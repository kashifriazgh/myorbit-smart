'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Modal,
  Fade,
  Collapse,
  Chip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import GoalTaskCreator from '@/app/components/goals/GoalTaskCreator';


export interface StrategyActionItem {
  id: string;
  task: string;
  done: boolean;
  sourceId?: string;
  sourceName?: string;
  assumedContributionValue?: number;
  kind?: 'schedule' | 'todo';
  dueDate?: string;
  time?: string;
  assignee?: string;
  scheduleId?: string;
  todoId?: string;
}

export interface StrategyTasksSectionProps {
  goal: Goal;
  actions: StrategyActionItem[];
  onSaveActions: (updatedActions: StrategyActionItem[]) => Promise<void>;
  title?: string;
  description?: string;
  placeholder?: string;
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export default function StrategyTasksSection({
  goal,
  actions,
  onSaveActions,
  title: _title = '🎯 Strategy Tasks & Action Steps',
  description: _description = 'Break down this goal into actionable steps, routines, and linked schedules or todo tasks.',
  placeholder = '+ Add a strategy task (e.g., daily session, review checkpoint)…',
}: StrategyTasksSectionProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo, deleteTodo } = useTodoContext();
  const { allSchedules, addSchedule, editSchedule, removeSchedule } = useSchedules();

  const todayStr = useMemo(() => getTodayStr(), []);

  // Sync actions state real-time with linked schedule or todo status
  const syncedActions = useMemo(() => {
    return actions.map((act) => {
      let isDone = act.done;
      if (act.scheduleId) {
        const foundSched = allSchedules.find((s) => s.id === act.scheduleId);
        if (foundSched) isDone = foundSched.status === 'completed';
      } else if (act.todoId) {
        const foundTodo = todos.find((t) => t.id === act.todoId);
        if (foundTodo) isDone = foundTodo.status === 'completed';
      }
      return isDone !== act.done ? { ...act, done: isDone } : act;
    });
  }, [actions, allSchedules, todos]);

