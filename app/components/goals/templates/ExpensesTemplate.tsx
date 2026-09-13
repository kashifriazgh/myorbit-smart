'use client';

import React, { useMemo, useState } from 'react';
import {
  IconButton,
  Dialog,
  DialogContent,
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
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as CircleIcon,
  TrendingDown,
  CalendarToday as CalendarIcon,
  Close as CloseIcon,
  AccountBalanceWallet as WalletIcon,
  GpsFixed as TargetIcon,
  NotificationsNone as BellIcon,
  ChevronRight,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { getExpenseItemProgress } from '@/app/lib/utils/goalProgress';

export interface ExpenseActionItem {
  id: string;
  kind?: 'schedule' | 'todo';
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

// Sparkline SVG Component for historical billing trends
function Sparkline({ values, targetHigh }: { values: number[]; targetHigh: number }) {
  const w = 280;
  const h = 48;
  const safeValues = values && values.length > 0 ? values : [targetHigh, targetHigh];
  const max = Math.max(...safeValues, targetHigh, 1) * 1.08;
  const min = Math.max(0, Math.min(...safeValues, targetHigh) * 0.88);
  const range = max - min || 1;

  const pts = safeValues.map((v, i) => {
    const x = Math.round((i / Math.max(safeValues.length - 1, 1)) * w);
    const y = Math.round(h - ((v - min) / range) * h);
    return `${x},${y}`;
  });
  const targetY = Math.round(h - ((targetHigh - min) / range) * h);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12 my-2">
      <line
        x1="0"
        y1={targetY}
        x2={w}
        y2={targetY}
        strokeDasharray="4 4"
        className="stroke-slate-300 dark:stroke-white/20"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={pts.join(' ')}
        fill="none"
        className="stroke-amber-400"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {safeValues.map((v, i) => {
        const x = Math.round((i / Math.max(safeValues.length - 1, 1)) * w);
        const y = Math.round(h - ((v - min) / range) * h);
        return <circle key={i} cx={x} cy={y} r="3" className="fill-amber-400" />;
      })}
    </svg>
  );
}



export default function ExpensesTemplate({ goal, onUpdateGoal }: ExpensesTemplateProps) {
  const currencyUnit = goal.overallTargetUnit || 'Rs';

  // State for Expenses - Start empty if no saved expenseItems exist (no dummy data)
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    if (Array.isArray(goal.expenseItems) && goal.expenseItems.length > 0) {
      return goal.expenseItems as unknown as ExpenseItem[];
    }
    return [];
  });

  // Sorting
  const [sortByOver, setSortByOver] = useState(true);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add/Edit Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Dining Out');
  const [formActionType, setFormActionType] = useState<'reduce' | 'eliminate'>('reduce');
  const [formCurrentVal, setFormCurrentVal] = useState<string>('');
  const [formTargetVal, setFormTargetVal] = useState<string>('');
  const [formByDate, setFormByDate] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline Step Form state for cards
  const [newStepInputs, setNewStepInputs] = useState<Record<string, string>>({});

  // Totals & Calculations
  const totals = useMemo(() => {
    const current = expenses.reduce((s, e) => s + e.currentValue, 0);
    const target = expenses.reduce((s, e) => s + e.targetValue, 0);
    const overCount = expenses.filter((e) => e.currentValue > e.targetValue).length;
    return { current, target, overCount };
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
    if (item) {
      setEditingId(item.id);
      setFormTitle(item.title);
      setFormCategory(item.category || 'Dining Out');
      setFormActionType(item.actionType || 'reduce');
      setFormCurrentVal(item.currentValue.toString());
      setFormTargetVal(item.targetValue.toString());
      setFormByDate(item.byDate || new Date().toISOString().split('T')[0]);
    } else {
      setEditingId(null);
      setFormTitle('');
      setFormCategory('Dining Out');
      setFormActionType('reduce');
      setFormCurrentVal('');
      setFormTargetVal('');
      setFormByDate(new Date().toISOString().split('T')[0]);
    }
    setDialogOpen(true);
  };

  // Save Modal Form
  const handleSubmitForm = async () => {
    if (!formTitle.trim()) return setFormError('Give this expense a name.');
    const c = parseFloat(formCurrentVal);
    if (!formCurrentVal || isNaN(c) || c <= 0) return setFormError('Enter a valid current amount.');
    
    let t = parseFloat(formTargetVal);
    if (formActionType === 'eliminate') {
      t = 0;
    } else if (!formTargetVal || isNaN(t) || t < 0) {
      return setFormError('Enter a valid target amount.');
    }

    setFormError('');
    setSaving(true);

    try {
      const pct = formActionType === 'eliminate' ? 100 : c > 0 ? Math.max(0, Math.round(((c - t) / c) * 100)) : 0;
      const existing = editingId ? expenses.find((e) => e.id === editingId) : null;
      
      const historyArr = existing?.history && existing.history.length > 0
        ? [...existing.history.slice(-3), c]
        : [c];

      const newItem: ExpenseItem = {
        id: editingId || 'exp_' + Date.now(),
        title: formTitle.trim(),
        category: formCategory,
        actionType: formActionType,
        currentValue: c,
        initialValue: existing ? existing.initialValue : c,
        targetValue: t,
        reductionPercent: pct,
        byDate: formByDate || new Date().toISOString().split('T')[0],
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
    const filtered = expenses.filter((e) => e.id !== itemId);
    await saveExpensesList(filtered);
  };

  // Toggle Strategic Action Step
  const handleToggleStep = async (itemId: string, stepId: string) => {
    const updated = expenses.map((item) => {
      if (item.id === itemId) {
        const newActions = (item.actions || []).map((step) =>
          step.id === stepId ? { ...step, done: !step.done } : step
        );
        return { ...item, actions: newActions };
      }
      return item;
    });
    await saveExpensesList(updated);
  };

  // Add Strategic Action Step
  const handleAddStep = async (itemId: string) => {
    const text = (newStepInputs[itemId] || '').trim();
    if (!text) return;

    const updated = expenses.map((item) => {
      if (item.id === itemId) {
        const newStep: ExpenseActionItem = {
          id: 'step_' + Date.now(),
          task: text,
          done: false,
        };
        return { ...item, actions: [...(item.actions || []), newStep] };
      }
      return item;
    });

    await saveExpensesList(updated);
    setNewStepInputs((prev) => ({ ...prev, [itemId]: '' }));
  };

  // Delete Action Step
  const handleDeleteStep = async (itemId: string, stepId: string) => {
    const updated = expenses.map((item) => {
      if (item.id === itemId) {
        const newActions = (item.actions || []).filter((s) => s.id !== stepId);
        return { ...item, actions: newActions };
      }
      return item;
    });
    await saveExpensesList(updated);
  };

  // Dialog Live Computations
  const dlgCurrent = parseFloat(formCurrentVal);
  const dlgTarget = formActionType === 'eliminate' ? 0 : parseFloat(formTargetVal);

  const dlgPct = useMemo(() => {
    if (!dlgCurrent || !dlgTarget || dlgTarget <= 0) return 0;
    return Math.min(100, Math.round((dlgCurrent / dlgTarget) * 100));
  }, [dlgCurrent, dlgTarget]);

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
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {formatCurrency(totals.current, currencyUnit)} of {formatCurrency(totals.target, currencyUnit)} target
            </p>
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

        {/* Warning Banner when over budget */}
        {totals.overCount > 0 && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-3 mb-4 text-rose-600 dark:text-rose-300">
            <TrendingDown className="shrink-0 text-rose-500 dark:text-rose-400" sx={{ fontSize: 20 }} />
            <p className="text-xs font-medium">
              {totals.overCount} {totals.overCount === 1 ? 'category is' : 'categories are'} over target — trim these first.
            </p>
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
            const steps = item.actions || [];
            const doneSteps = steps.filter((s) => s.done).length;
            const onTrack = item.targetValue === 0 ? item.currentValue === 0 : item.currentValue <= item.targetValue;
            const overBy = item.currentValue - item.targetValue;

            const meta = CATEGORY_META[item.category] || CATEGORY_META.Other;
            const IconC = meta.icon;

            return (
              <div
                key={item.id}
                className="w-full rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-5 md:p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                    >
                      <IconC sx={{ fontSize: 22 }} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Reduction goal · {item.category}</p>
                      <h3 className="text-slate-900 dark:text-white text-base font-semibold leading-snug">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${
                        onTrack
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'
                      }`}
                    >
                      {onTrack
                        ? item.actionType === 'eliminate'
                          ? 'Eliminated 100%'
                          : 'On target'
                        : `Rs ${overBy.toLocaleString()} above target`}
                    </span>

                    <IconButton size="small" onClick={() => handleOpenModal(item)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                      <EditIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteExpenseItem(item.id)} className="text-rose-400 hover:text-rose-600">
                      <DeleteIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </div>
                </div>

                {/* Amount Row */}
                <div className="flex items-baseline gap-2 mt-3 mb-1">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {formatCurrency(item.currentValue, currencyUnit)}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    now &middot; target {formatCurrency(item.targetValue, currencyUnit)}
                  </span>
                </div>

                {/* Sparkline Visual */}
                <Sparkline values={item.history || [item.currentValue]} targetHigh={item.targetValue} />
                <p className="text-xs text-slate-400 dark:text-slate-500 -mt-1 mb-4">
                  Last billing cycles &middot; dashed line is target
                </p>

                {/* ── Collapsible Strategic Action Tasks Section ── */}
                <div className="mb-4 pt-3 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Strategy & Action Steps
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                      {doneSteps}/{steps.length} done
                    </p>
                  </div>

                  {steps.length > 0 && (
                    <div className="space-y-1.5 mb-2.5">
                      {steps.map((step) => (
                        <div
                          key={step.id}
                          className="w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                        >
                          <button
                            onClick={() => handleToggleStep(item.id, step.id)}
                            className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                          >
                            {step.done ? (
                              <CheckIcon className="text-emerald-500 dark:text-emerald-400 shrink-0" sx={{ fontSize: 18 }} />
                            ) : (
                              <CircleIcon className="text-slate-300 dark:text-slate-600 shrink-0" sx={{ fontSize: 18 }} />
                            )}
                            <span
                              className={`text-sm truncate ${
                                step.done ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {step.task}
                            </span>
                          </button>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteStep(item.id, step.id)}
                            className="text-slate-300 hover:text-rose-500 opacity-60 hover:opacity-100 transition-opacity"
                          >
                            <DeleteIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Step Input */}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Add a strategy step..."
                      value={newStepInputs[item.id] || ''}
                      onChange={(e) => setNewStepInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddStep(item.id);
                      }}
                      className="flex-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-teal-500"
                    />
                    <button
                      onClick={() => handleAddStep(item.id)}
                      className="px-3 py-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-semibold hover:bg-teal-500/20 transition-colors"
                    >
                      + Add
                    </button>
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

                {/* Over Budget Notice */}
                {!onTrack && (
                  <div className="flex items-start gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
                    <TrendingDown className="mt-0.5 shrink-0 text-amber-500" sx={{ fontSize: 15 }} />
                    <p>Over target — try completing the next strategy step before the check-in date.</p>
                  </div>
                )}
              </div>
            );
          }))}
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
            {/* Glowing background blur spots */}
            <div className="pointer-events-none absolute -top-24 -right-16 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

            {/* Dialog Fixed Header */}
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

            {/* Dialog Scrollable Form Body */}
            <div className="relative flex-1 overflow-y-auto pr-1 space-y-3.5 custom-scrollbar my-1">
              {/* Expense Title */}
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

              {/* Category Grid */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(CATEGORY_META).map(([key, meta]) => {
                    const isSelected = formCategory === key;
                    const IconC = meta.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormCategory(key)}
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
              </div>

              {/* Reduction Goal Objective Segmented Control */}
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

              {/* Current & Target Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    <WalletIcon sx={{ fontSize: 15 }} className="text-cyan-600 dark:text-cyan-400" />
                    Current
                  </label>
                  <div className="flex items-center rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-2.5 focus-within:border-cyan-500/60 dark:focus-within:border-cyan-400/60 focus-within:ring-2 focus-within:ring-cyan-500/20 dark:focus-within:ring-cyan-400/20 transition-all">
                    <span className="text-slate-400 dark:text-slate-500 text-sm mr-1 font-medium">{currencyUnit}</span>
                    <input
                      value={formCurrentVal}
                      onChange={(e) => setFormCurrentVal(e.target.value.replace(/[^0-9.]/g, ''))}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    <TargetIcon sx={{ fontSize: 15 }} className="text-emerald-600 dark:text-emerald-400" />
                    Target
                  </label>
                  <div className="flex items-center rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-2.5 focus-within:border-emerald-500/60 dark:focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-500/20 dark:focus-within:ring-emerald-400/20 transition-all">
                    <span className="text-slate-400 dark:text-slate-500 text-sm mr-1 font-medium">{currencyUnit}</span>
                    <input
                      value={formActionType === 'eliminate' ? '0' : formTargetVal}
                      disabled={formActionType === 'eliminate'}
                      onChange={(e) => setFormTargetVal(e.target.value.replace(/[^0-9.]/g, ''))}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none font-semibold disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Target By Date */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  <CalendarIcon sx={{ fontSize: 15 }} className="text-teal-600 dark:text-teal-400" />
                  Target Date (Optional)
                </label>
                <input
                  type="date"
                  value={formByDate}
                  onChange={(e) => setFormByDate(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3.5 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500"
                />
              </div>

              {/* Progress Bar & Status Preview */}
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

            {/* Fixed Submit Button at Bottom */}
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
    </div>
  );
}

