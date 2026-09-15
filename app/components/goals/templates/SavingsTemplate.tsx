'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  CircularProgress,
  Tooltip,
  Modal,
  Fade,
  Collapse,
} from '@mui/material';
import {
  AccountBalanceWallet,
  Add as AddIcon,
  ArrowDownward,
  ArrowUpward,
  CalendarMonth,
  Checklist as TodoIcon,
  Delete as DeleteIcon,
  AccessTime as ClockIcon,
  MonetizationOn,
  LinkOff,
  Schedule as ScheduleIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc, collection, addDoc, Timestamp, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface Transaction {
  date: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  note?: string;
}

export interface SavingsActionItem {
  id: string;
  task: string;
  done: boolean;
  assumedContributionValue?: number;
  kind?: 'schedule' | 'todo';
  dueDate?: string;
  time?: string;
  assignee?: string;
  scheduleId?: string;
  todoId?: string;
}

interface SavingsTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
  onOpenAddMoney?: () => void;
}

function formatMoney(value: number, currency: string = 'PKR') {
  const displayCurrency = currency === 'units' ? 'PKR' : currency;
  const sign = value < 0 ? '-' : '';
  return `${sign}${displayCurrency} ${Math.round(Math.abs(value)).toLocaleString()}`;
}

const toPlainDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

