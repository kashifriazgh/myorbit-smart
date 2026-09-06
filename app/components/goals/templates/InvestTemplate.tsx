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
  Savings as GoldIcon,
  ShowChart as StockIcon,
  PieChart as FundIcon,
  Home as HomeIcon,
  Work as BriefcaseIcon,
  LocalOffer as TagIcon,
  Add as AddIcon,
  Event as EventIcon,
  CheckCircle,
  RadioButtonUnchecked,
  Checklist as TodoIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface ProfitLog {
  id?: string;
  amount: number;
  date: string;
  recurring?: 'weekly' | 'monthly' | 'custom';
}

export interface InvestmentData {
  type: 'gold' | 'stock' | 'mutual_fund' | 'real_estate' | 'business' | 'other';
  title: string;
  amountInvested: number;
  quantity?: number;
  unit?: string;
  expectedProfit?: number;
  profitTimingMode?: 'date' | 'weekly' | 'monthly' | 'custom';
  expectedBy?: string;
}

interface InvestTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

const TYPE_META = {
  gold: { label: 'Gold', color: '#f59e0b', icon: GoldIcon },
  stock: { label: 'Stock / Shares', color: '#0284c7', icon: StockIcon },
  mutual_fund: { label: 'Mutual Fund', color: '#8b5cf6', icon: FundIcon },
  real_estate: { label: 'Real Estate', color: '#10b981', icon: HomeIcon },
  business: { label: 'Business Venture', color: '#6366f1', icon: BriefcaseIcon },
  other: { label: 'Other Asset', color: '#64748b', icon: TagIcon },
};

function formatMoney(value: number, currency: string = 'PKR') {
  const sign = value < 0 ? '-' : '';
  return `${sign}${currency} ${Math.round(Math.abs(value)).toLocaleString()}`;
}

function formatDate(dateStr: string | Date | null | undefined) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function monthLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
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