  // Strategy Task Details Modal State
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<StrategyActionItem | null>(null);
  const [taskEditText, setTaskEditText] = useState('');
  const [taskEditAssumedVal, setTaskEditAssumedVal] = useState<number | ''>('');
  const [taskEditKind, setTaskEditKind] = useState<'none' | 'schedule' | 'todo'>('none');
  const [showConvertOptions, setShowConvertOptions] = useState(false);
  const [taskEditDate, setTaskEditDate] = useState(todayStr);
  const [taskEditStartTime, setTaskEditStartTime] = useState('09:00');
  const [taskEditEndTime, setTaskEditEndTime] = useState('09:30');
  const [taskEditTodoTime, setTaskEditTodoTime] = useState('');
  const [taskEditAssignee, setTaskEditAssignee] = useState('');
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);

  // Statistics
  const completedCount = useMemo(() => syncedActions.filter((a) => a.done).length, [syncedActions]);
  const progressPercent = useMemo(() => {
    if (syncedActions.length === 0) return 0;
    return Math.round((completedCount / syncedActions.length) * 100);
  }, [completedCount, syncedActions.length]);

  // Toggle Action Completion
  const handleToggleStepCompletion = async (step: StrategyActionItem) => {
    const nextDone = !step.done;
    const updated = syncedActions.map((s) => (s.id === step.id ? { ...s, done: nextDone } : s));
    await onSaveActions(updated);

    if (step.scheduleId && editSchedule) {
      await editSchedule(step.scheduleId, { status: nextDone ? 'completed' : 'pending' }).catch((e) => console.warn(e));
    }
    if (step.todoId && updateTodo) {
      await updateTodo(step.todoId, { status: nextDone ? 'completed' : 'in_progress' }).catch((e) => console.warn(e));
    }
  };

  // Add New Action Task
  const handleAddStep = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const newStep: StrategyActionItem = {
      id: 'step_' + Date.now(),
      task: trimmed,
      done: false,
    };
    const updated = [...syncedActions, newStep];
    await onSaveActions(updated);
  };

  // Delete Action Task
  const handleDeleteStep = async (stepId: string) => {
    const step = syncedActions.find((s) => s.id === stepId);
    if (step?.scheduleId && removeSchedule) {
      await removeSchedule(step.scheduleId, true).catch((err) => console.error(err));
    }
    if (step?.todoId && deleteTodo) {
      await deleteTodo(step.todoId, true).catch((err) => console.error(err));
    }
    const updated = syncedActions.filter((s) => s.id !== stepId);
    await onSaveActions(updated);
  };

  // Open Edit Details Modal
  const handleOpenTaskDetailModal = (step: StrategyActionItem) => {
    setActiveStep(step);
    setTaskEditText(step.task);
    setTaskEditAssumedVal(step.assumedContributionValue || '');
    const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
    setTaskEditKind(kind as 'none' | 'schedule' | 'todo');
    setShowConvertOptions(kind === 'schedule' || kind === 'todo');

    setTaskEditDate(step.dueDate || todayStr);
    setTaskEditStartTime(step.time || '09:00');
    setTaskEditEndTime('09:30');
    setTaskEditTodoTime(step.time || '');
    setTaskEditAssignee(step.assignee || '');
    setTaskModalOpen(true);
  };

  // Save Edit Details / Convert to Schedule or Todo
  const handleSaveTaskDetail = async () => {
    if (!activeStep || !taskEditText.trim()) return;
    setSavingTaskEdit(true);
    try {
      let updatedScheduleId = activeStep.scheduleId;
      let updatedTodoId = activeStep.todoId;
      const rawDate = taskEditDate || todayStr;
      const targetDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;

      if (taskEditKind === 'schedule') {
        if (updatedTodoId && deleteTodo) {
          await deleteTodo(updatedTodoId, true).catch((err) => console.error(err));
          updatedTodoId = undefined;
        }
        if (!updatedScheduleId) {
          if (addSchedule) {
            const created = await addSchedule({
              userId: user?.uid || '',
              title: taskEditText.trim(),
              date: targetDate,
              startTime: taskEditStartTime || '09:00',
              endTime: taskEditEndTime || '09:30',
              status: activeStep.done ? 'completed' : 'pending',
              linkedGoalId: goal.id,
              goalTitle: goal.title,
            });
            if (typeof created === 'string') updatedScheduleId = created;
            else if (created && typeof (created as { id?: string }).id === 'string') updatedScheduleId = (created as { id: string }).id;
          }
        } else if (editSchedule) {
          await editSchedule(updatedScheduleId, {
            title: taskEditText.trim(),
            date: targetDate,
            startTime: taskEditStartTime || '09:00',
            endTime: taskEditEndTime || '09:30',
          });
        }
      } else if (taskEditKind === 'todo') {
        if (updatedScheduleId && removeSchedule) {
          await removeSchedule(updatedScheduleId, true).catch((err) => console.error(err));
          updatedScheduleId = undefined;
        }
        if (!updatedTodoId) {
          if (addTodo) {
            const created = await addTodo({
              title: taskEditText.trim(),
              status: activeStep.done ? 'completed' : 'in_progress',
              priority: 'routine',
              projectId: goal.projectId || '',
              authorId: user?.uid || '',
              dueDate: new Date(targetDate),
              steps: [],
              tags: [],
              progressPercent: 0,
              assignedUsers: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              linkedGoalId: goal.id,
              goalTitle: goal.title,
            });
            if (typeof created === 'string') updatedTodoId = created;
            else if (created && typeof (created as { id?: string }).id === 'string') updatedTodoId = (created as { id: string }).id;
          }
        } else if (updateTodo) {
          await updateTodo(updatedTodoId, {
            title: taskEditText.trim(),
            dueDate: new Date(targetDate),
          });
        }
      } else {
        if (updatedScheduleId && removeSchedule) {
          await removeSchedule(updatedScheduleId, true).catch((err) => console.error(err));
          updatedScheduleId = undefined;
        }
        if (updatedTodoId && deleteTodo) {
          await deleteTodo(updatedTodoId, true).catch((err) => console.error(err));
          updatedTodoId = undefined;
        }
      }

      const updatedActions = syncedActions.map((s) => {
        if (s.id === activeStep.id) {
          return {
            ...s,
            task: taskEditText.trim(),
            assumedContributionValue: typeof taskEditAssumedVal === 'number' ? taskEditAssumedVal : undefined,
            kind: taskEditKind === 'none' ? undefined : taskEditKind,
            dueDate: targetDate,
            time: taskEditKind === 'schedule' ? taskEditStartTime : taskEditKind === 'todo' ? taskEditTodoTime : undefined,
            assignee: taskEditAssignee.trim() || undefined,
            scheduleId: updatedScheduleId,
            todoId: updatedTodoId,
          };
        }
        return s;
      });

      await onSaveActions(updatedActions);
      setTaskModalOpen(false);
    } catch (err) {
      console.error('Failed to save task detail:', err);
    } finally {
      setSavingTaskEdit(false);
    }
  };

  const cardBorder = isDark ? '#334155' : '#e2e8f0';

  return (
    <Box sx={{ mt: 3.5, pt: 3, mb: 4, borderTop: `1px solid ${cardBorder}` }}>
      {/* ── 1. STRATEGY TASK CREATOR ── */}
      <div className="mb-4">
        <GoalTaskCreator
          onAdd={handleAddStep}
          placeholder={placeholder}
          badge={
            syncedActions.length > 0 ? (
              <Chip
                label={`${completedCount}/${syncedActions.length} Done (${progressPercent}%)`}
                size="small"
                sx={{
                  bgcolor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe',
                  color: '#3b82f6',
                  fontWeight: 700,
                  fontSize: 11,
                }}
              />
            ) : undefined
          }
        />
      </div>

      {/* ── 3. TASKS LIST (Placed below input field) ── */}
      <div className="space-y-2 mb-3">
        {syncedActions.map((step) => {
          const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
          const hasLink = kind === 'schedule' || kind === 'todo';

          return (
            <div
              key={step.id}
              onClick={() => handleOpenTaskDetailModal(step)}
              className="group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Custom Animated Checkbox */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStepCompletion(step);
                  }}
                  className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0 ${
                    step.done
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
                  }`}
                >
                  {step.done && (
                    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 stroke-current stroke-[3]">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <span
                    className={`block text-xs font-bold truncate ${
                      step.done
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {step.task}
                  </span>

                  {(step.dueDate || step.time) && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                      {step.dueDate && <CalendarIcon sx={{ fontSize: 11 }} />}
                      {step.dueDate && step.dueDate}
                      {step.time && <TimeIcon sx={{ fontSize: 11, ml: 0.5 }} />}
                      {step.time && step.time}
                      {step.assignee && ` · Assignee: ${step.assignee}`}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Convert / Sync Badge */}
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                    hasLink
                      ? kind === 'schedule'
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                        : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }`}
                >
                  {kind === 'schedule'
                    ? '🗓 Schedule'
                    : kind === 'todo'
                    ? '✅ Todo'
                    : '+ Schedule/Todo'}
                </span>

                {/* Edit Icon */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenTaskDetailModal(step);
                  }}
                  className="p-1 text-slate-400 hover:text-blue-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit task details"
                >
                  <EditIcon sx={{ fontSize: 16 }} />
                </button>

                {/* Delete Icon */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteStep(step.id);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete task"
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </button>
              </div>
            </div>
          );
        })}

        {syncedActions.length === 0 && (
          <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 text-center">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              No strategy tasks added yet. Add action steps above to track execution!
            </p>
          </div>
        )}
      </div>

      {/* ── 4. STRATEGY TASK DETAIL & CONVERSION MODAL ── */}
      <Modal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        closeAfterTransition
      >
        <Fade in={taskModalOpen}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[28px] w-[90%] sm:w-[440px] shadow-2xl overflow-hidden border outline-none bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[1.05rem] font-extrabold text-slate-800 dark:text-slate-100">
                Strategy Task Details
              </p>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Task Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  Task Title / Strategy Step
                </label>
                <input
                  type="text"
                  value={taskEditText}
                  onChange={(e) => setTaskEditText(e.target.value)}
                  placeholder="e.g. Daily 20-min reading or exercise session"
                  className="w-full text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Conversion Toggle Section */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowConvertOptions(!showConvertOptions)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-blue-400 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🗓️</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {taskEditKind === 'schedule'
                          ? 'Converted to Schedule'
                          : taskEditKind === 'todo'
                          ? 'Converted to Todo'
                          : 'Convert to Schedule or Todo'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Sync status in real-time across app
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-blue-500 font-bold">
                    {showConvertOptions ? 'Hide' : 'Options'}
                  </span>
                </button>

                <Collapse in={showConvertOptions}>
                  <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('none')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                          taskEditKind === 'none'
                            ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Simple Task
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('schedule')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                          taskEditKind === 'schedule'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        🗓 Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('todo')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                          taskEditKind === 'todo'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        ✅ Todo
                      </button>
                    </div>

                    {(taskEditKind === 'schedule' || taskEditKind === 'todo') && (
                      <div className="space-y-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                            Due Date
                          </label>
                          <input
                            type="date"
                            value={taskEditDate}
                            onChange={(e) => setTaskEditDate(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        {taskEditKind === 'schedule' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={taskEditStartTime}
                                onChange={(e) => setTaskEditStartTime(e.target.value)}
                                className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={taskEditEndTime}
                                onChange={(e) => setTaskEditEndTime(e.target.value)}
                                className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                            Assignee (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Self or Username"
                            value={taskEditAssignee}
                            onChange={(e) => setTaskEditAssignee(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Collapse>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <button
                type="button"
                onClick={() => activeStep && handleDeleteStep(activeStep.id)}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 px-3 py-2 rounded-xl transition-colors"
              >
                Delete Task
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3.5 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingTaskEdit || !taskEditText.trim()}
                  onClick={handleSaveTaskDetail}
                  className="text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-40 px-4 py-2 rounded-xl shadow-md transition-colors"
                >
                  {savingTaskEdit ? 'Saving...' : 'Save Task'}
                </button>
              </div>
            </div>
          </div>
        </Fade>
      </Modal>
    </Box>
  );
}
