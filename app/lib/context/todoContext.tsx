'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
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
  addTodo: (todo: Omit<Todo, 'id'>) => Promise<string>;
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
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

  const fetchTodos = useCallback(async () => {
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
            dueDate: data.dueDate?.toDate?.() || (data.dueDate ? new Date(data.dueDate) : null),
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
  }, [user]);

  useEffect(() => {
    if (user) {
      const unsubscribe = fetchTodos();
      return () => {
        if (unsubscribe) {
          unsubscribe.then((unsub) => unsub());
        }
      };
    }
  }, [user, fetchTodos]);

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

  const addTodo = async (todoData: Omit<Todo, 'id'>) => {
    try {
      const docRef = await addDoc(collection(db, 'todos'), {
        ...todoData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding todo:', error);
      throw error;
    }
  };

  const updateTodo = async (id: string, updates: Partial<Todo>) => {
    try {
      const todoRef = doc(db, 'todos', id);
      await updateDoc(todoRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating todo:', error);
      throw error;
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'todos', id));
    } catch (error) {
      console.error('Error deleting todo:', error);
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
    addTodo,
    updateTodo,
    deleteTodo,
    refreshTodos,
  };

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
};
