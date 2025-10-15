'use client';

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Close,
  Add,
  Delete,
  TrendingUp,
  FitnessCenter,
  School,
  Psychology,
  Category,
} from '@mui/icons-material';
import { useGoals } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { Goal, GoalType, GoalPriority, GoalStep } from '../../lib/interface';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';

interface GoalModalProps {
  open: boolean;
  onClose: () => void;
  goal?: Goal; // For editing existing goals
}

const getGoalTypeColor = (type: GoalType) => {
  switch (type) {
    case 'finance':
      return '#10B981';
    case 'health':
      return '#F59E0B';
    case 'learning':
      return '#3B82F6';
    case 'habit':
      return '#8B5CF6';
    default:
      return '#6B7280';
  }
};

const GoalModal: React.FC<GoalModalProps> = ({ open, onClose, goal }) => {
  const { addGoal, updateGoal } = useGoals();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [loading, setLoading] = useState(false);
  const [showDescription, setShowDescription] = useState(false);

  // Form state
  const isTimestampLike = (v: unknown): v is { toDate: () => Date } => {
    if (typeof v !== 'object' || v === null) return false;
    const maybe = v as { toDate?: unknown };
    return typeof maybe.toDate === 'function';
  };
  const normalizeToDate = (val: unknown): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (isTimestampLike(val)) return val.toDate();
    if (typeof val === 'string' || typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const [formData, setFormData] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    type: (goal?.type || 'custom') as GoalType,
    priority: (goal?.priority || 'Medium') as GoalPriority,
    dueDate: normalizeToDate(goal?.dueDate),
    category: goal?.category || '',
    timeline: goal?.timeline || '',
    steps: goal?.steps || ([] as GoalStep[]),
    privacy: goal?.privacy || ('private' as 'private' | 'public' | 'specific'),
    pinned: goal?.pinned || false,
  });

  const [newStep, setNewStep] = useState({
    title: '',
    description: '',
    targetValue: '',
    unit: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
  });

  const handleInputChange = (field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Auto-calc timeline when dueDate changes
    if (field === 'dueDate' && value) {
      const tl = computeTimelineFromDueDate(value as Date);
      setFormData((prev) => ({ ...prev, timeline: tl }));
    }
  };

  // Helpers
  const endOfMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const startOfMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), 1);
  const addMonths = (date: Date, m: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + m);
    return d;
  };

  const formatDate = (d: Date) => d; // Firestore Timestamp will be set in context; keep Date

  const monthPresetButtons = useMemo(() => {
    const now = new Date();
    // next three month ends including current month end if within 4 months
    const opts: { label: string; value: Date }[] = [];
    for (let i = 0; i < 4; i++) {
      const target = endOfMonth(addMonths(now, i));
      const label = target.toLocaleString('default', { month: 'short' });
      opts.push({ label: `End of ${label}`, value: target });
    }
    return opts;
  }, []);

  const maxDueDate = useMemo(() => {
    const now = new Date();
    return endOfMonth(addMonths(now, 4));
  }, []);

  function computeTimelineFromDueDate(due: Date): string {
    const now = new Date();
    // rules: if day <=12 => count current month as whole month; if 13-23 => half month; if >23 => exclude
    const day = now.getDate();
    const end = endOfMonth(due);
    // months difference inclusive by month boundaries
    let months =
      (end.getFullYear() - now.getFullYear()) * 12 +
      (end.getMonth() - now.getMonth()) +
      1; // inclusive
    if (day > 23) months -= 1; // don't count current month
    else if (day >= 13) return `${Math.max(0, months - 1)}.5 months`;
    return `${Math.max(0, months)} months`;
  }

  // Quick presets for steps based on due date
  const stepMonthPresets = useMemo(() => {
    const presets: { key: string; label: string; start: Date; end: Date }[] =
      [];
    if (!formData.dueDate) return presets;
    const now = new Date();
    const end = formData.dueDate as Date;
    // compute number of months between now and due end-of-month
    const totalMonths =
      (end.getFullYear() - now.getFullYear()) * 12 +
      (end.getMonth() - now.getMonth()) +
      1;
    if (totalMonths > 2) {
      for (let i = 0; i < Math.min(totalMonths, 4); i++) {
        const start = i === 0 ? now : startOfMonth(addMonths(now, i));
        const endM = endOfMonth(addMonths(now, i));
        presets.push({
          key: `m${i + 1}`,
          label: `${i + 1}${['st', 'nd', 'rd', 'th'][Math.min(i, 3)]} month`,
          start,
          end: endM,
        });
      }
    }
    // weeks presets
    const thisWeekStart = startOfWeek(now);
    const thisWeekEnd = addDays(thisWeekStart, 6);
    const nextWeekStart = addDays(thisWeekStart, 7);
    const nextWeekEnd = addDays(nextWeekStart, 6);
    presets.push({
      key: 'w1',
      label: 'This week',
      start: thisWeekStart,
      end: thisWeekEnd,
    });
    presets.push({
      key: 'w2',
      label: 'Next week',
      start: nextWeekStart,
      end: nextWeekEnd,
    });
    return presets;
  }, [formData.dueDate]);

  function startOfWeek(date: Date) {
    const d = new Date(date);
    const diff = d.getDay(); // 0 Sun .. 6 Sat
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  const handleAddStep = () => {
    if (!newStep.title.trim()) return;

    const step: GoalStep = {
      id: Date.now().toString(),
      title: newStep.title,
      description: newStep.description || undefined,
      targetValue: newStep.targetValue
        ? parseFloat(newStep.targetValue)
        : undefined,
      unit: newStep.unit || undefined,
      startDate: newStep.startDate || undefined,
      endDate: newStep.endDate || undefined,
      completed: false,
    };

    setFormData((prev) => ({
      ...prev,
      steps: [...prev.steps, step],
    }));

    setNewStep({
      title: '',
      description: '',
      targetValue: '',
      unit: '',
      startDate: null,
      endDate: null,
    });
  };

  const handleRemoveStep = (stepId: string) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.filter((step) => step.id !== stepId),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.dueDate) return;

    setLoading(true);
    try {
      const now = new Date();

      const goalData = {
        title: formData.title,
        description: formData.description || undefined,
        type: formData.type,
        priority: formData.priority,
        dueDate: formData.dueDate
          ? Timestamp.fromDate(new Date(formData.dueDate))
          : null,
        category: formData.category || undefined,
        timeline: formData.timeline || undefined,
        steps: formData.steps.map((step) => ({
          ...step,
          startDate: step.startDate
            ? Timestamp.fromDate(
                step.startDate instanceof Date
                  ? step.startDate
                  : step.startDate.toDate()
              )
            : null,
          endDate: step.endDate
            ? Timestamp.fromDate(
                step.endDate instanceof Date
                  ? step.endDate
                  : step.endDate.toDate()
              )
            : null,
        })),
        privacy: formData.privacy,
        pinned: formData.pinned,
        progress: goal?.progress || 0,
        status: goal?.status || 'Not Started',
        userId: user!.uid,
        authorName: user!.email || 'Anonymous',

        // 🕒 Firestore timestamps
        createdAt: goal ? goal.createdAt : Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };

      if (goal) {
        await updateGoal(goal.id!, goalData);
      } else {
        await addGoal(goalData);
      }

      onClose();
    } catch (error) {
      console.error('Error saving goal:', error);
    } finally {
      setLoading(false);
    }
  };

  const goalTypes: { value: GoalType; label: string; icon: React.ReactNode }[] =
    [
      { value: 'finance', label: 'Finance', icon: <TrendingUp /> },
      { value: 'health', label: 'Health', icon: <FitnessCenter /> },
      { value: 'learning', label: 'Learning', icon: <School /> },
      { value: 'habit', label: 'Habit', icon: <Psychology /> },
      { value: 'custom', label: 'Custom', icon: <Category /> },
    ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            borderRadius: '1rem',
          },
        }}
      >
        <DialogTitle className="flex justify-between items-center">
          <Typography
            component="div"
            variant="h6"
            className="font-semibold"
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
            }}
          >
            {goal ? 'Edit Goal' : 'Create New Goal'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent className="space-y-4">
          {/* Basic Information */}
          <Box>
            <Typography
              variant="subtitle1"
              className="font-semibold mb-3"
              sx={{
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
              }}
            >
              Basic Information
            </Typography>

            <Box className="space-y-4">
              <TextField
                fullWidth
                label="Goal Title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Save ₹5000 in 5 months"
                variant="outlined"
              />

              {/* Collapsible Description */}
              <Box className="space-y-2">
                <Button
                  size="small"
                  variant={showDescription ? 'outlined' : 'text'}
                  onClick={() => setShowDescription((s) => !s)}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {showDescription ? 'Hide description' : 'Add description'}
                </Button>
                {showDescription && (
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Description"
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange('description', e.target.value)
                    }
                    placeholder="Describe your goal in detail..."
                    variant="outlined"
                  />
                )}
              </Box>

              <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    label="Type"
                  >
                    {goalTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        <Box className="flex items-center gap-2">
                          <Box sx={{ color: getGoalTypeColor(type.value) }}>
                            {type.icon}
                          </Box>
                          {type.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) =>
                      handleInputChange('priority', e.target.value)
                    }
                    label="Priority"
                  >
                    <MenuItem value="Low">
                      <Chip
                        label="Low"
                        size="small"
                        sx={{ backgroundColor: '#10B98120', color: '#10B981' }}
                      />
                    </MenuItem>
                    <MenuItem value="Medium">
                      <Chip
                        label="Medium"
                        size="small"
                        sx={{ backgroundColor: '#F59E0B20', color: '#F59E0B' }}
                      />
                    </MenuItem>
                    <MenuItem value="High">
                      <Chip
                        label="High"
                        size="small"
                        sx={{ backgroundColor: '#EF444420', color: '#EF4444' }}
                      />
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Box className="space-y-2">
                  <DatePicker
                    label="Due Date"
                    value={formData.dueDate}
                    onChange={(date) => handleInputChange('dueDate', date)}
                    maxDate={maxDueDate}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                      },
                    }}
                  />
                  {/* Quick month presets */}
                  <Box className="flex flex-wrap gap-2">
                    {monthPresetButtons.map((opt) => (
                      <Button
                        key={opt.label}
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          handleInputChange('dueDate', formatDate(opt.value))
                        }
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </Box>
                </Box>

                <TextField
                  fullWidth
                  label="Timeline"
                  value={formData.timeline}
                  onChange={(e) =>
                    handleInputChange('timeline', e.target.value)
                  }
                  placeholder="e.g., 3 months, 6 weeks"
                  variant="outlined"
                />
              </Box>

              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                placeholder="e.g., Personal Development, Health & Fitness"
                variant="outlined"
              />
            </Box>
          </Box>

          <Divider />

          {/* Steps/Milestones */}
          <Box>
            <Typography
              variant="subtitle1"
              className="font-semibold mb-3"
              sx={{
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
              }}
            >
              Steps & Milestones
            </Typography>

            {/* Add New Step */}
            <Box
              className="border rounded-lg p-4 mb-4"
              sx={{
                borderColor: theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
              }}
            >
              <Typography variant="body2" className="font-medium mb-3">
                Add New Step
              </Typography>

              <Box className="space-y-3">
                <Box className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <TextField
                    fullWidth
                    size="small"
                    label="Step Title"
                    value={newStep.title}
                    onChange={(e) =>
                      setNewStep((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="e.g., Save ₹1000 in January"
                  />

                  <TextField
                    fullWidth
                    size="small"
                    label="Description"
                    value={newStep.description}
                    onChange={(e) =>
                      setNewStep((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Optional description"
                  />
                </Box>

                {/* Quick presets for step dates */}
                {stepMonthPresets.length > 0 && (
                  <Box className="flex flex-wrap gap-2 mb-2">
                    {stepMonthPresets.map((p) => (
                      <Button
                        key={p.key}
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          setNewStep((prev) => ({
                            ...prev,
                            startDate: p.start,
                            endDate: p.end,
                          }))
                        }
                      >
                        {p.label}
                      </Button>
                    ))}
                  </Box>
                )}

                <Box className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <TextField
                    fullWidth
                    size="small"
                    label="Target Value"
                    type="number"
                    value={newStep.targetValue}
                    onChange={(e) =>
                      setNewStep((prev) => ({
                        ...prev,
                        targetValue: e.target.value,
                      }))
                    }
                    placeholder="1000"
                  />

                  <TextField
                    fullWidth
                    size="small"
                    label="Unit"
                    value={newStep.unit}
                    onChange={(e) =>
                      setNewStep((prev) => ({ ...prev, unit: e.target.value }))
                    }
                    placeholder="Rs, kg, hours"
                  />

                  <DatePicker
                    label="Start Date"
                    value={newStep.startDate}
                    onChange={(date: Date | null) =>
                      setNewStep((prev) => ({ ...prev, startDate: date }))
                    }
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                      },
                    }}
                  />

                  <DatePicker
                    label="End Date"
                    value={newStep.endDate}
                    onChange={(date: Date | null) =>
                      setNewStep((prev) => ({ ...prev, endDate: date }))
                    }
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                      },
                    }}
                  />
                </Box>

                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddStep}
                  disabled={!newStep.title.trim()}
                  size="small"
                >
                  Add Step
                </Button>
              </Box>
            </Box>

            {/* Existing Steps */}
            <AnimatePresence>
              {formData.steps.map((step) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Box
                    className="flex items-center justify-between p-3 border rounded-lg mb-2"
                    sx={{
                      borderColor:
                        theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
                      backgroundColor:
                        theme?.mode === 'dark' ? '#37415120' : '#f9fafb',
                    }}
                  >
                    <Box className="flex-1">
                      <Typography variant="body2" className="font-medium">
                        {step.title}
                      </Typography>
                      {step.description && (
                        <Typography
                          variant="caption"
                          sx={{
                            color:
                              theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                          }}
                        >
                          {step.description}
                        </Typography>
                      )}
                      {(step.targetValue || step.unit) && (
                        <Typography variant="caption" className="block">
                          Target: {step.targetValue} {step.unit}
                        </Typography>
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveStep(step.id)}
                      sx={{ color: '#EF4444' }}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>
          </Box>

          <Divider />

          {/* Additional Settings */}
          <Box>
            <Typography
              variant="subtitle1"
              className="font-semibold mb-3"
              sx={{
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
              }}
            >
              Additional Settings
            </Typography>

            <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormControl fullWidth>
                <InputLabel>Privacy</InputLabel>
                <Select
                  value={formData.privacy}
                  onChange={(e) => handleInputChange('privacy', e.target.value)}
                  label="Privacy"
                >
                  <MenuItem value="private">Private</MenuItem>
                  <MenuItem value="public">Public</MenuItem>
                  <MenuItem value="specific">Specific Users</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.pinned}
                    onChange={(e) =>
                      handleInputChange('pinned', e.target.checked)
                    }
                  />
                }
                label="Pin to top"
              />
            </Box>
          </Box>
        </DialogContent>

        <DialogActions className="p-4">
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !formData.title.trim() || !formData.dueDate}
            sx={{
              backgroundColor: '#3B82F6',
              '&:hover': {
                backgroundColor: '#2563eb',
              },
            }}
          >
            {loading ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default GoalModal;
