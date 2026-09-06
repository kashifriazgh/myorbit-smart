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
  Work as BriefcaseIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Event as EventIcon,
  Checklist as TodoIcon,
  Repeat as RepeatIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface IncomeSourceItem {
  id: string;
  type: 'existing' | 'new_proposed';
  name: string;
  currentAmount: number;
  targetAmount: number;
  frequency: 'monthly' | 'weekly';
}

interface IncomeTemplateProps {
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

function calculateSourceProgress(src: IncomeSourceItem): number {
  if (!src.targetAmount || src.targetAmount <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((src.currentAmount / src.targetAmount) * 100)));
}

export default function IncomeTemplate({ goal, onUpdateGoal }: IncomeTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};
  const currency = String(goal.overallTargetUnit || answers.currency || 'PKR');

  // Income Sources List (Stored on goal.incomeSources)
  const [sources, setSources] = useState<IncomeSourceItem[]>(() => {
    if (Array.isArray(goal.incomeSources) && goal.incomeSources.length > 0) {
      return goal.incomeSources;
    }
    const initCurr = goal.currentValue || Number(answers.current_income || 0);
    const initTarg = goal.overallTargetValue || Number(answers.target_income || 0);

    return [
      {
        id: 'inc_' + Date.now(),
        type: 'existing',
        name: goal.title ? `${goal.title} (Primary Source)` : 'Primary Income Source',
        currentAmount: initCurr,
        targetAmount: initTarg > 0 ? initTarg : 100000,
        frequency: 'monthly',
      },
    ];
  });

  // Dialog State for Add / Edit Income Source
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Income Source Form Fields
  const [formType, setFormType] = useState<'existing' | 'new_proposed'>('existing');
  const [formName, setFormName] = useState('');
  const [formCurrentVal, setFormCurrentVal] = useState<number | ''>('');
  const [formTargetVal, setFormTargetVal] = useState<number | ''>('');
  const [formFrequency, setFormFrequency] = useState<'monthly' | 'weekly'>('monthly');
  const [savingSource, setSavingSource] = useState(false);

  // Quick Update Current Amount Dialog
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [targetSourceForUpdate, setTargetSourceForUpdate] = useState<IncomeSourceItem | null>(null);
  const [updateCurrentInput, setUpdateCurrentInput] = useState<number | ''>('');

  // Dialog State for Adding Action (Schedule / Todo)
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionKind, setActionKind] = useState<'schedule' | 'todo'>('schedule');
  const [actionTitle, setActionTitle] = useState('');
  const [actionTime, setActionTime] = useState('10:00');
  const [actionDueDate, setActionDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingAction, setSavingAction] = useState(false);

  // Group existing vs new proposed sources
  const existingSources = useMemo(() => sources.filter((s) => s.type === 'existing'), [sources]);
  const proposedSources = useMemo(() => sources.filter((s) => s.type === 'new_proposed'), [sources]);

  // Overall Income Totals & Mean Progress
  const totals = useMemo(() => {
    const totalCurrent = sources.reduce((sum, s) => sum + (s.currentAmount || 0), 0);
    const totalTarget = sources.reduce((sum, s) => sum + (s.targetAmount || 0), 0);
    let sumProg = 0;
    for (const src of sources) {
      sumProg += calculateSourceProgress(src);
    }
    const meanProgress = sources.length > 0 ? Math.max(0, Math.min(100, Math.round(sumProg / sources.length))) : 0;
    return { totalCurrent, totalTarget, meanProgress };
  }, [sources]);

  // Linked Timeline Actions (Schedules & Todos) - Same UI as SavingsTemplate.tsx
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
      }));

    return [...schedList, ...todoList];
  }, [allSchedules, todos, goal.id]);

  // Persist updated income sources array and sync mean progress
  const saveSourcesList = async (newList: IncomeSourceItem[]) => {
    setSources(newList);
    if (!goal.id) return;

    let sumProg = 0;
    for (const src of newList) {
      sumProg += calculateSourceProgress(src);
    }
    const newMean = newList.length > 0 ? Math.max(0, Math.min(100, Math.round(sumProg / newList.length))) : 0;
    const newCurrent = newList.reduce((sum, s) => sum + (s.currentAmount || 0), 0);
    const newTarget = newList.reduce((sum, s) => sum + (s.targetAmount || 0), 0);

    const payload = {
      incomeSources: newList,
      progress: newMean,
      currentValue: newCurrent,
      overallTargetValue: newTarget,
    };

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, payload);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), payload);
    }
  };

  // Open Modal to Add / Edit Income Source
  const handleOpenSourceModal = (item?: IncomeSourceItem) => {
    if (item) {
      setEditingId(item.id);
      setFormType(item.type);
      setFormName(item.name);
      setFormCurrentVal(item.type === 'existing' ? item.currentAmount : '');
      setFormTargetVal(item.targetAmount);
      setFormFrequency(item.frequency || 'monthly');
    } else {
      setEditingId(null);
      setFormType('existing');
      setFormName('');
      setFormCurrentVal('');
      setFormTargetVal('');
      setFormFrequency('monthly');
    }
    setDialogOpen(true);
  };

  const handleSaveSource = async () => {
    if (!formName.trim() || typeof formTargetVal !== 'number' || formTargetVal <= 0) return;
    setSavingSource(true);

    try {
      const currAmt = formType === 'existing' && typeof formCurrentVal === 'number' ? formCurrentVal : 0;
      const newItem: IncomeSourceItem = {
        id: editingId || 'inc_' + Date.now(),
        type: formType,
        name: formName.trim(),
        currentAmount: currAmt,
        targetAmount: formTargetVal,
        frequency: formFrequency,
      };

      let updatedList: IncomeSourceItem[];
      if (editingId) {
        updatedList = sources.map((s) => (s.id === editingId ? newItem : s));
      } else {
        updatedList = [...sources, newItem];
      }

      await saveSourcesList(updatedList);
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to save income source:', err);
    } finally {
      setSavingSource(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    const filtered = sources.filter((s) => s.id !== sourceId);
    await saveSourcesList(filtered);
  };

  // Quick Update Current Amount Dialog
  const handleOpenUpdateCurrent = (item: IncomeSourceItem) => {
    setTargetSourceForUpdate(item);
    setUpdateCurrentInput(item.currentAmount);
    setUpdateModalOpen(true);
  };

  const handleConfirmUpdateCurrent = async () => {
    if (!targetSourceForUpdate || typeof updateCurrentInput !== 'number') return;
    const updated = sources.map((s) => {
      if (s.id === targetSourceForUpdate.id) {
        return { ...s, currentAmount: updateCurrentInput };
      }
      return s;
    });
    await saveSourcesList(updated);
    setUpdateModalOpen(false);
  };

  // Create Linked Schedule or Todo (SavingsTemplate UI pattern)
  const handleAddAction = async () => {
    if (!actionTitle.trim() || !user || !goal.id) return;
    setSavingAction(true);
    try {
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
          frequencyMode: 'weekly',
          selectedDaysOfWeek: [1, 3, 5],
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
      setActionModalOpen(false);
    } catch (err) {
      console.error('Failed to add action:', err);
    } finally {
      setSavingAction(false);
    }
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
          border: `1.5px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#a7f3d0'}`,
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
          p: 3.5,
          boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 8px 30px rgba(16,185,129,0.06)',
          mb: 3.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Income Growth Tracker
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: textPrimary, mt: 0.5 }}>
              {goal.title}
            </Typography>
          </Box>

          <Chip
            label={`${totals.meanProgress}% Target Progress`}
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

        <Box sx={{ mt: 3, display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 32, fontWeight: 900, color: textPrimary, fontFamily: 'monospace' }}>
            {formatMoney(totals.totalCurrent, currency)}
          </Typography>
          <Typography sx={{ fontSize: 13, color: textMuted, fontWeight: 500 }}>
            current active income (target: {formatMoney(totals.totalTarget, currency)})
          </Typography>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ mt: 2, height: 8, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              width: `${totals.meanProgress}%`,
              background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
              borderRadius: 99,
              transition: 'width 0.6s ease',
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, fontSize: 12, color: textMuted }}>
          <span>Overall Mean Income Target Progress</span>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{totals.meanProgress}% Achieved</span>
        </Box>
      </Box>

      {/* ── 2. Existing Income Sources (Top Section) ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Existing Income Sources ({existingSources.length})
          </Typography>
          <Button
            size="small"
            onClick={() => handleOpenSourceModal()}
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontSize: 12,
              fontWeight: 800,
              color: '#ffffff',
              bgcolor: '#10b981',
              borderRadius: '10px',
              px: 2,
              py: 0.6,
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            + Add Income Source
          </Button>
        </Box>

        {existingSources.length === 0 ? (
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
              No existing income sources added yet. Click <strong>+ Add Income Source</strong> to configure your current earnings!
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {existingSources.map((src) => {
              const srcProg = calculateSourceProgress(src);
              return (
                <Box
                  key={src.id}
                  sx={{
                    borderRadius: '20px',
                    border: `1.5px solid ${cardBorder}`,
                    bgcolor: surfaceBg,
                    p: 2.5,
                    boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 4px 16px rgba(15,23,42,0.04)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '12px',
                          bgcolor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BriefcaseIcon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
                          {src.name}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: textMuted, textTransform: 'capitalize' }}>
                          Existing Source · {src.frequency}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={`${srcProg}% Reached`}
                        size="small"
                        sx={{
                          fontSize: 11,
                          fontWeight: 800,
                          bgcolor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                        }}
                      />
                      <IconButton size="small" onClick={() => handleOpenSourceModal(src)}>
                        <EditIcon sx={{ fontSize: 17, color: textMuted }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteSource(src.id)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Amounts & Quick Update Button */}
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography sx={{ fontSize: 24, fontWeight: 900, color: textPrimary, fontFamily: 'monospace' }}>
                        {formatMoney(src.currentAmount, currency)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: textMuted }}>
                        / {formatMoney(src.targetAmount, currency)} target per {src.frequency.replace('ly', '')}
                      </Typography>
                    </Box>

                    <Button
                      size="small"
                      onClick={() => handleOpenUpdateCurrent(src)}
                      startIcon={<TrendingUpIcon sx={{ fontSize: 15 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#10b981',
                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '8px',
                        px: 1.2,
                        py: 0.4,
                        '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.2)' },
                      }}
                    >
                      Update Current Amount
                    </Button>
                  </Box>

                  {/* Progress Bar */}
                  <Box sx={{ mt: 1.5, height: 7, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${srcProg}%`,
                        bgcolor: '#10b981',
                        borderRadius: 99,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* ── 3. New Proposed Income Sources (Below Section) ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            New Proposed Income Sources ({proposedSources.length})
          </Typography>
        </Box>

        {proposedSources.length === 0 ? (
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
              No proposed income channels added. Click <strong>+ Add Income Source</strong> and select &quot;New Proposed Source&quot; to set targets for new side hustles or projects!
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {proposedSources.map((src) => {
              const srcProg = calculateSourceProgress(src);
              return (
                <Box
                  key={src.id}
                  sx={{
                    borderRadius: '20px',
                    border: `1.5px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe'}`,
                    bgcolor: surfaceBg,
                    p: 2.5,
                    boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 4px 16px rgba(59,130,246,0.04)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '12px',
                          bgcolor: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TrendingUpIcon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
                          {src.name}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: textMuted, textTransform: 'capitalize' }}>
                          Proposed Channel · {src.frequency}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label="New Proposed"
                        size="small"
                        sx={{
                          fontSize: 11,
                          fontWeight: 800,
                          bgcolor: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                        }}
                      />
                      <IconButton size="small" onClick={() => handleOpenSourceModal(src)}>
                        <EditIcon sx={{ fontSize: 17, color: textMuted }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteSource(src.id)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Amounts */}
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography sx={{ fontSize: 24, fontWeight: 900, color: textPrimary, fontFamily: 'monospace' }}>
                        {formatMoney(src.currentAmount, currency)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: textMuted }}>
                        / Desired Target: {formatMoney(src.targetAmount, currency)} per {src.frequency.replace('ly', '')}
                      </Typography>
                    </Box>

                    <Button
                      size="small"
                      onClick={() => handleOpenUpdateCurrent(src)}
                      startIcon={<TrendingUpIcon sx={{ fontSize: 15 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#3b82f6',
                        bgcolor: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '8px',
                        px: 1.2,
                        py: 0.4,
                        '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.2)' },
                      }}
                    >
                      Log Earned Income
                    </Button>
                  </Box>

                  {/* Progress Bar */}
                  <Box sx={{ mt: 1.5, height: 7, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${srcProg}%`,
                        bgcolor: '#3b82f6',
                        borderRadius: 99,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* ── 4. SCHEDULES & TODOS VERTICAL TIMELINE SECTION (Same UI as SavingsTemplate.tsx) ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Income Routines & Tasks ({actionItems.length})
          </Typography>
          <Button
            size="small"
            onClick={() => setActionModalOpen(true)}
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
              No routine schedules or tasks linked to this income goal. Click <strong>+ Add Schedule / Task</strong> to schedule pitch calls or client reviews!
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
                          bgcolor: item.kind === 'schedule' ? (isDark ? '#064e3b' : '#ffedd5') : (isDark ? '#1e3a8a' : '#e0f2fe'),
                          color: item.kind === 'schedule' ? '#f97316' : '#0284c7',
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
                          {item.kind === 'schedule' ? `Recurring Schedule · ${item.time || '10:00 AM'}` : `One-off Task · Due ${item.date}`}
                        </Typography>
                      </Box>
                    </Box>

                    <Chip
                      label={isDone ? 'Completed' : item.kind === 'schedule' ? 'Recurring' : 'Todo'}
                      size="small"
                      sx={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        bgcolor: isDone
                          ? (isDark ? '#064e3b' : '#ecfdf5')
                          : item.kind === 'schedule'
                            ? (isDark ? '#431407' : '#fff7ed')
                            : (isDark ? '#0c4a6e' : '#f0f9ff'),
                        color: isDone ? '#10b981' : item.kind === 'schedule' ? '#f97316' : '#0284c7',
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Add / Edit Income Source Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17, pb: 1 }}>
          {editingId ? 'Edit Income Source' : 'Add Income Source'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {/* Field 1: Existing or New Proposed */}
            <FormControl component="fieldset">
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, mb: 0.5 }}>
                Source Type
              </Typography>
              <RadioGroup
                row
                value={formType}
                onChange={(e) => setFormType(e.target.value as 'existing' | 'new_proposed')}
              >
                <FormControlLabel value="existing" control={<Radio size="small" />} label="Existing Source" />
                <FormControlLabel value="new_proposed" control={<Radio size="small" />} label="New Proposed Source" />
              </RadioGroup>
            </FormControl>

            {/* Field 2: Income Source Name */}
            <TextField
              label="Income Source Name"
              placeholder="e.g. Software Consulting, E-commerce Store"
              fullWidth
              size="small"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />

            {/* Field 3: Amounts based on Type */}
            {formType === 'existing' && (
              <TextField
                label={`Current Income Amount (${currency})`}
                type="number"
                fullWidth
                size="small"
                value={formCurrentVal}
                onChange={(e) => setFormCurrentVal(e.target.value ? Number(e.target.value) : '')}
              />
            )}

            <TextField
              label={`Desired Target Amount (${currency})`}
              type="number"
              fullWidth
              size="small"
              value={formTargetVal}
              onChange={(e) => setFormTargetVal(e.target.value ? Number(e.target.value) : '')}
            />

            {/* Field 4: Frequency (Monthly or Weekly) */}
            <FormControl fullWidth size="small">
              <InputLabel>Frequency</InputLabel>
              <Select
                value={formFrequency}
                label="Frequency"
                onChange={(e) => setFormFrequency(e.target.value as 'monthly' | 'weekly')}
              >
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingSource || !formName.trim() || typeof formTargetVal !== 'number' || formTargetVal <= 0}
            onClick={handleSaveSource}
            sx={{ textTransform: 'none', fontWeight: 800, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Save Source
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Quick Update Current Amount Dialog ── */}
      <Dialog open={updateModalOpen} onClose={() => setUpdateModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          Update Current Earnings ({targetSourceForUpdate?.name})
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 12, color: textMuted, mb: 2 }}>
              Enter your updated earnings for this income source to update your progress.
            </Typography>
            <TextField
              label={`New Current Amount (${currency})`}
              type="number"
              fullWidth
              size="small"
              value={updateCurrentInput}
              onChange={(e) => setUpdateCurrentInput(e.target.value ? Number(e.target.value) : '')}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setUpdateModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmUpdateCurrent}
            disabled={typeof updateCurrentInput !== 'number'}
            sx={{ fontWeight: 800, bgcolor: '#10b981' }}
          >
            Save Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add Action (Schedule / Todo) Dialog ── */}
      <Dialog open={actionModalOpen} onClose={() => setActionModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          Add Linked Routine or Task
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
              placeholder="e.g. Pitch 3 new freelance clients"
              fullWidth
              size="small"
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
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
            onClick={handleAddAction}
            sx={{ textTransform: 'none', fontWeight: 800, bgcolor: '#10b981' }}
          >
            Save Action
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
