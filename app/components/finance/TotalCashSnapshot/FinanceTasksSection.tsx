'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ListTodo,
} from 'lucide-react';
import { FinanceTask } from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';

interface FinanceTasksSectionProps {
  userId: string;
}

const DEFAULT_TASKS = [
  { title: 'Pay electricity bill', completed: false },
  { title: 'Review monthly expenses', completed: false },
  { title: 'Check bank balance', completed: true },
  { title: 'Transfer savings to emergency fund', completed: false },
];

export default function FinanceTasksSection({ userId }: FinanceTasksSectionProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const [tasks, setTasks] = useState<FinanceTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Load tasks from Firestore
  useEffect(() => {
    if (!userId) return;
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'financeTasks'), where('userId', '==', userId));
        const snap = await getDocs(q);
        const list: FinanceTask[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FinanceTask, 'id'>),
        }));

        if (list.length === 0) {
          // Initialize with default tasks
          const createdList: FinanceTask[] = [];
          for (const t of DEFAULT_TASKS) {
            const docRef = await addDoc(collection(db, 'financeTasks'), {
              userId,
              title: t.title,
              completed: t.completed,
              createdAt: serverTimestamp(),
            });
            createdList.push({ id: docRef.id, userId, title: t.title, completed: t.completed });
          }
          setTasks(createdList);
        } else {
          setTasks(list);
        }
      } catch (e) {
        console.warn('Error fetching tasks, falling back to local defaults:', e);
        // Fallback to local default tasks
        setTasks(
          DEFAULT_TASKS.map((t, idx) => ({
            id: `local_${idx}`,
            userId,
            title: t.title,
            completed: t.completed,
          }))
        );
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [userId]);

  const handleToggleTask = async (task: FinanceTask) => {
    const newStatus = !task.completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: newStatus } : t))
    );

    if (task.id && !task.id.startsWith('local_')) {
      try {
        await updateDoc(doc(db, 'financeTasks', task.id), {
          completed: newStatus,
        });
      } catch (e) {
        console.error('Failed to update task:', e);
      }
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !userId) return;
    setAdding(true);
    try {
      const cleanTitle = newTaskTitle.trim();
      const newTaskData = {
        userId,
        title: cleanTitle,
        completed: false,
      };

      const docRef = await addDoc(collection(db, 'financeTasks'), {
        ...newTaskData,
        createdAt: serverTimestamp(),
      });

      setTasks((prev) => [{ id: docRef.id, ...newTaskData }, ...prev]);
      setNewTaskTitle('');
    } catch (e) {
      console.error('Failed to add task:', e);
      // Local fallback
      setTasks((prev) => [
        { id: `local_${Date.now()}`, userId, title: newTaskTitle.trim(), completed: false },
        ...prev,
      ]);
      setNewTaskTitle('');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteTask = async (id?: string) => {
    if (!id) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (!id.startsWith('local_')) {
      try {
        await deleteDoc(doc(db, 'financeTasks', id));
      } catch (e) {
        console.error('Failed to delete task:', e);
      }
    }
  };

  const remaining = tasks.filter((t) => !t.completed).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Top Banner */}
      <div
        className={`border rounded-2xl p-4 flex items-center justify-between ${
          isDark ? 'bg-[#121824] border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
              isDark
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                : 'bg-blue-50 text-blue-600 border-blue-200'
            }`}
          >
            <ListTodo size={17} />
          </div>
          <div>
            <h3
              className={`text-sm font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Financial To-Dos
            </h3>
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {remaining === 0 ? 'All tasks completed! 🎉' : `${remaining} task${remaining > 1 ? 's' : ''} remaining`}
            </span>
          </div>
        </div>

        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            isDark
              ? 'bg-slate-800 border-white/10 text-slate-300'
              : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}
        >
          {tasks.filter((t) => t.completed).length} / {tasks.length} Done
        </span>
      </div>

      {/* Add Task Input Form */}
      <form onSubmit={handleAddTask} className="flex items-center gap-2">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add a financial task (e.g., Pay Wi-Fi bill, Check statement)…"
          className={`flex-1 px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${
            isDark
              ? 'bg-[#121824] border-white/10 text-white placeholder-slate-500'
              : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
          }`}
        />
        <button
          type="submit"
          disabled={adding || !newTaskTitle.trim()}
          className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          <Plus size={15} />
          <span>Add</span>
        </button>
      </form>

      {/* Task List */}
      <div className="flex flex-col gap-2 mt-1">
        {loading ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading to-dos…</div>
        ) : tasks.length === 0 ? (
          <div
            className={`py-6 text-center text-xs text-slate-500 rounded-2xl border ${
              isDark ? 'bg-slate-900/30 border-white/5' : 'bg-white border-slate-200'
            }`}
          >
            No financial to-dos yet. Add one above!
          </div>
        ) : (
          tasks.map((task) => {
            return (
              <div
                key={task.id}
                className={`border rounded-2xl p-3 flex items-center justify-between gap-3 transition-all ${
                  task.completed
                    ? isDark
                      ? 'border-white/5 bg-slate-900/40 opacity-70'
                      : 'border-slate-200/70 bg-slate-50 opacity-75'
                    : isDark
                    ? 'bg-[#121824] border-white/10 hover:border-white/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleTask(task)}
                  className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                >
                  <div className="shrink-0 text-slate-400 hover:text-blue-500 transition-colors">
                    {task.completed ? (
                      <CheckCircle2 size={19} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                    ) : (
                      <Circle size={19} className={isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} />
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium truncate ${
                      task.completed
                        ? 'line-through text-slate-500'
                        : isDark
                        ? 'text-slate-200'
                        : 'text-slate-800'
                    }`}
                  >
                    {task.title}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Delete task"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
