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
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Repeat as RepeatIcon,
  EventNote as TodoIcon,
  TrendingDown,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { getExpenseItemProgress } from '@/app/lib/utils/goalProgress';

export interface ExpenseActionItem {
  id: string;
  kind: 'schedule' | 'todo';
  task: string;
  time?: string;
  frequencyPerWeek?: number;
  dueDate?: string;
  done?: boolean;
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

function formatMoney(value: number, currency: string = 'PKR') {
  return `${currency} ${Math.round(value).toLocaleString()}`;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
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

export default function ExpensesTemplate({ goal, onUpdateGoal }: ExpensesTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const currency = goal.overallTargetUnit || 'PKR';

  // State for Expense items list
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    if (Array.isArray(goal.expenseItems) && goal.expenseItems.length > 0) {
      return goal.expenseItems;
    }
    const answers = goal.questionnaireAnswers || {};
    const initCat = String(answers.expense_category || 'Dining Out');
    const initCurr = Number(answers.current_expense || 15000);
    const initTarg = Number(goal.overallTargetValue || answers.target_amount || 5000);
    const initPercent = initCurr > 0 ? Math.round(((initCurr - initTarg) / initCurr) * 100) : 50;

    return [
      {
        id: 'exp_' + Date.now(),
        title: goal.title || 'Reduce Monthly Expenses',
        category: CATEGORY_META[initCat] ? initCat : 'Dining Out',
        actionType: initTarg === 0 ? 'eliminate' : 'reduce',
        currentValue: initCurr,
        initialValue: initCurr,
        targetValue: initTarg,
        reductionPercent: Math.max(0, initPercent),
        byDate: toPlainDate(goal.dueDate)?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        actions: [],
      },
    ];
  });

  // Modal Dialog State for Add/Edit Expense Milestone
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Expense Dialog Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Dining Out');
  const [formActionType, setFormActionType] = useState<'reduce' | 'eliminate'>('reduce');
  const [formCurrentVal, setFormCurrentVal] = useState<number | ''>('');
  const [formTargetVal, setFormTargetVal] = useState<number | ''>('');
  const [formPercent, setFormPercent] = useState<number | ''>('');
  const [formByDate, setFormByDate] = useState('');
  const [saving, setSaving] = useState(false);

  // State for Quick Update Current Expense Value Dialog
  const [updateValueOpen, setUpdateValueOpen] = useState(false);
  const [targetItemForUpdate, setTargetItemForUpdate] = useState<ExpenseItem | null>(null);
  const [newCurrentInput, setNewCurrentInput] = useState<number | ''>('');

  // State for Inline Action Modal per item
  const [actionFormOpenId, setActionFormOpenId] = useState<string | null>(null);
  const [actionKind, setActionKind] = useState<'schedule' | 'todo'>('schedule');
  const [actionTask, setActionTask] = useState('');
  const [actionTime, setActionTime] = useState('09:00');
  const [actionFreq, setActionFreq] = useState(2);
  const [actionDueDate, setActionDueDate] = useState('');

  // Calculations
  const meanProgress = useMemo(() => {
    if (expenses.length === 0) return 0;
    const sum = expenses.reduce((acc, item) => acc + getExpenseItemProgress(item), 0);
    return Math.max(0, Math.min(100, Math.round(sum / expenses.length)));
  }, [expenses]);

  const totalCurrent = useMemo(() => expenses.reduce((sum, e) => sum + e.currentValue, 0), [expenses]);
  const totalTarget = useMemo(() => expenses.reduce((sum, e) => sum + e.targetValue, 0), [expenses]);

  // Persist expenses array and update overall progress
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

  // Open Dialog to Add / Edit Expense Milestone Item
  const handleOpenAddModal = (item?: ExpenseItem) => {
    if (item) {
      setEditingId(item.id);
      setFormTitle(item.title);
      setFormCategory(item.category || 'Dining Out');
      setFormActionType(item.actionType || 'reduce');
      setFormCurrentVal(item.currentValue);
      setFormTargetVal(item.targetValue);
      setFormPercent(item.reductionPercent ?? 50);
      setFormByDate(item.byDate || new Date().toISOString().split('T')[0]);
    } else {
      setEditingId(null);
      setFormTitle('');
      setFormCategory('Dining Out');
      setFormActionType('reduce');
      setFormCurrentVal('');
      setFormTargetVal('');
      setFormPercent('');
      setFormByDate(new Date().toISOString().split('T')[0]);
    }
    setDialogOpen(true);
  };

