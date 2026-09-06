'use client';

import React, { useMemo, useState } from 'react';
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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import {
  Person as PersonIcon,
  Business as BuildingIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Repeat as RepeatIcon,
  Event as EventIcon,
  Checklist as TodoIcon,
  CalendarToday as CalendarIcon,
  MonetizationOn as MoneyIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface DebtCheckIn {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface DebtRecordItem {
  id: string;
  type: 'payback' | 'recoverable'; // payback = You Owe, recoverable = Owed to You
  name: string;
  entityType: 'person' | 'org';
  amount: number;
  paidAmount: number;
  dueDate: string;
  notes?: string;
  checkIns?: DebtCheckIn[];
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
  return `${currency} ${Math.round(value).toLocaleString()}`;
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

function calculateDebtProgress(rec: DebtRecordItem): number {
  if (!rec.amount || rec.amount <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((rec.paidAmount / rec.amount) * 100)));
}



export default function DebtTemplate({ goal, onUpdateGoal }: DebtTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};
  const currency = String(goal.overallTargetUnit || answers.currency || 'PKR');

  // Debt Records Array (Stored on goal.debtRecords)
  const [records, setRecords] = useState<DebtRecordItem[]>(() => {
    if (Array.isArray(goal.debtRecords) && goal.debtRecords.length > 0) {
      return goal.debtRecords;
    }
    const debtType = String(answers.debt_type || answers.type || 'payback');
    const amountVal = Number(goal.overallTargetValue || answers.target_amount || answers.amount || 50000);
    return [
      {
        id: 'debt_' + Date.now(),
        name: String(answers.debt_name || answers.person_or_inst || answers.person_name || 'Ahmed Khan'),
        type: debtType === 'recoverable' || debtType === 'owed_to_you' ? 'recoverable' : 'payback',
        entityType: 'person',
        amount: amountVal,
        paidAmount: Number(answers.paid_amount || 0),
        dueDate: toPlainDate(goal.dueDate)?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        notes: '',
        checkIns: [],
      },
    ];
  });

  // Modal Dialog State for Add / Edit Debt Account
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Debt Form Fields
  const [formType, setFormType] = useState<'payback' | 'recoverable'>('payback');
  const [formName, setFormName] = useState('');
  const [formEntityType, setFormEntityType] = useState<'person' | 'org'>('person');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formPaidAmount, setFormPaidAmount] = useState<number | ''>(0);
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  // Modal Dialog for Payment / Collection Check-in Log
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [targetRecordForLog, setTargetRecordForLog] = useState<DebtRecordItem | null>(null);
  const [logAmountInput, setLogAmountInput] = useState<number | ''>('');
  const [logNoteInput, setLogNoteInput] = useState('');
  const [loggingProgress, setLoggingProgress] = useState(false);

  // History Drawer State
  const [historyOpenRecordId, setHistoryOpenRecordId] = useState<string | null>(null);

  // Dialog State for Adding Action (Schedule / Todo) attached to a Debt Record
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [targetRecordForAction, setTargetRecordForAction] = useState<DebtRecordItem | null>(null);
  const [actionKind, setActionKind] = useState<'schedule' | 'todo'>('schedule');
  const [actionTitle, setActionTitle] = useState('');
  const [actionTime, setActionTime] = useState('10:00');
  const [actionDueDate, setActionDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [actionAssumedAmount, setActionAssumedAmount] = useState<number | ''>('');
  const [savingAction, setSavingAction] = useState(false);

  // Prompt state for schedule completion amount confirmation
  const [completionPromptItem, setCompletionPromptItem] = useState<{
    id: string;
    title: string;
    kind: 'schedule' | 'todo';
    assumedAmount: number;
    debtRecordId?: string;
  } | null>(null);
  const [promptAmount, setPromptAmount] = useState<number | ''>('');

  // Group Payback (Top) vs Recoverable (Below)
  const paybackRecords = useMemo(() => records.filter((r) => r.type === 'payback'), [records]);
  const recoverableRecords = useMemo(() => records.filter((r) => r.type === 'recoverable'), [records]);

  // Overall Debt Totals & Mean Progress
  const totals = useMemo(() => {
    let totalPaybackRemaining = 0;
    let totalPaybackCleared = 0;
    let totalPaybackTarget = 0;

    let totalRecoverableRemaining = 0;
    let totalRecoverableCleared = 0;
    let totalRecoverableTarget = 0;

    let sumProg = 0;
    records.forEach((r) => {
      const rem = Math.max(0, r.amount - r.paidAmount);
      if (r.type === 'payback') {
        totalPaybackRemaining += rem;
        totalPaybackCleared += r.paidAmount;
        totalPaybackTarget += r.amount;
      } else {
        totalRecoverableRemaining += rem;
        totalRecoverableCleared += r.paidAmount;
        totalRecoverableTarget += r.amount;
      }
      sumProg += calculateDebtProgress(r);
    });

    const meanProgress = records.length > 0 ? Math.max(0, Math.min(100, Math.round(sumProg / records.length))) : 0;
    return {
      totalPaybackRemaining,
      totalPaybackCleared,
      totalPaybackTarget,
      totalRecoverableRemaining,
      totalRecoverableCleared,
      totalRecoverableTarget,
      net: totalRecoverableRemaining - totalPaybackRemaining,
      meanProgress,
    };
  }, [records]);

  // Linked Timeline Actions (Schedules & Todos)
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
        debtRecordId: (s as { debtRecordId?: string }).debtRecordId,
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
        assumedAmount: (t as { contributionAmount?: number }).contributionAmount || 0,
        debtRecordId: (t as { debtRecordId?: string }).debtRecordId,
      }));

    return [...schedList, ...todoList];
  }, [allSchedules, todos, goal.id]);

  // Save Debt Records List & Sync Mean Progress
  const saveRecordsList = async (newList: DebtRecordItem[]) => {
    setRecords(newList);
    if (!goal.id) return;

    let sumProg = 0;
    for (const r of newList) {
      sumProg += calculateDebtProgress(r);
    }
    const newMean = newList.length > 0 ? Math.max(0, Math.min(100, Math.round(sumProg / newList.length))) : 0;
    const newTotalCleared = newList.reduce((sum, r) => sum + r.paidAmount, 0);
    const newTotalAmount = newList.reduce((sum, r) => sum + r.amount, 0);

    const payload = {
      debtRecords: newList,
      progress: newMean,
      currentValue: newTotalCleared,
      overallTargetValue: newTotalAmount,
    };

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, payload);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), payload);
    }
  };

  // Open Modal to Add / Edit Debt Record
  const handleOpenModal = (item?: DebtRecordItem) => {
    if (item) {
      setEditingId(item.id);
      setFormType(item.type);
      setFormName(item.name);
      setFormEntityType(item.entityType || 'person');
      setFormAmount(item.amount);
      setFormPaidAmount(item.paidAmount);
      setFormDueDate(item.dueDate || new Date().toISOString().split('T')[0]);
      setFormNotes(item.notes || '');
    } else {
      setEditingId(null);
      setFormType('payback');
      setFormName('');
      setFormEntityType('person');
      setFormAmount('');
      setFormPaidAmount(0);
      setFormDueDate(new Date().toISOString().split('T')[0]);
      setFormNotes('');
    }
    setDialogOpen(true);
  };

  const handleSaveRecord = async () => {
    if (!formName.trim() || typeof formAmount !== 'number' || formAmount <= 0) return;
    setSavingRecord(true);

    try {
      const paidVal = typeof formPaidAmount === 'number' ? formPaidAmount : 0;
      const newItem: DebtRecordItem = {
        id: editingId || 'debt_' + Date.now(),
        type: formType,
        name: formName.trim(),
        entityType: formEntityType,
        amount: formAmount,
        paidAmount: paidVal,
        dueDate: formDueDate || new Date().toISOString().split('T')[0],
        notes: formNotes.trim(),
        checkIns: editingId ? (records.find((r) => r.id === editingId)?.checkIns ?? []) : [],
      };

      let updatedList: DebtRecordItem[];
      if (editingId) {
        updatedList = records.map((r) => (r.id === editingId ? newItem : r));
      } else {
        updatedList = [...records, newItem];
      }

      await saveRecordsList(updatedList);
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to save debt record:', err);
    } finally {
      setSavingRecord(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    const filtered = records.filter((r) => r.id !== recordId);
    await saveRecordsList(filtered);
  };

  // Open Log Payment / Collection Entry Dialog
  const handleOpenLogModal = (item: DebtRecordItem) => {
    setTargetRecordForLog(item);
    setLogAmountInput('');
    setLogNoteInput('');
    setLogModalOpen(true);
  };

  const handleConfirmLogEntry = async () => {
    if (!targetRecordForLog || typeof logAmountInput !== 'number' || logAmountInput <= 0) return;
    setLoggingProgress(true);

    try {
      const newCheckIn: DebtCheckIn = {
        id: 'ci_' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        amount: logAmountInput,
        note: logNoteInput.trim() || (targetRecordForLog.type === 'payback' ? 'Payback payment' : 'Collection entry'),
      };

      const updated = records.map((rec) => {
        if (rec.id === targetRecordForLog.id) {
          const newPaid = Math.min(rec.amount, rec.paidAmount + logAmountInput);
          const newCheckIns = [...(rec.checkIns || []), newCheckIn];
          return {
            ...rec,
            paidAmount: newPaid,
            checkIns: newCheckIns,
          };
        }
        return rec;
      });

      await saveRecordsList(updated);
      setLogModalOpen(false);
    } catch (err) {
      console.error('Error logging debt payment checkin:', err);
    } finally {
      setLoggingProgress(false);
    }
  };

  // Open Add Action (Schedule / Todo) attached to a Debt Record
  const handleOpenActionModal = (item?: DebtRecordItem) => {
    setTargetRecordForAction(item || null);
    setActionKind('schedule');
    setActionTitle('');
    setActionTime('10:00');
    setActionDueDate(new Date().toISOString().split('T')[0]);
    setActionAssumedAmount('');
    setActionModalOpen(true);
  };

  const handleSaveAction = async () => {
    if (!actionTitle.trim() || !user || !goal.id) return;
    setSavingAction(true);

    try {
      const assumedVal = typeof actionAssumedAmount === 'number' ? actionAssumedAmount : 0;
      const recId = targetRecordForAction?.id;

      if (actionKind === 'schedule') {
        await addSchedule({
          title: actionTitle.trim(),
          date: actionDueDate || new Date().toISOString().split('T')[0],
          startTime: actionTime || '10:00',
          endTime: '11:00',
          projectId: goal.projectId || '',
          userId: user.uid,
          status: 'pending',
          priority: 'high',
          linkedGoalId: goal.id,
          goalTitle: goal.title,
          contributionAmount: assumedVal,
          debtRecordId: recId,
        } as Parameters<typeof addSchedule>[0]);
      } else {
        await addTodo({
          title: actionTitle.trim(),
          status: 'in_progress',
          priority: 'urgent',
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
          contributionAmount: assumedVal,
          debtRecordId: recId,
        } as Parameters<typeof addTodo>[0]);
      }

      setActionModalOpen(false);
    } catch (err) {
      console.error('Failed to create action:', err);
    } finally {
      setSavingAction(false);
    }
  };

  // Action completion prompt (Add assumed amount to debt record)
  const handleInitiateCompletion = (item: {
    id: string;
    title: string;
    kind: 'schedule' | 'todo';
    assumedAmount: number;
    debtRecordId?: string;
  }) => {
    setCompletionPromptItem(item);
    setPromptAmount(item.assumedAmount || '');
  };

  const handleConfirmActionCompletion = async () => {
    if (!completionPromptItem || !goal.id) return;
    const addAmt = typeof promptAmount === 'number' ? promptAmount : 0;

    if (addAmt > 0) {
      let updatedRecords = [...records];
      if (completionPromptItem.debtRecordId) {
        updatedRecords = updatedRecords.map((r) => {
          if (r.id === completionPromptItem.debtRecordId) {
            return {
              ...r,
              paidAmount: Math.min(r.amount, r.paidAmount + addAmt),
              checkIns: [
                ...(r.checkIns || []),
                {
                  id: 'ci_' + Date.now(),
                  date: new Date().toISOString().split('T')[0],
                  amount: addAmt,
                  note: `Completed Routine: ${completionPromptItem.title}`,
                },
              ],
            };
          }
          return r;
        });
      } else if (updatedRecords.length > 0) {
        // Add to first record if not specified
        const targetRec = updatedRecords[0];
        updatedRecords[0] = {
          ...targetRec,
          paidAmount: Math.min(targetRec.amount, targetRec.paidAmount + addAmt),
        };
      }
      await saveRecordsList(updatedRecords);
    }

    // Toggle status in Context
    if (completionPromptItem.kind === 'schedule') {
      const foundSched = allSchedules.find((s) => s.id === completionPromptItem.id);
      if (foundSched && foundSched.id) {
        const snapRef = doc(db, 'schedules', foundSched.id);
        await updateDoc(snapRef, { status: 'completed' });
      }
    } else {
      await updateTodo(completionPromptItem.id, { status: 'completed', progressPercent: 100 });
    }

    setCompletionPromptItem(null);
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
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Manage Debt & Paybacks
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: textPrimary, mt: 0.5 }}>
              {goal.title}
            </Typography>
          </Box>

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
            }}
          />
        </Box>

        {/* Breakdown Grid (Payback vs Recoverable) */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 3 }}>
          <Box sx={{ p: 2, borderRadius: '18px', bgcolor: isDark ? '#450a0a' : '#fef2f2', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>
              You Owe (Payback Top)
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace', mt: 0.5 }}>
              {formatMoney(totals.totalPaybackRemaining, currency)}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: textMuted, mt: 0.3 }}>
              {formatMoney(totals.totalPaybackCleared, currency)} cleared of {formatMoney(totals.totalPaybackTarget, currency)}
            </Typography>
          </Box>

          <Box sx={{ p: 2, borderRadius: '18px', bgcolor: isDark ? '#064e3b' : '#ecfdf5', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>
              Owed to You (Recoverable)
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#10b981', fontFamily: 'monospace', mt: 0.5 }}>
              {formatMoney(totals.totalRecoverableRemaining, currency)}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: textMuted, mt: 0.3 }}>
              {formatMoney(totals.totalRecoverableCleared, currency)} collected of {formatMoney(totals.totalRecoverableTarget, currency)}
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

      {/* ── 2. Payback Debts Section (Shown at Top) ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            💸 Payback Debts — You Owe ({paybackRecords.length})
          </Typography>
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
            + Add Debt Account
          </Button>
        </Box>

        {paybackRecords.length === 0 ? (
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
              No payback debts configured. Click <strong>+ Add Debt Account</strong> to add debts you need to pay off!
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {paybackRecords.map((r) => {
              const remaining = Math.max(0, r.amount - r.paidAmount);
              const prog = calculateDebtProgress(r);
              const daysLeft = daysUntil(r.dueDate);
              const EntityIcon = r.entityType === 'org' ? BuildingIcon : PersonIcon;

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
                  {/* Header Row */}
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
                        <EntityIcon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
                          {r.name}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: textMuted }}>
                          {r.entityType === 'org' ? 'Institution / Credit Card' : 'Individual Counterparty'}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={prog >= 100 ? 'Paid Off' : 'You Owe (Payback)'}
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
                      <IconButton size="small" onClick={() => handleDeleteRecord(r.id)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Amounts & Due Date */}
                  <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography sx={{ fontSize: 26, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace' }}>
                        {formatMoney(remaining, currency)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: textMuted }}>
                        remaining (cleared {formatMoney(r.paidAmount, currency)} of {formatMoney(r.amount, currency)})
                      </Typography>
                    </Box>
                  </Box>

                  {/* Progress Bar */}
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

                  {/* Action Buttons for this Debt Record */}
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      onClick={() => handleOpenLogModal(r)}
                      startIcon={<MoneyIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#ffffff',
                        bgcolor: '#10b981',
                        borderRadius: '10px',
                        px: 1.5,
                        '&:hover': { bgcolor: '#059669' },
                      }}
                    >
                      + Log Payment Entry
                    </Button>

                    <Button
                      size="small"
                      onClick={() => handleOpenActionModal(r)}
                      startIcon={<EventIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#0284c7',
                        bgcolor: 'rgba(2, 132, 199, 0.1)',
                        borderRadius: '10px',
                        px: 1.5,
                        '&:hover': { bgcolor: 'rgba(2, 132, 199, 0.2)' },
                      }}
                    >
                      + Attach Schedule / Task
                    </Button>

                    {r.checkIns && r.checkIns.length > 0 && (
                      <Button
                        size="small"
                        onClick={() => setHistoryOpenRecordId(historyOpenRecordId === r.id ? null : r.id)}
                        startIcon={<HistoryIcon sx={{ fontSize: 16 }} />}
                        sx={{
                          textTransform: 'none',
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: textMuted,
                        }}
                      >
                        {historyOpenRecordId === r.id ? 'Hide Payment History' : `Payment History (${r.checkIns.length})`}
                      </Button>
                    )}
                  </Box>

                  {/* Payment History Log */}
                  {historyOpenRecordId === r.id && r.checkIns && r.checkIns.length > 0 && (
                    <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px dashed ${cardBorder}` }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: textMuted, textTransform: 'uppercase', mb: 1 }}>
                        Payment Logs History
                      </Typography>
                      <Stack spacing={1}>
                        {r.checkIns.map((ci) => (
                          <Box
                            key={ci.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              p: 1.2,
                              borderRadius: '10px',
                              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                            }}
                          >
                            <Box>
                              <Typography sx={{ fontSize: 12, fontWeight: 700, color: textPrimary }}>
                                {ci.note || 'Payment Entry'}
                              </Typography>
                              <Typography sx={{ fontSize: 10.5, color: textMuted }}>
                                {formatDate(ci.date)}
                              </Typography>
                            </Box>
                            <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                              +{formatMoney(ci.amount, currency)}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* ── 3. Recoverable Debts Section (Shown Below) ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            💰 Recoverable Debts — Owed to You ({recoverableRecords.length})
          </Typography>
        </Box>

        {recoverableRecords.length === 0 ? (
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
              No recoverable debt records added. Click <strong>+ Add Debt Account</strong> and select &quot;Owed to You (Recoverable)&quot; to track money people owe you!
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {recoverableRecords.map((r) => {
              const remaining = Math.max(0, r.amount - r.paidAmount);
              const prog = calculateDebtProgress(r);
              const EntityIcon = r.entityType === 'org' ? BuildingIcon : PersonIcon;

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
                        <EntityIcon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
                          {r.name}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: textMuted }}>
                          Owed to You (Recoverable)
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={prog >= 100 ? 'Fully Collected' : 'Recoverable'}
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
                      <IconButton size="small" onClick={() => handleDeleteRecord(r.id)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Amounts */}
                  <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography sx={{ fontSize: 26, fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>
                        {formatMoney(remaining, currency)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: textMuted }}>
                        remaining to collect (collected {formatMoney(r.paidAmount, currency)} of {formatMoney(r.amount, currency)})
                      </Typography>
                    </Box>
                  </Box>

                  {/* Progress Bar */}
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

                  {/* Action Buttons */}
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      onClick={() => handleOpenLogModal(r)}
                      startIcon={<MoneyIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#ffffff',
                        bgcolor: '#10b981',
                        borderRadius: '10px',
                        px: 1.5,
                        '&:hover': { bgcolor: '#059669' },
                      }}
                    >
                      + Log Collection Entry
                    </Button>

                    <Button
                      size="small"
                      onClick={() => handleOpenActionModal(r)}
                      startIcon={<EventIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#0284c7',
                        bgcolor: 'rgba(2, 132, 199, 0.1)',
                        borderRadius: '10px',
                        px: 1.5,
                        '&:hover': { bgcolor: 'rgba(2, 132, 199, 0.2)' },
                      }}
                    >
                      + Attach Schedule / Task
                    </Button>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* ── 4. SCHEDULES & TODOS VERTICAL TIMELINE SECTION (SavingsTemplate UI pattern) ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Repayment & Collection Routines ({actionItems.length})
          </Typography>
          <Button
            size="small"
            onClick={() => handleOpenActionModal()}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#ef4444' }}
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
              No repayment dates or follow-up tasks linked to this goal. Add scheduled reminders!
            </Typography>
          </Box>
        ) : (
          /* Dotted vertical timeline node structure identical to SavingsTemplate.tsx */
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

                  {/* Node marker circle */}
                  <Box
                    onClick={() => {
                      if (!isDone) handleInitiateCompletion(item);
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

                  {/* Task Timeline Card */}
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
                      <Box
                        sx={{
                          width: 46,
                          height: 46,
                          borderRadius: '14px',
                          bgcolor: item.kind === 'schedule' ? (isDark ? '#450a0a' : '#fef2f2') : (isDark ? '#0c4a6e' : '#e0f2fe'),
                          color: item.kind === 'schedule' ? '#ef4444' : '#0284c7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {item.kind === 'schedule' ? <RepeatIcon sx={{ fontSize: 24 }} /> : <TodoIcon sx={{ fontSize: 24 }} />}
                      </Box>

                      <Box>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: textPrimary, textDecoration: isDone ? 'line-through' : 'none' }}>
                          {item.title}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: textMuted, mt: 0.3 }}>
                          {item.kind === 'schedule' ? `Recurring Schedule · ${item.time || '10:00 AM'}` : `Task · Due ${item.date}`}
                          {item.assumedAmount > 0 && (
                            <span style={{ fontWeight: 700, color: '#10b981', marginLeft: 6 }}>
                              (Assumed: {formatMoney(item.assumedAmount, currency)})
                            </span>
                          )}
                        </Typography>
                      </Box>
                    </Box>

                    <Chip
                      label={isDone ? 'Completed' : item.kind === 'schedule' ? 'Scheduled' : 'Todo'}
                      size="small"
                      sx={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        bgcolor: isDone ? (isDark ? '#064e3b' : '#ecfdf5') : item.kind === 'schedule' ? (isDark ? '#450a0a' : '#fef2f2') : (isDark ? '#0c4a6e' : '#e0f2fe'),
                        color: isDone ? '#10b981' : item.kind === 'schedule' ? '#ef4444' : '#0284c7',
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Add / Edit Debt Account Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17, pb: 1 }}>
          {editingId ? 'Edit Debt Account' : 'Add Debt Account'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl component="fieldset">
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, mb: 0.5 }}>
                Debt Type
              </Typography>
              <RadioGroup
                row
                value={formType}
                onChange={(e) => setFormType(e.target.value as 'payback' | 'recoverable')}
              >
                <FormControlLabel value="payback" control={<Radio size="small" />} label="You Owe (Payback Top)" />
                <FormControlLabel value="recoverable" control={<Radio size="small" />} label="Owed to You (Recoverable)" />
              </RadioGroup>
            </FormControl>

            <TextField
              label="Counterparty / Person / Org Name"
              placeholder="e.g. Ahmed Khan, HBL Credit Card"
              fullWidth
              size="small"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Entity Type</InputLabel>
              <Select
                value={formEntityType}
                label="Entity Type"
                onChange={(e) => setFormEntityType(e.target.value as 'person' | 'org')}
              >
                <MenuItem value="person">Individual Person</MenuItem>
                <MenuItem value="org">Institution / Organization</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label={`Total Debt Amount (${currency})`}
              type="number"
              fullWidth
              size="small"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value ? Number(e.target.value) : '')}
            />

            <TextField
              label={`Paid / Cleared Amount So Far (${currency})`}
              type="number"
              fullWidth
              size="small"
              value={formPaidAmount}
              onChange={(e) => setFormPaidAmount(e.target.value ? Number(e.target.value) : '')}
            />

            <TextField
              label="Due Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
            />

            <TextField
              label="Notes / Terms (Optional)"
              placeholder="e.g. 0% interest, 3 installments"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingRecord || !formName.trim() || typeof formAmount !== 'number' || formAmount <= 0}
            onClick={handleSaveRecord}
            sx={{ textTransform: 'none', fontWeight: 800, bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' } }}
          >
            Save Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Log Payment / Collection Entry Dialog ── */}
      <Dialog open={logModalOpen} onClose={() => setLogModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          Log {targetRecordForLog?.type === 'payback' ? 'Payment' : 'Collection'} ({targetRecordForLog?.name})
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 12, color: textMuted }}>
              Enter the amount {targetRecordForLog?.type === 'payback' ? 'paid off towards' : 'collected from'} this debt account to credit progress.
            </Typography>

            <TextField
              label={`Amount (${currency})`}
              type="number"
              fullWidth
              size="small"
              value={logAmountInput}
              onChange={(e) => setLogAmountInput(e.target.value ? Number(e.target.value) : '')}
            />

            <TextField
              label="Note (Optional)"
              placeholder="e.g. Installment 1 via Bank Transfer"
              fullWidth
              size="small"
              value={logNoteInput}
              onChange={(e) => setLogNoteInput(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLogModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmLogEntry}
            disabled={loggingProgress || typeof logAmountInput !== 'number' || logAmountInput <= 0}
            sx={{ fontWeight: 800, bgcolor: '#10b981' }}
          >
            Save Payment Log
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add Action (Schedule / Todo with Assumed Amount) Dialog ── */}
      <Dialog open={actionModalOpen} onClose={() => setActionModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          Attach Schedule or Task Reminder
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                variant={actionKind === 'schedule' ? 'contained' : 'outlined'}
                onClick={() => setActionKind('schedule')}
                startIcon={<EventIcon />}
                size="small"
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                Recurring Schedule
              </Button>
              <Button
                fullWidth
                variant={actionKind === 'todo' ? 'contained' : 'outlined'}
                onClick={() => setActionKind('todo')}
                startIcon={<TodoIcon />}
                size="small"
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                One-time Task
              </Button>
            </Box>

            <TextField
              label="Action Title"
              placeholder="e.g. Pay monthly installment to Ahmed"
              fullWidth
              size="small"
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
            />

            <TextField
              label={`Assumed Contribution Amount (${currency})`}
              type="number"
              placeholder="e.g. 5000"
              fullWidth
              size="small"
              value={actionAssumedAmount}
              onChange={(e) => setActionAssumedAmount(e.target.value ? Number(e.target.value) : '')}
              helperText="Amount added to debt settlement upon completion"
            />

            {actionKind === 'schedule' ? (
              <TextField
                label="Preferred Time"
                type="time"
                fullWidth
                size="small"
                value={actionTime}
                onChange={(e) => setActionTime(e.target.value)}
              />
            ) : (
              <TextField
                label="Due Date"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={actionDueDate}
                onChange={(e) => setActionDueDate(e.target.value)}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActionModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingAction || !actionTitle.trim()}
            onClick={handleSaveAction}
            sx={{ textTransform: 'none', fontWeight: 800, bgcolor: '#0284c7' }}
          >
            Attach Action
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Completion Prompt Modal ── */}
      <Dialog
        open={Boolean(completionPromptItem)}
        onClose={() => setCompletionPromptItem(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17 }}>
          Have you cleared/collected the amount?
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 13, color: textMuted }}>
              Completing <strong>&quot;{completionPromptItem?.title}&quot;</strong>. Confirm the amount to record towards debt settlement:
            </Typography>

            <TextField
              label={`Amount (${currency})`}
              type="number"
              fullWidth
              size="small"
              value={promptAmount}
              onChange={(e) => setPromptAmount(e.target.value ? Number(e.target.value) : '')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCompletionPromptItem(null)} sx={{ color: textMuted }}>
            Skip Amount
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmActionCompletion}
            sx={{ fontWeight: 800, bgcolor: '#10b981' }}
          >
            Confirm & Complete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
