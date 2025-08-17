'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { Todo } from '@/app/lib/interface';
import { useAuth } from './userContext';

interface TodoContextType {
  todos: Todo[];
  loading: boolean;
  updateStepStatus: (
    todoId: string,
    stepIndex: number,
    newStatus: string
  ) => Promise<void>;
  updateSubStepStatus: (
    todoId: string,
    stepIndex: number,
    subIndex: number,
    done: boolean
  ) => Promise<void>;
  refreshTodos: () => void;
}

const TodoContext = createContext<TodoContextType | undefined>(undefined);

export const useTodoContext = () => {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodoContext must be used within a TodoProvider');
  }
  return context;
};

export const TodoProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodos = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'todos'),
        where('authorId', '==', user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedTodos: Todo[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...(data as Todo),
            id: doc.id,
            dueDate: data.dueDate?.toDate?.() || new Date(data.dueDate),
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
          };
        });

        setTodos(fetchedTodos);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching todos:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const unsubscribe = fetchTodos();
      return () => {
        if (unsubscribe) {
          unsubscribe.then((unsub) => unsub());
        }
      };
    }
  }, [user]);

  const updateStepStatus = async (
    todoId: string,
    stepIndex: number,
    newStatus: string
  ) => {
    try {
      const todoRef = doc(db, 'todos', todoId);
      const todo = todos.find((t) => t.id === todoId);

      if (!todo || !todo.steps) return;

      const updatedSteps = [...todo.steps];
      updatedSteps[stepIndex].status = newStatus as
        | 'in_progress'
        | 'completed'
        | 'hold'
        | 'left-over';

      // Also update the 'done' field for consistency
      updatedSteps[stepIndex].done = newStatus === 'completed';

      await updateDoc(todoRef, {
        steps: updatedSteps,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating step status:', error);
      throw error;
    }
  };

  const updateSubStepStatus = async (
    todoId: string,
    stepIndex: number,
    subIndex: number,
    done: boolean
  ) => {
    try {
      const todoRef = doc(db, 'todos', todoId);
      const todo = todos.find((t) => t.id === todoId);

      if (!todo || !todo.steps) return;

      const updatedSteps = [...todo.steps];
      if (updatedSteps[stepIndex].subSteps) {
        updatedSteps[stepIndex].subSteps![subIndex].done = done;
        updatedSteps[stepIndex].subSteps![subIndex].status = done
          ? 'completed'
          : 'in_progress';
      }

      await updateDoc(todoRef, {
        steps: updatedSteps,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating substep status:', error);
      throw error;
    }
  };

  const refreshTodos = () => {
    fetchTodos();
  };

  const value: TodoContextType = {
    todos,
    loading,
    updateStepStatus,
    updateSubStepStatus,
    refreshTodos,
  };

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
};