function daysBetween(a: Date, b: Date) {
  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | Date | Timestamp | null | undefined) {
  if (!dateStr) return '—';
  const d = toPlainDate(dateStr);
  if (!d) return String(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SavingsTemplate({ goal, onUpdateGoal }: SavingsTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { addTodo, updateTodo, deleteTodo } = useTodoContext();
  const { addSchedule, editSchedule, removeSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};
  const rawUnit = goal.overallTargetUnit || answers.currency || 'PKR';
  const currency = String(rawUnit === 'units' ? 'PKR' : rawUnit);
  const openingBalance = Number(answers.opening_balance || 0);

  const targetValue = goal.overallTargetValue || Number(answers.target_amount || answers.amount || 0);
  const targetDate = toPlainDate(goal.dueDate) || (answers.target_date ? toPlainDate(answers.target_date) : null);
  const startDate = toPlainDate(goal.createdAt);

  // Behind-the-scenes Finance source
  const [selectedSource, setSelectedSource] = useState<string>(
    String(goal.linkedSourceId || answers.saving_source || answers.fund_source || '')
  );

  // New source creation state
  const [createSourceOpen, setCreateSourceOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [creatingSource, setCreatingSource] = useState(false);

  // Ledger Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (Array.isArray(goal.transactions)) return goal.transactions;
    return [];
  });

  // Strategy Tasks State
  const [actions, setActions] = useState<SavingsActionItem[]>(() => {
    if (Array.isArray(goal.actions)) return goal.actions as unknown as SavingsActionItem[];
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

  // Strategy Task Details Modal State
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<SavingsActionItem | null>(null);
  const [taskEditText, setTaskEditText] = useState('');
  const [taskEditAssumedVal, setTaskEditAssumedVal] = useState<number | ''>('');
  const [taskEditKind, setTaskEditKind] = useState<'none' | 'schedule' | 'todo'>('none');
  const [taskEditDate, setTaskEditDate] = useState('');
  const [taskEditStartTime, setTaskEditStartTime] = useState('10:00');
  const [taskEditEndTime, setTaskEditEndTime] = useState('11:00');
  const [taskEditTodoTime, setTaskEditTodoTime] = useState('');
  const [taskEditAssignee, setTaskEditAssignee] = useState('');
  const [showConvertOptions, setShowConvertOptions] = useState(false);
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);

  // Update Progress Modal State
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressInputAmount, setProgressInputAmount] = useState<number | ''>('');
  const [savingProgress, setSavingProgress] = useState(false);

  // Sleek Add Money Dialog (ONLY Amount + Note)
  const [addTxnOpen, setAddTxnOpen] = useState(false);
  const [txnAmount, setTxnAmount] = useState<number | ''>('');
  const [txnNote, setTxnNote] = useState('');
  const [savingTxn, setSavingTxn] = useState(false);

  // Periodic Savings Check-In Reminder State
  const [reminderFreq, setReminderFreq] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>(() => {
    return (goal.savingsReminderFreq as 'daily' | 'weekly' | 'monthly' | 'custom') || 'weekly';
  });
  const [customIntervalDays, setCustomIntervalDays] = useState<number>(() => {
    return goal.savingsCustomIntervalDays || 3;
  });
  const [lastCheckInDate, setLastCheckInDate] = useState<string>(() => {
    return goal.lastSavingsCheckInDate || '';
  });
  const [freqSettingsOpen, setFreqSettingsOpen] = useState(false);

  // Completion Prompt Dialog for Strategy Steps
  const [stepPromptItem, setStepPromptItem] = useState<SavingsActionItem | null>(null);
  const [stepPromptAmount, setStepPromptAmount] = useState<number | ''>('');
  const [savingStepPrompt, setSavingStepPrompt] = useState(false);

  // Helper: Persist Actions list to Goal
  const saveActionsList = async (updated: SavingsActionItem[]) => {
    setActions(updated);
    if (goal.id) {
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, { actions: updated as unknown as Goal['actions'] });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), { actions: updated });
      }
    }
  };

  // Check if periodic check-in is due
  const isCheckInDue = useMemo(() => {
    if (!lastCheckInDate) return true;
    const last = new Date(lastCheckInDate);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    if (reminderFreq === 'daily') return diffDays >= 1;
    if (reminderFreq === 'weekly') return diffDays >= 7;
    if (reminderFreq === 'monthly') return diffDays >= 30;
    if (reminderFreq === 'custom') return diffDays >= (customIntervalDays || 3);
    return false;
  }, [lastCheckInDate, reminderFreq, customIntervalDays]);

  const handleUpdateReminderFreq = async (freq: 'daily' | 'weekly' | 'monthly' | 'custom', customDays?: number) => {
    setReminderFreq(freq);
    if (customDays) setCustomIntervalDays(customDays);
    if (goal.id) {
      const payload = { savingsReminderFreq: freq, savingsCustomIntervalDays: customDays || customIntervalDays };
      if (onUpdateGoal) await onUpdateGoal(goal.id, payload);
      else await updateDoc(doc(db, 'goals', goal.id), payload);
    }
    setFreqSettingsOpen(false);
  };

  const handleConfirmCheckIn = async (openDepositModal?: boolean) => {
    const todayStr = new Date().toISOString().split('T')[0];
    setLastCheckInDate(todayStr);
    if (goal.id) {
      const payload = { lastSavingsCheckInDate: todayStr };
      if (onUpdateGoal) await onUpdateGoal(goal.id, payload);
      else await updateDoc(doc(db, 'goals', goal.id), payload);
    }
    if (openDepositModal) {
      setAddTxnOpen(true);
    }
  };

  // Auto-set initial default source if missing
  useEffect(() => {
    if (!selectedSource && goal.title) {
      const defaultName = `${goal.title} Pot`;
      setSelectedSource(defaultName);
      if (goal.id && onUpdateGoal) {
        onUpdateGoal(goal.id, { linkedSourceId: defaultName });
      }
    }
  }, [selectedSource, goal.title, goal.id, onUpdateGoal]);

  // Derived Total Saved
  const totalSaved = useMemo(() => {
    if (transactions.length > 0) {
      return transactions.reduce((sum, t) => sum + (t.type === 'withdrawal' ? -t.amount : t.amount), openingBalance);
    }
    return goal.currentValue || openingBalance;
  }, [transactions, openingBalance, goal.currentValue]);

  const progress = useMemo(() => {
    if (!targetValue || targetValue <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((totalSaved / targetValue) * 100)));
  }, [totalSaved, targetValue]);

  const timeInfo = useMemo(() => {
    if (!targetDate) return null;
    const now = new Date();
    const daysLeft = daysBetween(now, new Date(targetDate));
    if (!startDate) return { daysLeft };
    const duration = daysBetween(new Date(startDate), new Date(targetDate));
    const elapsed = Math.max(0, Math.min(duration, daysBetween(new Date(startDate), now)));
    const timeProgress = duration <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((elapsed / duration) * 100)));
    return { daysLeft, duration, elapsed, timeProgress };
  }, [startDate, targetDate]);

  // Record Finance transaction & sync snapshot
  const recordFinanceTransaction = async (
    amount: number,
    type: 'deposit' | 'withdrawal',
    sourceName: string,
    noteText: string
  ) => {
    if (!user || !goal.id) return;
    const sourceToUse = sourceName || `${goal.title} Pot`;

    // 1. Create cashTransaction in Firestore
    const txnPayload = {
      userId: user.uid,
      amount,
      type: type === 'deposit' ? 'add' : 'deduct',
      source: 'custom',
      customPaymentHeadName: sourceToUse,
      category: 'manual',
      note: noteText || `Savings Deposit: ${goal.title}`,
      createdAt: Timestamp.now(),
    };
    await addDoc(collection(db, 'cashTransactions'), txnPayload);

    // 2. Update totalCashSnapshots in Firestore
    const snapRef = doc(db, 'totalCashSnapshots', user.uid);
    const snap = await getDoc(snapRef);

    if (snap.exists()) {
      const data = snap.data();
      const sourcesObj = data?.sources || { bank: {}, custom: {} };
      const customObj = typeof sourcesObj.custom === 'object' ? { ...sourcesObj.custom } : {};
      const currentBal = Number(customObj[sourceToUse] || 0);
      const newBal = type === 'deposit' ? currentBal + amount : Math.max(0, currentBal - amount);

      customObj[sourceToUse] = newBal;
      const updatedTotal = (Number(data.totalAmount) || 0) + (type === 'deposit' ? amount : -amount);

      await updateDoc(snapRef, {
        'sources.custom': customObj,
        totalAmount: updatedTotal,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(snapRef, {
        userId: user.uid,
        sources: {
          in_hand: 0,
          easypaisa: 0,
          jazzcash: 0,
          other: 0,
          bank: {},
          custom: { [sourceToUse]: amount },
        },
        totalAmount: amount,
        freezeAmount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 3. Update Goal progress & ledger
    const newTxn: Transaction = {
      date: new Date().toISOString().split('T')[0],
      amount,
      type,
      note: noteText || `Deposit`,
    };
    const updatedTxns = [newTxn, ...transactions];
    setTransactions(updatedTxns);

    const netChange = type === 'deposit' ? amount : -amount;
    const updatedCurrentVal = Math.max(0, (goal.currentValue || 0) + netChange);
    const newPct = targetValue > 0 ? Math.max(0, Math.min(100, Math.round((updatedCurrentVal / targetValue) * 100))) : 0;

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, {
        transactions: updatedTxns,
        currentValue: updatedCurrentVal,
        progress: newPct,
        linkedSourceId: sourceToUse,
      });
    } else {
      await updateDoc(doc(db, 'goals', goal.id), {
        transactions: updatedTxns,
        currentValue: updatedCurrentVal,
        progress: newPct,
        linkedSourceId: sourceToUse,
      });
    }
  };

  // Handle Add Deposit Submission
  const handleAddDeposit = async () => {
    if (typeof txnAmount !== 'number' || txnAmount <= 0 || !goal.id || !user) return;
    setSavingTxn(true);
    try {
      await recordFinanceTransaction(txnAmount, 'deposit', selectedSource, txnNote.trim());
      setTxnAmount('');
      setTxnNote('');
      setAddTxnOpen(false);
    } catch (err) {
      console.error('Failed to add deposit:', err);
    } finally {
      setSavingTxn(false);
    }
  };

  // Open Log / Update Progress Modal for Savings Goal
  const handleOpenProgressModal = () => {
    setProgressInputAmount(totalSaved);
    setProgressDialogOpen(true);
  };

  // Confirm Log / Update Progress
  const handleSaveProgress = async () => {
    if (typeof progressInputAmount !== 'number' || progressInputAmount < 0 || !user || !goal.id) return;
    setSavingProgress(true);

    try {
      const delta = progressInputAmount - totalSaved;
      if (delta !== 0) {
        await recordFinanceTransaction(
          Math.abs(delta),
          delta > 0 ? 'deposit' : 'withdrawal',
          selectedSource,
          `Progress update adjustment`
        );
      }
      setProgressDialogOpen(false);
    } catch (err) {
      console.error('Failed to update progress:', err);
    } finally {
      setSavingProgress(false);
    }
  };

  // Delete a specific transaction entry from Savings Ledger
  const handleDeleteTransaction = async (index: number) => {
    if (!goal.id || !user) return;
    const targetTxn = transactions[index];
    if (!targetTxn) return;

    if (!confirm(`Delete entry of ${formatMoney(targetTxn.amount, currency)}?`)) return;

    try {
      const updatedTxns = transactions.filter((_, i) => i !== index);
      setTransactions(updatedTxns);

      // Reverse balance from totalCashSnapshots
      const sourceToUse = selectedSource || `${goal.title} Pot`;
      const snapRef = doc(db, 'totalCashSnapshots', user.uid);
      const snap = await getDoc(snapRef);

      if (snap.exists()) {
        const data = snap.data();
        const customObj = typeof data?.sources?.custom === 'object' ? { ...data.sources.custom } : {};
        const currentBal = Number(customObj[sourceToUse] || 0);
        const reverseVal = targetTxn.type === 'deposit' ? -targetTxn.amount : targetTxn.amount;
        customObj[sourceToUse] = Math.max(0, currentBal + reverseVal);
        const updatedTotal = Math.max(0, (Number(data.totalAmount) || 0) + reverseVal);

        await updateDoc(snapRef, {
          'sources.custom': customObj,
          totalAmount: updatedTotal,
          updatedAt: serverTimestamp(),
        });
      }

      const netChange = targetTxn.type === 'deposit' ? -targetTxn.amount : targetTxn.amount;
      const updatedCurrentVal = Math.max(0, (goal.currentValue || 0) + netChange);
      const newPct = targetValue > 0 ? Math.max(0, Math.min(100, Math.round((updatedCurrentVal / targetValue) * 100))) : 0;

      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, {
          transactions: updatedTxns,
          currentValue: updatedCurrentVal,
          progress: newPct,
        });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), {
          transactions: updatedTxns,
          currentValue: updatedCurrentVal,
          progress: newPct,
        });
      }
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  // Unlink source
  const handleUnlinkSource = async () => {
    if (!goal.id) return;
    if (!confirm('Unlink and reset the Finance Source for this goal?')) return;
    setSelectedSource('');
    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, { linkedSourceId: '' });
    } else {
      await updateDoc(doc(db, 'goals', goal.id), { linkedSourceId: '' });
    }
  };

  // Handle Initial Source Creation
  const handleCreateSource = async () => {
    if (!newSourceName.trim() || !user || !goal.id) return;
    setCreatingSource(true);
    try {
      const srcName = newSourceName.trim();

      await addDoc(collection(db, 'customPaymentHeads'), {
        userId: user.uid,
        name: srcName,
        goalId: goal.id,
        goalTitle: goal.title,
        createdAt: Timestamp.now(),
      });

      const snapRef = doc(db, 'totalCashSnapshots', user.uid);
      const snap = await getDoc(snapRef);
      if (snap.exists()) {
        const data = snap.data();
        const customObj = typeof data?.sources?.custom === 'object' ? { ...data.sources.custom } : {};
        if (customObj[srcName] === undefined) {
          customObj[srcName] = 0;
          await updateDoc(snapRef, {
            'sources.custom': customObj,
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        await setDoc(snapRef, {
          userId: user.uid,
          sources: {
            in_hand: 0,
            easypaisa: 0,
            jazzcash: 0,
            other: 0,
            bank: {},
            custom: { [srcName]: 0 },
          },
          totalAmount: 0,
          freezeAmount: 0,
          createdAt: serverTimestamp(),
        });
      }

      setSelectedSource(srcName);
      if (onUpdateGoal) await onUpdateGoal(goal.id, { linkedSourceId: srcName });

      setNewSourceName('');
      setCreateSourceOpen(false);
    } catch (err) {
      console.error('Failed to create source:', err);
    } finally {
      setCreatingSource(false);
    }
  };

  // Add Strategic Action Step from inline row
  const handleAddStep = async () => {
    const text = newStepInput.trim();
    if (!text) return;

    const newStep: SavingsActionItem = {
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
  const handleOpenTaskDetailModal = (step: SavingsActionItem) => {
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
    setTaskEditAssignee(step.assignee || '');
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
  const handleToggleStepCompletion = async (step: SavingsActionItem) => {
    if (!step.done && step.assumedContributionValue && step.assumedContributionValue > 0) {
      setStepPromptItem(step);
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

  // Confirm Step Completion with Financial Deposit
  const handleConfirmStepPrompt = async (applyDeposit: boolean) => {
    if (!stepPromptItem) return;
    setSavingStepPrompt(true);

    try {
      const step = stepPromptItem;
      const depositAmt = applyDeposit && typeof stepPromptAmount === 'number' && stepPromptAmount > 0
        ? stepPromptAmount
        : 0;

      if (depositAmt > 0) {
        await recordFinanceTransaction(
          depositAmt,
          'deposit',
          selectedSource,
          `Completed strategy step: ${step.task}`
        );
      }

      if (step.scheduleId && editSchedule) {
        editSchedule(step.scheduleId, { status: 'completed' }).catch((err) => console.error(err));
      }
      if (step.todoId && updateTodo) {
        updateTodo(step.todoId, { status: 'completed' }).catch((err) => console.error(err));
      }

      const updated = actions.map((s) => (s.id === step.id ? { ...s, done: true } : s));
      await saveActionsList(updated);

      setStepPromptItem(null);
      setStepPromptAmount('');
    } catch (err) {
      console.error('Failed to confirm step prompt:', err);
    } finally {
      setSavingStepPrompt(false);
    }
  };

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%', spaceY: 3 }}>
      {/* 🌟 SAVINGS INTERVAL CHECK-IN REMINDER BANNER */}
      {isCheckInDue && (
        <Box
          sx={{
            borderRadius: '24px',
            background: isDark
              ? 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(15,23,42,0.9) 100%)'
              : 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)',
            border: '1.5px solid #10b981',
            p: 2.5,
            mb: 3,
            boxShadow: '0 8px 25px rgba(16,185,129,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '14px',
                bgcolor: '#10b981',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(16,185,129,0.4)',
              }}
            >
              <MonetizationOn sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>
                Savings Check-In ({reminderFreq.toUpperCase()})
              </Typography>
              <Typography sx={{ fontSize: 13, color: textMuted, mt: 0.2 }}>
                Have you got money in your savings for this {reminderFreq === 'daily' ? 'day' : reminderFreq === 'weekly' ? 'week' : reminderFreq === 'monthly' ? 'month' : 'session'}?
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="contained"
              onClick={() => handleConfirmCheckIn(true)}
              sx={{
                bgcolor: '#10b981',
                color: '#ffffff',
                fontWeight: 800,
                borderRadius: '12px',
                textTransform: 'none',
                px: 2,
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              + Yes, Log Deposit
            </Button>
            <Button
              size="small"
              onClick={() => handleConfirmCheckIn(false)}
              sx={{
                color: textMuted,
                fontWeight: 700,
                borderRadius: '12px',
                textTransform: 'none',
              }}
            >
              Not Yet
            </Button>
            <IconButton size="small" onClick={() => setFreqSettingsOpen(true)} sx={{ color: textMuted }}>
              <ClockIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Stack>
        </Box>
      )}

      {/* 🌟 1. HERO TARGET CARD */}
      <Box
        sx={{
          borderRadius: '28px',
          border: `1px solid ${cardBorder}`,
          bgcolor: surfaceBg,
          p: 3.5,
          boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 8px 30px rgba(16,185,129,0.06)',
          mb: 3.5,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 140,
            height: 140,
            borderRadius: '50%',
            bgcolor: 'rgba(16,185,129,0.12)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: textPrimary, letterSpacing: '-0.02em' }}>
            {goal.title}
          </Typography>

          {/* Update Progress Button */}
          <Button
            size="small"
            variant="outlined"
            onClick={handleOpenProgressModal}
            startIcon={<EditIcon sx={{ fontSize: 15 }} />}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 12,
              borderColor: '#10b981',
              color: '#10b981',
              '&:hover': { bgcolor: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5', borderColor: '#059669' },
            }}
          >
            Update Progress
          </Button>
        </Box>

        {/* Prominent Target Date Banner */}
        {targetDate && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: '20px',
              bgcolor: isDark ? 'rgba(15,23,42,0.6)' : '#f0fdf4',
              border: `1px solid ${isDark ? '#064e3b' : '#bbf7d0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: '14px',
                  bgcolor: '#10b981',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                }}
              >
                <CalendarMonth sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Target Date
                </Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
                  {formatDate(targetDate)}
                </Typography>
              </Box>
            </Box>

            {timeInfo && (
              <Chip
                label={timeInfo.daysLeft >= 0 ? `⏳ ${timeInfo.daysLeft} Days Remaining` : '⚠️ Past Due'}
                sx={{
                  bgcolor: timeInfo.daysLeft >= 0 ? (isDark ? '#064e3b' : '#ecfdf5') : '#fef2f2',
                  color: timeInfo.daysLeft >= 0 ? '#10b981' : '#ef4444',
                  fontWeight: 800,
                  fontSize: 12,
                  py: 0.5,
                  height: 32,
                  borderRadius: '12px',
                }}
              />
            )}
          </Box>
        )}

        {/* Current Deposited Total & + Add Money Button */}
        <Box sx={{ mt: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Total Deposited Amount
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
              <Typography sx={{ fontSize: 36, fontWeight: 900, color: textPrimary, fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
                {formatMoney(totalSaved, currency)}
              </Typography>
              {targetValue > 0 && (
                <Typography sx={{ fontSize: 13, color: textMuted, fontWeight: 500 }}>
                  of {formatMoney(targetValue, currency)} target
                </Typography>
              )}
            </Box>
          </Box>

          <Button
            variant="contained"
            onClick={() => setAddTxnOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 20 }} />}
            sx={{
              borderRadius: '14px',
              px: 3,
              py: 1.25,
              textTransform: 'none',
              fontSize: 14,
              fontWeight: 800,
              bgcolor: '#10b981',
              color: '#ffffff',
              boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
              '&:hover': { bgcolor: '#059669', boxShadow: '0 6px 20px rgba(16,185,129,0.45)' },
            }}
          >
            + Add Money
          </Button>
        </Box>

        {/* Dynamic Progress Bar */}
        <Box sx={{ mt: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted }}>
              Savings Progress
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>
              {progress}%
            </Typography>
          </Box>
          <Box sx={{ height: 8, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${progress}%`,
                bgcolor: '#10b981',
                borderRadius: 99,
                transition: 'width 0.5s ease',
              }}
            />
          </Box>
        </Box>

        {!selectedSource ? (
          <Box sx={{ mt: 3, pt: 2, borderTop: `1px dashed ${cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 12, color: textMuted }}>
              No Finance source attached yet.
            </Typography>
            <Button
              size="small"
              onClick={() => setCreateSourceOpen(true)}
              startIcon={<AccountBalanceWallet sx={{ fontSize: 15 }} />}
              sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700, color: '#10b981' }}
            >
              Set Up Finance Source
            </Button>
          </Box>
        ) : (
          <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
            <Tooltip title="Unlink / reset linked finance source">
              <IconButton size="small" onClick={handleUnlinkSource} sx={{ color: textMuted, opacity: 0.5, '&:hover': { opacity: 1, color: '#ef4444' } }}>
                <LinkOff sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* 🌟 2. STRATEGY TASKS SECTION (Matching ExpensesTemplate style) */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: textPrimary, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              🎯 Strategy Tasks ({actions.length})
            </Typography>
            <Typography sx={{ fontSize: 11, color: textMuted, mt: 0.2 }}>
              Action steps to reach your savings target
            </Typography>
          </Box>
        </Box>

        {/* Strategic Tasks List */}
        <div className="space-y-2 mb-3">
          {actions.map((step) => {
            const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
            const hasLink = kind === 'schedule' || kind === 'todo';

            return (
              <div
                key={step.id}
                onClick={() => handleOpenTaskDetailModal(step)}
                className="group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Custom Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStepCompletion(step);
                    }}
                    className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0 ${
                      step.done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
                    }`}
                  >
                    {step.done && (
                      <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 stroke-current stroke-[3]">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Task text */}
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
                  {/* Expected savings amount pill */}
                  {step.assumedContributionValue ? (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                      +{formatMoney(step.assumedContributionValue, currency)}
                    </span>
                  ) : null}

                  {/* Schedule/Todo converted pill */}
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

                  {/* Delete step button */}
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
            className="flex-1 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleAddStep}
            disabled={!newStepInput.trim()}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold transition-colors shadow-sm"
          >
            Add Task
          </button>
        </div>
      </Box>

      {/* 🌟 3. SAVINGS LEDGER */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Deposit Ledger ({transactions.length})
          </Typography>
        </Box>

        {transactions.length === 0 ? (
          <Box
            sx={{
              p: 3.5,
              borderRadius: '20px',
              border: `1px dashed ${cardBorder}`,
              bgcolor: surfaceBg,
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: 13, color: textMuted }}>
              No deposit entries recorded yet. Click <strong>+ Add Money</strong> to make your first deposit!
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {transactions.map((t, i) => {
              const isDeposit = t.type === 'deposit';
              return (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '18px',
                    bgcolor: surfaceBg,
                    border: `1px solid ${cardBorder}`,
                    transition: 'all 0.2s ease',
                    '&:hover': { boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(15,23,42,0.05)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        bgcolor: isDeposit ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#4c1d95' : '#fef2f2'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDeposit ? '#10b981' : '#ef4444',
                      }}
                    >
                      {isDeposit ? <ArrowDownward sx={{ fontSize: 20 }} /> : <ArrowUpward sx={{ fontSize: 20 }} />}
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>
                        {t.note || (isDeposit ? 'Deposit' : 'Withdrawal')}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: textMuted }}>
                        {formatDate(t.date)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography
                      sx={{
                        fontSize: 15,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        color: isDeposit ? '#10b981' : '#ef4444',
                      }}
                    >
                      {isDeposit ? '+' : '-'}{formatMoney(t.amount, currency)}
                    </Typography>

                    <IconButton
                      size="small"
                      onClick={() => handleDeleteTransaction(i)}
                      sx={{
                        color: textMuted,
                        '&:hover': { color: '#ef4444', bgcolor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2' },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* 🌟 4. STRATEGY TASK DETAIL MODAL */}
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
                Task Details
              </p>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Body */}
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

              {/* Expected Savings Amount Row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Expected Savings
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Amount saved when this task is done
                  </p>
                </div>
                <div
                  className="flex items-center gap-1 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {currency}
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

              {/* View full scheduling toggle */}
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
                    borderColor: showConvertOptions ? '#10b981' : '#e2e8f0',
                    color: showConvertOptions ? '#10b981' : '#475569',
                    '&:hover': { borderColor: '#10b981', color: '#10b981' },
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
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-3.5 py-2.5 rounded-2xl border border-emerald-200/60 dark:border-emerald-500/20 leading-relaxed font-medium">
                      📌 Linking makes this task visible in{' '}
                      <strong>Schedules / Todos</strong> and syncs its completion back to this goal.
                    </p>

                    {/* Type selector */}
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

                    {/* Schedule fields */}
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

                    {/* Todo fields */}
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

              {/* Action Buttons */}
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
                    background: 'linear-gradient(to right, #059669, #10b981)',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                    '&:hover': { background: 'linear-gradient(to right, #047857, #059669)' },
                    '&:disabled': { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none' },
                  }}
                >
                  {savingTaskEdit ? 'Saving…' : 'Save Changes'}
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
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </Fade>
      </Modal>

      {/* 🌟 5. UPDATE PROGRESS MODAL */}
      <Dialog
        open={progressDialogOpen}
        onClose={() => setProgressDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1,
            bgcolor: surfaceBg,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17 }}>Update Goal Progress</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 13, color: textMuted }}>
              Update your current total savings amount towards this goal.
            </Typography>

            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: isDark ? 'rgba(15,23,42,0.5)' : '#f8fafc', border: `1px solid ${cardBorder}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted }}>Current Saved</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{formatMoney(totalSaved, currency)}</Typography>
              </Box>
              {targetValue > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted }}>Target</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>{formatMoney(targetValue, currency)}</Typography>
                </Box>
              )}
            </Box>

            <TextField
              label={`New Total Saved (${currency})`}
              type="number"
              fullWidth
              autoFocus
              variant="outlined"
              value={progressInputAmount}
              onChange={(e) => setProgressInputAmount(e.target.value ? Number(e.target.value) : '')}
              InputProps={{
                sx: { borderRadius: '14px', fontSize: 16, fontWeight: 800, fontFamily: 'monospace' },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setProgressDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={savingProgress || typeof progressInputAmount !== 'number' || progressInputAmount < 0}
            onClick={handleSaveProgress}
            sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            {savingProgress ? 'Saving...' : 'Save Progress'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 🌟 6. ADD DEPOSIT DIALOG */}
      <Dialog
        open={addTxnOpen}
        onClose={() => setAddTxnOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1,
            bgcolor: surfaceBg,
            boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(16,185,129,0.12)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 18, pt: 2, px: 3, pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '12px',
              bgcolor: isDark ? '#064e3b' : '#ecfdf5',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MonetizationOn sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 17, color: textPrimary }}>Add Deposit</Typography>
            <Typography sx={{ fontSize: 12, color: textMuted, fontWeight: 500 }}>
              Log money saved towards your goal
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2 }}>
          <Stack spacing={2.5}>
            <TextField
              label={`Amount (${currency})`}
              type="number"
              fullWidth
              autoFocus
              variant="outlined"
              value={txnAmount}
              onChange={(e) => setTxnAmount(e.target.value ? Number(e.target.value) : '')}
              InputProps={{
                sx: { borderRadius: '14px', fontSize: 18, fontWeight: 800, fontFamily: 'monospace' },
              }}
            />

            <TextField
              label="Note / Purpose (Optional)"
              placeholder="e.g. Monthly salary contribution, Freelance bonus"
              fullWidth
              variant="outlined"
              value={txnNote}
              onChange={(e) => setTxnNote(e.target.value)}
              InputProps={{
                sx: { borderRadius: '14px', fontSize: 13 },
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setAddTxnOpen(false)} sx={{ textTransform: 'none', borderRadius: '12px', fontWeight: 600, px: 2.5 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingTxn || typeof txnAmount !== 'number' || txnAmount <= 0}
            onClick={handleAddDeposit}
            sx={{
              borderRadius: '12px',
              px: 3.5,
              py: 1,
              textTransform: 'none',
              fontSize: 14,
              fontWeight: 800,
              bgcolor: '#10b981',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            {savingTxn ? <CircularProgress size={20} color="inherit" /> : 'Add Deposit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 🌟 7. INITIAL SOURCE SETUP DIALOG */}
      <Dialog open={createSourceOpen} onClose={() => setCreateSourceOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Set Up Finance Source</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 12, color: textMuted }}>
              Create a dedicated savings head synced with your Finance section.
            </Typography>
            <TextField
              label="Source Name"
              placeholder="e.g. Car Fund, Savings Pot"
              fullWidth
              size="small"
              autoFocus
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateSourceOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={creatingSource || !newSourceName.trim()}
            onClick={handleCreateSource}
            sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            {creatingSource ? <CircularProgress size={18} color="inherit" /> : 'Set Up Source'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 🌟 8. STEP PROMPT DIALOG */}
      <Dialog open={!!stepPromptItem} onClose={() => setStepPromptItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Confirm Savings Deposit</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 13, color: textPrimary }}>
              Completing <strong>&ldquo;{stepPromptItem?.task}&rdquo;</strong>.
            </Typography>

            <Typography sx={{ fontSize: 12, color: textMuted }}>
              Confirm the savings amount saved to add to your goal total & finance source:
            </Typography>

            <TextField
              label={`Deposit Amount (${currency})`}
              type="number"
              fullWidth
              size="small"
              autoFocus
              value={stepPromptAmount}
              onChange={(e) => setStepPromptAmount(e.target.value ? Number(e.target.value) : '')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setStepPromptItem(null)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              disabled={savingStepPrompt}
              onClick={() => handleConfirmStepPrompt(false)}
              sx={{ textTransform: 'none' }}
            >
              Skip Amount
            </Button>
            <Button
              variant="contained"
              disabled={savingStepPrompt || typeof stepPromptAmount !== 'number' || stepPromptAmount <= 0}
              onClick={() => handleConfirmStepPrompt(true)}
              sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
            >
              {savingStepPrompt ? 'Saving...' : 'Confirm & Deposit'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* 🌟 9. REMINDER FREQUENCY SETTINGS DIALOG */}
      <Dialog open={freqSettingsOpen} onClose={() => setFreqSettingsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Savings Check-In Frequency</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 13, color: textMuted }}>
              Choose how often you would like to receive a check-in message asking if you have saved money:
            </Typography>
            <Stack spacing={1}>
              {(['daily', 'weekly', 'monthly', 'custom'] as const).map((freq) => (
                <Button
                  key={freq}
                  variant={reminderFreq === freq ? 'contained' : 'outlined'}
                  onClick={() => handleUpdateReminderFreq(freq)}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'capitalize',
                    fontWeight: 700,
                    borderRadius: '12px',
                    bgcolor: reminderFreq === freq ? '#10b981' : 'transparent',
                    '&:hover': { bgcolor: reminderFreq === freq ? '#059669' : undefined },
                  }}
                >
                  {freq === 'custom' ? `Custom (${customIntervalDays} days)` : freq}
                </Button>
              ))}
            </Stack>
            {reminderFreq === 'custom' && (
              <TextField
                label="Custom Interval (Days)"
                type="number"
                size="small"
                value={customIntervalDays}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCustomIntervalDays(val);
                  handleUpdateReminderFreq('custom', val);
                }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setFreqSettingsOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
