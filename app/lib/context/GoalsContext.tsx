'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Goal } from '../interface';
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

interface GoalsContextType {
  goals: Goal[];
  loading: boolean;
  error: string | null;
  addGoal: (
    goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<string>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  updateGoalProgress: (id: string, progress: number) => Promise<void>;
  updateStepStatus: (
    goalId: string,
    stepId: string,
    completed: boolean
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

interface GoalsProviderProps {
  children: ReactNode;
  userId: string;
}

export const GoalsProvider: React.FC<GoalsProviderProps> = ({
  children,
  userId,
}) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch by single field to avoid composite index requirement.
    // We get status == 'In Progress' and then filter by authorId client-side where needed.
    const goalsRef = collection(db, 'goals');
    const q = query(
      goalsRef,
      where('status', 'in', ['In Progress', 'Not Started'])
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
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const addGoal = async (
    goalData: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>
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
        steps: goalData.steps.map((step) => ({
          ...step,
          startDate: step.startDate
            ? Timestamp.fromDate(toDateSafe(step.startDate)!)
            : undefined,
          endDate: step.endDate
            ? Timestamp.fromDate(toDateSafe(step.endDate)!)
            : undefined,
        })),
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
    updates: Partial<Goal>
  ): Promise<void> => {
    try {
      const goalRef = doc(db, 'goals', id);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
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
        }));
      }

      await updateDoc(goalRef, updateData);
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
    progress: number
  ): Promise<void> => {
    try {
      const goalRef = doc(db, 'goals', id);
      const completedSteps =
        goals.find((g) => g.id === id)?.steps.filter((s) => s.completed)
          .length || 0;
      const totalSteps = goals.find((g) => g.id === id)?.steps.length || 1;
      const calculatedProgress = Math.round(
        (completedSteps / totalSteps) * 100
      );

      await updateDoc(goalRef, {
        progress: Math.max(progress, calculatedProgress),
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
    completed: boolean
  ): Promise<void> => {
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('Goal not found');

      const updatedSteps = goal.steps.map((step) =>
        step.id === stepId ? { ...step, completed } : step
      );

      const completedSteps = updatedSteps.filter((s) => s.completed).length;
      const totalSteps = updatedSteps.length;
      const newProgress =
        totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      await updateGoal(goalId, {
        steps: updatedSteps,
        progress: newProgress,
        status:
          newProgress === 100
            ? 'Completed'
            : newProgress > 0
            ? 'In Progress'
            : 'Not Started',
        completedAt: newProgress === 100 ? new Date() : null,
      });
    } catch (err) {
      console.error('Error updating step status:', err);
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
    getGoalsByType,
    getGoalsByStatus,
    getOverdueGoals,
  };

  return (
    <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>
  );
};
