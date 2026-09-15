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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Modal,
  Fade,
  Collapse,
  CircularProgress,
} from '@mui/material';
import {
  Work as BriefcaseIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface ExistingIncomeSource {
  id: string;
  name: string;
  currentAmount: number;
  frequency: 'monthly' | 'weekly';
}

export interface ProposedIncomeItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  frequency: 'monthly' | 'weekly';
}

export interface IncomeActionItem {
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

interface IncomeTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

function formatMoney(value: number, currency: string = 'PKR') {
  const displayCurrency = currency === 'units' ? 'PKR' : currency;
  const sign = value < 0 ? '-' : '';
  return `${sign}${displayCurrency} ${Math.round(Math.abs(value)).toLocaleString()}`;
}

export default function IncomeTemplate({ goal, onUpdateGoal }: IncomeTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { addTodo, updateTodo, deleteTodo } = useTodoContext();
  const { addSchedule, editSchedule, removeSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};
  const rawUnit = goal.overallTargetUnit || answers.currency || 'PKR';
  const currency = String(rawUnit === 'units' ? 'PKR' : rawUnit);
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Friend';

  // 1. Existing Income Sources (Queried from root 'incomeSources' collection)
  const [existingSources, setExistingSources] = useState<ExistingIncomeSource[]>([]);

  // 2. Proposed New Income Sources (Stored ONLY on the Goal object)
  const [proposedSources, setProposedSources] = useState<ProposedIncomeItem[]>(() => {
    if (Array.isArray(goal.incomeSources) && goal.incomeSources.length > 0) {
      return goal.incomeSources as unknown as ProposedIncomeItem[];
    }
    return [];
  });

  // 3. Strategy Tasks State
  const [actions, setActions] = useState<IncomeActionItem[]>(() => {
    if (Array.isArray(goal.actions)) return goal.actions as unknown as IncomeActionItem[];
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
  const [activeStep, setActiveStep] = useState<IncomeActionItem | null>(null);
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

  // Fetch Existing Income Sources from Firestore 'incomeSources' collection
  const fetchExistingSources = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const q = query(collection(db, 'incomeSources'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const list: ExistingIncomeSource[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'Income Source',
          currentAmount: Number(data.currentAmount || 0),
          frequency: data.frequency || 'monthly',
        };
      });
      setExistingSources(list);
    } catch (err) {
      console.error('Error fetching incomeSources collection:', err);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchExistingSources();
  }, [fetchExistingSources]);

  // Modal State for Adding CURRENT Income Source
  const [currentModalOpen, setCurrentModalOpen] = useState(false);
  const [currentNameInput, setCurrentNameInput] = useState('');
  const [currentAmountInput, setCurrentAmountInput] = useState<number | ''>('');
  const [currentFreqInput, setCurrentFreqInput] = useState<'monthly' | 'weekly'>('monthly');
  const [savingCurrent, setSavingCurrent] = useState(false);

  // Modal State for Adding PROPOSED Income Source
  const [proposedModalOpen, setProposedModalOpen] = useState(false);
  const [proposedEditingId, setProposedEditingId] = useState<string | null>(null);
  const [proposedNameInput, setProposedNameInput] = useState('');
  const [proposedTargetInput, setProposedTargetInput] = useState<number | ''>('');
  const [proposedFreqInput, setProposedFreqInput] = useState<'monthly' | 'weekly'>('monthly');
  const [savingProposed, setSavingProposed] = useState(false);

  // "Have you got an income increase?" Log Modal for Proposed Source
  const [logEarnedOpen, setLogEarnedOpen] = useState(false);
  const [targetProposedForLog, setTargetProposedForLog] = useState<ProposedIncomeItem | null>(null);
  const [earnedInput, setEarnedInput] = useState<number | ''>('');
  const [savingEarned, setSavingEarned] = useState(false);

  // Calculate Totals
  const totalCurrentIncome = useMemo(() => {
    const fromSources = existingSources.reduce((sum, s) => sum + (s.currentAmount || 0), 0);
    if (fromSources > 0) return fromSources;
    return Number(goal.currentValue || 0);
  }, [existingSources, goal.currentValue]);

  const targetGoalIncome = Number(goal.overallTargetValue || answers.target_income || 0);

  const progressPercent = useMemo(() => {
    if (!targetGoalIncome || targetGoalIncome <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((totalCurrentIncome / targetGoalIncome) * 100)));
  }, [totalCurrentIncome, targetGoalIncome]);

