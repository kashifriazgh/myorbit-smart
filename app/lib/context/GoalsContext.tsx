'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Goal, GoalStep, GoalStepStatus, StepCheckIn, GoalTracker, TrackerCheckIn } from '../interface';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './userContext';
import { loadGoalsCache, saveGoalsCache, clearGoalsCache } from '../utils/goalsCache';
import { deleteSchedule, updateSchedule } from '../functions/schedules';
import { invalidateTodosCache } from '../utils/todosCache';
import { invalidateSchedulesCache } from '../utils/schedulesCache';

interface GoalsContextType {
  goals: Goal[];
  loading: boolean;
  error: string | null;
  addGoal: (
    goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<string>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  updateGoalProgress: (id: string, progress: number) => Promise<void>;
  updateStepStatus: (
    goalId: string,
    stepId: string,
    status: GoalStepStatus,
    completionData?: {
      finalValue?: number;
      finalNote?: string;
    },
  ) => Promise<void>;
  updateLinkedItemStatusInGoal: (
    linkedGoalId: string,
    linkedItemId: string,
    linkedType: 'schedule' | 'todo' | 'finance_source',
    isCompleted: boolean,
  ) => Promise<void>;
  addGoalStep: (goalId: string, step: Partial<GoalStep>) => Promise<void>;
  updateGoalStep: (
    goalId: string,
    stepId: string,
    updates: Partial<GoalStep>,
  ) => Promise<void>;
  deleteGoalStep: (goalId: string, stepId: string) => Promise<void>;
  reorderGoalSteps: (goalId: string, orderedStepIds: string[]) => Promise<void>;
  addStepCheckIn: (
    goalId: string,
    stepId: string,
    checkIn: StepCheckIn,
  ) => Promise<void>;
  getGoalsByType: (type: Goal['type']) => Goal[];
  getGoalsByStatus: (status: Goal['status']) => Goal[];
  getOverdueGoals: () => Goal[];
  saveGoalTracker: (goalId: string, tracker: GoalTracker) => Promise<void>;
  addTrackerCheckIn: (goalId: string, checkIn: TrackerCheckIn) => Promise<void>;
  removeGoalTracker: (goalId: string) => Promise<void>;
}

const GoalsContext = createContext<GoalsContextType | undefined>(undefined);

export const useGoals = () => {
  const context = useContext(GoalsContext);
  if (!context) {
    throw new Error('useGoals must be used within a GoalsProvider');
  }
  return context;
};

export const calculateGoalProgress = (goal: Goal, extraContributedValue: number = 0): number => {
  const isOpposes = goal.progressTrackingType === 'opposes' || goal.progressMode === 'current_value';

  if (isOpposes) {
    const start = typeof goal.startingValue === 'number' ? goal.startingValue : (goal.startValue ?? 0);
    const target = goal.overallTargetValue ?? 0;
    if (start === target) return 0;

    let latestValue = start;

    if (goal.trackerEnabled && goal.tracker) {
      const completedCheckIns = [...goal.tracker.checkIns]
        .filter((c) => c.completed && typeof c.value === 'number')
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
      if (completedCheckIns.length > 0) {
        latestValue = completedCheckIns[completedCheckIns.length - 1].value!;
      }
    } else {
      const completedSteps = [...(goal.steps || [])]
        .filter((s) => s.status === GoalStepStatus.COMPLETED)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (completedSteps.length > 0) {
        const latestStep = completedSteps[completedSteps.length - 1];
        latestValue = latestStep.actualValue ?? latestStep.targetValue ?? start;
      }
    }

    const dirStr = String(goal.direction || '').toLowerCase();
    let pct = 0;
    if (dirStr === 'down') {
      pct = Math.round(((start - latestValue) / (start - target)) * 100);
    } else {
      pct = Math.round(((latestValue - start) / (target - start)) * 100);
    }
    return Math.max(0, Math.min(100, pct));
  } else {
    // ── Accumulative Mode ──
    const targetVal = goal.overallTargetValue ?? 0;
    const steps = goal.steps || [];

    if (targetVal > 0) {
      const completedContributedSum = steps.reduce((sum, s) => {
        if (s.status === GoalStepStatus.COMPLETED) {
          const isContributive = s.role === 'contributive' || s.role === undefined;
          if (isContributive) {
            const amt = typeof s.contributionAmount === 'number' && s.contributionAmount > 0
              ? s.contributionAmount
              : (typeof s.targetValue === 'number' && s.targetValue > 0 ? s.targetValue : 0);
            return sum + amt;
          }
        }
        return sum;
      }, extraContributedValue);

      const rawPct = (completedContributedSum / targetVal) * 100;
      let pct = 0;
      if (rawPct > 0 && rawPct < 1) {
        pct = Number(rawPct.toFixed(1));
      } else {
        pct = Math.round(rawPct);
      }
      return Math.max(0, Math.min(100, pct));
    }

    if (goal.trackerEnabled && goal.tracker) {
      const hasUnit = !!goal.tracker.unit;
      const doneCheckIns = goal.tracker.checkIns.filter((c) => c.completed);
      const actualTotal = hasUnit
        ? doneCheckIns.reduce((s, c) => s + (c.value ?? 0), 0)
        : doneCheckIns.length;
      const denominator = hasUnit ? goal.tracker.totalTarget : goal.tracker.totalCheckIns;
      return denominator > 0 ? Math.min(100, Math.round((actualTotal / denominator) * 100)) : 0;
    } else {
      // Fallback: Milestones cumulative weighted progress when overallTargetValue is 0
      const completedWeight = steps.reduce((acc, step) => {
        return (
          acc + (step.status === GoalStepStatus.COMPLETED ? (step.weight ?? 1) : 0)
        );
      }, 0);
      const totalWeight = steps.reduce(
        (acc, step) => acc + (step.weight ?? 1),
        0,
      );
      return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    }
  }
};

export const GoalsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setGoals([]);
      setLoading(false);
      clearGoalsCache();
      return;
    }

    // Try cache first for immediate rendering
    const cached = loadGoalsCache(userId);
    if (cached) {
      console.log(`%c[GoalCache] 📦 Loaded ${cached.length} goals from localStorage cache`, 'color:#6366f1;font-weight:bold');
      setGoals(cached);
      setLoading(false);
    }

    // Fetch by single field to avoid composite index requirement.
    const goalsRef = collection(db, 'goals');
    const q = query(
      goalsRef,
      where('status', 'in', ['In Progress', 'Not Started', 'Completed']),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const goalsData: Goal[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          goalsData.push({
            id: doc.id,
            ...data,
            steps: data.steps || [],
          } as Goal);
        });
        setGoals(goalsData);
        setLoading(false);
        saveGoalsCache(goalsData, userId);
        console.log(`%c[GoalCache] ✅ Saved ${goalsData.length} goals to cache`, 'color:#22c55e;font-weight:bold');
      },
      (err) => {
        console.error('Error fetching goals:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userId]);

  const toDateSafe = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: unknown }).toDate === 'function'
    ) {
      return (value as { toDate: () => Date }).toDate();
    }
    if (
      typeof value === 'object' &&
      value !== null &&
      'seconds' in value &&
      'nanoseconds' in value
    ) {
      const { seconds, nanoseconds } = value as {
        seconds: number;
        nanoseconds: number;
      };
      return new Date(seconds * 1000 + nanoseconds / 1_000_000);
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  const addGoalStep = async (
    goalId: string,
    stepData: Partial<GoalStep>,
  ): Promise<void> => {
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('Goal not found');

      const nextOrder =
        Math.max(0, ...(goal.steps || []).map((step) => step.order)) + 1;
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const defaultStatus = stepData.status ?? GoalStepStatus.IN_PROGRESS;
      const newStep: GoalStep = {
        id,
        title: stepData.title?.trim() || 'New milestone',
        description: stepData.description,
        order: stepData.order ?? nextOrder,
        status: defaultStatus,
        targetValue: stepData.targetValue,
        actualValue: stepData.actualValue,
        unit: stepData.unit,
        startDate:
          stepData.startDate ??
          (defaultStatus === GoalStepStatus.IN_PROGRESS
            ? new Date()
            : undefined),
        endDate: stepData.endDate || null,
        weight: stepData.weight ?? 1,
        effortEstimate: stepData.effortEstimate,
        dependsOn: stepData.dependsOn,
        recurrence: stepData.recurrence,
        checkIns: stepData.checkIns,
        linkedTodoIds: stepData.linkedTodoIds,
        completionRecord: stepData.completionRecord,
        role: stepData.role,
        contributionAmount: stepData.contributionAmount,
        contributionUnit: stepData.contributionUnit,
        linkedType: stepData.linkedType,
        linkedItemId: stepData.linkedItemId,
      };

      const updatedSteps = [...(goal.steps || []), newStep];
      const progress = calculateGoalProgress({ ...goal, steps: updatedSteps });

      await updateGoal(goalId, {
        steps: updatedSteps,
        progress,
        status: deriveStatusFromProgress(progress),
      });
    } catch (err) {
      console.error('Error adding goal step:', err);
      throw err;
    }
  };

  const reorderGoalSteps = async (
    goalId: string,
    orderedStepIds: string[],
  ): Promise<void> => {
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('Goal not found');

      const stepsById = new Map(goal.steps.map((step) => [step.id, step]));
      const updatedSteps = orderedStepIds
        .map((stepId, index) => {
          const step = stepsById.get(stepId);
          return step
            ? {
                ...step,
                order: index + 1,
              }
            : null;
        })
        .filter((step): step is GoalStep => step !== null);

      await updateGoal(goalId, { steps: updatedSteps });
    } catch (err) {
      console.error('Error reordering goal steps:', err);
      throw err;
    }
  };

  const addStepCheckIn = async (
    goalId: string,
    stepId: string,
    checkIn: StepCheckIn,
  ): Promise<void> => {
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('Goal not found');

      const updatedSteps = goal.steps.map((step) => {
        if (step.id !== stepId) return step;
        const newCheckIns = [...(step.checkIns || []), checkIn];
        return {
          ...step,
          checkIns: newCheckIns,
          actualValue:
            typeof checkIn.value === 'number'
              ? checkIn.value
              : step.actualValue,
        };
      });
      const progress = calculateGoalProgress({ ...goal, steps: updatedSteps });

      await updateGoal(goalId, {
        steps: updatedSteps,
        progress,
        status: deriveStatusFromProgress(progress),
      });
    } catch (err) {
      console.error('Error adding step check-in:', err);
      throw err;
    }
  };

  const deriveStatusFromProgress = (progress: number): Goal['status'] => {
    if (progress >= 100) return 'Completed';
    if (progress > 0) return 'In Progress';
    return 'Not Started';
  };

  const addGoal = async (
    goalData: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> => {
    try {
      const isTimestampLike = (v: unknown): v is { toDate: () => Date } => {
        if (typeof v !== 'object' || v === null) return false;
        const maybe = v as { toDate?: unknown };
        return typeof maybe.toDate === 'function';
      };
      const toDateSafe = (v: unknown): Date | undefined => {
        if (!v) return undefined;
        if (v instanceof Date) return v;
        if (isTimestampLike(v)) return v.toDate();
        if (typeof v !== 'string' && typeof v !== 'number') return undefined;
        const d = new Date(v as string | number);
        return isNaN(d.getTime()) ? undefined : d;
      };
      const sanitizeObject = (obj: unknown): unknown => {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) return obj.map(sanitizeObject);
        if (typeof obj === 'object') {
          const out: Record<string, unknown> = {};
          Object.keys(obj as Record<string, unknown>).forEach((k) => {
            const v = (obj as Record<string, unknown>)[k];
            if (v === undefined) return; // skip undefined fields
            out[k] = sanitizeObject(v);
          });
          return out;
        }
        return obj;
      };
      const now = new Date();
      const goalWithTimestamps = sanitizeObject({
        ...goalData,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        dueDate: Timestamp.fromDate(toDateSafe(goalData.dueDate) || now),
        steps: (goalData.steps || []).map((step) => {
          const normalized: Record<string, unknown> = {
            ...step,
            startDate: step.startDate
              ? Timestamp.fromDate(toDateSafe(step.startDate)!)
              : undefined,
            endDate: step.endDate
              ? Timestamp.fromDate(toDateSafe(step.endDate)!)
              : undefined,
          };

          if (step.recurrence?.recurrenceEndDate) {
            normalized.recurrence = {
              ...step.recurrence,
              recurrenceEndDate: Timestamp.fromDate(
                toDateSafe(step.recurrence.recurrenceEndDate)!,
              ),
            };
          }

          if (step.checkIns) {
            normalized.checkIns = step.checkIns.map((checkIn) => ({
              ...checkIn,
              date: Timestamp.fromDate(toDateSafe(checkIn.date)!),
            }));
          }

          if (step.completionRecord) {
            normalized.completionRecord = {
              ...step.completionRecord,
              completedAt: Timestamp.fromDate(
                toDateSafe(step.completionRecord.completedAt)!,
              ),
            };
          }

          return normalized;
        }),
      });

      const docRef = await addDoc(collection(db, 'goals'), goalWithTimestamps);
      return docRef.id;
    } catch (err) {
      console.error('Error adding goal:', err);
      throw err;
    }
  };

  const updateGoal = async (
    id: string,
    updates: Partial<Goal>,
  ): Promise<void> => {
    try {
      const goalRef = doc(db, 'goals', id);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      const removeUndefined = (value: unknown): unknown => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        if (Array.isArray(value)) return value.map(removeUndefined);
        if (typeof value === 'object' && value !== null) {
          const result: Record<string, unknown> = {};
          Object.entries(value as Record<string, unknown>).forEach(
            ([key, val]) => {
              const cleaned = removeUndefined(val);
              if (cleaned !== undefined) {
                result[key] = cleaned;
              }
            },
          );
          return result;
        }
        return value;
      };

      // Handle date fields
      if (updates.dueDate) {
        updateData.dueDate =
          updates.dueDate instanceof Date
            ? Timestamp.fromDate(updates.dueDate)
            : updates.dueDate;
      }
      if (updates.completedAt) {
        updateData.completedAt =
          updates.completedAt instanceof Date
            ? Timestamp.fromDate(updates.completedAt)
            : updates.completedAt;
      }
      if (updates.steps) {
        updateData.steps = updates.steps.map((step) => ({
          ...step,
          startDate:
            step.startDate instanceof Date
              ? Timestamp.fromDate(step.startDate)
              : step.startDate,
          endDate:
            step.endDate instanceof Date
              ? Timestamp.fromDate(step.endDate)
              : step.endDate,
          recurrence: step.recurrence
            ? {
                ...step.recurrence,
                recurrenceEndDate:
                  step.recurrence.recurrenceEndDate instanceof Date
                    ? Timestamp.fromDate(step.recurrence.recurrenceEndDate)
                    : step.recurrence.recurrenceEndDate,
              }
            : undefined,
          checkIns: step.checkIns?.map((checkIn) => ({
            ...checkIn,
            date:
              checkIn.date instanceof Date
                ? Timestamp.fromDate(checkIn.date)
                : checkIn.date,
          })),
          completionRecord: step.completionRecord
            ? {
                ...step.completionRecord,
                completedAt:
                  step.completionRecord.completedAt instanceof Date
                    ? Timestamp.fromDate(step.completionRecord.completedAt)
                    : step.completionRecord.completedAt,
              }
            : undefined,
        }));
      }

      const sanitizedUpdateData = removeUndefined(updateData);
      await updateDoc(goalRef, sanitizedUpdateData as Record<string, unknown>);
    } catch (err) {
      console.error('Error updating goal:', err);
      throw err;
    }
  };

  const deleteGoal = async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'goals', id));
    } catch (err) {
      console.error('Error deleting goal:', err);
      throw err;
    }
  };

  const updateGoalProgress = async (
    id: string,
    progress: number,
  ): Promise<void> => {
    try {
      const goalRef = doc(db, 'goals', id);
      await updateDoc(goalRef, {
        progress,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (err) {
      console.error('Error updating goal progress:', err);
      throw err;
    }
  };

  const updateStepStatus = async (
    goalId: string,
    stepId: string,
    status: GoalStepStatus,
    completionData?: {
      finalValue?: number;
      finalNote?: string;
    },
  ): Promise<void> => {
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('Goal not found');

      const updatedSteps = goal.steps.map((step) => {
        if (step.id !== stepId) return step;
        const nextStep: GoalStep = {
          ...step,
          status,
          completionRecord:
            status === GoalStepStatus.COMPLETED
              ? {
                  ...(step.completionRecord ?? {}),
                  completedAt:
                    step.completionRecord?.completedAt instanceof Date
                      ? step.completionRecord.completedAt
                      : (step.completionRecord?.completedAt ??
                        Timestamp.fromDate(new Date())),
                  finalValue:
                    completionData?.finalValue ??
                    step.completionRecord?.finalValue,
                  finalNote:
                    completionData?.finalNote ??
                    step.completionRecord?.finalNote,
                  totalCheckIns: step.checkIns?.length ?? 0,
                  durationDays: (() => {
                    const startDate = toDateSafe(step.startDate);
                    if (!startDate) return step.completionRecord?.durationDays;
                    return Math.max(
                      0,
                      Math.ceil(
                        (Date.now() - startDate.getTime()) /
                          (24 * 60 * 60 * 1000),
                      ),
                    );
                  })(),
                }
              : step.completionRecord,
        };
        return nextStep;
      });

      const progress = calculateGoalProgress({ ...goal, steps: updatedSteps });

      await updateGoal(goalId, {
        steps: updatedSteps,
        progress,
        status: deriveStatusFromProgress(progress),
        completedAt: progress === 100 ? Timestamp.fromDate(new Date()) : null,
      });

      // Synchronize status back to linked Todo or Schedule
      const targetStep = (goal.steps || []).find((s) => s.id === stepId);
      if (targetStep && targetStep.linkedItemId) {
        const isDone = status === GoalStepStatus.COMPLETED;
        if (targetStep.linkedType === 'todo') {
          await updateDoc(doc(db, 'todos', targetStep.linkedItemId), {
            status: isDone ? 'completed' : 'in_progress',
            done: isDone,
            progressPercent: isDone ? 100 : 0,
            updatedAt: new Date(),
          }).catch((e) => console.warn('Failed to sync todo status:', e));
          invalidateTodosCache();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('orbit_todo_updated', {
                detail: { id: targetStep.linkedItemId, isDone },
              }),
            );
          }
        } else if (targetStep.linkedType === 'schedule') {
          await updateSchedule(targetStep.linkedItemId, {
            status: isDone ? 'completed' : 'pending',
          }).catch((e) => console.warn('Failed to sync schedule status:', e));
          invalidateSchedulesCache();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('orbit_schedule_updated', {
                detail: { id: targetStep.linkedItemId, isDone },
              }),
            );
          }
        }
      }
    } catch (err) {
      console.error('Error updating step status:', err);
      throw err;
    }
  };

  const updateGoalStep = async (
    goalId: string,
    stepId: string,
    updates: Partial<GoalStep>,
  ): Promise<void> => {
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('Goal not found');

      const updatedSteps = goal.steps.map((step) =>
        step.id !== stepId ? step : { ...step, ...updates },
      );
      const progress = calculateGoalProgress({ ...goal, steps: updatedSteps });

      await updateGoal(goalId, {
        steps: updatedSteps,
        progress,
        status: deriveStatusFromProgress(progress),
        completedAt: progress === 100 ? Timestamp.fromDate(new Date()) : null,
      });
    } catch (err) {
      console.error('Error updating goal step:', err);
      throw err;
    }
  };

  const updateLinkedItemStatusInGoal = async (
    linkedGoalId: string,
    linkedItemId: string,
    linkedType: 'schedule' | 'todo' | 'finance_source',
    isCompleted: boolean,
  ): Promise<void> => {
    try {
      const goal = goals.find((g) => g.id === linkedGoalId);
      if (!goal) return;

      const targetStep = (goal.steps || []).find(
        (s) => s.linkedItemId === linkedItemId || (s.linkedType === linkedType && s.linkedItemId === linkedItemId)
      );

      if (!targetStep) return;

      const newStatus = isCompleted ? GoalStepStatus.COMPLETED : GoalStepStatus.IN_PROGRESS;
      if (targetStep.status === newStatus) return;

      const updatedSteps = goal.steps.map((step) => {
        if (step.id !== targetStep.id) return step;
        return {
          ...step,
          status: newStatus,
        };
      });

      const progress = calculateGoalProgress({ ...goal, steps: updatedSteps });

      await updateGoal(linkedGoalId, {
        steps: updatedSteps,
        progress,
        status: deriveStatusFromProgress(progress),
        completedAt: progress === 100 ? Timestamp.fromDate(new Date()) : null,
      });
    } catch (err) {
      console.warn('Failed to sync linked item status to goal:', err);
    }
  };

  const deleteGoalStep = async (
    goalId: string,
    stepId: string,
  ): Promise<void> => {
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('Goal not found');

      const targetStep = (goal.steps || []).find((step) => step.id === stepId);
      if (targetStep && targetStep.linkedItemId) {
        if (targetStep.linkedType === 'schedule') {
          await deleteSchedule(targetStep.linkedItemId).catch((e) => console.warn('Failed to delete linked schedule:', e));
        } else if (targetStep.linkedType === 'todo') {
          await deleteDoc(doc(db, 'todos', targetStep.linkedItemId)).catch((e) => console.warn('Failed to delete linked todo:', e));
        } else if (targetStep.linkedType === 'finance_source') {
          if (targetStep.linkedItemId) {
            await deleteDoc(doc(db, 'customPaymentHeads', targetStep.linkedItemId)).catch((e) => console.warn('Failed to delete custom payment head doc:', e));
          }
          if (user) {
            const snapshotRef = doc(db, 'totalCashSnapshots', user.uid);
            const snap = await getDoc(snapshotRef);
            if (snap.exists()) {
              const data = snap.data();
              const customSources = typeof data?.sources?.custom === 'object' ? { ...data.sources.custom } : {};
              const srcName = targetStep.title.replace(/^Source of Fund:\s*/i, '').replace(/^Finance Fund:\s*/i, '').trim();
              if (customSources[srcName] !== undefined) {
                delete customSources[srcName];
                await updateDoc(snapshotRef, { 'sources.custom': customSources, updatedAt: new Date() });
              }
            }
          }
        }
      }

      const updatedSteps = goal.steps.filter((step) => step.id !== stepId);
      const progress = calculateGoalProgress({ ...goal, steps: updatedSteps });

      await updateGoal(goalId, {
        steps: updatedSteps,
        progress,
        status: deriveStatusFromProgress(progress),
        completedAt: progress === 100 ? Timestamp.fromDate(new Date()) : null,
      });
    } catch (err) {
      console.error('Error deleting goal step:', err);
      throw err;
    }
  };

  const getGoalsByType = (type: Goal['type']): Goal[] => {
    return goals.filter((goal) => goal.type === type);
  };

  const getGoalsByStatus = (status: Goal['status']): Goal[] => {
    return goals.filter((goal) => goal.status === status);
  };

  const getOverdueGoals = (): Goal[] => {
    const now = new Date();
    return goals.filter((goal) => {
      const dueDate = toDateSafe(goal.dueDate);
      if (!dueDate) return false;
      return dueDate < now && goal.status !== 'Completed';
    });
  };

  const saveGoalTracker = async (goalId: string, tracker: GoalTracker): Promise<void> => {
    try {
      await updateGoal(goalId, { trackerEnabled: true, tracker });
    } catch (err) {
      console.error('Error saving tracker:', err);
      throw err;
    }
  };

  const addTrackerCheckIn = async (goalId: string, updated: TrackerCheckIn): Promise<void> => {
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal?.tracker) throw new Error('No tracker found');
      const checkIns = goal.tracker.checkIns.map((c) =>
        c.id === updated.id ? updated : c
      );
      const updatedGoal: Goal = {
        ...goal,
        tracker: { ...goal.tracker, checkIns },
      };
      const progress = calculateGoalProgress(updatedGoal);
      await updateGoal(goalId, {
        tracker: { ...goal.tracker, checkIns },
        progress,
        status: deriveStatusFromProgress(progress),
      });
    } catch (err) {
      console.error('Error adding tracker check-in:', err);
      throw err;
    }
  };

  const removeGoalTracker = async (goalId: string): Promise<void> => {
    try {
      await updateGoal(goalId, { trackerEnabled: false, tracker: null });
    } catch (err) {
      console.error('Error removing tracker:', err);
      throw err;
    }
  };

  const value: GoalsContextType = {
    goals,
    loading,
    error,
    addGoal,
    updateGoal,
    deleteGoal,
    updateGoalProgress,
    updateStepStatus,
    updateLinkedItemStatusInGoal,
    updateGoalStep,
    deleteGoalStep,
    addGoalStep,
    reorderGoalSteps,
    addStepCheckIn,
    getGoalsByType,
    getGoalsByStatus,
    getOverdueGoals,
    saveGoalTracker,
    addTrackerCheckIn,
    removeGoalTracker,
  };

  return (
    <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>
  );
};
