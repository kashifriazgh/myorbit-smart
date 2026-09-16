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
  Modal,
  Fade,
} from '@mui/material';
import {
  LocalDrink as WaterIcon,
  Restaurant as MealIcon,
  Egg as ProteinIcon,
  Apple as FruitIcon,
  Add as AddIcon,
  Event as EventIcon,
  CheckCircle,
  RadioButtonUnchecked,
  Checklist as TodoIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Medication as SupplementIcon,
  Fastfood as FastFoodIcon,
  Cake as SugarIcon,
  LocalBar as SoftDrinkIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface NutritionItem {
  id?: string;
  name: string;
  category: 'water' | 'calories' | 'protein' | 'sugar' | 'soft_drinks' | 'fast_food' | 'meals' | 'supplements' | 'fruits' | 'other';
  targetValue: number;
  currentValue: number;
  unit: string;
  scheduleTime?: string;
}

export interface NutritionActionItem {
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

interface NutritionTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

const NUTRITION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  water: { label: 'Water Intake', icon: WaterIcon, color: '#0284c7' },
  calories: { label: 'Daily Calories', icon: MealIcon, color: '#f59e0b' },
  protein: { label: 'Protein Intake', icon: ProteinIcon, color: '#10b981' },
  sugar: { label: 'Sugar Control', icon: SugarIcon, color: '#ec4899' },
  soft_drinks: { label: 'Soft Drinks', icon: SoftDrinkIcon, color: '#ef4444' },
  fast_food: { label: 'Fast Food', icon: FastFoodIcon, color: '#f97316' },
  meals: { label: 'Balanced Meals', icon: MealIcon, color: '#8b5cf6' },
  supplements: { label: 'Supplements', icon: SupplementIcon, color: '#06b6d4' },
  fruits: { label: 'Fruits & Veggies', icon: FruitIcon, color: '#ec4899' },
  other: { label: 'Other Nutrition', icon: MealIcon, color: '#64748b' },
};

function formatUnitVal(val: number, unit: string) {
  if (unit === 'glasses') return `${val.toLocaleString()} ${val === 1 ? 'glass' : 'glasses'}`;
  if (unit === 'liters' || unit === 'L') return `${val.toLocaleString()} ${val === 1 ? 'liter' : 'liters'}`;
  if (unit === 'ml') return `${val.toLocaleString()} ml`;
  if (unit === 'bottles') return `${val.toLocaleString()} ${val === 1 ? 'bottle' : 'bottles'}`;
  if (unit === 'cans') return `${val.toLocaleString()} ${val === 1 ? 'can' : 'cans'}`;
  if (unit === 'sips') return `${val.toLocaleString()} ${val === 1 ? 'sip' : 'sips'}`;
  if (unit === 'tabs' || unit === 'tablets') return `${val.toLocaleString()} ${val === 1 ? 'tab' : 'tabs'}`;
  if (unit === 'capsules') return `${val.toLocaleString()} ${val === 1 ? 'capsule' : 'capsules'}`;
  if (unit === 'scoops') return `${val.toLocaleString()} ${val === 1 ? 'scoop' : 'scoops'}`;
  if (unit === 'doses') return `${val.toLocaleString()} ${val === 1 ? 'dose' : 'doses'}`;
  if (unit === 'teaspoons') return `${val.toLocaleString()} ${val === 1 ? 'teaspoon' : 'teaspoons'}`;
  if (unit === 'times') return `${val.toLocaleString()} ${val === 1 ? 'time' : 'times'}`;
  if (unit === 'grams' || unit === 'gm' || unit === 'g') return `${val.toLocaleString()} g`;
  if (unit === 'calories' || unit === 'kcal') return `${val.toLocaleString()} kcal`;
  if (unit === 'servings') return `${val.toLocaleString()} ${val === 1 ? 'serving' : 'servings'}`;
  if (unit === 'meals') return `${val.toLocaleString()} ${val === 1 ? 'meal' : 'meals'}`;
  return `${val.toLocaleString()} ${unit}`;
}

export default function NutritionTemplate({ goal, onUpdateGoal }: NutritionTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo, deleteTodo } = useTodoContext();
  const { allSchedules, addSchedule, editSchedule, removeSchedule } = useSchedules();

  // Strategic Action Tasks State
  const [actions, setActions] = useState<NutritionActionItem[]>(() => {
    if (Array.isArray(goal.actions) && goal.actions.length > 0) {
      return goal.actions as unknown as NutritionActionItem[];
    }
    return [];
  });

  // Task Details Modal States
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<NutritionActionItem | null>(null);
  const [taskEditText, setTaskEditText] = useState('');
  const [taskEditAssumedVal, setTaskEditAssumedVal] = useState<number | ''>('');
  const [taskEditKind, setTaskEditKind] = useState<'none' | 'schedule' | 'todo'>('none');
  const [showConvertOptions, setShowConvertOptions] = useState(false);
  const [taskEditDate, setTaskEditDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskEditStartTime, setTaskEditStartTime] = useState('08:00');
  const [taskEditEndTime, setTaskEditEndTime] = useState('08:30');
  const [taskEditTodoTime, setTaskEditTodoTime] = useState('');
  const [taskEditAssignee, setTaskEditAssignee] = useState('');
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);

  const answers = useMemo(() => goal.questionnaireAnswers || {}, [goal.questionnaireAnswers]);

  // Nutrition items stored on goal.nutritionItems or derived from questionnaire answers
  const [items, setItems] = useState<NutritionItem[]>(() => {
    if (Array.isArray(goal.nutritionItems) && goal.nutritionItems.length > 0) {
      return goal.nutritionItems as unknown as NutritionItem[];
    }

    const trackItem = String(answers.track_item || 'Nutrition Intake');
    const targetAmt = Number(answers.target_amount || goal.overallTargetValue || 8);
    const chosenUnit = String(
      goal.overallTargetUnit ||
        answers.unit_water ||
        answers.unit_protein ||
        answers.unit_calories ||
        answers.unit_sugar ||
        answers.unit_soft_drinks ||
        answers.unit_fast_food ||
        answers.unit_meals ||
        answers.unit_supplements ||
        'servings'
    );

    let catKey: NutritionItem['category'] = 'other';
    const lowerItem = trackItem.toLowerCase();
    if (lowerItem.includes('water')) catKey = 'water';
    else if (lowerItem.includes('protein')) catKey = 'protein';
    else if (lowerItem.includes('calorie')) catKey = 'calories';
    else if (lowerItem.includes('sugar')) catKey = 'sugar';
    else if (lowerItem.includes('soft') || lowerItem.includes('drink')) catKey = 'soft_drinks';
    else if (lowerItem.includes('fast') || lowerItem.includes('junk')) catKey = 'fast_food';
    else if (lowerItem.includes('meal')) catKey = 'meals';
    else if (lowerItem.includes('supplement')) catKey = 'supplements';

    return [
      {
        id: '1',
        name: goal.title || `${trackItem} Tracker`,
        category: catKey,
        targetValue: targetAmt,
        currentValue: Number(goal.currentValue || 0),
        unit: chosenUnit,
        scheduleTime: '08:00 AM',
      },
    ];
  });

  // Dialog state for adding/editing nutrition item
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<NutritionItem['category']>('water');
  const [targetVal, setTargetVal] = useState<number | ''>('');
  const [currentVal, setCurrentVal] = useState<number | ''>('');
  const [unit, setUnit] = useState<string>('glasses');
  const [time, setTime] = useState('08:00 AM');
  const [savingItem, setSavingItem] = useState(false);

  // Dialog state for adding intake log
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedItemIdx, setSelectedItemIdx] = useState<number>(0);
  const [addAmount, setAddAmount] = useState<number | ''>('');
  const [savingLog, setSavingLog] = useState(false);

  // Schedule modal
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('08:00');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSched, setSavingSched] = useState(false);

  const selectedNutName = useMemo(() => {
    const raw = String(
      answers.track_item ||
      answers.track_item_custom ||
      answers.nutrition_type ||
      answers.item_type ||
      items[0]?.name ||
      ''
    ).trim();

    if (!raw || raw.toLowerCase() === 'other' || raw.toLowerCase() === 'nutrition goal') {
      return items[0]?.name || '';
    }
    return raw;
  }, [answers, items]);

  const displayTitle = useMemo(() => {
    if (!selectedNutName) return goal.title;
    if (goal.title.toLowerCase().includes(selectedNutName.toLowerCase())) {
      return goal.title;
    }
    return `${goal.title} - ${selectedNutName}`;
  }, [goal.title, selectedNutName]);

  const handleOpenLogModal = (idx: number) => {
    setSelectedItemIdx(idx);
    const targetItem = items[idx];
    setAddAmount(targetItem ? targetItem.targetValue : 1);
    setLogModalOpen(true);
  };

  // Filter linked schedules and todos
  const linkedNutritionSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const linkedNutritionTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  // Helper: Persist Actions list to Goal
  const saveActionsList = async (updated: NutritionActionItem[]) => {
    setActions(updated);
    if (goal.id) {
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, { actions: updated as unknown as Goal['actions'] });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), { actions: updated });
      }
    }
  };

  const handleToggleStepCompletion = async (step: NutritionActionItem) => {
    const nextDone = !step.done;
    const updated = actions.map((s) => (s.id === step.id ? { ...s, done: nextDone } : s));
    await saveActionsList(updated);

    if (step.scheduleId && editSchedule) {
      await editSchedule(step.scheduleId, { status: nextDone ? 'completed' : 'pending' }).catch((e) => console.warn(e));
    }
    if (step.todoId && updateTodo) {
      await updateTodo(step.todoId, { status: nextDone ? 'completed' : 'in_progress' }).catch((e) => console.warn(e));
    }
  };

  const handleAddStep = async (taskText: string, sourceId?: string, sourceName?: string) => {
    const text = taskText.trim();
    if (!text) return;

    const newStep: NutritionActionItem = {
      id: 'step_' + Date.now(),
      task: text,
      done: false,
      sourceId: sourceId || undefined,
      sourceName: sourceName || undefined,
    };
    const updated = [...actions, newStep];
    await saveActionsList(updated);
  };

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

  const handleOpenTaskDetailModal = (step: NutritionActionItem) => {
    setActiveStep(step);
    setTaskEditText(step.task);
    setTaskEditAssumedVal(step.assumedContributionValue || '');
    const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
    setTaskEditKind(kind as 'none' | 'schedule' | 'todo');
    setShowConvertOptions(kind === 'schedule' || kind === 'todo');

    const todayStr = new Date().toISOString().split('T')[0];
    setTaskEditDate(step.dueDate || todayStr);
    setTaskEditStartTime(step.time || '08:00');
    setTaskEditEndTime('08:30');
    setTaskEditTodoTime(step.time || '');
    setTaskEditAssignee(step.assignee || '');
    setTaskModalOpen(true);
  };

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
              startTime: taskEditStartTime || '08:00',
              endTime: taskEditEndTime || '08:30',
              status: activeStep.done ? 'completed' : 'pending',
              linkedGoalId: goal.id,
              goalTitle: goal.title,
            });
            if (typeof created === 'string') updatedScheduleId = created;
            else if (created && typeof (created as { id?: string }).id === 'string') updatedScheduleId = (created as { id: string }).id;
          }
        } else if (editSchedule) {
          await editSchedule(updatedScheduleId, {
            title: taskEditText.trim(),
            date: targetDate,
            startTime: taskEditStartTime || '08:00',
            endTime: taskEditEndTime || '08:30',
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

      const updatedActions = actions.map((s) => {
        if (s.id === activeStep.id) {
          return {
            ...s,
            task: taskEditText.trim(),
            assumedContributionValue: typeof taskEditAssumedVal === 'number' ? taskEditAssumedVal : undefined,
            kind: taskEditKind === 'none' ? undefined : taskEditKind,
            dueDate: targetDate,
            time: taskEditKind === 'schedule' ? taskEditStartTime : taskEditKind === 'todo' ? taskEditTodoTime : undefined,
            assignee: taskEditAssignee.trim() || undefined,
            scheduleId: updatedScheduleId,
            todoId: updatedTodoId,
          };
        }
        return s;
      });

      await saveActionsList(updatedActions);
      setTaskModalOpen(false);
    } catch (err) {
      console.error('Failed to save task detail:', err);
    } finally {
      setSavingTaskEdit(false);
    }
  };

  const saveItemsList = async (updatedList: NutritionItem[]) => {
    setItems(updatedList);
    if (!goal.id) return;

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, { nutritionItems: updatedList });
    } else {
      await updateDoc(doc(db, 'goals', goal.id), { nutritionItems: updatedList });
    }
  };

  const handleOpenItemModal = (item?: NutritionItem, idx?: number) => {
    if (item && idx !== undefined) {
      setEditingIdx(idx);
      setName(item.name);
      setCategory(item.category);
      setTargetVal(item.targetValue);
      setCurrentVal(item.currentValue);
      setUnit(item.unit);
      setTime(item.scheduleTime || '08:00 AM');
    } else {
      setEditingIdx(null);
      setName('');
      setCategory('water');
      setTargetVal('');
      setCurrentVal('');
      setUnit('glasses');
      setTime('08:00 AM');
    }
    setModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!name.trim() || typeof targetVal !== 'number' || targetVal <= 0 || !goal.id) return;
    setSavingItem(true);
    try {
      const newItem: NutritionItem = {
        id: editingIdx !== null && items[editingIdx] ? items[editingIdx].id : 'nut_' + Date.now(),
        name: name.trim(),
        category,
        targetValue: targetVal,
        currentValue: typeof currentVal === 'number' ? currentVal : 0,
        unit,
        scheduleTime: time,
      };

      let updated: NutritionItem[];
      if (editingIdx !== null) {
        updated = items.map((it, idx) => (idx === editingIdx ? newItem : it));
      } else {
        updated = [...items, newItem];
      }

      await saveItemsList(updated);
      setModalOpen(false);
    } catch (err) {
      console.error('Failed to save nutrition item:', err);
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (idxToDelete: number) => {
    if (!confirm('Are you sure you want to delete this nutrition tracker item?')) return;
    const filtered = items.filter((_, idx) => idx !== idxToDelete);
    await saveItemsList(filtered);
  };

  const handleLogIntake = async () => {
    if (typeof addAmount !== 'number' || addAmount <= 0 || !goal.id) return;
    setSavingLog(true);
    try {
      const targetItem = items[selectedItemIdx];
      if (!targetItem) return;
      const updatedItem = {
        ...targetItem,
        currentValue: targetItem.currentValue + addAmount,
      };

      const updatedList = items.map((it, idx) => (idx === selectedItemIdx ? updatedItem : it));
      await saveItemsList(updatedList);

      setAddAmount('');
      setLogModalOpen(false);
    } catch (err) {
      console.error('Failed to log intake:', err);
    } finally {
      setSavingLog(false);
    }
  };

  const handleScheduleMeal = async () => {
    if (!schedTitle.trim() || !user || !goal.id) return;
    setSavingSched(true);
    try {
      if (schedKind === 'schedule') {
        await addSchedule({
          title: schedTitle.trim(),
          date: schedDate || new Date().toISOString().split('T')[0],
          startTime: schedTime || '08:00',
          endTime: '08:30',
          projectId: goal.projectId || '',
          userId: user.uid,
          status: 'pending',
          priority: 'medium',
          linkedGoalId: goal.id,
          goalTitle: goal.title,
          frequencyMode: 'daily',
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
      setSchedModalOpen(false);
    } catch (err) {
      console.error('Failed to schedule nutrition:', err);
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
      {/* Header Card */}
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
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Health · Nutrition & Hydration Goal
        </Typography>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: textPrimary, mt: 0.5 }}>
          {displayTitle}
        </Typography>
      </Box>

      {/* Nutrition Categories Progress List */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Tracked Intake Categories ({items.length})
          </Typography>
          <Button
            size="small"
            onClick={() => handleOpenItemModal()}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#10b981' }}
          >
            Add Nutrition
          </Button>
        </Box>

        <Stack spacing={2}>
          {items.map((it, idx) => {
            const meta = NUTRITION_META[it.category] || NUTRITION_META.other;
            const IconComponent = meta.icon;
            const progress = it.targetValue > 0 ? Math.max(0, Math.min(100, Math.round((it.currentValue / it.targetValue) * 100))) : 0;

            return (
              <Box
                key={it.id || idx}
                sx={{
                  borderRadius: '20px',
                  border: `1px solid ${cardBorder}`,
                  bgcolor: surfaceBg,
                  p: 2.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: '12px',
                        bgcolor: `${meta.color}15`,
                        color: meta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconComponent sx={{ fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>
                        {it.name}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: textMuted }}>
                        Target: {formatUnitVal(it.targetValue, it.unit)} {it.scheduleTime && `· Time: ${it.scheduleTime}`}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip
                      label={`${progress}% Achieved`}
                      size="small"
                      sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        bgcolor: isDark ? `${meta.color}20` : `${meta.color}10`,
                        color: meta.color,
                      }}
                    />
                    <IconButton size="small" onClick={() => handleOpenItemModal(it, idx)}>
                      <EditIcon sx={{ fontSize: 16, color: textMuted }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteItem(idx)} sx={{ color: '#ef4444' }}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>

                <Box sx={{ mt: 2, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, color: textPrimary, fontFamily: 'monospace' }}>
                    {formatUnitVal(it.currentValue, it.unit)}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => handleOpenLogModal(idx)}
                    sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700, color: meta.color }}
                  >
                    + Add Intake
                  </Button>
                </Box>

                <Box sx={{ mt: 1.5, height: 6, borderRadius: 99, bgcolor: isDark ? '#334155' : '#f1f5f9', overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: meta.color, borderRadius: 99, transition: 'width 0.4s ease' }} />
                </Box>

                {/* 🌟 EMBEDDED PER-ITEM STRATEGY TASKS SECTION */}
                <ItemStrategyTaskBox
                  sourceId={it.id || String(idx)}
                  sourceName={it.name}
                  actions={actions}
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
      </Box>

      {/* Schedules & Todo Reminders */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Scheduled Meals & Nutrition Reminders ({linkedNutritionSchedules.length + linkedNutritionTodos.length})
          </Typography>
          <Button
            size="small"
            onClick={() => setSchedModalOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#f59e0b' }}
          >
            + Schedule Reminder
          </Button>
        </Box>

        <Stack spacing={1.25}>
          {linkedNutritionSchedules.map((s) => (
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
                <MealIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    Scheduled: {s.startTime || '08:00 AM'} · Daily Nutrition
                  </Typography>
                </Box>
              </Box>
              <Chip label="Schedule" size="small" sx={{ bgcolor: isDark ? '#451a03' : '#fffbeb', color: '#f59e0b', fontSize: 10, fontWeight: 700 }} />
            </Box>
          ))}

          {linkedNutritionTodos.map((todo) => {
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
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: isDone ? textMuted : textPrimary, textDecoration: isDone ? 'line-through' : 'none' }}>
                  {todo.title}
                </Typography>
              </Box>
            );
          })}

          {linkedNutritionSchedules.length === 0 && linkedNutritionTodos.length === 0 && (
            <Typography sx={{ fontSize: 12, color: textMuted, fontStyle: 'italic', textAlign: 'center', py: 2 }}>
              No meal or hydration reminders scheduled yet. Click &quot;+ Schedule Reminder&quot; to set timings.
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Add / Edit Category Dialog */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
          {editingIdx !== null ? 'Edit Nutrition Category' : 'Add Nutrition Category'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Intake Name"
              placeholder="e.g. Daily Water, Protein Shake, Vitamin D Tabs"
              fullWidth
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value as NutritionItem['category'])}>
                <MenuItem value="water">Water Intake 💧</MenuItem>
                <MenuItem value="protein">Protein Intake 🥩</MenuItem>
                <MenuItem value="calories">Daily Calories 🔥</MenuItem>
                <MenuItem value="sugar">Sugar Control 🍬</MenuItem>
                <MenuItem value="soft_drinks">Soft Drinks 🥤</MenuItem>
                <MenuItem value="fast_food">Fast Food 🍔</MenuItem>
                <MenuItem value="meals">Balanced Meals 🥗</MenuItem>
                <MenuItem value="supplements">Supplements 💊</MenuItem>
                <MenuItem value="fruits">Fruits & Vegetables 🍎</MenuItem>
                <MenuItem value="other">Other 🍽️</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Unit</InputLabel>
              <Select value={unit} label="Unit" onChange={(e) => setUnit(e.target.value)}>
                <MenuItem value="glasses">Glasses 🥛</MenuItem>
                <MenuItem value="liters">Liters (L) 🧴</MenuItem>
                <MenuItem value="ml">Milliliters (ml) 🧪</MenuItem>
                <MenuItem value="bottles">Bottles 🍼</MenuItem>
                <MenuItem value="cans">Cans 🥫</MenuItem>
                <MenuItem value="sips">Sips 🥤</MenuItem>
                <MenuItem value="grams">Grams (gm) ⚖️</MenuItem>
                <MenuItem value="scoops">Scoops 🏋️</MenuItem>
                <MenuItem value="servings">Servings 🍽️</MenuItem>
                <MenuItem value="calories">Calories (kcal) 🔥</MenuItem>
                <MenuItem value="teaspoons">Teaspoons 🥄</MenuItem>
                <MenuItem value="tabs">Tablets / Tabs 💊</MenuItem>
                <MenuItem value="capsules">Capsules 💊</MenuItem>
                <MenuItem value="doses">Doses 🧪</MenuItem>
                <MenuItem value="times">Times / Occurrences 📅</MenuItem>
                <MenuItem value="meals">Meals 🥗</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Daily Target Amount"
              type="number"
              fullWidth
              size="small"
              value={targetVal}
              onChange={(e) => setTargetVal(e.target.value ? Number(e.target.value) : '')}
            />

            <TextField
              label="Current Logged Amount"
              type="number"
              fullWidth
              size="small"
              value={currentVal}
              onChange={(e) => setCurrentVal(e.target.value ? Number(e.target.value) : '')}
            />

            <TextField
              label="Scheduled Time (Optional)"
              placeholder="e.g. 08:00 AM"
              fullWidth
              size="small"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingItem || !name.trim() || typeof targetVal !== 'number' || targetVal <= 0}
            onClick={handleSaveItem}
            sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Save Category
          </Button>
        </DialogActions>
      </Dialog>

      {/* Log Intake Dialog */}
      <Dialog open={logModalOpen} onClose={() => setLogModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Log Nutrition Intake</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedItemIdx}
                label="Category"
                onChange={(e) => setSelectedItemIdx(Number(e.target.value))}
              >
                {items.map((it, i) => (
                  <MenuItem key={i} value={i}>
                    {it.name} ({it.unit})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={`Amount to Add (${items[selectedItemIdx]?.unit || ''})`}
              type="number"
              fullWidth
              size="small"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value ? Number(e.target.value) : '')}
            />

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pt: 0.5 }}>
              <Chip
                label={`Full Target (${items[selectedItemIdx]?.targetValue || 1} ${items[selectedItemIdx]?.unit || ''})`}
                onClick={() => setAddAmount(items[selectedItemIdx]?.targetValue || 1)}
                size="small"
                color="primary"
                sx={{ fontWeight: 700, cursor: 'pointer' }}
              />
              {items[selectedItemIdx]?.targetValue && items[selectedItemIdx].targetValue > 1 && (
                <Chip
                  label={`Half Target (${Math.round(items[selectedItemIdx].targetValue / 2)} ${items[selectedItemIdx]?.unit || ''})`}
                  onClick={() => setAddAmount(Math.round(items[selectedItemIdx].targetValue / 2))}
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 700, cursor: 'pointer' }}
                />
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLogModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingLog || typeof addAmount !== 'number' || addAmount <= 0}
            onClick={handleLogIntake}
            sx={{ textTransform: 'none', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            Log Intake
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Meal Dialog */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Schedule Meal / Hydration</DialogTitle>
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
                Schedule Routine
              </Button>
              <Button
                fullWidth
                variant={schedKind === 'todo' ? 'contained' : 'outlined'}
                onClick={() => setSchedKind('todo')}
                startIcon={<TodoIcon />}
                size="small"
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                Reminder Task
              </Button>
            </Box>

            <TextField
              label="Reminder Title"
              placeholder="e.g. Lunch & Protein Shake or Take Vitamin D Tabs"
              fullWidth
              size="small"
              value={schedTitle}
              onChange={(e) => setSchedTitle(e.target.value)}
            />

            <TextField
              label="Time"
              type="time"
              fullWidth
              size="small"
              value={schedTime}
              onChange={(e) => setSchedTime(e.target.value)}
            />

            <TextField
              label="Start Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={schedDate}
              onChange={(e) => setSchedDate(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSchedModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingSched || !schedTitle.trim()}
            onClick={handleScheduleMeal}
            sx={{ textTransform: 'none', bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' } }}
          >
            Save Reminder
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
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Parent Item Name Banner if item action */}
              {activeStep?.sourceName && (
                <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Linked Nutrition Category
                  </p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {activeStep.sourceName}
                  </p>
                </div>
              )}

              {/* Task Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  Task Title / Strategy Step
                </label>
                <input
                  type="text"
                  value={taskEditText}
                  onChange={(e) => setTaskEditText(e.target.value)}
                  placeholder="e.g. Drink 2 glasses of water before breakfast"
                  className="w-full text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Toggle Convert Options Button */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowConvertOptions(!showConvertOptions)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-emerald-400 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🗓️</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {taskEditKind === 'schedule'
                          ? 'Converted to Schedule'
                          : taskEditKind === 'todo'
                          ? 'Converted to Todo'
                          : 'Convert to Schedule or Todo'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {taskEditKind === 'none'
                          ? 'Appears in Schedules or Todo lists across app'
                          : `Currently synced as ${taskEditKind}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {showConvertOptions ? 'Hide' : 'Configure'}
                  </span>
                </button>

                {showConvertOptions && (
                  <div className="mt-2.5 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 space-y-3">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('none')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                          taskEditKind === 'none'
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Plain Step
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('schedule')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                          taskEditKind === 'schedule'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        🗓 Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('todo')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                          taskEditKind === 'todo'
                            ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        ✅ Todo
                      </button>
                    </div>

                    {taskEditKind !== 'none' && (
                      <div className="space-y-2.5 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                            {taskEditKind === 'schedule' ? 'Schedule Date' : 'Due Date'}
                          </label>
                          <input
                            type="date"
                            value={taskEditDate}
                            onChange={(e) => setTaskEditDate(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        {taskEditKind === 'schedule' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={taskEditStartTime}
                                onChange={(e) => setTaskEditStartTime(e.target.value)}
                                className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={taskEditEndTime}
                                onChange={(e) => setTaskEditEndTime(e.target.value)}
                                className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Assignee Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  Assignee (Optional)
                </label>
                <input
                  type="text"
                  value={taskEditAssignee}
                  onChange={(e) => setTaskEditAssignee(e.target.value)}
                  placeholder="e.g. Self, Dietitian"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (activeStep) {
                    handleDeleteStep(activeStep.id);
                    setTaskModalOpen(false);
                  }
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              >
                Delete Task
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  Cancel
                </button>
                <Button
                  variant="contained"
                  disabled={savingTaskEdit || !taskEditText.trim()}
                  onClick={handleSaveTaskDetail}
                  sx={{
                    borderRadius: '12px',
                    px: 3,
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: '#10b981',
                    color: '#fff',
                    '&:hover': { bgcolor: '#059669' },
                  }}
                >
                  {savingTaskEdit ? 'Saving...' : 'Save Task'}
                </Button>
              </div>
            </div>
          </div>
        </Fade>
      </Modal>
    </Box>
  );
}

// 🌟 PER-ITEM STRATEGY TASK BOX COMPONENT FOR NUTRITION CATEGORIES
function ItemStrategyTaskBox({
  sourceId,
  sourceName,
  actions,
  isDark,
  onToggleStep,
  onOpenModal,
  onDeleteStep,
  onAddStep,
}: {
  sourceId: string;
  sourceName: string;
  actions: NutritionActionItem[];
  isDark: boolean;
  onToggleStep: (step: NutritionActionItem) => void;
  onOpenModal: (step: NutritionActionItem) => void;
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
