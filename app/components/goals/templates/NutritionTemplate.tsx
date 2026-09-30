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
  MenuItem,
  Select,
  FormControl,
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
import StreakCard from '@/app/components/goals/StreakCard';
import ActivityRingLogger from '@/app/components/goals/ActivityRingLogger';
import StrategyTasksSection, { StrategyActionItem } from '@/app/components/goals/StrategyTasksSection';

export interface NutritionItem {
  id?: string;
  name: string;
  category: 'water' | 'calories' | 'protein' | 'sugar' | 'soft_drinks' | 'fast_food' | 'meals' | 'supplements' | 'fruits' | 'other';
  targetValue: number;
  currentValue: number;
  unit: string;
  scheduleTime?: string;
  lastCompletedAt?: string;
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

const CATEGORY_UNITS_MAP: Record<NutritionItem['category'], Array<{ label: string; value: string }>> = {
  water: [
    { label: 'Glasses 🥛', value: 'glasses' },
    { label: 'Liters (L) 🧴', value: 'liters' },
    { label: 'Milliliters (ml) 🧪', value: 'ml' },
    { label: 'Bottles 🍼', value: 'bottles' },
    { label: 'Sips 🥤', value: 'sips' },
  ],
  calories: [
    { label: 'Calories (kcal) 🔥', value: 'calories' },
  ],
  protein: [
    { label: 'Grams (g) ⚖️', value: 'grams' },
    { label: 'Scoops 🏋️', value: 'scoops' },
    { label: 'Servings 🍽️', value: 'servings' },
  ],
  sugar: [
    { label: 'Grams (g) ⚖️', value: 'grams' },
    { label: 'Teaspoons 🥄', value: 'teaspoons' },
    { label: 'Servings 🍽️', value: 'servings' },
    { label: 'Times / Occurrences 📅', value: 'times' },
  ],
  soft_drinks: [
    { label: 'Cans 🥫', value: 'cans' },
    { label: 'Bottles 🍼', value: 'bottles' },
    { label: 'Glasses 🥛', value: 'glasses' },
    { label: 'Sips 🥤', value: 'sips' },
    { label: 'Times / Occurrences 📅', value: 'times' },
  ],
  fast_food: [
    { label: 'Meals 🥗', value: 'meals' },
    { label: 'Servings 🍽️', value: 'servings' },
    { label: 'Times / Occurrences 📅', value: 'times' },
  ],
  meals: [
    { label: 'Meals 🥗', value: 'meals' },
    { label: 'Servings 🍽️', value: 'servings' },
  ],
  supplements: [
    { label: 'Tablets / Tabs 💊', value: 'tabs' },
    { label: 'Capsules 💊', value: 'capsules' },
    { label: 'Doses 🧪', value: 'doses' },
    { label: 'Scoops 🏋️', value: 'scoops' },
    { label: 'Teaspoons 🥄', value: 'teaspoons' },
  ],
  fruits: [
    { label: 'Servings 🍽️', value: 'servings' },
    { label: 'Grams (g) ⚖️', value: 'grams' },
    { label: 'Times / Occurrences 📅', value: 'times' },
  ],
  other: [
    { label: 'Servings 🍽️', value: 'servings' },
    { label: 'Grams (g) ⚖️', value: 'grams' },
    { label: 'Calories (kcal) 🔥', value: 'calories' },
    { label: 'Milliliters (ml) 🧪', value: 'ml' },
    { label: 'Times / Occurrences 📅', value: 'times' },
  ],
};

function getTodayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function _formatDate(dateVal: unknown): string {
  if (!dateVal) return getTodayStr();
  if (dateVal instanceof Date) {
    const year = dateVal.getFullYear();
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const day = String(dateVal.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof dateVal === 'object' && 'seconds' in (dateVal as { seconds: number })) {
    const d = new Date((dateVal as { seconds: number }).seconds * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(dateVal).split('T')[0];
}

function calculateNutritionProgress(item: NutritionItem): number {
  if (!item.targetValue || item.targetValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((item.currentValue || 0) / item.targetValue) * 100)));
}

function isDoneForToday(it: NutritionItem, _goal?: Goal): boolean {
  const todayStr = getTodayStr();
  if ((it as { lastCompletedAt?: string }).lastCompletedAt === todayStr) return true;
  if (it.targetValue > 0 && (it.currentValue || 0) >= it.targetValue) return true;
  return false;
}

function getPredefinedSlotsForNutrition(unit: string, targetValue: number, _category: string): Array<{ label: string; value: number }> {
  const target = targetValue && targetValue > 0 ? targetValue : 8;
  const normUnit = (unit || '').toLowerCase().trim();

  if (normUnit === 'glasses') {
    const _q1 = 1;
    const q2 = Math.max(1, Math.round(target * 0.25));
    const q3 = Math.max(1, Math.round(target * 0.5));
    return [
      { label: `+1 glass`, value: 1 },
      { label: `+${q2} glasses`, value: q2 },
      { label: `+${q3} glasses`, value: q3 },
      { label: `Full (${target} glasses)`, value: target },
    ];
  }

  if (normUnit === 'liters' || normUnit === 'l') {
    const _q1 = 0.5;
    const q2 = Number((target * 0.5).toFixed(1));
    return [
      { label: `+0.5 L`, value: 0.5 },
      { label: `+${q2} L`, value: q2 },
      { label: `Full (${target} L)`, value: target },
    ];
  }

  if (normUnit === 'ml') {
    const _q1 = 250;
    const _q2 = 500;
    const q3 = Math.round(target * 0.5);
    return [
      { label: `+250 ml`, value: 250 },
      { label: `+500 ml`, value: 500 },
      { label: `+${q3} ml`, value: q3 },
      { label: `Full (${target} ml)`, value: target },
    ];
  }

  if (normUnit === 'calories' || normUnit === 'kcal') {
    const q1 = Math.round(target * 0.25);
    const q2 = Math.round(target * 0.5);
    const q3 = Math.round(target * 0.75);
    return [
      { label: `+${q1} kcal`, value: q1 },
      { label: `+${q2} kcal`, value: q2 },
      { label: `+${q3} kcal`, value: q3 },
      { label: `Full (${target} kcal)`, value: target },
    ];
  }

  if (normUnit === 'grams' || normUnit === 'gm' || normUnit === 'g') {
    const q1 = Math.max(1, Math.round(target * 0.25));
    const q2 = Math.max(1, Math.round(target * 0.5));
    const q3 = Math.max(1, Math.round(target * 0.75));
    return [
      { label: `+${q1} g`, value: q1 },
      { label: `+${q2} g`, value: q2 },
      { label: `+${q3} g`, value: q3 },
      { label: `Full (${target} g)`, value: target },
    ];
  }

  const q1 = Math.max(1, Math.round(target * 0.25));
  const q2 = Math.max(1, Math.round(target * 0.5));
  const q3 = Math.max(1, Math.round(target * 0.75));
  return [
    { label: `+${q1} ${unit}`, value: q1 },
    { label: `+${q2} ${unit}`, value: q2 },
    { label: `+${q3} ${unit}`, value: q3 },
    { label: `Full (${target} ${unit})`, value: target },
  ];
}

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
  const [_newGeneralStepInput, _setNewGeneralStepInput] = useState('');

  // Sync actions state when goal.actions, allSchedules, or todos update
  useEffect(() => {
    if (Array.isArray(goal.actions) && goal.actions.length > 0) {
      const initial = goal.actions as unknown as NutritionActionItem[];
      const synced = initial.map((step) => {
        let isDone = step.done;
        if (step.scheduleId) {
          const linkedSched = allSchedules.find((s) => s.id === step.scheduleId);
          if (linkedSched) isDone = linkedSched.status === 'completed';
        }
        if (step.todoId) {
          const linkedTodo = todos.find((t) => t.id === step.todoId);
          if (linkedTodo) isDone = linkedTodo.status === 'completed';
        }
        return { ...step, done: isDone };
      });
      setActions(synced);
    } else {
      setActions([]);
    }
  }, [goal.actions, allSchedules, todos]);

  // Task Details Modal States
  const [_taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<NutritionActionItem | null>(null);
  const [taskEditText, setTaskEditText] = useState('');
  const [taskEditAssumedVal, setTaskEditAssumedVal] = useState<number | ''>('');
  const [taskEditKind, setTaskEditKind] = useState<'none' | 'schedule' | 'todo'>('none');
  const [_showConvertOptions, setShowConvertOptions] = useState(false);
  const [taskEditDate, setTaskEditDate] = useState(getTodayStr());
  const [taskEditStartTime, setTaskEditStartTime] = useState('08:00');
  const [taskEditEndTime, setTaskEditEndTime] = useState('08:30');
  const [taskEditTodoTime, setTaskEditTodoTime] = useState('');
  const [taskEditAssignee, setTaskEditAssignee] = useState('');
  const [_savingTaskEdit, setSavingTaskEdit] = useState(false);

  const answers = useMemo(() => goal.questionnaireAnswers || {}, [goal.questionnaireAnswers]);

  // Nutrition items state with automatic 24-hr daily reset logic for daily routines
  const [items, setItems] = useState<NutritionItem[]>(() => {
    const todayStr = getTodayStr();
    if (Array.isArray(goal.nutritionItems) && goal.nutritionItems.length > 0) {
      const raw = goal.nutritionItems as unknown as NutritionItem[];
      return raw.map((it) => {
        if ((it as { lastCompletedAt?: string }).lastCompletedAt && (it as { lastCompletedAt?: string }).lastCompletedAt !== todayStr) {
          return {
            ...it,
            currentValue: 0,
          };
        }
        return it;
      });
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

  // Auto reset daily nutrition progress when a new 24-hr day starts
  useEffect(() => {
    const todayStr = getTodayStr();
    if (!items.length) return;

    let hasReset = false;
    const resetList = items.map((it) => {
      if ((it as { lastCompletedAt?: string }).lastCompletedAt && (it as { lastCompletedAt?: string }).lastCompletedAt !== todayStr && it.currentValue > 0) {
        hasReset = true;
        return {
          ...it,
          currentValue: 0,
        };
      }
      return it;
    });

    if (hasReset) {
      setItems(resetList);
      if (goal.id) {
        let sumProgress = 0;
        for (const item of resetList) {
          sumProgress += calculateNutritionProgress(item);
        }
        const newMean = resetList.length > 0 ? Math.max(0, Math.min(100, Math.round(sumProgress / resetList.length))) : 0;

        const payload: Partial<Goal> = {
          nutritionItems: resetList as unknown as Goal['nutritionItems'],
          progress: newMean,
        };
        if (onUpdateGoal) {
          onUpdateGoal(goal.id, payload).catch((err) => console.warn(err));
        } else {
          updateDoc(doc(db, 'goals', goal.id), payload).catch((err) => console.warn(err));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.id]);

  // Overall Mean Progress
  const meanProgress = useMemo(() => {
    if (items.length === 0) return 0;
    let sum = 0;
    for (const it of items) {
      sum += calculateNutritionProgress(it);
    }
    return Math.max(0, Math.min(100, Math.round(sum / items.length)));
  }, [items]);

  // Wrapped Goal object with immediate habit check-in evaluation (>=70% streak done)
  const currentGoalWithCheckIns = useMemo(() => {
    const todayStr = getTodayStr();
    const isStreakDone = meanProgress >= 70;
    const existingCheckIns = Array.isArray(goal.habitCheckIns) ? [...goal.habitCheckIns] : [];

    if (isStreakDone) {
      const hasToday = existingCheckIns.some((c) => c.date && c.date.split('T')[0] === todayStr);
      const updatedCheckIns = hasToday
        ? existingCheckIns.map((c) => (c.date && c.date.split('T')[0] === todayStr ? { ...c, completed: true } : c))
        : [...existingCheckIns, { id: 'chk_' + Date.now(), date: todayStr, completed: true }];
      return { ...goal, habitCheckIns: updatedCheckIns, progress: meanProgress };
    }
    return { ...goal, progress: meanProgress };
  }, [goal, meanProgress]);

  // Dialog state for adding/editing nutrition item
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<NutritionItem['category']>('water');
  const [targetVal, setTargetVal] = useState<number | ''>('');
  const [unit, setUnit] = useState<string>('glasses');
  const [time, setTime] = useState('08:00 AM');
  const [savingItem, setSavingItem] = useState(false);

  // Available units filtered by active category
  const currentAvailableUnits = useMemo(() => {
    return CATEGORY_UNITS_MAP[category] || CATEGORY_UNITS_MAP.other;
  }, [category]);

  const handleCategoryChange = (newCat: NutritionItem['category']) => {
    setCategory(newCat);
    const available = CATEGORY_UNITS_MAP[newCat] || CATEGORY_UNITS_MAP.other;
    if (available.length > 0 && !available.some((u) => u.value === unit)) {
      setUnit(available[0].value);
    }
  };

  // Schedule modal
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('08:00');
  const [schedDate, setSchedDate] = useState(getTodayStr());
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

  const _handleToggleStepCompletion = async (step: NutritionActionItem) => {
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

  const _handleAddStep = async (taskText: string, sourceId?: string, sourceName?: string) => {
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

  const _handleDeleteStep = async (stepId: string) => {
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

  const _handleOpenTaskDetailModal = (step: NutritionActionItem) => {
    setActiveStep(step);
    setTaskEditText(step.task);
    setTaskEditAssumedVal(step.assumedContributionValue || '');
    const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
    setTaskEditKind(kind as 'none' | 'schedule' | 'todo');
    setShowConvertOptions(kind === 'schedule' || kind === 'todo');

    const todayStr = getTodayStr();
    setTaskEditDate(step.dueDate || todayStr);
    setTaskEditStartTime(step.time || '08:00');
    setTaskEditEndTime('08:30');
    setTaskEditTodoTime(step.time || '');
    setTaskEditAssignee(step.assignee || '');
    setTaskModalOpen(true);
  };

  const _handleSaveTaskDetail = async () => {
    if (!activeStep || !taskEditText.trim()) return;
    setSavingTaskEdit(true);
    try {
      let updatedScheduleId = activeStep.scheduleId;
      let updatedTodoId = activeStep.todoId;
      const rawDate = taskEditDate || getTodayStr();
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
    const todayStr = getTodayStr();

    let sum = 0;
    for (const it of updatedList) {
      sum += calculateNutritionProgress(it);
    }
    const newMean = updatedList.length > 0 ? Math.max(0, Math.min(100, Math.round(sum / updatedList.length))) : 0;

    const existingCheckIns = Array.isArray(goal.habitCheckIns) ? [...goal.habitCheckIns] : [];
    let updatedCheckIns = existingCheckIns;
    if (newMean >= 70) {
      const hasToday = existingCheckIns.some((c) => c.date && c.date.split('T')[0] === todayStr);
      updatedCheckIns = hasToday
        ? existingCheckIns.map((c) => (c.date && c.date.split('T')[0] === todayStr ? { ...c, completed: true } : c))
        : [...existingCheckIns, { id: 'chk_' + Date.now(), date: todayStr, completed: true }];
    }

    const payload: Partial<Goal> = {
      nutritionItems: updatedList as unknown as Goal['nutritionItems'],
      habitCheckIns: updatedCheckIns,
      progress: newMean,
    };

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, payload);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), payload);
    }
  };

  const handleLoggerAddEntry = async (it: NutritionItem, addedValue: number) => {
    if (!goal.id) return;
    const todayStr = getTodayStr();

    const prevVal = it.currentValue || 0;
    const newCurrent = Math.min(it.targetValue, Math.round((prevVal + addedValue) * 100) / 100);
    const isCompletedNow = newCurrent >= it.targetValue;

    const updatedList = items.map((e) => {
      if (e.id === it.id || e === it) {
        return {
          ...e,
          currentValue: newCurrent,
          lastCompletedAt: isCompletedNow ? todayStr : (e as { lastCompletedAt?: string }).lastCompletedAt,
        };
      }
      return e;
    });

    setItems(updatedList);

    let sumProgress = 0;
    for (const item of updatedList) {
      sumProgress += calculateNutritionProgress(item);
    }
    const newMean = updatedList.length > 0 ? Math.max(0, Math.min(100, Math.round(sumProgress / updatedList.length))) : 0;

    const existingCheckIns = Array.isArray(goal.habitCheckIns) ? [...goal.habitCheckIns] : [];
    let updatedCheckIns = existingCheckIns;
    const isStreakDone = newMean >= 70 || isCompletedNow;

    if (isStreakDone) {
      const hasToday = existingCheckIns.some((c) => c.date && c.date.split('T')[0] === todayStr);
      updatedCheckIns = hasToday
        ? existingCheckIns.map((c) => (c.date && c.date.split('T')[0] === todayStr ? { ...c, completed: true } : c))
        : [...existingCheckIns, { id: 'chk_' + Date.now(), date: todayStr, completed: true }];
    }

    const payload: Partial<Goal> = {
      nutritionItems: updatedList as unknown as Goal['nutritionItems'],
      habitCheckIns: updatedCheckIns,
      progress: newMean,
    };

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, payload);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), payload);
    }
  };

  const handleLoggerFinishToday = async (it: NutritionItem) => {
    const remaining = Math.max(0, it.targetValue - (it.currentValue || 0));
    await handleLoggerAddEntry(it, remaining > 0 ? remaining : it.targetValue);
  };

  const handleOpenItemModal = (item?: NutritionItem, idx?: number) => {
    if (item && idx !== undefined) {
      setEditingIdx(idx);
      setName(item.name);
      setCategory(item.category);
      setTargetVal(item.targetValue);
      const categoryUnits = CATEGORY_UNITS_MAP[item.category] || CATEGORY_UNITS_MAP.other;
      const validUnit = categoryUnits.some((u) => u.value === item.unit) ? item.unit : categoryUnits[0].value;
      setUnit(validUnit);
      setTime(item.scheduleTime || '08:00 AM');
    } else {
      setEditingIdx(null);
      setName('');
      setCategory('water');
      setTargetVal('');
      setUnit('glasses');
      setTime('08:00 AM');
    }
    setModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!name.trim() || typeof targetVal !== 'number' || targetVal <= 0 || !goal.id) return;
    setSavingItem(true);
    try {
      const existingCurrent = editingIdx !== null && items[editingIdx] ? items[editingIdx].currentValue || 0 : 0;
      const newItem: NutritionItem = {
        id: editingIdx !== null && items[editingIdx] ? items[editingIdx].id : 'nut_' + Date.now(),
        name: name.trim(),
        category,
        targetValue: targetVal,
        currentValue: existingCurrent,
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

  const handleScheduleMeal = async () => {
    if (!schedTitle.trim() || !user || !goal.id) return;
    setSavingSched(true);
    try {
      if (schedKind === 'schedule') {
        await addSchedule({
          title: schedTitle.trim(),
          date: schedDate || getTodayStr(),
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
      {/* ── 1. Top Nutrition Summary Banner Card ── */}
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Health · Nutrition & Hydration Goal
            </Typography>

            <Chip
              label={`${meanProgress}% Target Progress`}
              size="small"
              sx={{
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                fontWeight: 800,
                fontSize: 12,
                px: 1,
                py: 0.5,
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            />
          </Box>

          <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 800, color: textPrimary, width: '100%', wordBreak: 'break-word', mt: 0.5 }}>
            {displayTitle}
          </Typography>
        </Box>

        <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: { xs: 18, sm: 20 }, fontWeight: 800, color: textPrimary, fontFamily: 'monospace' }}>
            {items.length} Active Intake {items.length === 1 ? 'Category' : 'Categories'}
          </Typography>
          <Typography sx={{ fontSize: 12, color: textMuted, fontWeight: 500 }}>
            configured for nutrition routine
          </Typography>
        </Box>

        <Box sx={{ mt: 2, height: 8, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              width: `${meanProgress}%`,
              bgcolor: '#10b981',
              borderRadius: 99,
              transition: 'width 0.4s ease',
            }}
          />
        </Box>
      </Box>

      {/* Streak Status Card (Add Nutrition button removed from StreaksCard) */}
      <StreakCard
        goal={currentGoalWithCheckIns}
        onUpdateGoal={onUpdateGoal}
        metricLabel="nutrition intake"
      />

      {/* ── 2. Tracked Intake Categories Section ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Tracked Intake Categories ({items.length})
          </Typography>

          {items.length > 0 && (
            <Button
              variant="contained"
              size="small"
              onClick={() => handleOpenItemModal()}
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: 'none',
                fontSize: 12.5,
                fontWeight: 800,
                borderRadius: '12px',
                bgcolor: '#10b981',
                color: '#ffffff',
                px: 2,
                py: 0.75,
                boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              + Add Nutrition
            </Button>
          )}
        </Box>

        {items.length === 0 ? (
          <Box
            sx={{
              p: 4,
              borderRadius: '24px',
              border: `2px dashed ${isDark ? '#334155' : '#cbd5e1'}`,
              bgcolor: surfaceBg,
              textAlign: 'center',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(15,23,42,0.03)',
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '18px',
                bgcolor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <WaterIcon sx={{ fontSize: 30 }} />
            </Box>

            <Typography sx={{ fontSize: 18, fontWeight: 800, color: textPrimary, mb: 1 }}>
              Choose a nutrition item to track
            </Typography>
            <Typography sx={{ fontSize: 13, color: textMuted, maxWidth: 460, mx: 'auto', mb: 3 }}>
              Set up your daily intake routines (Water, Protein, Calories, Meals, Supplements, Fruits & Veggies) with custom targets and units.
            </Typography>

            <Button
              variant="contained"
              onClick={() => handleOpenItemModal()}
              startIcon={<AddIcon />}
              sx={{
                textTransform: 'none',
                fontSize: 13.5,
                fontWeight: 800,
                borderRadius: '14px',
                bgcolor: '#10b981',
                color: '#ffffff',
                px: 3,
                py: 1,
                boxShadow: '0 6px 20px rgba(16,185,129,0.35)',
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              + Add Nutrition
            </Button>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {items.map((it, idx) => {
              const meta = NUTRITION_META[it.category] || NUTRITION_META.other;
              const IconComponent = meta.icon;
              const itProg = calculateNutritionProgress(it);

              return (
                <Box
                  key={it.id || idx}
                  sx={{
                    borderRadius: '22px',
                    border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    bgcolor: surfaceBg,
                    p: 3,
                    boxShadow: isDark ? '0 4px 18px rgba(0,0,0,0.25)' : '0 4px 18px rgba(15,23,42,0.04)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '14px',
                          bgcolor: `${meta.color}15`,
                          color: meta.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          mt: 0.5,
                        }}
                      >
                        <IconComponent sx={{ fontSize: 24 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 17, fontWeight: 800, color: textPrimary, width: '100%' }}>
                          {it.name}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: textMuted, fontWeight: 500, mt: 0.25 }}>
                          Target: {formatUnitVal(it.targetValue, it.unit)} {it.scheduleTime && `· Time: ${it.scheduleTime}`}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Chip
                        label={`${itProg}%`}
                        size="small"
                        sx={{
                          fontSize: 11,
                          fontWeight: 800,
                          bgcolor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          mr: 0.5,
                        }}
                      />
                      <IconButton size="small" onClick={() => handleOpenItemModal(it, idx)}>
                        <EditIcon sx={{ fontSize: 17, color: textMuted }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteItem(idx)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Circular Ring Progress Logger */}
                  <Box sx={{ mt: 2.5 }}>
                    <ActivityRingLogger
                      label={it.name}
                      unit={it.unit}
                      target={it.targetValue}
                      currentValue={it.currentValue || 0}
                      chips={getPredefinedSlotsForNutrition(it.unit, it.targetValue, it.category).map((s) => s.value)}
                      isDone={isDoneForToday(it, currentGoalWithCheckIns)}
                      onAddEntry={(addedVal) => handleLoggerAddEntry(it, addedVal)}
                      onFinishForToday={() => handleLoggerFinishToday(it)}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* ── 3. SCHEDULES & TODOS REMINDERS SECTION ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
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

      {/* ── 4. STRATEGY TASKS SECTION ── */}
      <StrategyTasksSection
        goal={goal}
        actions={actions as StrategyActionItem[]}
        onSaveActions={async (updated) => saveActionsList(updated as NutritionActionItem[])}
        placeholder="+ Quickly add a strategy task for your nutrition goal…"
      />

      {/* ── MODERN ADD / EDIT NUTRITION CATEGORY MODAL ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} closeAfterTransition>
        <Fade in={modalOpen}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[28px] w-[92%] sm:w-[460px] shadow-2xl overflow-hidden border outline-none bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800">
            {/* Header Banner */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                  🥗
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                    {editingIdx !== null ? 'Edit Nutrition Tracker' : 'Add Nutrition Tracker'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure daily intake targets and measurement units
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Intake Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                  Intake / Item Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Daily Water, Whey Protein, Vitamin D Tabs"
                  className="w-full text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Category Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                  Nutrition Category
                </label>
                <FormControl fullWidth size="small">
                  <Select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as NutritionItem['category'])}
                    sx={{
                      borderRadius: '12px',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      bgcolor: isDark ? 'rgba(30,41,59,0.5)' : '#f8fafc',
                    }}
                  >
                    <MenuItem value="water">💧 Water Intake</MenuItem>
                    <MenuItem value="protein">🥩 Protein Intake</MenuItem>
                    <MenuItem value="calories">🔥 Daily Calories</MenuItem>
                    <MenuItem value="sugar">🍬 Sugar Control</MenuItem>
                    <MenuItem value="soft_drinks">🥤 Soft Drinks</MenuItem>
                    <MenuItem value="fast_food">🍔 Fast Food</MenuItem>
                    <MenuItem value="meals">🥗 Balanced Meals</MenuItem>
                    <MenuItem value="supplements">💊 Supplements</MenuItem>
                    <MenuItem value="fruits">🍎 Fruits & Vegetables</MenuItem>
                    <MenuItem value="other">🍽️ Other Nutrition</MenuItem>
                  </Select>
                </FormControl>
              </div>

              {/* Category-Specific Units Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                  Measurement Unit ({currentAvailableUnits.length} available)
                </label>
                <FormControl fullWidth size="small">
                  <Select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    sx={{
                      borderRadius: '12px',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      bgcolor: isDark ? 'rgba(30,41,59,0.5)' : '#f8fafc',
                    }}
                  >
                    {currentAvailableUnits.map((u) => (
                      <MenuItem key={u.value} value={u.value}>
                        {u.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              {/* Daily Target Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                  Daily Target Goal Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetVal}
                    onChange={(e) => setTargetVal(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 8"
                    className="w-full text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {unit}
                  </span>
                </div>
              </div>

              {/* Scheduled Time (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                  Scheduled Reminder Time (Optional)
                </label>
                <input
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="e.g. 08:00 AM"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
              >
                Cancel
              </button>
              <Button
                variant="contained"
                disabled={savingItem || !name.trim() || typeof targetVal !== 'number' || targetVal <= 0}
                onClick={handleSaveItem}
                sx={{
                  borderRadius: '12px',
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.825rem',
                  bgcolor: '#10b981',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                  '&:hover': { bgcolor: '#059669' },
                }}
              >
                {savingItem ? 'Saving...' : editingIdx !== null ? 'Update Tracker' : 'Save Tracker'}
              </Button>
            </div>
          </div>
        </Fade>
      </Modal>

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


    </Box>
  );
}
