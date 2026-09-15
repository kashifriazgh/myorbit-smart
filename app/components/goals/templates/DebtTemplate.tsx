'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
  Modal,
  Fade,
  Collapse,
} from '@mui/material';
import {
  Person as PersonIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  CalendarToday as CalendarIcon,
  MonetizationOn as MoneyIcon,
  LinkOff as LinkOffIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { Goal, LoanRecord } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface DebtCheckIn {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface UnifiedDebtItem {
  id: string;
  type: 'borrow' | 'lend'; // borrow = You Owe, lend = Owed to You
  counterparty: string;
  entityType?: 'person' | 'org';
  amount: number;
  paidAmount: number;
  dueDate: string;
  isSettled?: boolean;
  notes?: string;
  checkIns?: DebtCheckIn[];
}

export interface DebtActionItem {
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

interface DebtTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

const toPlainDate = (value: unknown): Date | null => {
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
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

function formatMoney(value: number, currency: string = 'PKR') {
  const displayCurrency = currency === 'units' ? 'PKR' : currency;
  const sign = value < 0 ? '-' : '';
  return `${sign}${displayCurrency} ${Math.round(Math.abs(value)).toLocaleString()}`;
}

function formatDate(val: unknown) {
  if (!val) return '—';
  const d = toPlainDate(val);
  if (!d || Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function calculateDebtProgress(rec: UnifiedDebtItem): number {
  if (!rec.amount || rec.amount <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((rec.paidAmount / rec.amount) * 100)));
}

export default function DebtTemplate({ goal, onUpdateGoal }: DebtTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { addTodo, updateTodo, deleteTodo } = useTodoContext();
  const { addSchedule, editSchedule, removeSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};
  const rawUnit = goal.overallTargetUnit || answers.currency || 'PKR';
  const currency = String(rawUnit === 'units' ? 'PKR' : rawUnit);

  const [loading, setLoading] = useState(true);
  const [debtItems, setDebtItems] = useState<UnifiedDebtItem[]>([]);
  const [allUserLoans, setAllUserLoans] = useState<UnifiedDebtItem[]>([]);
  const [linkedLoanIds, setLinkedLoanIds] = useState<string[]>(() => goal.linkedLoanIds || []);

  // Loan Picker Modal State
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);

  // Strategy Tasks State
  const [actions, setActions] = useState<DebtActionItem[]>(() => {
    if (Array.isArray(goal.actions)) return goal.actions as unknown as DebtActionItem[];
    if (Array.isArray(goal.steps)) {
      return (goal.steps as unknown as Array<Record<string, unknown>>).map((s, idx) => ({
        id: String(s.id || `step_${idx}`),
        task: String(s.task || s.title || ''),
        done: Boolean(s.done || s.status === 'completed'),
        sourceId: String(s.sourceId || ''),
        sourceName: String(s.sourceName || ''),
        assumedContributionValue: Number(s.assumedContributionValue || 0),
        kind: (s.kind as 'schedule' | 'todo') || (s.linkedType as 'schedule' | 'todo') || undefined,
        scheduleId: String(s.scheduleId || s.linkedItemId || ''),
        todoId: String(s.todoId || ''),
      }));
    }
    return [];
  });
  const [newGeneralStepInput, setNewGeneralStepInput] = useState('');

  // Strategy Task Details Modal State
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<DebtActionItem | null>(null);
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

  // Fetch loans from Firestore `loans` collection
  const fetchLoans = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'loans'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched: UnifiedDebtItem[] = snap.docs.map((d) => {
        const data = d.data() as LoanRecord;
        const dt = toPlainDate(data.dueDate);
        return {
          id: d.id,
          type: data.type === 'lend' ? 'lend' : 'borrow',
          counterparty: data.counterparty || 'Debt Account',
          entityType: 'person',
          amount: Number(data.amount || 0),
          paidAmount: Number(data.paidAmount || 0),
          dueDate: dt ? dt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          isSettled: data.isSettled ?? false,
          notes: data.notes || data.note || '',
          checkIns: [],
        };
      });

      setAllUserLoans(fetched);
      // ONLY include loans that are explicitly linked in linkedLoanIds
      const linked = fetched.filter((item) => linkedLoanIds.includes(item.id));
      setDebtItems(linked);
    } catch (err) {
      console.error('Error fetching loans in DebtTemplate:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, linkedLoanIds]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // Modal Dialog State for Add / Edit Debt Account
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formType, setFormType] = useState<'borrow' | 'lend'>('borrow');
  const [formCounterparty, setFormCounterparty] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formPaidAmount, setFormPaidAmount] = useState<number | ''>(0);
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  // Modal Dialog for Payment / Collection Entry Log
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [targetRecordForLog, setTargetRecordForLog] = useState<UnifiedDebtItem | null>(null);
  const [logAmountInput, setLogAmountInput] = useState<number | ''>('');
  const [logNoteInput, setLogNoteInput] = useState('');
  const [loggingProgress, setLoggingProgress] = useState(false);

  // Group Borrow (You Owe / Payback Top) vs Lend (Owed to You / Recoverable Below)
  const borrowRecords = useMemo(() => debtItems.filter((r) => r.type === 'borrow'), [debtItems]);
  const lendRecords = useMemo(() => debtItems.filter((r) => r.type === 'lend'), [debtItems]);

  // Overall Debt Totals & Mean Progress
  const totals = useMemo(() => {
    let totalBorrowRemaining = 0;
    let totalBorrowCleared = 0;
    let totalBorrowTarget = 0;

    let totalLendRemaining = 0;
    let totalLendCleared = 0;
    let totalLendTarget = 0;

    let sumProg = 0;
    debtItems.forEach((r) => {
      const rem = Math.max(0, r.amount - r.paidAmount);
      if (r.type === 'borrow') {
        totalBorrowRemaining += rem;
        totalBorrowCleared += r.paidAmount;
        totalBorrowTarget += r.amount;
      } else {
        totalLendRemaining += rem;
        totalLendCleared += r.paidAmount;
        totalLendTarget += r.amount;
      }
      sumProg += calculateDebtProgress(r);
    });

    const meanProgress = debtItems.length > 0 ? Math.max(0, Math.min(100, Math.round(sumProg / debtItems.length))) : 0;
    return {
      totalBorrowRemaining,
      totalBorrowCleared,
      totalBorrowTarget,
      totalLendRemaining,
      totalLendCleared,
      totalLendTarget,
      meanProgress,
    };
  }, [debtItems]);

  // Helper: Persist Actions list to Goal
  const saveActionsList = async (updated: DebtActionItem[]) => {
    setActions(updated);
    if (goal.id) {
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, { actions: updated as unknown as Goal['actions'] });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), { actions: updated });
      }
    }
  };

  // Sync Mean Progress to goal document
  const syncGoalProgress = async (items: UnifiedDebtItem[]) => {
    if (!goal.id) return;
    let sumProg = 0;
    for (const r of items) {
      sumProg += calculateDebtProgress(r);
    }
    const newMean = items.length > 0 ? Math.max(0, Math.min(100, Math.round(sumProg / items.length))) : 0;
    const newTotalCleared = items.reduce((sum, r) => sum + r.paidAmount, 0);
    const newTotalAmount = items.reduce((sum, r) => sum + r.amount, 0);

    const payload = {
      progress: newMean,
      currentValue: newTotalCleared,
      overallTargetValue: newTotalAmount,
      linkedLoanIds,
    };

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, payload);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), payload);
    }
  };

  // Open Loan Picker Modal
  const handleOpenPicker = async () => {
    if (!user?.uid) return;
    try {
      const q = query(collection(db, 'loans'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched: UnifiedDebtItem[] = snap.docs.map((d) => {
        const data = d.data() as LoanRecord;
        const dt = toPlainDate(data.dueDate);
        return {
          id: d.id,
          type: data.type === 'lend' ? 'lend' : 'borrow',
          counterparty: data.counterparty || 'Debt Account',
          entityType: 'person',
          amount: Number(data.amount || 0),
          paidAmount: Number(data.paidAmount || 0),
          dueDate: dt ? dt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          isSettled: data.isSettled ?? false,
          notes: data.notes || data.note || '',
          checkIns: [],
        };
      });

      setAllUserLoans(fetched);
      setSelectedLoanIds(linkedLoanIds);
      setPickerOpen(true);
    } catch (err) {
      console.error('Error opening loan picker:', err);
    }
  };

  // Save Loan Picker selection
  const handleSavePicker = async () => {
    setLinkedLoanIds(selectedLoanIds);
    const filtered = allUserLoans.filter((item) => selectedLoanIds.includes(item.id));
    setDebtItems(filtered);

    if (goal.id) {
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, { linkedLoanIds: selectedLoanIds });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), { linkedLoanIds: selectedLoanIds });
      }
    }
    await syncGoalProgress(filtered);
    setPickerOpen(false);
  };

  // Open Modal to Add / Edit Debt Account
  const handleOpenModal = (item?: UnifiedDebtItem) => {
    if (item) {
      setEditingId(item.id);
      setFormType(item.type);
      setFormCounterparty(item.counterparty);
      setFormAmount(item.amount);
      setFormPaidAmount(item.paidAmount);
      setFormDueDate(item.dueDate || new Date().toISOString().split('T')[0]);
      setFormNotes(item.notes || '');
    } else {
      setEditingId(null);
      setFormType('borrow');
      setFormCounterparty('');
      setFormAmount('');
      setFormPaidAmount(0);
      setFormDueDate(new Date().toISOString().split('T')[0]);
      setFormNotes('');
    }
    setDialogOpen(true);
  };

  const handleSaveRecord = async () => {
    if (!formCounterparty.trim() || !user?.uid || typeof formAmount !== 'number' || formAmount <= 0) return;
    setSavingRecord(true);

    try {
      const paidVal = typeof formPaidAmount === 'number' ? formPaidAmount : 0;
      const isSettled = paidVal >= formAmount;

      if (editingId) {
        await updateDoc(doc(db, 'loans', editingId), {
          counterparty: formCounterparty.trim(),
          type: formType,
          amount: formAmount,
          paidAmount: paidVal,
          dueDate: formDueDate ? Timestamp.fromDate(new Date(formDueDate)) : serverTimestamp(),
          notes: formNotes.trim(),
          isSettled,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create in root loans collection AND link to this goal!
        const docRef = await addDoc(collection(db, 'loans'), {
          userId: user.uid,
          counterparty: formCounterparty.trim(),
          type: formType,
          amount: formAmount,
          paidAmount: paidVal,
          dueDate: formDueDate ? Timestamp.fromDate(new Date(formDueDate)) : serverTimestamp(),
          notes: formNotes.trim(),
          isSettled,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const updatedLinked = [...linkedLoanIds, docRef.id];
        setLinkedLoanIds(updatedLinked);
        if (goal.id) {
          if (onUpdateGoal) {
            await onUpdateGoal(goal.id, { linkedLoanIds: updatedLinked });
          } else {
            await updateDoc(doc(db, 'goals', goal.id), { linkedLoanIds: updatedLinked });
          }
        }
      }

      setDialogOpen(false);
      await fetchLoans();
    } catch (err) {
      console.error('Failed to save debt record:', err);
    } finally {
      setSavingRecord(false);
    }
  };

  // Unlink loan from goal
  const handleUnlinkRecord = async (loanId: string) => {
    const updatedLinked = linkedLoanIds.filter((id) => id !== loanId);
    setLinkedLoanIds(updatedLinked);
    const updatedItems = debtItems.filter((r) => r.id !== loanId);
    setDebtItems(updatedItems);

    if (goal.id) {
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, { linkedLoanIds: updatedLinked });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), { linkedLoanIds: updatedLinked });
      }
    }
    await syncGoalProgress(updatedItems);
  };

  // Log Payment / Collection Entry
  const handleOpenLogModal = (item: UnifiedDebtItem) => {
    setTargetRecordForLog(item);
    setLogAmountInput('');
    setLogNoteInput('');
    setLogModalOpen(true);
  };

  const handleConfirmLogEntry = async () => {
    if (!targetRecordForLog || typeof logAmountInput !== 'number' || logAmountInput <= 0) return;
    setLoggingProgress(true);

    try {
      const newPaid = Math.min(targetRecordForLog.amount, targetRecordForLog.paidAmount + logAmountInput);
      const isSettled = newPaid >= targetRecordForLog.amount;

      await updateDoc(doc(db, 'loans', targetRecordForLog.id), {
        paidAmount: newPaid,
        isSettled,
        updatedAt: serverTimestamp(),
      });

      const updatedItems = debtItems.map((rec) => {
        if (rec.id === targetRecordForLog.id) {
          const newCheckIn: DebtCheckIn = {
            id: 'ci_' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            amount: logAmountInput,
            note: logNoteInput.trim() || (rec.type === 'borrow' ? 'Payback payment' : 'Collection entry'),
          };
          return {
            ...rec,
            paidAmount: newPaid,
            isSettled,
            checkIns: [...(rec.checkIns || []), newCheckIn],
          };
        }
        return rec;
      });

      setDebtItems(updatedItems);
      await syncGoalProgress(updatedItems);
      setLogModalOpen(false);
    } catch (err) {
      console.error('Error logging debt payment checkin:', err);
    } finally {
      setLoggingProgress(false);
    }
  };

  // Open Log / Update Progress Modal for Debt Goal
  const handleOpenProgressModal = () => {
    const totalCleared = debtItems.reduce((sum, r) => sum + r.paidAmount, 0);
    setProgressInputAmount(totalCleared);
    setProgressDialogOpen(true);
  };

  // Confirm Log / Update Progress
  const handleSaveProgress = async () => {
    if (typeof progressInputAmount !== 'number' || progressInputAmount < 0 || !user || !goal.id) return;
    setSavingProgress(true);

    try {
      const totalAmount = debtItems.reduce((sum, r) => sum + r.amount, 0);
      const newPct = totalAmount > 0 ? Math.max(0, Math.min(100, Math.round((progressInputAmount / totalAmount) * 100))) : totals.meanProgress;

      const payload = {
        currentValue: progressInputAmount,
        progress: newPct,
      };

      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, payload);
      } else {
        await updateDoc(doc(db, 'goals', goal.id), payload);
      }
      setProgressDialogOpen(false);
    } catch (err) {
      console.error('Failed to update progress:', err);
    } finally {
      setSavingProgress(false);
    }
  };

  // Add Strategic Action Step (can be linked to a specific debt account or general)
  const handleAddStep = async (taskText: string, sourceId?: string, sourceName?: string) => {
    const text = taskText.trim();
    if (!text) return;

    const newStep: DebtActionItem = {
      id: 'step_' + Date.now(),
      task: text,
      done: false,
      sourceId: sourceId || undefined,
      sourceName: sourceName || undefined,
    };
    const updated = [...actions, newStep];
    await saveActionsList(updated);
  };

  // Delete Action Step
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
  const handleOpenTaskDetailModal = (step: DebtActionItem) => {
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
              priority: 'urgent',
              projectId: goal.projectId || '',
              authorId: user?.uid || '',
              dueDate: new Date(targetDate),
              steps: [],
              tags: activeStep.sourceName ? [activeStep.sourceName] : [],
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
  const handleToggleStepCompletion = async (step: DebtActionItem) => {
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

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── 1. Top Summary Banner Card ── */}
      <Box
        sx={{
          borderRadius: '28px',
          border: `1.5px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#fecdd3'}`,
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
          p: 3.5,
          boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 8px 30px rgba(239,68,68,0.06)',
          mb: 3.5,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Manage Debt & Borrowed Loans
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: textPrimary, mt: 0.5 }}>
              {goal.title}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip
              label={`${totals.meanProgress}% Settled`}
              size="small"
              sx={{
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                fontWeight: 800,
                fontSize: 12,
                px: 0.5,
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
              }}
            />

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
                bgcolor: surfaceBg,
                '&:hover': { bgcolor: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5', borderColor: '#059669' },
              }}
            >
              Update Progress
            </Button>
          </Stack>
        </Box>

        {/* Breakdown Grid (Payback vs Recoverable) */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 3 }}>
          <Box sx={{ p: 2, borderRadius: '18px', bgcolor: isDark ? '#450a0a' : '#fef2f2', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>
              You Owe (Borrowed Loans)
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace', mt: 0.5 }}>
              {formatMoney(totals.totalBorrowRemaining, currency)}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: textMuted, mt: 0.3 }}>
              {formatMoney(totals.totalBorrowCleared, currency)} cleared of {formatMoney(totals.totalBorrowTarget, currency)}
            </Typography>
          </Box>

          <Box sx={{ p: 2, borderRadius: '18px', bgcolor: isDark ? '#064e3b' : '#ecfdf5', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>
              Owed to You (Lended Loans)
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#10b981', fontFamily: 'monospace', mt: 0.5 }}>
              {formatMoney(totals.totalLendRemaining, currency)}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: textMuted, mt: 0.3 }}>
              {formatMoney(totals.totalLendCleared, currency)} collected of {formatMoney(totals.totalLendTarget, currency)}
            </Typography>
          </Box>
        </Box>

        {/* Overall Mean Progress Bar */}
        <Box sx={{ mt: 2.5, height: 8, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              width: `${totals.meanProgress}%`,
              background: 'linear-gradient(90deg, #ef4444 0%, #10b981 100%)',
              borderRadius: 99,
              transition: 'width 0.6s ease',
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, fontSize: 12, color: textMuted }}>
          <span>Overall Mean Debt Settlement Progress</span>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{totals.meanProgress}% Cleared</span>
        </Box>
      </Box>

      {/* ── 2. Borrowed / Payback Debts Section (Shown at Top) ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            💸 Borrowed Debts — You Owe ({borrowRecords.length})
          </Typography>
          {borrowRecords.length > 0 && (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={handleOpenPicker}
                startIcon={<LinkIcon sx={{ fontSize: 16 }} />}
                sx={{
                  textTransform: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#3b82f6',
                  border: '1px solid #bfdbfe',
                  bgcolor: 'rgba(59, 130, 246, 0.08)',
                  borderRadius: '10px',
                  px: 1.5,
                  py: 0.6,
                  '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.16)' },
                }}
              >
                Select Existing Loans
              </Button>
              <Button
                size="small"
                onClick={() => handleOpenModal()}
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                sx={{
                  textTransform: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#ffffff',
                  bgcolor: '#ef4444',
                  borderRadius: '10px',
                  px: 2,
                  py: 0.6,
                  '&:hover': { bgcolor: '#dc2626' },
                }}
              >
                + Create Debt Account
              </Button>
            </Stack>
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress color="error" />
          </Box>
        ) : borrowRecords.length === 0 ? (
          <Box
            sx={{
              p: 3.5,
              borderRadius: '22px',
              border: `2px dashed ${isDark ? 'rgba(239,68,68,0.4)' : '#fecdd3'}`,
              bgcolor: isDark ? 'rgba(69,10,10,0.2)' : '#fff5f5',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
              No borrowed loans linked to this goal yet 🤝
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: textMuted, mt: 0.5, mb: 2.5 }}>
              Choose existing loans from your Loans collection or create a new debt account.
            </Typography>
            <Stack direction="row" spacing={1.5} justifyContent="center">
              <Button
                variant="outlined"
                onClick={handleOpenPicker}
                startIcon={<LinkIcon />}
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: 13,
                  px: 2.5,
                  borderColor: '#3b82f6',
                  color: '#3b82f6',
                }}
              >
                Select Existing Loans
              </Button>
              <Button
                variant="contained"
                onClick={() => handleOpenModal()}
                startIcon={<AddIcon />}
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: 13,
                  bgcolor: '#ef4444',
                  px: 2.5,
                  '&:hover': { bgcolor: '#dc2626' },
                }}
              >
                Create Debt Account
              </Button>
            </Stack>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {borrowRecords.map((r) => {
              const remaining = Math.max(0, r.amount - r.paidAmount);
              const prog = calculateDebtProgress(r);
              const daysLeft = daysUntil(r.dueDate);

              return (
                <Box
                  key={r.id}
                  sx={{
                    borderRadius: '22px',
                    border: `1.5px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#fecdd3'}`,
                    bgcolor: surfaceBg,
                    p: 2.5,
                    boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 4px 16px rgba(239,68,68,0.04)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: '14px',
                          bgcolor: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <PersonIcon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
                          {r.counterparty}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: textMuted }}>
                          Borrowed Loan
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={prog >= 100 ? 'Paid Off' : 'You Owe (Borrow)'}
                        size="small"
                        sx={{
                          fontSize: 11,
                          fontWeight: 800,
                          bgcolor: prog >= 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: prog >= 100 ? '#10b981' : '#ef4444',
                          border: `1px solid ${prog >= 100 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        }}
                      />
                      <IconButton size="small" onClick={() => handleOpenModal(r)}>
                        <EditIcon sx={{ fontSize: 17, color: textMuted }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Unlink from goal"
                        onClick={() => handleUnlinkRecord(r.id)}
                        sx={{ color: textMuted }}
                      >
                        <LinkOffIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography sx={{ fontSize: 26, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace' }}>
                        {formatMoney(remaining, currency)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: textMuted }}>
                        remaining (cleared {formatMoney(r.paidAmount, currency)} of {formatMoney(r.amount, currency)})
                      </Typography>
                    </Box>

                    {/* 🌟 HUMAN FRIENDLY "Have you paid some amount?" BUTTON */}
                    <Button
                      size="small"
                      onClick={() => handleOpenLogModal(r)}
                      startIcon={<MoneyIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#ffffff',
                        bgcolor: '#10b981',
                        borderRadius: '10px',
                        px: 1.75,
                        py: 0.6,
                        '&:hover': { bgcolor: '#059669' },
                      }}
                    >
                      Have you paid some amount?
                    </Button>
                  </Box>

                  <Box sx={{ mt: 1.5, height: 7, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${prog}%`,
                        bgcolor: prog >= 100 ? '#10b981' : '#ef4444',
                        borderRadius: 99,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, fontSize: 11, color: textMuted }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarIcon sx={{ fontSize: 13 }} />
                      <span>Due Date: {formatDate(r.dueDate)}</span>
                      {daysLeft !== null && (
                        <span style={{ color: daysLeft < 0 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
                          ({daysLeft >= 0 ? `${daysLeft} days left` : 'overdue'})
                        </span>
                      )}
                    </Box>
                    <span style={{ fontWeight: 700, color: prog >= 100 ? '#10b981' : textPrimary }}>
                      {prog}% Paid Off
                    </span>
                  </Box>

                  {/* 🌟 EMBEDDED PER-ITEM STRATEGY TASKS SECTION */}
                  <ItemStrategyTaskBox
                    sourceId={r.id}
                    sourceName={r.counterparty}
                    actions={actions}
                    currency={currency}
                    isDark={isDark}
                    onToggleStep={handleToggleStepCompletion}
                    onOpenModal={handleOpenTaskDetailModal}
                    onDeleteStep={handleDeleteStep}
                    onAddStep={handleAddStep}
                  />
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* ── 3. Lended / Recoverable Debts Section (Shown Below) ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            💰 Lended Debts — Owed to You ({lendRecords.length})
          </Typography>
        </Box>

        {lendRecords.length === 0 ? (
          <Box
            sx={{
              p: 3,
              borderRadius: '18px',
              border: `1.5px dashed ${cardBorder}`,
              bgcolor: surfaceBg,
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: 13, color: textMuted }}>
              No lended debt records linked. Click <strong>Select Existing Loans</strong> or create a new debt account!
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {lendRecords.map((r) => {
              const remaining = Math.max(0, r.amount - r.paidAmount);
              const prog = calculateDebtProgress(r);

              return (
                <Box
                  key={r.id}
                  sx={{
                    borderRadius: '22px',
                    border: `1.5px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#bbf7d0'}`,
                    bgcolor: surfaceBg,
                    p: 2.5,
                    boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 4px 16px rgba(16,185,129,0.04)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: '14px',
                          bgcolor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <PersonIcon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
                          {r.counterparty}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: textMuted }}>
                          Lended Loan
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={prog >= 100 ? 'Fully Collected' : 'Lended'}
                        size="small"
                        sx={{
                          fontSize: 11,
                          fontWeight: 800,
                          bgcolor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                        }}
                      />
                      <IconButton size="small" onClick={() => handleOpenModal(r)}>
                        <EditIcon sx={{ fontSize: 17, color: textMuted }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Unlink from goal"
                        onClick={() => handleUnlinkRecord(r.id)}
                        sx={{ color: textMuted }}
                      >
                        <LinkOffIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography sx={{ fontSize: 26, fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>
                        {formatMoney(remaining, currency)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: textMuted }}>
                        remaining to collect (collected {formatMoney(r.paidAmount, currency)} of {formatMoney(r.amount, currency)})
                      </Typography>
                    </Box>

                    {/* 🌟 HUMAN FRIENDLY "Have you received some payment?" BUTTON */}
                    <Button
                      size="small"
                      onClick={() => handleOpenLogModal(r)}
                      startIcon={<MoneyIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#ffffff',
                        bgcolor: '#10b981',
                        borderRadius: '10px',
                        px: 1.75,
                        py: 0.6,
                        '&:hover': { bgcolor: '#059669' },
                      }}
                    >
                      Have you received some payment?
                    </Button>
                  </Box>

                  <Box sx={{ mt: 1.5, height: 7, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${prog}%`,
                        bgcolor: '#10b981',
                        borderRadius: 99,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </Box>

                  {/* 🌟 EMBEDDED PER-ITEM STRATEGY TASKS SECTION */}
                  <ItemStrategyTaskBox
                    sourceId={r.id}
                    sourceName={r.counterparty}
                    actions={actions}
                    currency={currency}
                    isDark={isDark}
                    onToggleStep={handleToggleStepCompletion}
                    onOpenModal={handleOpenTaskDetailModal}
                    onDeleteStep={handleDeleteStep}
                    onAddStep={handleAddStep}
                  />
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* ── 4. GENERAL STRATEGY TASKS OVERVIEW SECTION ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: textPrimary, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              🎯 All Strategy Tasks ({actions.length})
            </Typography>
            <Typography sx={{ fontSize: 11, color: textMuted, mt: 0.2 }}>
              Overview of all repayment & collection action steps across your debt accounts
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
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-sm font-semibold truncate ${
                        step.done
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {step.task}
                    </span>
                    {step.sourceName && (
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        Account: {step.sourceName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Expected settlement contribution amount pill */}
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

        {/* Inline Add General Strategic Action Step Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="+ Add a general strategy task…"
            value={newGeneralStepInput}
            onChange={(e) => setNewGeneralStepInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddStep(newGeneralStepInput);
                setNewGeneralStepInput('');
              }
            }}
            className="flex-1 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => {
              handleAddStep(newGeneralStepInput);
              setNewGeneralStepInput('');
            }}
            disabled={!newGeneralStepInput.trim()}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold transition-colors shadow-sm"
          >
            Add Task
          </button>
        </div>
      </Box>

      {/* ── Dialog 1: Add / Edit Debt Account Dialog ── */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1,
            bgcolor: surfaceBg,
            boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(239,68,68,0.12)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17, pt: 2, px: 3, pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '14px',
              bgcolor: formType === 'borrow'
                ? (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)')
                : (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'),
              color: formType === 'borrow' ? '#ef4444' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {formType === 'borrow' ? <PersonIcon sx={{ fontSize: 22 }} /> : <MoneyIcon sx={{ fontSize: 22 }} />}
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 17, color: textPrimary }}>
              {editingId ? 'Edit Debt Account' : 'Create Debt Account'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>
              {formType === 'borrow' ? 'Money you borrowed to pay back' : 'Money you lended to collect'}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2 }}>
          <Stack spacing={2.5}>
            {/* Custom Segmented Pill Type Selector */}
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, mb: 1 }}>
                Account Classification
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  p: 0.5,
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f1f5f9',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                }}
              >
                <Button
                  fullWidth
                  onClick={() => setFormType('borrow')}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: 12.5,
                    py: 0.9,
                    color: formType === 'borrow' ? '#ffffff' : textMuted,
                    bgcolor: formType === 'borrow' ? '#ef4444' : 'transparent',
                    boxShadow: formType === 'borrow' ? '0 2px 8px rgba(239, 68, 68, 0.3)' : 'none',
                    '&:hover': {
                      bgcolor: formType === 'borrow' ? '#dc2626' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                    },
                  }}
                >
                  💸 Borrowed (You Owe)
                </Button>
                <Button
                  fullWidth
                  onClick={() => setFormType('lend')}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: 12.5,
                    py: 0.9,
                    color: formType === 'lend' ? '#ffffff' : textMuted,
                    bgcolor: formType === 'lend' ? '#10b981' : 'transparent',
                    boxShadow: formType === 'lend' ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
                    '&:hover': {
                      bgcolor: formType === 'lend' ? '#059669' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                    },
                  }}
                >
                  💰 Lended (Owed to You)
                </Button>
              </Box>
            </Box>

            <TextField
              label="Counterparty / Person / Bank Name"
              placeholder="e.g. Ahmed Khan, Meezan Bank Loan"
              fullWidth
              variant="outlined"
              size="small"
              value={formCounterparty}
              onChange={(e) => setFormCounterparty(e.target.value)}
              InputProps={{
                sx: { borderRadius: '14px', fontSize: 14 },
              }}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField
                label={`Total Debt (${currency})`}
                type="number"
                fullWidth
                size="small"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value ? Number(e.target.value) : '')}
                InputProps={{
                  sx: { borderRadius: '14px', fontSize: 14, fontWeight: 700, fontFamily: 'monospace' },
                }}
              />

              <TextField
                label={`Paid Amount (${currency})`}
                type="number"
                fullWidth
                size="small"
                value={formPaidAmount}
                onChange={(e) => setFormPaidAmount(e.target.value ? Number(e.target.value) : '')}
                InputProps={{
                  sx: { borderRadius: '14px', fontSize: 14, fontWeight: 700, fontFamily: 'monospace' },
                }}
              />
            </Box>

            <TextField
              label="Due Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              InputProps={{
                sx: { borderRadius: '14px', fontSize: 13 },
              }}
            />

            <TextField
              label="Notes (Optional)"
              placeholder="e.g. Monthly installment plan or details"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              InputProps={{
                sx: { borderRadius: '14px', fontSize: 13 },
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            sx={{ textTransform: 'none', borderRadius: '12px', fontWeight: 600, color: textMuted }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingRecord || !formCounterparty.trim() || typeof formAmount !== 'number' || formAmount <= 0}
            onClick={handleSaveRecord}
            startIcon={savingRecord ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              borderRadius: '12px',
              px: 3,
              py: 1,
              bgcolor: formType === 'borrow' ? '#ef4444' : '#10b981',
              boxShadow: formType === 'borrow' ? '0 4px 14px rgba(239, 68, 68, 0.35)' : '0 4px 14px rgba(16, 185, 129, 0.35)',
            }}
          >
            {savingRecord ? 'Saving...' : editingId ? 'Update Debt Account' : 'Save Debt Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog 2: "Have you paid / received some payment?" Log Dialog ── */}
      <Dialog
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
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
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17, pt: 2, px: 3, pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
            <MoneyIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: textPrimary }}>
              {targetRecordForLog?.type === 'borrow' ? 'Have you paid some amount?' : 'Have you received some payment?'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>
              {targetRecordForLog?.counterparty}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2 }}>
          <Stack spacing={2}>
            <Typography sx={{ fontSize: 12.5, color: textMuted }}>
              Enter the amount {targetRecordForLog?.type === 'borrow' ? 'paid off towards' : 'collected from'} <strong>{targetRecordForLog?.counterparty}</strong>.
            </Typography>
            <TextField
              label={`Amount (${currency})`}
              type="number"
              fullWidth
              autoFocus
              variant="outlined"
              value={logAmountInput}
              onChange={(e) => setLogAmountInput(e.target.value ? Number(e.target.value) : '')}
              InputProps={{
                sx: { borderRadius: '14px', fontSize: 16, fontWeight: 800, fontFamily: 'monospace' },
              }}
            />
            <TextField
              label="Note (Optional)"
              placeholder="e.g. Monthly installment via Bank Transfer"
              fullWidth
              variant="outlined"
              value={logNoteInput}
              onChange={(e) => setLogNoteInput(e.target.value)}
              InputProps={{
                sx: { borderRadius: '12px', fontSize: 13 },
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setLogModalOpen(false)} sx={{ textTransform: 'none', borderRadius: '12px', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={loggingProgress || typeof logAmountInput !== 'number' || logAmountInput <= 0}
            onClick={handleConfirmLogEntry}
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
            {loggingProgress ? <CircularProgress size={18} color="inherit" /> : 'Save Progress'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog 3: UPDATE PROGRESS MODAL ── */}
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
              Update your cleared debt / collection total towards this goal.
            </Typography>

            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: isDark ? 'rgba(15,23,42,0.5)' : '#f8fafc', border: `1px solid ${cardBorder}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted }}>Current Cleared</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>
                  {formatMoney(debtItems.reduce((sum, r) => sum + r.paidAmount, 0), currency)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted }}>Total Debt</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>
                  {formatMoney(debtItems.reduce((sum, r) => sum + r.amount, 0), currency)}
                </Typography>
              </Box>
            </Box>

            <TextField
              label={`New Total Cleared (${currency})`}
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

      {/* ── Dialog 4: STRATEGY TASK DETAIL MODAL ── */}
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

              {/* Expected Settlement Amount Row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Expected Settlement
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Amount cleared when this task is done
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
                          <ScheduleIcon sx={{ fontSize: 13 }} /> Todo Details
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

      {/* ── Dialog 5: LINK EXISTING LOANS PICKER DIALOG ── */}
      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '24px', p: 1, bgcolor: surfaceBg } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17, pb: 1, color: textPrimary }}>
          Select Loans to Include in Goal
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 12, color: textMuted }}>
              Choose which loans from your Loans records should be tracked as items under this goal:
            </Typography>

            {allUserLoans.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: textMuted, py: 2, textAlign: 'center' }}>
                No loans found in your Loans section. Create a new debt account below!
              </Typography>
            ) : (
              allUserLoans.map((loan) => {
                const isSelected = selectedLoanIds.includes(loan.id);
                const isBorrow = loan.type === 'borrow';

                return (
                  <Box
                    key={loan.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedLoanIds(selectedLoanIds.filter((id) => id !== loan.id));
                      } else {
                        setSelectedLoanIds([...selectedLoanIds, loan.id]);
                      }
                    }}
                    sx={{
                      p: 2,
                      borderRadius: '16px',
                      border: `1.5px solid ${isSelected ? (isBorrow ? '#ef4444' : '#10b981') : cardBorder}`,
                      bgcolor: isSelected ? (isBorrow ? (isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2') : (isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5')) : surfaceBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-emerald-500"
                      />
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 800, color: textPrimary }}>
                          {loan.counterparty}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: textMuted }}>
                          {isBorrow ? 'You Owe (Borrow)' : 'Owed to You (Lend)'} · Due {formatDate(loan.dueDate)}
                        </Typography>
                      </Box>
                    </Box>

                    <Typography sx={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: isBorrow ? '#ef4444' : '#10b981' }}>
                      {formatMoney(loan.amount - loan.paidAmount, currency)}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setPickerOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePicker}
            sx={{ textTransform: 'none', fontWeight: 800, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Save Selection
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// 🌟 PER-ITEM STRATEGY TASK BOX COMPONENT FOR DEBT ITEMS
function ItemStrategyTaskBox({
  sourceId,
  sourceName,
  actions,
  currency,
  isDark,
  onToggleStep,
  onOpenModal,
  onDeleteStep,
  onAddStep,
}: {
  sourceId: string;
  sourceName: string;
  actions: DebtActionItem[];
  currency: string;
  isDark: boolean;
  onToggleStep: (step: DebtActionItem) => void;
  onOpenModal: (step: DebtActionItem) => void;
  onDeleteStep: (stepId: string) => void;
  onAddStep: (taskText: string, sourceId?: string, sourceName?: string) => void;
}) {
  const [inputVal, setInputVal] = useState('');
  const itemActions = useMemo(() => actions.filter((a) => a.sourceId === sourceId), [actions, sourceId]);

  const handleAdd = () => {
    if (!inputVal.trim()) return;
    onAddStep(inputVal, sourceId, sourceName);
    setInputVal('');
  };

  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: `1px dashed ${isDark ? '#334155' : '#e2e8f0'}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          🎯 Strategy Tasks for {sourceName} ({itemActions.length})
        </Typography>
      </Box>

      {itemActions.length > 0 && (
        <div className="space-y-1.5 mb-2.5">
          {itemActions.map((step) => {
            const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
            const hasLink = kind === 'schedule' || kind === 'todo';

            return (
              <div
                key={step.id}
                onClick={() => onOpenModal(step)}
                className="group flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStep(step);
                    }}
                    className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${
                      step.done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
                    }`}
                  >
                    {step.done && (
                      <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 stroke-current stroke-[3]">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <span
                    className={`text-xs font-semibold truncate ${
                      step.done
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {step.task}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {step.assumedContributionValue ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                      +{formatMoney(step.assumedContributionValue, currency)}
                    </span>
                  ) : null}

                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border transition-colors ${
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
                      : '+ Schedule/Todo'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteStep(step.id);
                    }}
                    className="p-0.5 text-slate-400 hover:text-rose-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete step"
                  >
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline Add Task Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={`+ Add strategy task for ${sourceName}…`}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          className="flex-1 text-xs font-medium px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!inputVal.trim()}
          className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold transition-colors shadow-sm shrink-0"
        >
          Add Task
        </button>
      </div>
    </Box>
  );
}