  // Helper: Persist Actions list to Goal
  const saveActionsList = async (updated: IncomeActionItem[]) => {
    setActions(updated);
    if (goal.id) {
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, { actions: updated as unknown as Goal['actions'] });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), { actions: updated });
      }
    }
  };

  // Save Proposed Income Sources to Firestore Goal Document
  const saveProposedSourcesList = async (newList: ProposedIncomeItem[]) => {
    setProposedSources(newList);
    if (!goal.id) return;

    const payload = {
      incomeSources: newList,
      currentValue: totalCurrentIncome,
    };

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, payload);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), payload);
    }
  };

  // Handler: Add Current Income Source
  const handleSaveCurrentSource = async () => {
    if (!currentNameInput.trim() || !user?.uid || typeof currentAmountInput !== 'number' || currentAmountInput <= 0) return;
    setSavingCurrent(true);
    try {
      await addDoc(collection(db, 'incomeSources'), {
        userId: user.uid,
        name: currentNameInput.trim(),
        type: 'existing',
        currentAmount: currentAmountInput,
        initialAmount: currentAmountInput,
        targetAmount: currentAmountInput,
        frequency: currentFreqInput,
        createdAt: serverTimestamp(),
      });
      setCurrentModalOpen(false);
      setCurrentNameInput('');
      setCurrentAmountInput('');
      await fetchExistingSources();
    } catch (err) {
      console.error('Error adding current income source:', err);
    } finally {
      setSavingCurrent(false);
    }
  };

  // Handler: Delete Current Income Source
  const handleDeleteCurrentSource = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'incomeSources', id));
      await fetchExistingSources();
    } catch (err) {
      console.error('Error deleting current income source:', err);
    }
  };

  // Handler: Open Proposed Modal
  const handleOpenProposedModal = (item?: ProposedIncomeItem) => {
    if (item) {
      setProposedEditingId(item.id);
      setProposedNameInput(item.name);
      setProposedTargetInput(item.targetAmount);
      setProposedFreqInput(item.frequency);
    } else {
      setProposedEditingId(null);
      setProposedNameInput('');
      setProposedTargetInput('');
      setProposedFreqInput('monthly');
    }
    setProposedModalOpen(true);
  };

  // Handler: Save Proposed Income Source
  const handleSaveProposedSource = async () => {
    if (!proposedNameInput.trim() || typeof proposedTargetInput !== 'number' || proposedTargetInput <= 0) return;
    setSavingProposed(true);

    try {
      const newItem: ProposedIncomeItem = {
        id: proposedEditingId || 'prop_' + Date.now(),
        name: proposedNameInput.trim(),
        targetAmount: proposedTargetInput,
        currentAmount: 0,
        frequency: proposedFreqInput,
      };

      let updatedList: ProposedIncomeItem[];
      if (proposedEditingId) {
        updatedList = proposedSources.map((s) => (s.id === proposedEditingId ? newItem : s));
      } else {
        updatedList = [...proposedSources, newItem];
      }

      await saveProposedSourcesList(updatedList);
      setProposedModalOpen(false);
    } catch (err) {
      console.error('Error saving proposed source:', err);
    } finally {
      setSavingProposed(false);
    }
  };

  const handleDeleteProposedSource = async (id: string) => {
    const filtered = proposedSources.filter((s) => s.id !== id);
    await saveProposedSourcesList(filtered);
  };

  // Handler: Confirm Income Increase Log (Immediate close & progress bar)
  const handleConfirmEarnedLog = async () => {
    if (!targetProposedForLog || typeof earnedInput !== 'number') return;
    setSavingEarned(true);
    try {
      const updated = proposedSources.map((s) => {
        if (s.id === targetProposedForLog.id) {
          return { ...s, currentAmount: earnedInput };
        }
        return s;
      });
      await saveProposedSourcesList(updated);
      setLogEarnedOpen(false);
      setEarnedInput('');
      setTargetProposedForLog(null);
    } catch (err) {
      console.error('Error logging income increase:', err);
    } finally {
      setSavingEarned(false);
    }
  };

  // Open Log / Update Progress Modal for Income Goal
  const handleOpenProgressModal = () => {
    setProgressInputAmount(totalCurrentIncome);
    setProgressDialogOpen(true);
  };

  // Confirm Log / Update Progress
  const handleSaveProgress = async () => {
    if (typeof progressInputAmount !== 'number' || progressInputAmount < 0 || !user || !goal.id) return;
    setSavingProgress(true);

    try {
      const newPct = targetGoalIncome > 0 ? Math.max(0, Math.min(100, Math.round((progressInputAmount / targetGoalIncome) * 100))) : 0;
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

  // Add Strategic Action Step (can be linked to a specific item or general)
  const handleAddStep = async (taskText: string, sourceId?: string, sourceName?: string) => {
    const text = taskText.trim();
    if (!text) return;

    const newStep: IncomeActionItem = {
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
  const handleOpenTaskDetailModal = (step: IncomeActionItem) => {
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
  const handleToggleStepCompletion = async (step: IncomeActionItem) => {
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
      {/* ── 1. Modern Friendly Header Banner ── */}
      <Box
        sx={{
          borderRadius: '28px',
          background: isDark
            ? 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)'
            : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
          p: 3.5,
          border: `1.5px solid ${isDark ? '#059669' : '#6ee7b7'}`,
          boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 8px 24px rgba(16,185,129,0.1)',
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

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: isDark ? '#a7f3d0' : '#047857', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Income Growth Goal
            </Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 900, color: textPrimary, mt: 0.5 }}>
              Your current income is{' '}
              <span style={{ color: '#10b981', fontFamily: 'monospace' }}>
                {formatMoney(totalCurrentIncome, currency)}
              </span>
            </Typography>
            <Typography sx={{ fontSize: 13, color: textMuted, mt: 0.5 }}>
              Calculated across all your active existing income sources
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center">
            {targetGoalIncome > 0 && (
              <Chip
                label={`Target: ${formatMoney(targetGoalIncome, currency)}`}
                sx={{
                  bgcolor: '#10b981',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: 13,
                  py: 0.6,
                  px: 1,
                  borderRadius: '12px',
                }}
              />
            )}

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

        {/* Progress Bar */}
        {targetGoalIncome > 0 && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted }}>
                Income Growth Progress
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>
                {progressPercent}%
              </Typography>
            </Box>
            <Box sx={{ height: 8, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  bgcolor: '#10b981',
                  borderRadius: 99,
                  transition: 'width 0.5s ease',
                }}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* ── 2. Existing Income Sources Section ── */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em', mb: 2, px: 0.5 }}>
          Current Income Sources ({existingSources.length})
        </Typography>

        {existingSources.length === 0 ? (
          <Box
            sx={{
              p: 3.5,
              borderRadius: '22px',
              border: `2px dashed ${isDark ? 'rgba(16,185,129,0.4)' : '#6ee7b7'}`,
              bgcolor: isDark ? 'rgba(6,78,59,0.2)' : '#f0fdf4',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: textPrimary }}>
              Hey {userName}, add your current income source! 👋
            </Typography>
            <Typography sx={{ fontSize: 13, color: textMuted, mt: 0.5, mb: 2.5 }}>
              Let us know how much you currently earn from your job, business, or freelancing.
            </Typography>
            <Button
              variant="contained"
              onClick={() => setCurrentModalOpen(true)}
              startIcon={<AddIcon />}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 800,
                bgcolor: '#10b981',
                px: 3,
                py: 1,
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              + Add Current Income Source
            </Button>
          </Box>
        ) : (
          <Stack spacing={2}>
            {existingSources.map((src) => {
              return (
                <Box
                  key={src.id}
                  sx={{
                    borderRadius: '20px',
                    border: `1.5px solid ${cardBorder}`,
                    bgcolor: surfaceBg,
                    p: 2.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: '14px',
                          bgcolor: 'rgba(16,185,129,0.15)',
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
                        <Typography sx={{ fontSize: 12, color: textMuted, textTransform: 'capitalize' }}>
                          Current Source · {src.frequency}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: '#10b981' }}>
                        {formatMoney(src.currentAmount, currency)}
                      </Typography>
                      <IconButton size="small" onClick={() => handleDeleteCurrentSource(src.id)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* 🌟 EMBEDDED PER-ITEM STRATEGY TASKS SECTION */}
                  <ItemStrategyTaskBox
                    sourceId={src.id}
                    sourceName={src.name}
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

            <Box sx={{ pt: 1, textAlign: 'right' }}>
              <Button
                size="small"
                onClick={() => setCurrentModalOpen(true)}
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                sx={{ textTransform: 'none', fontSize: 12.5, fontWeight: 800, color: '#10b981' }}
              >
                + Add Another Current Income Source
              </Button>
            </Box>
          </Stack>
        )}
      </Box>

      {/* ── 3. Proposed New Income Sources Section ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Proposed New Income Channels ({proposedSources.length})
            </Typography>
            <Typography sx={{ fontSize: 12, color: textMuted }}>
              Ideas and new streams to hit your target (Stored on this goal only)
            </Typography>
          </Box>
        </Box>

        {proposedSources.length === 0 ? (
          <Box
            sx={{
              p: 3.5,
              borderRadius: '22px',
              border: `1.5px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe'}`,
              bgcolor: isDark ? 'rgba(30,41,59,0.7)' : '#f0f9ff',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
              Ready to explore new earnings streams? 🚀
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: textMuted, mt: 0.5, mb: 2.5 }}>
              Add proposed projects, side hustles, or salary raises to reach your goal.
            </Typography>
            <Button
              variant="contained"
              onClick={() => handleOpenProposedModal()}
              startIcon={<TrendingUpIcon />}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 800,
                bgcolor: '#3b82f6',
                px: 3,
                py: 0.9,
                '&:hover': { bgcolor: '#2563eb' },
              }}
            >
              Add Now
            </Button>
          </Box>
        ) : (
          <Stack spacing={2}>
            {proposedSources.map((src) => {
              const pct = src.targetAmount > 0 ? Math.min(100, Math.round((src.currentAmount / src.targetAmount) * 100)) : 0;
              return (
                <Box
                  key={src.id}
                  sx={{
                    borderRadius: '22px',
                    border: `1.5px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe'}`,
                    bgcolor: surfaceBg,
                    p: 2.5,
                    boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 4px 16px rgba(59,130,246,0.05)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: '14px',
                          bgcolor: 'rgba(59,130,246,0.15)',
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
                        <Typography sx={{ fontSize: 12, color: textMuted }}>
                          Proposed Channel · {src.frequency}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label="Proposed Channel"
                        size="small"
                        sx={{
                          fontSize: 11,
                          fontWeight: 800,
                          bgcolor: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                        }}
                      />
                      <IconButton size="small" onClick={() => handleOpenProposedModal(src)}>
                        <EditIcon sx={{ fontSize: 17, color: textMuted }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteProposedSource(src.id)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Target & Current Earned Amounts */}
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography sx={{ fontSize: 24, fontWeight: 900, color: textPrimary, fontFamily: 'monospace' }}>
                        {formatMoney(src.currentAmount, currency)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: textMuted }}>
                        / Desired Target: {formatMoney(src.targetAmount, currency)} ({pct}% achieved)
                      </Typography>
                    </Box>

                    {/* 🌟 HUMAN FRIENDLY "Have you got an income increase?" BUTTON */}
                    <Button
                      size="small"
                      onClick={() => {
                        setTargetProposedForLog(src);
                        setEarnedInput(src.currentAmount);
                        setLogEarnedOpen(true);
                      }}
                      startIcon={<TrendingUpIcon sx={{ fontSize: 15 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#10b981',
                        bgcolor: 'rgba(16, 185, 129, 0.12)',
                        borderRadius: '10px',
                        px: 1.75,
                        py: 0.6,
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981' },
                      }}
                    >
                      Have you got an income increase?
                    </Button>
                  </Box>

                  {/* Progress Bar */}
                  <Box sx={{ mt: 1.5, height: 7, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${pct}%`,
                        bgcolor: '#3b82f6',
                        borderRadius: 99,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </Box>

                  {/* 🌟 EMBEDDED PER-ITEM STRATEGY TASKS SECTION */}
                  <ItemStrategyTaskBox
                    sourceId={src.id}
                    sourceName={src.name}
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

            <Box sx={{ pt: 1, textAlign: 'right' }}>
              <Button
                size="small"
                onClick={() => handleOpenProposedModal()}
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                sx={{ textTransform: 'none', fontSize: 12.5, fontWeight: 800, color: '#3b82f6' }}
              >
                + Add new proposed income source
              </Button>
            </Box>
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
              Overview of all income growth action steps across your sources
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
                        Source: {step.sourceName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Expected income amount pill */}
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

      {/* ── Dialog 1: Add CURRENT Income Source ── */}
      <Dialog
        open={currentModalOpen}
        onClose={() => setCurrentModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17 }}>
          Add Current Income Source
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Source Name"
              placeholder="e.g. Primary Job, Monthly Salary"
              fullWidth
              size="small"
              value={currentNameInput}
              onChange={(e) => setCurrentNameInput(e.target.value)}
            />

            <TextField
              label={`Current Monthly/Weekly Earnings (${currency})`}
              type="number"
              fullWidth
              size="small"
              value={currentAmountInput}
              onChange={(e) => setCurrentAmountInput(e.target.value ? Number(e.target.value) : '')}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Frequency</InputLabel>
              <Select
                value={currentFreqInput}
                label="Frequency"
                onChange={(e) => setCurrentFreqInput(e.target.value as 'monthly' | 'weekly')}
              >
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCurrentModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingCurrent || !currentNameInput.trim() || typeof currentAmountInput !== 'number' || currentAmountInput <= 0}
            onClick={handleSaveCurrentSource}
            sx={{ textTransform: 'none', fontWeight: 800, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Add Source
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog 2: Add / Edit PROPOSED Income Source ── */}
      <Dialog
        open={proposedModalOpen}
        onClose={() => setProposedModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 17 }}>
          {proposedEditingId ? 'Edit Proposed Income Channel' : 'Add Proposed Income Channel'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 12, color: textMuted }}>
              Proposed income streams are stored specifically for this goal to help you reach your desired target.
            </Typography>

            <TextField
              label="Proposed Source Name"
              placeholder="e.g. Freelance Consulting, E-commerce Store"
              fullWidth
              size="small"
              value={proposedNameInput}
              onChange={(e) => setProposedNameInput(e.target.value)}
            />

            <TextField
              label={`Desired Target Earnings (${currency})`}
              type="number"
              fullWidth
              size="small"
              value={proposedTargetInput}
              onChange={(e) => setProposedTargetInput(e.target.value ? Number(e.target.value) : '')}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Frequency</InputLabel>
              <Select
                value={proposedFreqInput}
                label="Frequency"
                onChange={(e) => setProposedFreqInput(e.target.value as 'monthly' | 'weekly')}
              >
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setProposedModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingProposed || !proposedNameInput.trim() || typeof proposedTargetInput !== 'number' || proposedTargetInput <= 0}
            onClick={handleSaveProposedSource}
            sx={{ textTransform: 'none', fontWeight: 800, bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
          >
            Save Proposed Source
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog 3: "Have you got an income increase?" Log Modal ── */}
      <Dialog
        open={logEarnedOpen}
        onClose={() => setLogEarnedOpen(false)}
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
            <TrendingUpIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: textPrimary }}>
              Have you got an income increase?
            </Typography>
            <Typography sx={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>
              {targetProposedForLog?.name}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2 }}>
          <Stack spacing={2}>
            <Typography sx={{ fontSize: 12.5, color: textMuted }}>
              Update the current earnings achieved so far from <strong>{targetProposedForLog?.name}</strong>.
            </Typography>
            <TextField
              label={`Current Earned Amount (${currency})`}
              type="number"
              fullWidth
              autoFocus
              variant="outlined"
              value={earnedInput}
              onChange={(e) => setEarnedInput(e.target.value ? Number(e.target.value) : '')}
              InputProps={{
                sx: { borderRadius: '14px', fontSize: 16, fontWeight: 800, fontFamily: 'monospace' },
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setLogEarnedOpen(false)} sx={{ textTransform: 'none', borderRadius: '12px', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingEarned || typeof earnedInput !== 'number'}
            onClick={handleConfirmEarnedLog}
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
            {savingEarned ? <CircularProgress size={18} color="inherit" /> : 'Save Progress'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog 4: UPDATE PROGRESS MODAL ── */}
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
              Update your current income earned towards this goal.
            </Typography>

            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: isDark ? 'rgba(15,23,42,0.5)' : '#f8fafc', border: `1px solid ${cardBorder}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted }}>Current Earned</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{formatMoney(totalCurrentIncome, currency)}</Typography>
              </Box>
              {targetGoalIncome > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted }}>Target</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>{formatMoney(targetGoalIncome, currency)}</Typography>
                </Box>
              )}
            </Box>

            <TextField
              label={`New Current Income (${currency})`}
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

      {/* ── Dialog 5: STRATEGY TASK DETAIL MODAL ── */}
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

              {/* Expected Income Amount Row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Expected Income
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Amount added when this task is done
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
    </Box>
  );
}

// 🌟 PER-ITEM STRATEGY TASK BOX COMPONENT
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
  actions: IncomeActionItem[];
  currency: string;
  isDark: boolean;
  onToggleStep: (step: IncomeActionItem) => void;
  onOpenModal: (step: IncomeActionItem) => void;
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
