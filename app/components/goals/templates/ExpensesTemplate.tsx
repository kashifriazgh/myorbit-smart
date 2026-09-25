'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  IconButton,
  Dialog,
  DialogContent,
  Modal,
  Fade,
  Collapse,
  Button,
} from '@mui/material';
import {
  Fastfood as FoodIcon,
  Subscriptions as SubscriptionIcon,
  DirectionsCar as FuelIcon,
  ShoppingBag as BagIcon,
  LocalOffer as TagIcon,
  ReceiptLong as BillIcon,
  ShoppingCart as GroceryIcon,
  Movie as EntertainmentIcon,
  Add as PlusIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  TrendingDown,
  CalendarToday as CalendarIcon,
  Close as CloseIcon,
  AccountBalanceWallet as WalletIcon,
  GpsFixed as TargetIcon,
  NotificationsNone as BellIcon,
  ChevronRight,
  Schedule as ScheduleIcon,
  FormatListBulleted as TodoIcon,
  ShowChart as ChartIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { getExpenseItemProgress } from '@/app/lib/utils/goalProgress';
import { useAuth } from '@/app/lib/context/userContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { useTodoContext } from '@/app/lib/context/todoContext';

export interface ExpenseActionItem {
  id: string;
  kind?: 'schedule' | 'todo';
  task: string;
  time?: string;
  frequencyPerWeek?: number;
  dueDate?: string;
  done?: boolean;
  assumedContributionValue?: number;
  scheduleId?: string;
  todoId?: string;
}

export interface ExpenseItem {
  id: string;
  title: string;
  category: string;
  actionType: 'reduce' | 'eliminate';
  currentValue: number;
  initialValue: number;
  targetValue: number;
  reductionPercent: number;
  byDate: string;
  actions?: ExpenseActionItem[];
  history?: number[];
}

interface ExpensesTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  'Dining Out': { label: 'Dining Out & Food', icon: FoodIcon, color: '#f97316' },
  Subscriptions: { label: 'Subscriptions', icon: SubscriptionIcon, color: '#8b5cf6' },
  Shopping: { label: 'Shopping & Clothes', icon: BagIcon, color: '#ec4899' },
  'Utility Bills': { label: 'Utility Bills', icon: BillIcon, color: '#0284c7' },
  Transport: { label: 'Transport & Fuel', icon: FuelIcon, color: '#14b8a6' },
  Groceries: { label: 'Groceries', icon: GroceryIcon, color: '#10b981' },
  Entertainment: { label: 'Entertainment', icon: EntertainmentIcon, color: '#eab308' },
  Other: { label: 'Other Expense', icon: TagIcon, color: '#64748b' },
};