export default function InvestTemplate({ goal, onUpdateGoal }: InvestTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};
  const currency = String(goal.overallTargetUnit || answers.currency || 'PKR');

  // Investment metadata
  const investType = (answers.investment_type || answers.asset_type || 'gold') as keyof typeof TYPE_META;
  const amountInvested = Number(answers.amount_invested || answers.initial_investment || goal.overallTargetValue || 100000);
  const quantity = answers.quantity ? Number(answers.quantity) : undefined;
  const unit = String(answers.unit || (investType === 'gold' ? 'grams' : 'units'));
  const expectedProfit = Number(answers.expected_profit || answers.target_profit || goal.overallTargetValue || 20000);
  const expectedBy = toPlainDate(goal.dueDate)?.toISOString().split('T')[0] || String(answers.expected_by || '2026-12-31');

  // Profit logs stored on goal.profitLogs
  const [profitLogs, setProfitLogs] = useState<ProfitLog[]>(() => {
    if (Array.isArray(goal.profitLogs) && goal.profitLogs.length > 0) {
      return goal.profitLogs;
    }
    return [
      { id: '1', amount: 2000, date: '2026-08-15' },
      { id: '2', amount: 2500, date: '2026-09-10' },
    ];
  });

  const [addProfitOpen, setAddProfitOpen] = useState(false);
  const [logAmount, setLogAmount] = useState<number | ''>('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logRecurring, setLogRecurring] = useState<ProfitLog['recurring'] | ''>('');
  const [savingLog, setSavingLog] = useState(false);

  // Schedules / Reminders modal
  const [addSchedOpen, setAddSchedOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedDate, setSchedDate] = useState(expectedBy);
  const [schedTime, setSchedTime] = useState('10:00');
  const [savingSched, setSavingSched] = useState(false);

  const meta = TYPE_META[investType] || TYPE_META.other;
  const IconComponent = meta.icon;

  const totalProfit = useMemo(() => profitLogs.reduce((sum, p) => sum + p.amount, 0), [profitLogs]);

  const monthlyGroups = useMemo(() => {
    const groups = new Map<string, number>();
    [...profitLogs]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((p) => {
        const label = monthLabel(p.date);
        groups.set(label, (groups.get(label) || 0) + p.amount);
      });
    return Array.from(groups.entries());
  }, [profitLogs]);

  const profitProgress = expectedProfit > 0 ? Math.max(0, Math.min(100, Math.round((totalProfit / expectedProfit) * 100))) : null;
  const returnPct = amountInvested > 0 ? Math.round((totalProfit / amountInvested) * 1000) / 10 : null;

  // Filter linked todos and schedules
  const linkedInvestTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  const linkedInvestSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const handleAddProfitLog = async () => {
    if (typeof logAmount !== 'number' || logAmount <= 0 || !goal.id) return;
    setSavingLog(true);
    try {
      const newLog: ProfitLog = {
        id: String(Date.now()),
        amount: logAmount,
        date: logDate || new Date().toISOString().split('T')[0],
        recurring: logRecurring || undefined,
      };
      const updated = [...profitLogs, newLog];
      setProfitLogs(updated);

      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, {
          profitLogs: updated,
          currentValue: updated.reduce((sum, p) => sum + p.amount, 0),
        });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), {
          profitLogs: updated,
        });
      }

      setLogAmount('');
      setAddProfitOpen(false);
    } catch (err) {
      console.error('Failed to add profit log:', err);
    } finally {
      setSavingLog(false);
    }
  };

  const handleAddProfitSchedule = async () => {
    if (!schedTitle.trim() || !user || !goal.id) return;
    setSavingSched(true);
    try {
      if (schedKind === 'schedule') {
        await addSchedule({
          title: schedTitle.trim(),
          date: schedDate || new Date().toISOString().split('T')[0],
          startTime: schedTime || '10:00',
          endTime: '11:00',
          projectId: goal.projectId || '',
          userId: user.uid,
          status: 'pending',
          priority: 'medium',
          linkedGoalId: goal.id,
          goalTitle: goal.title,
        });
      } else {
        await addTodo({
          title: schedTitle.trim(),
          status: 'in_progress',
          priority: 'routine',
          projectId: goal.projectId || '',
          authorId: user.uid,
          dueDate: schedDate ? new Date(schedDate) : new Date(),
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

      setSchedTitle('');
      setAddSchedOpen(false);
    } catch (err) {
      console.error('Failed to add payout schedule:', err);
    } finally {
      setSavingSched(false);
    }
  };

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header & Facts */}
      <Box
        sx={{
          borderRadius: '24px',
          border: `1px solid ${cardBorder}`,
          bgcolor: surfaceBg,
          p: 3,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.06)',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '14px',
              bgcolor: `${meta.color}15`,
              color: meta.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconComponent sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase' }}>
              Finance Investment · {meta.label}
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: textPrimary }}>
              {goal.title}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 3 }}>
          <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: isDark ? 'rgba(51,65,85,0.3)' : '#f8fafc' }}>
            <Typography sx={{ fontSize: 10, color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>
              Amount Invested
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: textPrimary, fontFamily: 'monospace', mt: 0.25 }}>
              {formatMoney(amountInvested, currency)}
            </Typography>
          </Box>

          {quantity !== undefined && (
            <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: isDark ? 'rgba(51,65,85,0.3)' : '#f8fafc' }}>
              <Typography sx={{ fontSize: 10, color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>
                Quantity / Holding
              </Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: textPrimary, fontFamily: 'monospace', mt: 0.25 }}>
                {quantity} {unit}
              </Typography>
            </Box>
          )}

          <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: isDark ? 'rgba(51,65,85,0.3)' : '#f8fafc' }}>
            <Typography sx={{ fontSize: 10, color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>
              Expected Profit
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: textPrimary, fontFamily: 'monospace', mt: 0.25 }}>
              {formatMoney(expectedProfit, currency)}
            </Typography>
          </Box>

          <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: isDark ? 'rgba(51,65,85,0.3)' : '#f8fafc' }}>
            <Typography sx={{ fontSize: 10, color: textMuted, textTransform: 'uppercase', fontWeight: 600 }}>
              Expected By
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary, mt: 0.25 }}>
              {formatDate(expectedBy)}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 2 Core Investment Metrics */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
        <Box
          sx={{
            p: 2.5,
            borderRadius: '20px',
            bgcolor: surfaceBg,
            border: `1px solid ${cardBorder}`,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase' }}>
            Profit Progress
          </Typography>
          <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#10b981', fontFamily: 'monospace', mt: 0.5 }}>
            {profitProgress !== null ? `${profitProgress}%` : '—'}
          </Typography>
          <Typography sx={{ fontSize: 10, color: textMuted, mt: 0.5 }}>
            Actual profit ÷ expected profit
          </Typography>
        </Box>

        <Box
          sx={{
            p: 2.5,
            borderRadius: '20px',
            bgcolor: surfaceBg,
            border: `1px solid ${cardBorder}`,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase' }}>
            Investment Return
          </Typography>
          <Typography
            sx={{
              fontSize: 28,
              fontWeight: 800,
              color: returnPct !== null && returnPct >= 0 ? '#0284c7' : '#ef4444',
              fontFamily: 'monospace',
              mt: 0.5,
            }}
          >
            {returnPct !== null ? `${returnPct}%` : '—'}
          </Typography>
          <Typography sx={{ fontSize: 10, color: textMuted, mt: 0.5 }}>
            Actual profit ÷ amount invested
          </Typography>
        </Box>
      </Box>

      {/* Actual Profit History */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Actual Profit Logged (Total: {formatMoney(totalProfit, currency)})
          </Typography>
          <Button
            size="small"
            onClick={() => setAddProfitOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#10b981' }}
          >
            + Log Profit
          </Button>
        </Box>

        {monthlyGroups.length > 0 ? (
          <Box sx={{ borderRadius: '20px', border: `1px solid ${cardBorder}`, bgcolor: surfaceBg, p: 2.5 }}>
            <Stack spacing={1.5}>
              {monthlyGroups.map(([label, amt]) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: textMuted }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: amt >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatMoney(amt, currency)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        ) : (
          <Typography sx={{ fontSize: 12, color: textMuted, fontStyle: 'italic', textAlign: 'center', py: 2 }}>
            No profit entries logged yet. Click &quot;+ Log Profit&quot; to add payouts.
          </Typography>
        )}
      </Box>

      {/* Expected Profit Payout Schedules & Tasks */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Payout Dates & Review Tasks ({linkedInvestSchedules.length + linkedInvestTodos.length})
          </Typography>
          <Button
            size="small"
            onClick={() => setAddSchedOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#0284c7' }}
          >
            + Schedule Payout Date
          </Button>
        </Box>

        <Stack spacing={1.25}>
          {linkedInvestSchedules.map((s) => (
            <Box
              key={s.id}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: surfaceBg,
                border: `1px solid ${cardBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <EventIcon sx={{ color: '#0284c7', fontSize: 20 }} />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    Scheduled Payout: {formatDate(s.date)} at {s.startTime || '10:00'}
                  </Typography>
                </Box>
              </Box>
              <Chip label="Schedule" size="small" sx={{ bgcolor: isDark ? '#0c4a6e' : '#e0f2fe', color: '#0284c7', fontSize: 10, fontWeight: 700 }} />
            </Box>
          ))}

          {linkedInvestTodos.map((todo) => {
            const isDone = todo.status === 'completed';
            return (
              <Box
                key={todo.id}
                onClick={() => todo.id && updateTodo(todo.id, { status: isDone ? 'in_progress' : 'completed' })}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: surfaceBg,
                  border: `1px solid ${cardBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  cursor: 'pointer',
                }}
              >
                <IconButton size="small" sx={{ p: 0, color: isDone ? '#10b981' : textMuted }}>
                  {isDone ? <CheckCircle sx={{ fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ fontSize: 20 }} />}
                </IconButton>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: isDone ? textMuted : textPrimary, textDecoration: isDone ? 'line-through' : 'none' }}>
                    {todo.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    Due {formatDate(todo.dueDate as unknown as string)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Add Profit Dialog */}
      <Dialog open={addProfitOpen} onClose={() => setAddProfitOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Log Investment Profit</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={`Profit Amount (${currency})`}
              type="number"
              fullWidth
              size="small"
              value={logAmount}
              onChange={(e) => setLogAmount(e.target.value ? Number(e.target.value) : '')}
            />

            <TextField
              label="Received Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Recurrence</InputLabel>
              <Select
                value={logRecurring}
                label="Recurrence"
                onChange={(e) => setLogRecurring(e.target.value as ProfitLog['recurring'])}
              >
                <MenuItem value="">One-time Payout</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddProfitOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingLog || typeof logAmount !== 'number' || logAmount <= 0}
            onClick={handleAddProfitLog}
            sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Log Profit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Payout Schedule Dialog */}
      <Dialog open={addSchedOpen} onClose={() => setAddSchedOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Schedule Profit Payout / Review</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                variant={schedKind === 'schedule' ? 'contained' : 'outlined'}
                onClick={() => setSchedKind('schedule')}
                startIcon={<EventIcon />}
                size="small"
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                Schedule Payout
              </Button>
              <Button
                fullWidth
                variant={schedKind === 'todo' ? 'contained' : 'outlined'}
                onClick={() => setSchedKind('todo')}
                startIcon={<TodoIcon />}
                size="small"
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                Review Task
              </Button>
            </Box>

            <TextField
              label="Title"
              placeholder="e.g. Expected dividend payout or Gold price check"
              fullWidth
              size="small"
              value={schedTitle}
              onChange={(e) => setSchedTitle(e.target.value)}
            />

            <TextField
              label="Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={schedDate}
              onChange={(e) => setSchedDate(e.target.value)}
            />

            {schedKind === 'schedule' && (
              <TextField
                label="Time"
                type="time"
                fullWidth
                size="small"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddSchedOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingSched || !schedTitle.trim()}
            onClick={handleAddProfitSchedule}
            sx={{ textTransform: 'none', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            Save Payout Schedule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
