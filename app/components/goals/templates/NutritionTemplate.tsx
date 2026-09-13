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
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

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
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: textPrimary, mt: 0.5, mb: 2 }}>
          {displayTitle}
        </Typography>

        {/* Quick Log Button */}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
          <Button
            variant="contained"
            onClick={() => handleOpenLogModal(0)}
            startIcon={<AddIcon />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            + Log Daily Intake
          </Button>
          <Button
            variant="outlined"
            onClick={() => setSchedModalOpen(true)}
            startIcon={<EventIcon />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, borderColor: cardBorder, color: textPrimary }}
          >
            Schedule Meal / Hydration
          </Button>
        </Box>
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
            + Add Category
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
    </Box>
  );
}
