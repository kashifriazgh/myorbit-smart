'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Goal, GoalStep, GoalStepStatus, StepCheckIn } from '../interface';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './userContext';

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
}

const GoalsContext = createContext<GoalsContextType | undefined>(undefined);

export const useGoals = () => {
  const context = useContext(GoalsContext);
  if (!context) {
    throw new Error('useGoals must be used within a GoalsProvider');
  }
  return context;
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
    // Fetch by single field to avoid composite index requirement.
    // We get status == 'In Progress' and then filter by authorId client-side where needed.
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
            // Keep Firestore Timestamp objects as-is for all date fields
            steps: data.steps || [],
          } as Goal);
        });
        setGoals(goalsData);
        setLoading(false);
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

  const calculateWeightedProgress = (steps: GoalStep[]) => {
    const completedWeight = steps.reduce((acc, step) => {
      return (
        acc +
        (step.status === GoalStepStatus.COMPLETED ? (step.weight ?? 1) : 0)
      );
    }, 0);
    const totalWeight = steps.reduce(
      (acc, step) => acc + (step.weight ?? 1),
      0,
    );
    return totalWeight > 0
      ? Math.round((completedWeight / totalWeight) * 100)
      : 0;
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
        endDate: stepData.endDate || new Date(),
        weight: stepData.weight ?? 1,
        effortEstimate: stepData.effortEstimate,
        dependsOn: stepData.dependsOn,
        recurrence: stepData.recurrence,
        checkIns: stepData.checkIns,
        linkedTodoIds: stepData.linkedTodoIds,
        completionRecord: stepData.completionRecord,
      };

      const updatedSteps = [...(goal.steps || []), newStep];
      const progress = calculateWeightedProgress(updatedSteps);

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
      const progress = calculateWeightedProgress(updatedSteps);

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

      const progress = calculateWeightedProgress(updatedSteps);

      await updateGoal(goalId, {
        steps: updatedSteps,
        progress,
        status: deriveStatusFromProgress(progress),
        completedAt: progress === 100 ? Timestamp.fromDate(new Date()) : null,
      });
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
      const progress = calculateWeightedProgress(updatedSteps);

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

  const deleteGoalStep = async (
    goalId: string,
    stepId: string,
  ): Promise<void> => {
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('Goal not found');

      const updatedSteps = goal.steps.filter((step) => step.id !== stepId);
      const progress = calculateWeightedProgress(updatedSteps);

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
      const dueDate =
        goal.dueDate instanceof Date ? goal.dueDate : goal.dueDate.toDate();
      return dueDate < now && goal.status !== 'Completed';
    });
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
    updateGoalStep,
    deleteGoalStep,
    addGoalStep,
    reorderGoalSteps,
    addStepCheckIn,
    getGoalsByType,
    getGoalsByStatus,
    getOverdueGoals,
  };

  return (
    <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>
  );
};