function formatCurrency(amount: number, unit: string = 'Rs') {
  return `${unit} ${Math.round(amount).toLocaleString()}`;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getFutureDateStr(daysAhead: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}



export default function ExpensesTemplate({ goal, onUpdateGoal }: ExpensesTemplateProps) {
  const currencyUnit = goal.overallTargetUnit || 'Rs';
  const { user } = useAuth();
  const { allSchedules, addSchedule, editSchedule, removeSchedule } = useSchedules();
  const { todos, addTodo, updateTodo, deleteTodo } = useTodoContext();

  // State for Expenses - Start empty if no saved expenseItems exist (no dummy data)
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    if (Array.isArray(goal.expenseItems) && goal.expenseItems.length > 0) {
      return goal.expenseItems as unknown as ExpenseItem[];
    }
    return [];
  });

  // Sync expenses state whenever goal.expenseItems updates from Firestore / Context
  useEffect(() => {
    if (Array.isArray(goal.expenseItems)) {
      setExpenses(goal.expenseItems as unknown as ExpenseItem[]);
    }
  }, [goal.expenseItems]);

  // Sorting
  const [sortByOver, setSortByOver] = useState(true);

  // Dialog State (Add/Edit Expense)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCategoryGrid, setShowCategoryGrid] = useState(false);

  // Add/Edit Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Dining Out');
  const [formActionType, setFormActionType] = useState<'reduce' | 'eliminate'>('reduce');
  const [formInitialVal, setFormInitialVal] = useState<string>('');
  const [formCurrentVal, setFormCurrentVal] = useState<string>('');
  const [formTargetVal, setFormTargetVal] = useState<string>('');
  const [formByDate, setFormByDate] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Mark as Achieved Settlement State
  const [killDialogOpen, setKillDialogOpen] = useState(false);
  const [killTargetItem, setKillTargetItem] = useState<ExpenseItem | null>(null);
  const [killFinalAmount, setKillFinalAmount] = useState<number | ''>('');
  const [savingKill, setSavingKill] = useState(false);

  // Log / Update Progress State per Expense Item
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressItem, setProgressItem] = useState<ExpenseItem | null>(null);
  const [progressInputAmount, setProgressInputAmount] = useState<number | ''>('');
  const [savingProgress, setSavingProgress] = useState(false);

  // Strategy Tasks State
  const [actions, setActions] = useState<ExpenseActionItem[]>(() => {
    if (Array.isArray(goal.actions)) return goal.actions as unknown as ExpenseActionItem[];
    if (Array.isArray(goal.steps)) {
      return (goal.steps as unknown as Array<Record<string, unknown>>).map((s, idx) => ({
        id: String(s.id || `step_${idx}`),
        task: String(s.task || s.title || ''),
        done: Boolean(s.done || s.status === 'completed'),
        assumedContributionValue: Number(s.assumedContributionValue || 0),
        kind: (s.kind as 'schedule' | 'todo') || (s.linkedType as 'schedule' | 'todo') || undefined,
        scheduleId: String(s.scheduleId || s.linkedItemId || ''),
        todoId: String(s.todoId || ''),
      }));
    }
    return [];
  });
  const [newStepInput, setNewStepInput] = useState('');

  // Sync strategy tasks status in real time with allSchedules and todos
  useEffect(() => {
    const rawGoalActions = Array.isArray(goal.actions) ? (goal.actions as unknown as ExpenseActionItem[]) : [];
    const baseActions = rawGoalActions.length > 0 ? rawGoalActions : actions;
    let hasMismatch = false;

    const synced = baseActions.map((act) => {
      let updatedDone = act.done;
      if (act.kind === 'schedule' && act.scheduleId) {
        const sched = allSchedules.find((s) => s.id === act.scheduleId);
        if (sched) {
          const isComp = sched.status === 'completed';
          if (isComp !== act.done) {
            updatedDone = isComp;
            hasMismatch = true;
          }
        }
      } else if (act.kind === 'todo' && act.todoId) {
        const td = todos.find((t) => t.id === act.todoId);
        if (td) {
          const isComp = td.status === 'completed';
          if (isComp !== act.done) {
            updatedDone = isComp;
            hasMismatch = true;
          }
        }
      }
      return updatedDone !== act.done ? { ...act, done: updatedDone } : act;
    });

    if (hasMismatch || (synced.length !== actions.length && rawGoalActions.length > 0)) {
      setActions(synced);
    }
  }, [goal.actions, allSchedules, todos, actions]);

  const saveActionsList = async (updated: ExpenseActionItem[]) => {
    setActions(updated);
    if (goal.id) {
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, { actions: updated as unknown as Goal['actions'] });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), { actions: updated });
      }
    }
  };

  // Strategy Task Detail Modal State
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<ExpenseActionItem | null>(null);
  const [taskEditText, setTaskEditText] = useState('');
  const [taskEditAssumedVal, setTaskEditAssumedVal] = useState<number | ''>('');
  const [taskEditKind, setTaskEditKind] = useState<'none' | 'schedule' | 'todo'>('none');
  const [showConvertOptions, setShowConvertOptions] = useState(false);
  const [taskEditDate, setTaskEditDate] = useState('');
  const [taskEditStartTime, setTaskEditStartTime] = useState('10:00');
  const [taskEditEndTime, setTaskEditEndTime] = useState('11:00');
  const [taskEditTodoTime, setTaskEditTodoTime] = useState('');
  const [taskEditAssignee, setTaskEditAssignee] = useState('');
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);

  // Strategy Task Assumed Value Completion Prompt Modal State
  const [stepPromptItem, setStepPromptItem] = useState<{ itemId: string; step: ExpenseActionItem } | null>(null);
  const [stepPromptAmount, setStepPromptAmount] = useState<number | ''>('');
  const [savingStepPrompt, setSavingStepPrompt] = useState(false);

  // Totals & Calculations for Header Bar & Progress
  const totals = useMemo(() => {
    const initial = expenses.reduce((s, e) => s + (e.initialValue || e.currentValue || 0), 0);
    const current = expenses.reduce((s, e) => s + (e.currentValue || 0), 0);
    const target = expenses.reduce((s, e) => s + (e.targetValue || 0), 0);
    const overCount = expenses.filter((e) => e.currentValue > e.targetValue).length;

    let progressPct = 0;
    if (expenses.length > 0) {
      let sumProgress = 0;
      for (const item of expenses) {
        sumProgress += getExpenseItemProgress(item);
      }
      progressPct = Math.max(0, Math.min(100, Math.round(sumProgress / expenses.length)));
    }

    return { initial, current, target, overCount, progressPct };
  }, [expenses]);

  const sortedExpenses = useMemo(() => {
    if (!sortByOver) return expenses;
    return [...expenses].sort((a, b) => {
      const ratioA = a.targetValue > 0 ? a.currentValue / a.targetValue : a.currentValue;
      const ratioB = b.targetValue > 0 ? b.currentValue / b.targetValue : b.currentValue;
      return ratioB - ratioA;
    });
  }, [expenses, sortByOver]);

  // Persist expenses list to Firestore / state
  const saveExpensesList = async (newList: ExpenseItem[]) => {
    setExpenses(newList);
    if (!goal.id) return;

    let sum = 0;
    for (const item of newList) {
      sum += getExpenseItemProgress(item);
    }
    const newMean = newList.length > 0 ? Math.max(0, Math.min(100, Math.round(sum / newList.length))) : 0;

    const payload = {
      expenseItems: newList,
      progress: newMean,
    };

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, payload);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), payload);
    }
  };

  // Open Add/Edit Modal
  const handleOpenModal = (item?: ExpenseItem) => {
    setFormError('');
    setShowCategoryGrid(false);
    if (item) {
      setEditingId(item.id);
      setFormTitle(item.title);
      setFormCategory(item.category || 'Dining Out');
      setFormActionType(item.actionType || 'reduce');
      setFormInitialVal((item.initialValue || item.currentValue).toString());
      setFormCurrentVal(item.currentValue.toString());
      setFormTargetVal(item.targetValue.toString());
      setFormByDate(item.byDate || getFutureDateStr(15));
    } else {
      setEditingId(null);
      setFormTitle('');
      setFormCategory('Dining Out');
      setFormActionType('reduce');
      setFormInitialVal('');
      setFormCurrentVal('');
      setFormTargetVal('');
      setFormByDate(getFutureDateStr(15));
    }
    setDialogOpen(true);
  };

  // Save Add/Edit Expense Form
  const handleSubmitForm = async () => {
    if (!formTitle.trim()) return setFormError('Give this expense a name.');
    
    const init = parseFloat(formInitialVal);
    const c = parseFloat(formCurrentVal);
    if (!formInitialVal || isNaN(init) || init <= 0) return setFormError('Enter a valid initial baseline amount.');
    if (!formCurrentVal || isNaN(c) || c < 0) return setFormError('Enter a valid current amount.');
    
    let t = parseFloat(formTargetVal);
    if (formActionType === 'eliminate') {
      t = 0;
    } else if (!formTargetVal || isNaN(t) || t < 0) {
      return setFormError('Enter a valid target amount.');
    }

    setFormError('');
    setSaving(true);

    try {
      const existing = editingId ? expenses.find((e) => e.id === editingId) : null;
      const initialVal = init;
      const pct = getExpenseItemProgress({ currentValue: c, targetValue: t, initialValue: initialVal, actionType: formActionType });
      
      const historyArr = existing?.history && existing.history.length > 0
        ? [...existing.history.slice(-3), c]
        : [initialVal, c];

      const newItem: ExpenseItem = {
        id: editingId || 'exp_' + Date.now(),
        title: formTitle.trim(),
        category: formCategory,
        actionType: formActionType,
        currentValue: c,
        initialValue: initialVal,
        targetValue: t,
        reductionPercent: pct,
        byDate: formByDate || getFutureDateStr(15),
        actions: existing?.actions || [],
        history: historyArr,
      };

      const updatedList = editingId
        ? expenses.map((e) => (e.id === editingId ? newItem : e))
        : [...expenses, newItem];

      await saveExpensesList(updatedList);
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to save expense:', err);
      setFormError('Failed to save expense item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpenseItem = async (itemId: string) => {
    const item = expenses.find((e) => e.id === itemId);
    if (item?.actions) {
      for (const step of item.actions) {
        if (step.scheduleId && removeSchedule) {
          await removeSchedule(step.scheduleId, true).catch((err) => console.error(err));
        }
        if (step.todoId && deleteTodo) {
          await deleteTodo(step.todoId, true).catch((err) => console.error(err));
        }
      }
    }
    const filtered = expenses.filter((e) => e.id !== itemId);
    await saveExpensesList(filtered);
  };

  // Mark Expense as Achieved with custom settlement amount (Preserves initialValue)
  const handleOpenKillModal = (item: ExpenseItem) => {
    setKillTargetItem(item);
    setKillFinalAmount(item.targetValue);
    setKillDialogOpen(true);
  };

  const handleConfirmKill = async () => {
    if (!killTargetItem) return;
    setSavingKill(true);

    try {
      const finalVal = typeof killFinalAmount === 'number' ? killFinalAmount : 0;
      const updated = expenses.map((e) => {
        if (e.id === killTargetItem.id) {
          const initVal = e.initialValue || e.currentValue;
          const pct = getExpenseItemProgress({ currentValue: finalVal, targetValue: e.targetValue, initialValue: initVal, actionType: e.actionType });
          return {
            ...e,
            initialValue: initVal,
            currentValue: finalVal,
            reductionPercent: pct,
            history: [...(e.history || [initVal]), finalVal],
          };
        }
        return e;
      });

      await saveExpensesList(updated);
      setKillDialogOpen(false);
      setKillTargetItem(null);
    } catch (err) {
      console.error('Failed to mark expense achieved:', err);
    } finally {
      setSavingKill(false);
    }
  };

  // Open Log / Update Progress Modal for Expense Item
  const handleOpenProgressModal = (item: ExpenseItem) => {
    setProgressItem(item);
    setProgressInputAmount(item.currentValue);
    setProgressDialogOpen(true);
  };

  // Confirm Log / Update Progress
  const handleSaveProgress = async () => {
    if (!progressItem) return;
    const initVal = progressItem.initialValue || progressItem.currentValue;
    const newCurrentVal = typeof progressInputAmount === 'number'
      ? progressInputAmount
      : progressItem.currentValue;

    if (newCurrentVal < 0 || newCurrentVal > initVal) return;

    setSavingProgress(true);

    try {
      const pct = getExpenseItemProgress({
        currentValue: newCurrentVal,
        targetValue: progressItem.targetValue,
        initialValue: initVal,
        actionType: progressItem.actionType,
      });

      const historyArr = progressItem.history && progressItem.history.length > 0
        ? [...progressItem.history, newCurrentVal]
        : [initVal, newCurrentVal];

      const updated = expenses.map((e) => {
        if (e.id === progressItem.id) {
          return {
            ...e,
            initialValue: initVal,
            currentValue: newCurrentVal,
            reductionPercent: pct,
            history: historyArr,
          };
        }
        return e;
      });

      await saveExpensesList(updated);
      setProgressDialogOpen(false);
      setProgressItem(null);
    } catch (err) {
      console.error('Failed to update progress:', err);
    } finally {
      setSavingProgress(false);
    }
  };



  // Add Strategic Action Step from inline row
  const handleAddStep = async () => {
    const text = newStepInput.trim();
    if (!text) return;

    const newStep: ExpenseActionItem = {
      id: 'step_' + Date.now(),
      task: text,
      done: false,
    };
    const updated = [...actions, newStep];
    await saveActionsList(updated);
    setNewStepInput('');
  };

  // Delete Action Step inline
  const handleDeleteStep = async (stepId: string) => {
    const step = actions.find((s) => s.id === stepId);
    if (step?.scheduleId && removeSchedule) {
      await removeSchedule(step.scheduleId, true).catch((err) => console.error(err));
    }
    if (step?.todoId && deleteTodo) {
      await deleteTodo(step.todoId, true).catch((err) => console.error(err));
    }

    const updated = actions.filter((s) => s.id !== stepId);
    await saveActionsList(updated);
  };

  // Open Task Detail Dialog for Strategy Step
  const handleOpenTaskDetailModal = (step: ExpenseActionItem) => {
    setActiveStep(step);
    setTaskEditText(step.task);
    setTaskEditAssumedVal(step.assumedContributionValue || '');
    const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
    setTaskEditKind(kind as 'none' | 'schedule' | 'todo');
    setShowConvertOptions(kind === 'schedule' || kind === 'todo');

    const todayStr = new Date().toISOString().split('T')[0];
    setTaskEditDate(step.dueDate || todayStr);
    setTaskEditStartTime(step.time || '10:00');
    setTaskEditEndTime('11:00');
    setTaskEditTodoTime(step.time || '');
    setTaskEditAssignee((step as ExpenseActionItem & { assignee?: string }).assignee || '');
    setTaskModalOpen(true);
  };

  // Save Task Edit / Convert to Schedule or Todo
  const handleSaveTaskDetail = async () => {
    if (!activeStep || !taskEditText.trim()) return;
    setSavingTaskEdit(true);

    try {
      let updatedScheduleId = activeStep.scheduleId;
      let updatedTodoId = activeStep.todoId;
      const rawDate = taskEditDate || new Date().toISOString().split('T')[0];
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
              startTime: taskEditStartTime || '10:00',
              endTime: taskEditEndTime || '11:00',
              status: activeStep.done ? 'completed' : 'pending',
              linkedGoalId: goal.id,
              goalTitle: goal.title,
              contributionAmount: Number(taskEditAssumedVal) || 0,
            });
            if (typeof created === 'string') updatedScheduleId = created;
            else if (created && typeof (created as { id?: string }).id === 'string') updatedScheduleId = (created as { id: string }).id;
          }
        } else if (editSchedule) {
          await editSchedule(updatedScheduleId, {
            title: taskEditText.trim(),
            date: targetDate,
            startTime: taskEditStartTime || '10:00',
            endTime: taskEditEndTime || '11:00',
            contributionAmount: Number(taskEditAssumedVal) || 0,
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

      const updated = actions.map((s) => {
        if (s.id === activeStep.id) {
          return {
            ...s,
            task: taskEditText.trim(),
            kind: taskEditKind === 'none' ? undefined : taskEditKind,
            dueDate: targetDate,
            time: taskEditKind === 'schedule' ? taskEditStartTime : taskEditTodoTime,
            assumedContributionValue: Number(taskEditAssumedVal) || 0,
            scheduleId: updatedScheduleId,
            todoId: updatedTodoId,
            assignee: taskEditAssignee.trim() || undefined,
          };
        }
        return s;
      });

      await saveActionsList(updated);
      setTaskModalOpen(false);
      setActiveStep(null);
    } catch (err) {
      console.error('Failed to save task details:', err);
    } finally {
      setSavingTaskEdit(false);
    }
  };

  // Delete Action Step from Modal
  const handleDeleteTaskFromModal = async () => {
    if (!activeStep) return;
    setSavingTaskEdit(true);

    try {
      if (activeStep.scheduleId && removeSchedule) {
        await removeSchedule(activeStep.scheduleId, true).catch((err) => console.error(err));
      }
      if (activeStep.todoId && deleteTodo) {
        await deleteTodo(activeStep.todoId, true).catch((err) => console.error(err));
      }

      const updated = actions.filter((s) => s.id !== activeStep.id);
      await saveActionsList(updated);
      setTaskModalOpen(false);
      setActiveStep(null);
    } catch (err) {
      console.error('Failed to delete task step:', err);
    } finally {
      setSavingTaskEdit(false);
    }
  };

  // Toggle Strategic Action Step completion
  const handleToggleStepCompletion = async (step: ExpenseActionItem) => {
    if (!step.done && step.assumedContributionValue && step.assumedContributionValue > 0) {
      setStepPromptItem({ itemId: '', step });
      setStepPromptAmount(step.assumedContributionValue);
      return;
    }

    const newDone = !step.done;

    if (step.scheduleId && editSchedule) {
      editSchedule(step.scheduleId, { status: newDone ? 'completed' : 'pending' }).catch((err) => console.error(err));
    }
    if (step.todoId && updateTodo) {
      updateTodo(step.todoId, { status: newDone ? 'completed' : 'in_progress' }).catch((err) => console.error(err));
    }

    const updated = actions.map((s) => (s.id === step.id ? { ...s, done: newDone } : s));
    await saveActionsList(updated);
  };

  // Confirm Step Completion with Financial Progress Amount
  const handleConfirmStepPrompt = async (_applyReduction: boolean) => {
    if (!stepPromptItem) return;
    setSavingStepPrompt(true);

    try {
      const { step } = stepPromptItem;
      if (step.scheduleId && editSchedule) {
        editSchedule(step.scheduleId, { status: 'completed' }).catch((err) => console.error(err));
      }
      if (step.todoId && updateTodo) {
        updateTodo(step.todoId, { status: 'completed' }).catch((err) => console.error(err));
      }

      const updated = actions.map((s) => (s.id === step.id ? { ...s, done: true } : s));
      await saveActionsList(updated);

      setStepPromptItem(null);
    } catch (err) {
      console.error('Failed to confirm step prompt:', err);
    } finally {
      setSavingStepPrompt(false);
    }
  };

  // Dialog Live Computations
  const dlgInitial = parseFloat(formInitialVal) || 0;
  const dlgCurrent = parseFloat(formCurrentVal) || dlgInitial;
  const dlgTarget = formActionType === 'eliminate' ? 0 : parseFloat(formTargetVal) || 0;

  const dlgPct = useMemo(() => {
    return getExpenseItemProgress({
      currentValue: dlgCurrent,
      targetValue: dlgTarget,
      initialValue: dlgInitial,
      actionType: formActionType,
    });
  }, [dlgCurrent, dlgTarget, dlgInitial, formActionType]);

  const dlgOverBudget = useMemo(() => {
    return dlgCurrent && dlgTarget !== undefined && dlgCurrent > dlgTarget && formActionType !== 'eliminate';
  }, [dlgCurrent, dlgTarget, formActionType]);

  const dlgBarColorClass = dlgOverBudget
    ? 'bg-rose-400'
    : dlgPct > 80
    ? 'bg-amber-400'
    : 'bg-emerald-400';

  return (
    <div className="w-full text-slate-900 dark:text-slate-100 transition-colors">
      {/* ── Expenses Summary Header Bar ── */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {goal.title || 'Expenses'}
            </h2>
          </div>
          <button
            onClick={() => handleOpenModal()}
            aria-label="Add expense"
            className="h-10 px-4 rounded-2xl flex items-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-medium text-sm shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-[1.02]"
          >
            <PlusIcon sx={{ fontSize: 18 }} />
            <span>Add expense</span>
          </button>
        </div>

        {/* Header Progress Bar showing Initial (Left) and Target (Right) */}
        {expenses.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              <span className="flex items-center gap-1">
                <span className="text-slate-400 font-normal">Initial:</span>
                <strong className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totals.initial, currencyUnit)}</strong>
              </span>
              <span className="text-teal-600 dark:text-teal-400 font-bold px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/10">
                {totals.progressPct}% Reduced
              </span>
              <span className="flex items-center gap-1">
                <span className="text-slate-400 font-normal">Target:</span>
                <strong className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totals.target, currencyUnit)}</strong>
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${totals.progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Sorting & Item Count Row */}
        <div className="flex items-center justify-between py-1">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
            <WalletIcon sx={{ fontSize: 16, color: '#0284c7' }} />
            {expenses.length} {expenses.length === 1 ? 'expense category' : 'expense categories'}
          </p>
          <button
            onClick={() => setSortByOver((s) => !s)}
            className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
          >
            {sortByOver ? 'Sorted: highest usage first' : 'Sort by default'}
          </button>
        </div>
      </div>

      {/* ── Expenses Cards List ── */}
      <div className="max-w-2xl mx-auto space-y-4">
        {sortedExpenses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">No expenses added yet.</p>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-medium text-sm shadow-md"
            >
              Add your first expense
            </button>
          </div>
        ) : (
          sortedExpenses.map((item) => {
            const initVal = item.initialValue || item.currentValue;
            const itemProgress = getExpenseItemProgress(item);

            const meta = CATEGORY_META[item.category] || CATEGORY_META.Other;
            const IconC = meta.icon;

            return (
              <div
                key={item.id}
                className="w-full rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-5 md:p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden space-y-3"
              >
                {/* ── Dedicated Line 1: Icon, Category & Full Width Title ── */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                  >
                    <IconC sx={{ fontSize: 22 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      {item.category}
                    </span>
                    <h3 className="text-slate-900 dark:text-white text-base font-bold leading-snug break-words">
                      {item.title}
                    </h3>
                  </div>
                </div>

                {/* ── Dedicated Line 2: Action Buttons & Progress Pill Line ── */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5 flex-wrap">
                  <span
                    className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${
                      itemProgress >= 100
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400'
                        : itemProgress > 0
                        ? 'bg-teal-50 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400'
                        : 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'
                    }`}
                  >
                    {itemProgress >= 100
                      ? 'Target achieved (100%)'
                      : itemProgress > 0
                      ? `${itemProgress}% reduced`
                      : `0% reduced (${formatCurrency(Math.max(0, item.currentValue - item.targetValue), currencyUnit)} above target)`}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <button
                      onClick={() => handleOpenProgressModal(item)}
                      title="Update expense reduction progress"
                      className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                    >
                      <ChartIcon sx={{ fontSize: 15 }} />
                      Update Progress
                    </button>

                    <button
                      onClick={() => handleOpenKillModal(item)}
                      title="Mark as achieved"
                      className="px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-semibold hover:bg-teal-500/20 transition-colors"
                    >
                      Mark as achieved
                    </button>

                    <IconButton size="small" onClick={() => handleOpenModal(item)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                      <EditIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteExpenseItem(item.id)} className="text-rose-400 hover:text-rose-600">
                      <DeleteIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </div>
                </div>

                {/* ── Dedicated Line 3: 3-Values Display Box (Initial, Now/Current, Goal Target) ── */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-center">
                  <div className="text-left">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Initial Baseline</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {formatCurrency(initVal, currencyUnit)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">Now (Current)</p>
                    <p className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {formatCurrency(item.currentValue, currencyUnit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium font-semibold">Goal Target</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatCurrency(item.targetValue, currencyUnit)}
                    </p>
                  </div>
                </div>

                {/* ── Thin Progress Bar for Item ── */}
                <div className="w-full my-3">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1">
                    <span>Progress</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{itemProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        itemProgress >= 100
                          ? 'bg-emerald-500'
                          : itemProgress > 0
                          ? 'bg-teal-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${itemProgress}%` }}
                    />
                  </div>
                </div>

                {/* Next Check-in Box */}
                <div className="flex items-center justify-between rounded-2xl border border-teal-200 dark:border-teal-400/20 bg-teal-50 dark:bg-teal-400/10 px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <BellIcon className="text-teal-600 dark:text-teal-400 shrink-0" sx={{ fontSize: 18 }} />
                    <div>
                      <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">Target & Check-in Date</p>
                      <p className="text-xs text-teal-600/70 dark:text-teal-400/70">
                        {formatDate(item.byDate)} &middot; we&apos;ll ask for the new bill amount
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="text-teal-400 dark:text-teal-500 shrink-0" sx={{ fontSize: 18 }} />
                </div>
              </div>
            );
          }))}
      </div>

      {/* ── Line Separator & Strategy Tasks Section ── */}
      <div className="max-w-2xl mx-auto mt-6 pt-6 border-t border-slate-200 dark:border-white/10 space-y-4">
        <div className="flex items-center justify-between px-0.5">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
              🎯 Strategy Tasks ({actions.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Action steps & habits to reduce your expenses
            </p>
          </div>
        </div>

        {/* Strategic Tasks List */}
        <div className="space-y-2">
          {actions.map((step) => {
            const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
            const hasLink = kind === 'schedule' || kind === 'todo';

            return (
              <div
                key={step.id}
                onClick={() => handleOpenTaskDetailModal(step)}
                className="group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-500 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStepCompletion(step);
                    }}
                    className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0 ${
                      step.done
                        ? 'bg-teal-500 border-teal-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-teal-400'
                    }`}
                  >
                    {step.done && (
                      <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 stroke-current stroke-[3]">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <span
                    className={`text-sm font-semibold truncate ${
                      step.done
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {step.task}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {step.assumedContributionValue ? (
                    <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 px-2 py-0.5 rounded-full">
                      +{currencyUnit} {step.assumedContributionValue}
                    </span>
                  ) : null}

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                      hasLink
                        ? kind === 'schedule'
                          ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                          : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {kind === 'schedule'
                      ? '🗓 Schedule'
                      : kind === 'todo'
                      ? '✅ Todo'
                      : 'Add to Schedule/Todo →'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStep(step.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete step"
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Inline Add Strategic Action Step Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="+ Quickly add a strategy task…"
            value={newStepInput}
            onChange={(e) => setNewStepInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddStep();
            }}
            className="flex-1 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 dark:focus:border-teal-500"
          />
          <button
            type="button"
            onClick={handleAddStep}
            disabled={!newStepInput.trim()}
            className="px-3.5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-bold transition-colors shadow-sm"
          >
            Add Task
          </button>
        </div>
      </div>

      {/* ── Add / Edit Expense Dialog (Height Responsive & Scrollable) ── */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '28px',
            bgcolor: 'transparent',
            boxShadow: 'none',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
          <div className="relative w-full max-h-[90vh] flex flex-col rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#091428] shadow-2xl p-5 md:p-6 transition-all overflow-hidden">
            <div className="pointer-events-none absolute -top-24 -right-16 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

            <div className="relative flex items-start justify-between mb-2 shrink-0">
              <div>
                <h2 className="text-slate-900 dark:text-white text-lg font-semibold tracking-tight">
                  {editingId ? 'Edit expense' : 'Add expense'}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Set a target so you can see when to pull back.
                </p>
              </div>
              <button
                onClick={() => setDialogOpen(false)}
                aria-label="Close"
                className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="relative flex-1 overflow-y-auto pr-1 space-y-3.5 custom-scrollbar my-1">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  <TagIcon sx={{ fontSize: 15 }} className="text-teal-600 dark:text-teal-400" />
                  Expense title
                </label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Groceries this month"
                  className="w-full rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-teal-500/60 dark:focus:border-teal-400/60 focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 transition-all font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Category: <span className="font-semibold text-slate-900 dark:text-white">{formCategory}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryGrid((prev) => !prev)}
                    className="text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                  >
                    {showCategoryGrid ? 'Hide Categories' : 'Change Category'}
                  </button>
                </div>

                {showCategoryGrid && (
                  <div className="grid grid-cols-4 gap-1.5 mt-2 transition-all">
                    {Object.entries(CATEGORY_META).map(([key, meta]) => {
                      const isSelected = formCategory === key;
                      const IconC = meta.icon;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setFormCategory(key);
                            setShowCategoryGrid(false);
                          }}
                          className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all ${
                            isSelected
                              ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 font-semibold shadow-sm'
                              : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <IconC sx={{ fontSize: 18 }} />
                          <span className="text-[10px] leading-tight truncate w-full">{key}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  <TrendingDown sx={{ fontSize: 15 }} className="text-teal-600 dark:text-teal-400" />
                  Reduction Goal Objective
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setFormActionType('reduce');
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                      formActionType === 'reduce'
                        ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-300 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    Reduce Amount
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormActionType('eliminate');
                      setFormTargetVal('0');
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                      formActionType === 'eliminate'
                        ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-300 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    Eliminate 100%
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    <WalletIcon sx={{ fontSize: 13 }} className="text-slate-500 dark:text-slate-400" />
                    Initial Baseline
                  </label>
                  <div className="flex items-center rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-2 focus-within:border-teal-500/60 transition-all">
                    <span className="text-slate-400 dark:text-slate-500 text-xs mr-0.5 font-medium">{currencyUnit}</span>
                    <input
                      value={formInitialVal}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        setFormInitialVal(val);
                        if (!editingId && (!formCurrentVal || formCurrentVal === formInitialVal)) {
                          setFormCurrentVal(val);
                        }
                      }}
                      inputMode="decimal"
                      placeholder="3000"
                      className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-teal-600 dark:text-teal-400 mb-1">
                    <WalletIcon sx={{ fontSize: 13 }} className="text-teal-600 dark:text-teal-400" />
                    Current (Now)
                  </label>
                  <div className="flex items-center rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-2 focus-within:border-teal-500/60 transition-all">
                    <span className="text-slate-400 dark:text-slate-500 text-xs mr-0.5 font-medium">{currencyUnit}</span>
                    <input
                      value={formCurrentVal}
                      onChange={(e) => setFormCurrentVal(e.target.value.replace(/[^0-9.]/g, ''))}
                      inputMode="decimal"
                      placeholder="2500"
                      className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                    <TargetIcon sx={{ fontSize: 13 }} className="text-emerald-600 dark:text-emerald-400" />
                    Target
                  </label>
                  <div className="flex items-center rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-2 focus-within:border-emerald-500/60 transition-all">
                    <span className="text-slate-400 dark:text-slate-500 text-xs mr-0.5 font-medium">{currencyUnit}</span>
                    <input
                      value={formActionType === 'eliminate' ? '0' : formTargetVal}
                      disabled={formActionType === 'eliminate'}
                      onChange={(e) => setFormTargetVal(e.target.value.replace(/[^0-9.]/g, ''))}
                      inputMode="decimal"
                      placeholder="2000"
                      className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none font-semibold disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  <CalendarIcon sx={{ fontSize: 15 }} className="text-teal-600 dark:text-teal-400" />
                  Target Date
                </label>
                <input
                  type="date"
                  value={formByDate}
                  onChange={(e) => setFormByDate(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3.5 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 mb-2 font-medium"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormByDate(getFutureDateStr(15))}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-teal-500 transition-colors"
                  >
                    15 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormByDate(getFutureDateStr(30))}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-teal-500 transition-colors"
                  >
                    1 Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormByDate(getFutureDateStr(60))}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-teal-500 transition-colors"
                  >
                    2 Months
                  </button>
                </div>
              </div>

              {(formCurrentVal || formTargetVal) && formActionType !== 'eliminate' && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <span className="text-slate-500 dark:text-slate-400">{dlgPct}% of target</span>
                    <span className={dlgOverBudget ? 'text-rose-500 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
                      {dlgOverBudget
                        ? 'Over target'
                        : `${currencyUnit} ${dlgTarget ? Math.max(0, dlgTarget - (dlgCurrent || 0)).toLocaleString() : 0} left`}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${dlgBarColorClass} transition-all duration-500`}
                      style={{ width: `${Math.min(100, dlgPct)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 pt-3 mt-1 border-t border-slate-100 dark:border-white/5 relative z-10">
              {formError && <p className="text-rose-500 dark:text-rose-400 text-xs font-medium mb-2">{formError}</p>}
              <button
                type="button"
                onClick={handleSubmitForm}
                disabled={saving}
                className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white text-sm font-semibold py-2.5 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update expense' : 'Save expense'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Mark as Achieved Modal ── */}
      <Dialog open={killDialogOpen} onClose={() => setKillDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ p: 3 }}>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Mark &ldquo;{killTargetItem?.title}&rdquo; as Achieved
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter the final settled monthly amount for this expense. You can set it to 0, target, or any custom value. Initial baseline value will remain preserved.
            </p>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Final Settled Amount ({currencyUnit})
              </label>
              <input
                type="number"
                value={killFinalAmount}
                onChange={(e) => setKillFinalAmount(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 font-semibold"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setKillDialogOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmKill}
                disabled={savingKill}
                className="px-4 py-1.5 rounded-xl bg-teal-500 text-white text-xs font-semibold hover:bg-teal-600 transition-colors shadow-sm disabled:opacity-50"
              >
                {savingKill ? 'Saving...' : 'Confirm Settlement'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Log / Update Progress Dialog ── */}
      <Dialog open={progressDialogOpen} onClose={() => setProgressDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ p: 3 }}>
          {(() => {
            const dlgInitVal = progressItem ? (progressItem.initialValue || progressItem.currentValue) : 0;
            const dlgCurrentVal = typeof progressInputAmount === 'number' ? progressInputAmount : null;
            const dlgIsOverInitial = dlgCurrentVal !== null && dlgCurrentVal > dlgInitVal;
            const dlgIsInvalid = dlgCurrentVal === null || isNaN(dlgCurrentVal) || dlgCurrentVal < 0 || dlgIsOverInitial;

            return (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Log Expense Progress
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Update current expense value for &ldquo;{progressItem?.title}&rdquo;.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 text-xs space-y-1">
                  <p className="flex justify-between">
                    <span className="text-slate-400">Initial Baseline:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {formatCurrency(dlgInitVal, currencyUnit)}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-400">Goal Target:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {formatCurrency(progressItem?.targetValue || 0, currencyUnit)}
                    </span>
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Single Input Field: Current Reduced Expense Amount */}
                  <div>
                    <p className="text-xs font-bold text-teal-600 dark:text-teal-400 mb-1.5">
                      Have you reduced this expense? Mention below:
                    </p>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                      Current Reduced Amount ({currencyUnit})
                    </label>
                    <div
                      className={`flex items-center rounded-xl bg-slate-50 dark:bg-white/5 border px-3 py-2.5 transition-all ${
                        dlgIsOverInitial
                          ? 'border-rose-400 focus-within:border-rose-500 ring-1 ring-rose-400/30'
                          : 'border-slate-200 dark:border-white/10 focus-within:border-teal-500'
                      }`}
                    >
                      <span className="text-slate-400 text-xs mr-1 font-medium">{currencyUnit}</span>
                      <input
                        type="number"
                        placeholder="e.g. 2300"
                        value={progressInputAmount}
                        onChange={(e) => {
                          const valStr = e.target.value;
                          setProgressInputAmount(valStr !== '' ? Number(valStr) : '');
                        }}
                        className="w-full bg-transparent text-sm text-slate-900 dark:text-white outline-none font-semibold"
                      />
                    </div>
                    {dlgIsOverInitial ? (
                      <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1 font-medium">
                        ⚠️ Expense amount cannot be greater than initial baseline ({formatCurrency(dlgInitVal, currencyUnit)}).
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        Enter the updated amount you have reached so far.
                      </p>
                    )}
                  </div>

                  {/* Calculated Progress Preview */}
                  {progressItem && !dlgIsInvalid && dlgCurrentVal !== null && (
                    <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 text-center space-y-0.5">
                      <p className="text-xs font-bold text-teal-700 dark:text-teal-300">
                        Calculated Progress:{' '}
                        {getExpenseItemProgress({
                          initialValue: dlgInitVal,
                          currentValue: dlgCurrentVal,
                          targetValue: progressItem.targetValue,
                          actionType: progressItem.actionType,
                        })}
                        % Reduced
                      </p>
                      <p className="text-[11px] text-teal-600/80 dark:text-teal-400/80 font-medium">
                        ({formatCurrency(Math.max(0, dlgInitVal - dlgCurrentVal), currencyUnit)} reduced from initial {formatCurrency(dlgInitVal, currencyUnit)})
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setProgressDialogOpen(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProgress}
                    disabled={savingProgress || dlgIsInvalid}
                    className="px-4 py-1.5 rounded-xl bg-teal-500 text-white text-xs font-semibold hover:bg-teal-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingProgress ? 'Saving...' : 'Save Progress'}
                  </button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Strategy Task Detail Modal ─ ImportantTasks style ── */}
      <Modal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        closeAfterTransition
      >
        <Fade in={taskModalOpen}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[28px] w-[90%] sm:w-[440px] shadow-2xl overflow-hidden border outline-none bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800">

            {/* ── Header ── */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[1.05rem] font-extrabold text-slate-800 dark:text-slate-100">
                Task Details
              </p>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--btn-bg, #f1f5f9)',
                  color: '#64748b',
                }}
                className="dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* ── Body ── */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh] custom-scrollbar">

              {/* Editable Task Title */}
              <div
                className="rounded-2xl p-3"
                style={{
                  background: 'var(--title-bg, #f8fafc)',
                  border: '1px solid var(--title-border, #e2e8f0)',
                }}
              >
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
                  Task
                </p>
                <textarea
                  rows={2}
                  value={taskEditText}
                  onChange={(e) => setTaskEditText(e.target.value)}
                  placeholder="Describe this strategy step…"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    fontSize: '15px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    color: 'inherit',
                  }}
                  className="text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>

              {/* Assumed Expense Reduction Row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Expected Reduction
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Amount saved when this task is done
                  </p>
                </div>
                <div
                  className="flex items-center gap-1 rounded-xl px-3 py-2"
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                  }}
                >
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {currencyUnit}
                  </span>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={taskEditAssumedVal}
                    onChange={(e) => setTaskEditAssumedVal(e.target.value ? Number(e.target.value) : '')}
                    style={{
                      width: '80px',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: '15px',
                      fontWeight: 700,
                      fontFamily: 'inherit',
                      textAlign: 'right',
                      color: 'inherit',
                    }}
                    className="text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Assignee Row */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Assignee
                </p>
                <input
                  type="text"
                  placeholder="e.g. Myself, Ali…"
                  value={taskEditAssignee}
                  onChange={(e) => setTaskEditAssignee(e.target.value)}
                  style={{
                    width: '160px',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    fontFamily: 'inherit',
                    color: 'inherit',
                  }}
                  className="dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>

              {/* View full scheduling → link-style expander */}
              <div>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => setShowConvertOptions((p) => !p)}
                  endIcon={
                    <svg viewBox="0 0 20 20" fill="none" className={`w-4 h-4 transition-transform ${showConvertOptions ? 'rotate-180' : ''}`}>
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                  sx={{
                    borderRadius: '14px',
                    py: 1.2,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    borderColor: showConvertOptions ? '#6366f1' : 'var(--btn-border, #e2e8f0)',
                    color: showConvertOptions ? '#6366f1' : 'var(--btn-color, #475569)',
                    '&:hover': { borderColor: '#6366f1', color: '#6366f1' },
                  }}
                >
                  {showConvertOptions
                    ? 'Hide scheduling options'
                    : taskEditKind !== 'none'
                    ? `Linked to ${taskEditKind === 'schedule' ? 'Schedule' : 'Todo'} — edit →`
                    : 'Add to Schedule or Todo →'}
                </Button>

                <Collapse in={showConvertOptions}>
                  <div className="mt-3 space-y-3">
                    {/* info notice */}
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-3.5 py-2.5 rounded-2xl border border-indigo-200/60 dark:border-indigo-500/20 leading-relaxed font-medium">
                      📌 Linking makes this task visible in{' '}
                      <strong>Schedules / Todos</strong> and syncs its completion back to this goal.
                    </p>

                    {/* Type selector — 3 pills */}
                    <div className="flex gap-2">
                      {(['none', 'schedule', 'todo'] as const).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => setTaskEditKind(kind)}
                          className={`flex-1 py-2.5 rounded-2xl text-xs font-bold border-2 transition-all ${
                            taskEditKind === kind
                              ? kind === 'none'
                                ? 'border-slate-400 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                                : kind === 'schedule'
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                : 'border-blue-400 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {kind === 'none' ? '🚫 None' : kind === 'schedule' ? '🗓 Schedule' : '✅ Todo'}
                        </button>
                      ))}
                    </div>

                    {/* Schedule date/time fields */}
                    {taskEditKind === 'schedule' && (
                      <div className="rounded-2xl bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200/60 dark:border-amber-500/20 p-4 space-y-3">
                        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                          <ScheduleIcon sx={{ fontSize: 13 }} /> Schedule Details
                        </p>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                            📅 Date
                          </label>
                          <input
                            type="date"
                            value={taskEditDate}
                            onChange={(e) => setTaskEditDate(e.target.value)}
                            className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-3.5 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-400/70 font-semibold"
                            style={{ colorScheme: 'light dark' }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                              🕐 Start Time
                            </label>
                            <input
                              type="time"
                              value={taskEditStartTime}
                              onChange={(e) => setTaskEditStartTime(e.target.value)}
                              className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-400/70 font-semibold"
                              style={{ colorScheme: 'light dark' }}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                              🕑 End Time
                            </label>
                            <input
                              type="time"
                              value={taskEditEndTime}
                              onChange={(e) => setTaskEditEndTime(e.target.value)}
                              className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-400/70 font-semibold"
                              style={{ colorScheme: 'light dark' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Todo date/time fields */}
                    {taskEditKind === 'todo' && (
                      <div className="rounded-2xl bg-blue-50/60 dark:bg-blue-500/5 border border-blue-200/60 dark:border-blue-500/20 p-4 space-y-3">
                        <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                          <TodoIcon sx={{ fontSize: 13 }} /> Todo Details
                        </p>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                            📅 Due Date
                          </label>
                          <input
                            type="date"
                            value={taskEditDate}
                            onChange={(e) => setTaskEditDate(e.target.value)}
                            className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-3.5 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400/70 font-semibold"
                            style={{ colorScheme: 'light dark' }}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                            🕐 Due Time <span className="font-normal text-slate-400">(Optional)</span>
                          </label>
                          <input
                            type="time"
                            value={taskEditTodoTime}
                            onChange={(e) => setTaskEditTodoTime(e.target.value)}
                            className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-3.5 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400/70 font-semibold"
                            style={{ colorScheme: 'light dark' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Collapse>
              </div>

              {/* ── Action Buttons ── */}
              <div className="flex gap-3 pt-1">
                <Button
                  onClick={handleSaveTaskDetail}
                  disabled={savingTaskEdit || !taskEditText.trim()}
                  variant="contained"
                  fullWidth
                  sx={{
                    borderRadius: '14px',
                    py: 1.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    background: 'linear-gradient(to right, #0d9488, #10b981)',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                    '&:hover': { background: 'linear-gradient(to right, #0f766e, #059669)' },
                    '&:disabled': { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none' },
                  }}
                >
                  {savingTaskEdit ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving…
                    </span>
                  ) : 'Save Changes'}
                </Button>

                <Button
                  onClick={handleDeleteTaskFromModal}
                  disabled={savingTaskEdit}
                  variant="contained"
                  sx={{
                    borderRadius: '14px',
                    py: 1.5,
                    px: 3,
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: '#ef4444',
                    color: '#fff',
                    '&:hover': { bgcolor: '#dc2626' },
                    '&:disabled': { bgcolor: '#fca5a5', color: '#fff' },
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </Fade>
      </Modal>

      {/* ── Prompt Dialog for Strategy Step Completion with Assumed Amount ── */}
      <Dialog
        open={Boolean(stepPromptItem)}
        onClose={() => setStepPromptItem(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogContent sx={{ p: 3 }}>
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Confirm Expense Reduction
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Completing <strong>&ldquo;{stepPromptItem?.step.task}&rdquo;</strong>. Confirm the expense amount saved to directly reduce your goal expense:
            </p>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                Reduction Amount ({currencyUnit})
              </label>
              <input
                type="number"
                value={stepPromptAmount}
                onChange={(e) => setStepPromptAmount(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 font-semibold"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleConfirmStepPrompt(false)}
                disabled={savingStepPrompt}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Skip Amount
              </button>
              <button
                type="button"
                onClick={() => handleConfirmStepPrompt(true)}
                disabled={savingStepPrompt || typeof stepPromptAmount !== 'number' || stepPromptAmount <= 0}
                className="px-4 py-1.5 rounded-xl bg-teal-500 text-white text-xs font-semibold hover:bg-teal-600 transition-colors shadow-sm disabled:opacity-50"
              >
                {savingStepPrompt ? 'Saving...' : 'Confirm & Reduce'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