  // Auto-calculate reduction percent or target value on input change
  const handleCurrentValChange = (val: number | '') => {
    setFormCurrentVal(val);
    if (typeof val === 'number' && val > 0 && typeof formTargetVal === 'number') {
      const p = Math.round(((val - formTargetVal) / val) * 100);
      setFormPercent(Math.max(0, p));
    }
  };

  const handleTargetValChange = (val: number | '') => {
    setFormTargetVal(val);
    if (typeof formCurrentVal === 'number' && formCurrentVal > 0 && typeof val === 'number') {
      const p = Math.round(((formCurrentVal - val) / formCurrentVal) * 100);
      setFormPercent(Math.max(0, p));
    }
  };

  const handleActionTypeChange = (type: 'reduce' | 'eliminate') => {
    setFormActionType(type);
    if (type === 'eliminate') {
      setFormTargetVal(0);
      setFormPercent(100);
    }
  };

  const handleSaveItem = async () => {
    if (!formTitle.trim() || typeof formCurrentVal !== 'number') return;
    setSaving(true);

    try {
      const targVal = formActionType === 'eliminate' ? 0 : typeof formTargetVal === 'number' ? formTargetVal : 0;
      const pct = formActionType === 'eliminate' ? 100 : typeof formPercent === 'number' ? formPercent : Math.max(0, Math.round(((formCurrentVal - targVal) / formCurrentVal) * 100));

      const newItem: ExpenseItem = {
        id: editingId || 'exp_' + Date.now(),
        title: formTitle.trim(),
        category: formCategory,
        actionType: formActionType,
        currentValue: formCurrentVal,
        initialValue: editingId ? (expenses.find((e) => e.id === editingId)?.initialValue ?? formCurrentVal) : formCurrentVal,
        targetValue: targVal,
        reductionPercent: pct,
        byDate: formByDate || new Date().toISOString().split('T')[0],
        actions: editingId ? (expenses.find((e) => e.id === editingId)?.actions ?? []) : [],
      };

      let updatedList: ExpenseItem[];
      if (editingId) {
        updatedList = expenses.map((e) => (e.id === editingId ? newItem : e));
      } else {
        updatedList = [...expenses, newItem];
      }

      await saveExpensesList(updatedList);
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to save expense item:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpenseItem = async (itemId: string) => {
    const filtered = expenses.filter((e) => e.id !== itemId);
    await saveExpensesList(filtered);
  };

  // Quick update current value
  const handleOpenUpdateCurrentVal = (item: ExpenseItem) => {
    setTargetItemForUpdate(item);
    setNewCurrentInput(item.currentValue);
    setUpdateValueOpen(true);
  };

  const handleConfirmUpdateValue = async () => {
    if (!targetItemForUpdate || typeof newCurrentInput !== 'number') return;
    const updated = expenses.map((item) => {
      if (item.id === targetItemForUpdate.id) {
        return { ...item, currentValue: newCurrentInput };
      }
      return item;
    });
    await saveExpensesList(updated);
    setUpdateValueOpen(false);
  };

  // Add Action (Schedule/Todo) to Expense Card
  const handleAddAction = async (itemId: string) => {
    if (!actionTask.trim()) return;
    const newAction: ExpenseActionItem = {
      id: 'act_' + Date.now(),
      kind: actionKind,
      task: actionTask.trim(),
      time: actionKind === 'schedule' ? actionTime : undefined,
      frequencyPerWeek: actionKind === 'schedule' ? actionFreq : undefined,
      dueDate: actionKind === 'todo' ? actionDueDate || new Date().toISOString().split('T')[0] : undefined,
      done: false,
    };

    const updated = expenses.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          actions: [...(item.actions || []), newAction],
        };
      }
      return item;
    });

    await saveExpensesList(updated);
    setActionTask('');
    setActionFormOpenId(null);
  };

  const handleToggleAction = async (itemId: string, actionId: string) => {
    const updated = expenses.map((item) => {
      if (item.id === itemId) {
        const newActions = (item.actions || []).map((act) =>
          act.id === actionId ? { ...act, done: !act.done } : act
        );
        return { ...item, actions: newActions };
      }
      return item;
    });
    await saveExpensesList(updated);
  };

  const handleDeleteAction = async (itemId: string, actionId: string) => {
    const updated = expenses.map((item) => {
      if (item.id === itemId) {
        const newActions = (item.actions || []).filter((act) => act.id !== actionId);
        return { ...item, actions: newActions };
      }
      return item;
    });
    await saveExpensesList(updated);
  };

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── Top Overall Progress Banner ── */}
      <Box
        sx={{
          borderRadius: '24px',
          border: `1.5px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#fecdd3'}`,
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
          p: 3,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(225,29,72,0.06)',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Expense Reduction Milestones
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: textPrimary, mt: 0.5 }}>
              {goal.title}
            </Typography>
          </Box>
          <Chip
            label={`${meanProgress}% Reduced`}
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

        <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 30, fontWeight: 900, color: textPrimary, fontFamily: 'monospace' }}>
            {formatMoney(totalCurrent, currency)}
          </Typography>
          <Typography sx={{ fontSize: 13, color: textMuted, fontWeight: 500 }}>
            current monthly spending (target: {formatMoney(totalTarget, currency)})
          </Typography>
        </Box>

        <Box sx={{ mt: 2, height: 8, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              width: `${meanProgress}%`,
              background: 'linear-gradient(90deg, #ef4444 0%, #10b981 100%)',
              borderRadius: 99,
              transition: 'width 0.6s ease',
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5, fontSize: 12, color: textMuted }}>
          <span>Overall Mean Reduction Progress</span>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{meanProgress}% Achieved</span>
        </Box>
      </Box>

      {/* ── Expense Items List Header ── */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Tracked Expense Categories ({expenses.length})
          </Typography>
          <Button
            size="small"
            onClick={() => handleOpenAddModal()}
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontSize: 12,
              fontWeight: 800,
              color: '#ffffff',
              bgcolor: '#0284c7',
              borderRadius: '10px',
              px: 2,
              py: 0.6,
              '&:hover': { bgcolor: '#0369a1' },
            }}
          >
            + Add Expense Item
          </Button>
        </Box>

        {expenses.length === 0 ? (
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: '20px',
              border: `2px dashed ${cardBorder}`,
              bgcolor: surfaceBg,
            }}
          >
            <Typography sx={{ fontSize: 14, color: textMuted, mb: 1 }}>
              No expense reduction items added yet.
            </Typography>
            <Button
              size="small"
              onClick={() => handleOpenAddModal()}
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, bgcolor: '#0284c7' }}
            >
              Add Expense Item
            </Button>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {expenses.map((item) => {
              const itemProg = getExpenseItemProgress(item);
              const meta = CATEGORY_META[item.category] || CATEGORY_META.Other;
              const IconComp = meta.icon;
              const daysLeft = daysUntil(item.byDate);

              return (
                <Box
                  key={item.id}
                  sx={{
                    borderRadius: '22px',
                    border: `1.5px solid ${cardBorder}`,
                    bgcolor: surfaceBg,
                    p: 2.5,
                    boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 4px 16px rgba(15,23,42,0.04)',
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
                          bgcolor: `${meta.color}18`,
                          color: meta.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconComp sx={{ fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
                          {item.title}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: textMuted, fontWeight: 500 }}>
                          Category: {meta.label}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={
                          item.actionType === 'eliminate'
                            ? 'Eliminate 100%'
                            : `Reduce ${item.reductionPercent}%`
                        }
                        size="small"
                        sx={{
                          fontSize: 11,
                          fontWeight: 800,
                          bgcolor: item.actionType === 'eliminate' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                          color: item.actionType === 'eliminate' ? '#ef4444' : '#0284c7',
                          border: `1px solid ${item.actionType === 'eliminate' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(2, 132, 199, 0.3)'}`,
                        }}
                      />
                      <IconButton size="small" onClick={() => handleOpenAddModal(item)}>
                        <EditIcon sx={{ fontSize: 17, color: textMuted }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteExpenseItem(item.id)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Amounts & Target Date */}
                  <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography sx={{ fontSize: 24, fontWeight: 900, color: textPrimary, fontFamily: 'monospace' }}>
                        {formatMoney(item.currentValue, currency)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: textMuted }}>
                        / {formatMoney(item.targetValue, currency)} target
                      </Typography>
                    </Box>

                    <Button
                      size="small"
                      onClick={() => handleOpenUpdateCurrentVal(item)}
                      startIcon={<TrendingDown sx={{ fontSize: 15 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#0284c7',
                        bgcolor: 'rgba(2, 132, 199, 0.1)',
                        borderRadius: '8px',
                        px: 1.2,
                        py: 0.4,
                        '&:hover': { bgcolor: 'rgba(2, 132, 199, 0.2)' },
                      }}
                    >
                      Update Current Spending
                    </Button>
                  </Box>

                  {/* Item Progress Bar */}
                  <Box sx={{ mt: 1.5, height: 7, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${itemProg}%`,
                        bgcolor: itemProg >= 100 ? '#10b981' : '#0284c7',
                        borderRadius: 99,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, fontSize: 11, color: textMuted }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarIcon sx={{ fontSize: 13 }} />
                      <span>Target Date: {formatDate(item.byDate)}</span>
                      {daysLeft !== null && (
                        <span style={{ color: daysLeft < 0 ? '#ef4444' : '#0284c7', fontWeight: 600 }}>
                          ({daysLeft >= 0 ? `${daysLeft} days left` : 'overdue'})
                        </span>
                      )}
                    </Box>
                    <span style={{ fontWeight: 700, color: itemProg >= 100 ? '#10b981' : textPrimary }}>
                      {itemProg}% Reduced
                    </span>
                  </Box>

                  {/* ── Actions Section (Attached Schedules & Todos) ── */}
                  <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px dashed ${cardBorder}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        Actions supporting this reduction
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => {
                          setActionFormOpenId(actionFormOpenId === item.id ? null : item.id);
                          setActionTask('');
                        }}
                        sx={{ textTransform: 'none', fontSize: 11.5, fontWeight: 700, color: '#0284c7' }}
                      >
                        {actionFormOpenId === item.id ? 'Cancel' : '+ Add Action'}
                      </Button>
                    </Box>

                    {/* Action Form */}
                    {actionFormOpenId === item.id && (
                      <Box sx={{ p: 2, borderRadius: '14px', bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${cardBorder}`, mb: 2 }}>
                        <Stack spacing={1.5}>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant={actionKind === 'schedule' ? 'contained' : 'outlined'}
                              onClick={() => setActionKind('schedule')}
                              startIcon={<RepeatIcon sx={{ fontSize: 14 }} />}
                              sx={{ flex: 1, textTransform: 'none', borderRadius: '8px', fontSize: 11, fontWeight: 700 }}
                            >
                              Recurring Schedule
                            </Button>
                            <Button
                              size="small"
                              variant={actionKind === 'todo' ? 'contained' : 'outlined'}
                              onClick={() => setActionKind('todo')}
                              startIcon={<TodoIcon sx={{ fontSize: 14 }} />}
                              sx={{ flex: 1, textTransform: 'none', borderRadius: '8px', fontSize: 11, fontWeight: 700 }}
                            >
                              One-time Todo
                            </Button>
                          </Box>

                          <TextField
                            placeholder="e.g. Cook lunch at home instead of dining out"
                            value={actionTask}
                            onChange={(e) => setActionTask(e.target.value)}
                            size="small"
                            fullWidth
                          />

                          {actionKind === 'schedule' ? (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <TextField
                                type="time"
                                label="Time"
                                value={actionTime}
                                onChange={(e) => setActionTime(e.target.value)}
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                sx={{ flex: 1 }}
                              />
                              <FormControl size="small" sx={{ flex: 1 }}>
                                <InputLabel>Frequency</InputLabel>
                                <Select
                                  value={actionFreq}
                                  label="Frequency"
                                  onChange={(e) => setActionFreq(Number(e.target.value))}
                                >
                                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                    <MenuItem key={n} value={n}>
                                      {n}x / week
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Box>
                          ) : (
                            <TextField
                              type="date"
                              label="Due Date"
                              value={actionDueDate}
                              onChange={(e) => setActionDueDate(e.target.value)}
                              size="small"
                              InputLabelProps={{ shrink: true }}
                              fullWidth
                            />
                          )}

                          <Button
                            onClick={() => handleAddAction(item.id)}
                            disabled={!actionTask.trim()}
                            variant="contained"
                            size="small"
                            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 800, bgcolor: '#0284c7' }}
                          >
                            Add Action to Milestone
                          </Button>
                        </Stack>
                      </Box>
                    )}

                    {/* Actions List */}
                    {(!item.actions || item.actions.length === 0) ? (
                      <Typography sx={{ fontSize: 11.5, color: textMuted, fontStyle: 'italic' }}>
                        No actions added yet. Add schedules or todos to track habits that reduce this expense.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {item.actions.map((act) => (
                          <Box
                            key={act.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              p: 1.2,
                              px: 1.5,
                              borderRadius: '12px',
                              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                              border: `1px solid ${cardBorder}`,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0, flex: 1 }}>
                              {act.kind === 'todo' ? (
                                <IconButton size="small" onClick={() => handleToggleAction(item.id, act.id)}>
                                  {act.done ? (
                                    <CheckIcon sx={{ fontSize: 18, color: '#10b981' }} />
                                  ) : (
                                    <UncheckedIcon sx={{ fontSize: 18, color: textMuted }} />
                                  )}
                                </IconButton>
                              ) : (
                                <Box
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '6px',
                                    bgcolor: 'rgba(2, 132, 199, 0.1)',
                                    color: '#0284c7',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <RepeatIcon sx={{ fontSize: 14 }} />
                                </Box>
                              )}

                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  sx={{
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    color: act.done ? textMuted : textPrimary,
                                    textDecoration: act.done ? 'line-through' : 'none',
                                  }}
                                >
                                  {act.task}
                                </Typography>
                                <Typography sx={{ fontSize: 10.5, color: textMuted }}>
                                  {act.kind === 'schedule'
                                    ? `Recurring · ${act.time || 'Any time'} · ${act.frequencyPerWeek || 1}x/week`
                                    : `One-time · Due ${formatDate(act.dueDate || '')}`}
                                </Typography>
                              </Box>
                            </Box>

                            <IconButton size="small" onClick={() => handleDeleteAction(item.id, act.id)}>
                              <DeleteIcon sx={{ fontSize: 15, color: textMuted }} />
                            </IconButton>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* ── Add / Edit Expense Item Modal ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17, pb: 1 }}>
          {editingId ? 'Edit Expense Milestone' : 'Add Expense Milestone'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Expense Title"
              placeholder="e.g. Weekend Dining Out, Gym Subscription"
              fullWidth
              size="small"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Expense Category</InputLabel>
              <Select
                value={formCategory}
                label="Expense Category"
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <MenuItem key={key} value={key}>
                    {meta.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Objective Action</InputLabel>
              <Select
                value={formActionType}
                label="Objective Action"
                onChange={(e) => handleActionTypeChange(e.target.value as 'reduce' | 'eliminate')}
              >
                <MenuItem value="reduce">Reduce Expense Amount</MenuItem>
                <MenuItem value="eliminate">Eliminate Expense Completely (100%)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label={`Current Spending (${currency})`}
              type="number"
              fullWidth
              size="small"
              value={formCurrentVal}
              onChange={(e) => handleCurrentValChange(e.target.value ? Number(e.target.value) : '')}
            />

            {formActionType === 'reduce' && (
              <TextField
                label={`Target Reduced Spending (${currency})`}
                type="number"
                fullWidth
                size="small"
                value={formTargetVal}
                onChange={(e) => handleTargetValChange(e.target.value ? Number(e.target.value) : '')}
              />
            )}

            <TextField
              label="Reduction Percentage (%)"
              type="number"
              fullWidth
              size="small"
              value={formPercent}
              onChange={(e) => setFormPercent(e.target.value ? Number(e.target.value) : '')}
              helperText="Auto-calculated percentage reduction"
            />

            <TextField
              label="Target By Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={formByDate}
              onChange={(e) => setFormByDate(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={saving || !formTitle.trim() || typeof formCurrentVal !== 'number'}
            onClick={handleSaveItem}
            sx={{ textTransform: 'none', fontWeight: 800, bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            Save Milestone
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Quick Update Current Spending Dialog ── */}
      <Dialog open={updateValueOpen} onClose={() => setUpdateValueOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          Update Current Expense ({targetItemForUpdate?.title})
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 12, color: textMuted, mb: 2 }}>
              Enter your latest updated spending for this expense category to adjust progress.
            </Typography>
            <TextField
              label={`New Current Amount (${currency})`}
              type="number"
              fullWidth
              size="small"
              value={newCurrentInput}
              onChange={(e) => setNewCurrentInput(e.target.value ? Number(e.target.value) : '')}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setUpdateValueOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmUpdateValue}
            disabled={typeof newCurrentInput !== 'number'}
            sx={{ fontWeight: 800, bgcolor: '#0284c7' }}
          >
            Save Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
