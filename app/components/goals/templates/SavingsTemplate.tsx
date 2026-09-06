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
} from '@mui/material';
import {
  AccountBalanceWallet,
  Add as AddIcon,
  ArrowDownward,
  ArrowUpward,
  CalendarMonth,
  Event as EventIcon,
  Checklist as TodoIcon,
  Delete as DeleteIcon,
  AccessTime as ClockIcon,
  Check as CheckIcon,
  MonetizationOn,
  LinkOff,
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

interface SavingsTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
  onOpenAddMoney?: () => void;
}

function formatMoney(value: number, currency: string = 'PKR') {
  const sign = value < 0 ? '-' : '';
  return `${sign}${currency} ${Math.round(Math.abs(value)).toLocaleString()}`;
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
  const { todos, addTodo, updateTodo, deleteTodo } = useTodoContext();
  const { allSchedules, addSchedule, editSchedule, removeSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};
  const currency = String(goal.overallTargetUnit || answers.currency || 'PKR');
  const openingBalance = Number(answers.opening_balance || 0);

  const targetValue = goal.overallTargetValue || Number(answers.target_amount || answers.amount || 0);
  const targetDate = toPlainDate(goal.dueDate) || (answers.target_date ? toPlainDate(answers.target_date) : null);
  const startDate = toPlainDate(goal.createdAt);

  // Behind-the-scenes Finance source
  const [selectedSource, setSelectedSource] = useState<string>(
    String(goal.linkedSourceId || answers.saving_source || answers.fund_source || '')
  );

  // New source creation state (shown ONLY when no source exists yet)
  const [createSourceOpen, setCreateSourceOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [creatingSource, setCreatingSource] = useState(false);

  // Ledger Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (Array.isArray(goal.transactions)) return goal.transactions;
    return [];
  });

  // Sleek Add Money Dialog (ONLY Amount + Note)
  const [addTxnOpen, setAddTxnOpen] = useState(false);
  const [txnAmount, setTxnAmount] = useState<number | ''>('');
  const [txnNote, setTxnNote] = useState('');
  const [savingTxn, setSavingTxn] = useState(false);

  // Action Item (Schedule / Todo) creation modal states
  const [addActionOpen, setAddActionOpen] = useState(false);
  const [actionKind] = useState<'schedule' | 'todo'>('schedule');
  const [actionTitle, setActionTitle] = useState('');
  const [actionTime, setActionTime] = useState('10:00');
  const [actionDueDate, setActionDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [actionContributionAmount, setActionContributionAmount] = useState<number | ''>('');
  const [savingAction, setSavingAction] = useState(false);

  // Completion Prompt Dialog ("Have you got the amount?")
  const [promptItem, setPromptItem] = useState<{
    id: string;
    title: string;
    kind: 'schedule' | 'todo';
    assumedAmount: number;
  } | null>(null);
  const [promptAmount, setPromptAmount] = useState<number | ''>('');
  const [completingAction, setCompletingAction] = useState(false);

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
    if (!targetValue || targetValue <= 0) return null;
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

  // Combined timeline list of linked Schedules & Todos for this Savings Goal
  const actionItems = useMemo(() => {
    if (!goal.id) return [];
    const schedList = allSchedules
      .filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id)
      .map((s) => ({
        id: s.id || '',
        title: s.title,
        kind: 'schedule' as const,
        date: s.date,
        time: s.startTime || '10:00',
        status: s.status,
        assumedAmount: s.contributionAmount || 0,
      }));

    const todoList = todos
      .filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id)
      .map((t) => ({
        id: t.id || '',
        title: t.title,
        kind: 'todo' as const,
        date: formatDate(t.dueDate),
        time: 'Task',
        status: t.status,
        assumedAmount: 0,
      }));

    return [...schedList, ...todoList];
  }, [allSchedules, todos, goal.id]);

  // Behind-the-scenes helper: Sync transaction to Finance snapshot & cashTransactions
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
    const updatedCurrentVal = (goal.currentValue || 0) + netChange;

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, {
        transactions: updatedTxns,
        currentValue: updatedCurrentVal,
        linkedSourceId: sourceToUse,
      });
    } else {
      await updateDoc(doc(db, 'goals', goal.id), {
        transactions: updatedTxns,
        currentValue: updatedCurrentVal,
        linkedSourceId: sourceToUse,
      });
    }
  };

  // Handle Add Deposit Submission (Amount & Note ONLY)
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

      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, {
          transactions: updatedTxns,
          currentValue: updatedCurrentVal,
        });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), {
          transactions: updatedTxns,
          currentValue: updatedCurrentVal,
        });
      }
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  // Unlink/Reset source (allowing attached source deletion)
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

  // Handle Initial Source Creation (Shown ONLY if no source is attached yet)
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

  // Create Linked Schedule or Todo
  const handleAddAction = async () => {
    if (!actionTitle.trim() || !user || !goal.id) return;
    setSavingAction(true);
    try {
      const assumedVal = typeof actionContributionAmount === 'number' ? actionContributionAmount : undefined;

      if (actionKind === 'schedule') {
        await addSchedule({
          title: actionTitle.trim(),
          date: actionDueDate || new Date().toISOString().split('T')[0],
          startTime: actionTime || '10:00',
          endTime: '11:00',
          projectId: goal.projectId || '',
          userId: user.uid,
          status: 'pending',
          priority: 'medium',
          linkedGoalId: goal.id,
          goalTitle: goal.title,
          contributionAmount: assumedVal,
        });
      } else {
        await addTodo({
          title: actionTitle.trim(),
          status: 'in_progress',
          priority: 'routine',
          projectId: goal.projectId || '',
          authorId: user.uid,
          dueDate: actionDueDate ? new Date(actionDueDate) : new Date(),
          steps: [],
          tags: [],
          progressPercent: 0,
          assignedUsers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          linkedGoalId: goal.id,
          goalTitle: goal.title,
        });
      }

      setActionTitle('');
      setActionContributionAmount('');
      setAddActionOpen(false);
    } catch (err) {
      console.error('Failed to add action:', err);
    } finally {
      setSavingAction(false);
    }
  };

  // Open "Have you got the amount?" prompt when clicking complete on an action item
  const handleInitiateCompletion = (item: {
    id: string;
    title: string;
    kind: 'schedule' | 'todo';
    assumedAmount?: number;
  }) => {
    const amt = item.assumedAmount || 0;
    setPromptItem({
      id: item.id,
      title: item.title,
      kind: item.kind,
      assumedAmount: amt,
    });
    setPromptAmount(amt > 0 ? amt : '');
  };

  // Confirm Completion with optional savings entry
  const handleConfirmCompletion = async (addMoneyToSavings: boolean) => {
    if (!promptItem || !user || !goal.id) return;
    setCompletingAction(true);

    try {
      const confirmedVal = typeof promptAmount === 'number' && promptAmount > 0 ? promptAmount : promptItem.assumedAmount;

      if (addMoneyToSavings && confirmedVal > 0) {
        await recordFinanceTransaction(
          confirmedVal,
          'deposit',
          selectedSource,
          `Completed ${promptItem.kind}: ${promptItem.title}`
        );
      }

      if (promptItem.kind === 'schedule') {
        await editSchedule(promptItem.id, { status: 'completed' });
      } else {
        await updateTodo(promptItem.id, { status: 'completed', progressPercent: 100, completedAt: new Date() });
      }

      setPromptItem(null);
      setPromptAmount('');
    } catch (err) {
      console.error('Failed completing item:', err);
    } finally {
      setCompletingAction(false);
    }
  };

  // Delete Schedule or Todo item
  const handleDeleteActionItem = async (id: string, kind: 'schedule' | 'todo') => {
    if (!confirm(`Are you sure you want to delete this ${kind}?`)) return;
    try {
      if (kind === 'schedule') {
        await removeSchedule(id);
      } else {
        await deleteTodo(id);
      }
    } catch (err) {
      console.error(`Failed to delete ${kind}:`, err);
    }
  };

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%', spaceY: 3 }}>
      {/* 🌟 1. HERO TARGET CARD (Prominent Target Date Banner + Deposited Total) */}
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
        {/* Subtle accent glow */}
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

        {/* Goal Title */}
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: textPrimary, letterSpacing: '-0.02em' }}>
          {goal.title}
        </Typography>

        {/* 🌟 Prominent Emerging Target Date Banner */}
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
                  Emerging Target Date
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

          {/* Prominent + Add Money Button */}
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
        {progress !== null && (
          <Box sx={{ mt: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted }}>
                Savings Progress
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>
                {progress}%
              </Typography>
            </Box>
            <Box sx={{ height: 10, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
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
        )}

        {/* Behind-the-scenes Source Setup Option (ONLY shown if no source attached yet) */}
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
          /* Subtle option to unlink/reset source if user wants to change it */
          <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
            <Tooltip title="Unlink / reset linked finance source">
              <IconButton size="small" onClick={handleUnlinkSource} sx={{ color: textMuted, opacity: 0.5, '&:hover': { opacity: 1, color: '#ef4444' } }}>
                <LinkOff sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* 🌟 2. SAVINGS LEDGER (With Option to Delete Any Entry) */}
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

                    {/* Delete Entry Button */}
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

      {/* 🌟 3. SCHEDULES & TODOS TIMELINE LIST (Styled per SampleSchedule.tsx) */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Savings Routines & Tasks ({actionItems.length})
          </Typography>
          <Button
            size="small"
            onClick={() => setAddActionOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#10b981' }}
          >
            + Add Schedule / Task
          </Button>
        </Box>

        {actionItems.length === 0 ? (
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
              No routine schedules or tasks linked to this goal. Add scheduled deposit reminders!
            </Typography>
          </Box>
        ) : (
          /* Vertical Timeline Layout inspired by SampleSchedule.tsx */
          <Box sx={{ position: 'relative', pl: 3.5, pt: 1 }}>
            {actionItems.map((item, index) => {
              const isDone = item.status === 'completed';
              const isLast = index === actionItems.length - 1;

              return (
                <Box key={item.id} sx={{ position: 'relative', pb: isLast ? 0 : 3 }}>
                  {/* Connecting dotted line */}
                  {!isLast && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: -20,
                        top: 24,
                        bottom: -8,
                        width: '2px',
                        borderLeft: `2px dotted ${isDark ? '#334155' : '#cbd5e1'}`,
                      }}
                    />
                  )}

                  {/* Status node marker */}
                  <Box
                    onClick={() => {
                      if (!isDone) {
                        handleInitiateCompletion(item);
                      }
                    }}
                    sx={{
                      position: 'absolute',
                      left: -28,
                      top: 14,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      bgcolor: isDone ? '#10b981' : surfaceBg,
                      border: isDone ? 'none' : `2px solid ${isDark ? '#64748b' : '#94a3b8'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isDone ? 'default' : 'pointer',
                      zIndex: 2,
                    }}
                  >
                    {isDone && <CheckIcon sx={{ fontSize: 12, color: '#ffffff' }} />}
                  </Box>

                  {/* Task Card */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 2.25,
                      borderRadius: '20px',
                      bgcolor: surfaceBg,
                      border: `1px solid ${cardBorder}`,
                      opacity: isDone ? 0.65 : 1,
                      transition: 'all 0.2s ease',
                      boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(15,23,42,0.04)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {/* Icon badge box */}
                      <Box
                        sx={{
                          width: 46,
                          height: 46,
                          borderRadius: '14px',
                          bgcolor: item.kind === 'schedule' ? (isDark ? '#064e3b' : '#ffedd5') : (isDark ? '#1e3a8a' : '#e0f2fe'),
                          color: item.kind === 'schedule' ? '#f97316' : '#0284c7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {item.kind === 'schedule' ? <EventIcon sx={{ fontSize: 24 }} /> : <TodoIcon sx={{ fontSize: 24 }} />}
                      </Box>

                      <Box>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: textPrimary, textDecoration: isDone ? 'line-through' : 'none' }}>
                          {item.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip
                            label={item.kind === 'schedule' ? 'Schedule' : 'Todo Task'}
                            size="small"
                            sx={{ fontSize: 10, height: 20, bgcolor: isDark ? '#334155' : '#f1f5f9', fontWeight: 600 }}
                          />
                          {item.assumedAmount > 0 && (
                            <Chip
                              label={`Target: ${formatMoney(item.assumedAmount, currency)}`}
                              size="small"
                              sx={{ fontSize: 10, height: 20, bgcolor: isDark ? '#064e3b' : '#ecfdf5', color: '#10b981', fontWeight: 700 }}
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {/* Time info */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ClockIcon sx={{ fontSize: 13, color: textMuted }} />
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color: textMuted }}>
                            {item.time}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 10, color: textMuted }}>
                          {item.date}
                        </Typography>
                      </Box>

                      {/* Delete Action Item Button */}
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteActionItem(item.id, item.kind)}
                        sx={{
                          color: textMuted,
                          '&:hover': { color: '#ef4444', bgcolor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2' },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* 🌟 4. PROFESSIONAL & ATTRACTIVE ADD DEPOSIT DIALOG (ONLY Amount + Note Input) */}
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
            {/* Field 1: Amount Input */}
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

            {/* Field 2: Note / Purpose (Optional) */}
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

      {/* Initial Source Setup Dialog (ONLY shown when user clicks setup if no source exists) */}
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

      {/* Create Schedule / Todo Modal */}
      <Dialog open={addActionOpen} onClose={() => setAddActionOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Add Savings Schedule or Task</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Title"
              placeholder="e.g. Weekly deposit reminder"
              fullWidth
              size="small"
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
            />

            <TextField
              label="Due Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={actionDueDate}
              onChange={(e) => setActionDueDate(e.target.value)}
            />

            {actionKind === 'schedule' && (
              <TextField
                label="Time"
                type="time"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={actionTime}
                onChange={(e) => setActionTime(e.target.value)}
              />
            )}

            <TextField
              label={`Assumed Target Amount (${currency}) - Optional`}
              type="number"
              placeholder="e.g. 5000"
              fullWidth
              size="small"
              value={actionContributionAmount}
              onChange={(e) => setActionContributionAmount(e.target.value ? Number(e.target.value) : '')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddActionOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingAction || !actionTitle.trim()}
            onClick={handleAddAction}
            sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            {savingAction ? <CircularProgress size={18} color="inherit" /> : 'Save Action'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Prompt Dialog: "Have you got the amount?" */}
      <Dialog open={!!promptItem} onClose={() => setPromptItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Have you got the amount?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 13, color: textPrimary }}>
              Marking <strong>&ldquo;{promptItem?.title}&rdquo;</strong> as completed.
            </Typography>

            <Typography sx={{ fontSize: 12, color: textMuted }}>
              Confirm the savings amount received for this task. It will automatically update your Finance total and goal progress:
            </Typography>

            <TextField
              label={`Received Amount (${currency})`}
              type="number"
              fullWidth
              size="small"
              autoFocus
              value={promptAmount}
              onChange={(e) => setPromptAmount(e.target.value ? Number(e.target.value) : '')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setPromptItem(null)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              disabled={completingAction}
              onClick={() => handleConfirmCompletion(false)}
              sx={{ textTransform: 'none' }}
            >
              Skip Amount
            </Button>
            <Button
              variant="contained"
              disabled={completingAction || typeof promptAmount !== 'number' || promptAmount <= 0}
              onClick={() => handleConfirmCompletion(true)}
              sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
            >
              {completingAction ? <CircularProgress size={18} color="inherit" /> : 'Confirm & Save'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


