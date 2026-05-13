'use client';

import React, { useState } from 'react';
import { 
  Dialog, DialogContent, Box, Typography, Button, TextField, 
  IconButton, Stack, Grid, CircularProgress, 
  useTheme, useMediaQuery
} from '@mui/material';
import { 
  Close as CloseIcon,
  FormatQuote as StringIcon,
  Checklist as TodoIcon,
  Event as ScheduleIcon,
  Flag as GoalIcon,
  VpnKey as KeyIcon,
  Whatshot as StreakIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjects } from '@/app/lib/context/ProjectsContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { useGoals } from '@/app/lib/context/GoalsContext';
import { useAuth } from '@/app/lib/context/userContext';
import { PointType, GoalType } from '@/app/lib/interface';
import { FormControl, InputLabel, Select, MenuItem, Chip } from '@mui/material';

interface NewPointModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  agendaId: string;
}

const pointTypes = [
  { id: 'string', label: 'Simple Note', icon: <StringIcon />, color: '#7c3aed' },
  { id: 'todo', label: 'New Task', icon: <TodoIcon />, color: '#4f46e5' },
  { id: 'schedule', label: 'New Event', icon: <ScheduleIcon />, color: '#0891b2' },
  { id: 'streak', label: 'Weekly Habit', icon: <StreakIcon />, color: '#d97706' },
  { id: 'goal', label: 'New Goal', icon: <GoalIcon />, color: '#059669' },
  { id: 'keyvalue', label: 'Key Value', icon: <KeyIcon />, color: '#db2777' },
];

const NewPointModal: React.FC<NewPointModalProps> = ({ open, onClose, projectId, agendaId }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { addPoint } = useProjects();
  const { addTodo } = useTodoContext();
  const { addSchedule } = useSchedules();
  const { addGoal } = useGoals();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<PointType | null>(null);

  // Form states for different types
  const [stringContent, setStringContent] = useState('');
  
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDueDate, setTodoDueDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  
  const [goalTitle, setGoalTitle] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('lifestyle');

  const [streakTitle, setStreakTitle] = useState('');
  const [streakCount, setStreakCount] = useState(0);
  
  const [kvKey, setKvKey] = useState('');
  const [kvValue, setKvValue] = useState('');

  const [colorScheme, setColorScheme] = useState<'default' | 'success' | 'warning' | 'info' | 'error' | 'grey'>('default');
  const [groupName, setGroupName] = useState('');

  const handleTypeSelect = (type: PointType) => {
    setSelectedType(type);
    setStep(2);
  };

  const handleCreate = async () => {
    if (!selectedType) return;
    setLoading(true);

    try {
      if (!user) return;

      if (selectedType === 'string') {
        await addPoint(projectId, agendaId, { 
          type: 'string', 
          content: stringContent, 
          colorScheme,
          ...(groupName.trim() ? { groupName: groupName.trim() } : {})
        });
      } else if (selectedType === 'todo') {
        const todoId = await addTodo({
          title: todoTitle,
          status: 'in_progress',
          priority: 'routine',
          projectId,
          authorId: user.uid,
          dueDate: new Date(todoDueDate),
          steps: [],
          tags: [],
          progressPercent: 0,
          assignedUsers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await addPoint(projectId, agendaId, { 
          type: 'todo', 
          todoId,
          ...(groupName.trim() ? { groupName: groupName.trim() } : {})
        });
      } else if (selectedType === 'schedule') {
        const scheduleId = await addSchedule({
          title: scheduleTitle,
          date: scheduleDate,
          startTime: startTime,
          endTime: endTime,
          projectId,
          userId: user.uid,
          status: 'pending',
          priority: 'medium',
        });
        await addPoint(projectId, agendaId, { 
          type: 'schedule', 
          scheduleId,
          ...(groupName.trim() ? { groupName: groupName.trim() } : {})
        });
      } else if (selectedType === 'goal') {
        const goalId = await addGoal({
          title: goalTitle,
          type: goalType as GoalType,
          status: 'Not Started',
          priority: 'Medium',
          projectId,
          userId: user.uid,
          progress: 0,
          steps: [],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 1 month
        });
        await addPoint(projectId, agendaId, { 
          type: 'goal', 
          goalId,
          ...(groupName.trim() ? { groupName: groupName.trim() } : {})
        });
      } else if (selectedType === 'streak') {
        await addPoint(projectId, agendaId, { 
          type: 'streak', 
          content: streakTitle,
          count: streakCount,
          ...(groupName.trim() ? { groupName: groupName.trim() } : {})
        });
      } else if (selectedType === 'keyvalue') {
        await addPoint(projectId, agendaId, { 
          type: 'keyvalue', 
          key: kvKey, 
          value: kvValue,
          ...(groupName.trim() ? { groupName: groupName.trim() } : {})
        });
      }

      resetAndClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setSelectedType(null);
    setStringContent('');
    setTodoTitle('');
    setScheduleTitle('');
    setGoalTitle('');
    setStreakTitle('');
    setStreakCount(0);
    setKvKey('');
    setKvValue('');
    setColorScheme('default');
    setGroupName('');
    onClose();
  };

  const renderForm = () => {
    switch (selectedType) {
      case 'string':
        return (
          <Stack spacing={3}>
            <TextField
              fullWidth multiline rows={4} autoFocus
              placeholder="Write your note here..."
              value={stringContent}
              onChange={(e) => setStringContent(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />
            <Box>
              <Typography variant="caption" className="text-slate-400 font-bold uppercase ml-1 block mb-2">
                Color Scheme
              </Typography>
              <Box className="flex flex-wrap gap-2">
                {[
                  { id: 'default', color: '#7c3aed' },
                  { id: 'success', color: '#10b981' },
                  { id: 'warning', color: '#f59e0b' },
                  { id: 'info', color: '#0ea5e9' },
                  { id: 'error', color: '#ef4444' },
                  { id: 'grey', color: '#94a3b8' },
                ].map((c) => (
                  <Chip
                    key={c.id}
                    label={c.id}
                    onClick={() => setColorScheme(c.id as 'default' | 'success' | 'warning' | 'info' | 'error' | 'grey')}
                    sx={{
                      bgcolor: colorScheme === c.id ? c.color : 'transparent',
                      color: colorScheme === c.id ? '#fff' : c.color,
                      borderColor: c.color,
                      border: '1px solid',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      fontSize: '10px',
                      '&:hover': { bgcolor: colorScheme === c.id ? c.color : c.color + '20' }
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Stack>
        );
      case 'todo':
        return (
          <Stack spacing={3}>
            <TextField
              fullWidth autoFocus
              placeholder="What needs to be done?"
              label="Task Title"
              value={todoTitle}
              onChange={(e) => setTodoTitle(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontWeight: 700 } }}
            />
            <TextField
              fullWidth type="date"
              label="Due Date"
              value={todoDueDate}
              onChange={(e) => setTodoDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />
          </Stack>
        );
      case 'schedule':
        return (
          <Stack spacing={3}>
            <TextField
              fullWidth autoFocus
              placeholder="Event name..."
              label="Schedule Title"
              value={scheduleTitle}
              onChange={(e) => setScheduleTitle(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontWeight: 700 } }}
            />
            <TextField
              fullWidth type="date"
              label="Date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  fullWidth type="time"
                  label="Start Time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth type="time"
                  label="End Time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                />
              </Grid>
            </Grid>
          </Stack>
        );
      case 'goal':
        return (
          <Stack spacing={3}>
            <TextField
              fullWidth autoFocus
              placeholder="Big objective..."
              label="Goal Title"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontWeight: 700 } }}
            />
            <FormControl fullWidth>
              <InputLabel>Goal Category</InputLabel>
              <Select
                value={goalType}
                label="Goal Category"
                onChange={(e) => setGoalType(e.target.value as GoalType)}
                sx={{ borderRadius: '16px' }}
              >
                <MenuItem value="lifestyle">🌟 Lifestyle</MenuItem>
                <MenuItem value="work">💼 Work</MenuItem>
                <MenuItem value="health">🏃 Health</MenuItem>
                <MenuItem value="finance">💰 Finance</MenuItem>
                <MenuItem value="learning">📚 Learning</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        );
      case 'streak':
        return (
          <Stack spacing={3}>
            <TextField
              fullWidth autoFocus
              placeholder="Daily habit..."
              label="Habit Title"
              value={streakTitle}
              onChange={(e) => setStreakTitle(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontWeight: 700 } }}
            />
            <TextField
              fullWidth type="number"
              label="Current Streak"
              value={streakCount}
              onChange={(e) => setStreakCount(Number(e.target.value))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />
          </Stack>
        );
      case 'keyvalue':
        return (
          <Stack spacing={3}>
            <TextField
              fullWidth autoFocus
              placeholder="e.g. Version, Budget, Location..."
              label="Key"
              value={kvKey}
              onChange={(e) => setKvKey(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontWeight: 900 } }}
            />
            <TextField
              fullWidth
              placeholder="e.g. 1.0.4, $500, London..."
              label="Value"
              value={kvValue}
              onChange={(e) => setKvValue(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />
          </Stack>
        );
      default:
        return null;
    }
  };

  const isFormValid = () => {
    if (selectedType === 'string') return stringContent.trim().length > 0;
    if (selectedType === 'todo') return todoTitle.trim().length > 0;
    if (selectedType === 'schedule') return scheduleTitle.trim().length > 0;
    if (selectedType === 'goal') return goalTitle.trim().length > 0;
    if (selectedType === 'streak') return streakTitle.trim().length > 0;
    if (selectedType === 'keyvalue') return kvKey.trim().length > 0 && kvValue.trim().length > 0;
    return false;
  };

  return (
    <Dialog 
      open={open} 
      onClose={resetAndClose}
      fullScreen={isMobile}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { borderRadius: isMobile ? 0 : '28px', bgcolor: 'background.paper', overflow: 'hidden' }
      }}
    >
      <Box className="p-6 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
        <Typography variant="h6" className="font-black tracking-tight">
          {step === 1 ? 'Add New Point' : `New ${selectedType?.toUpperCase()}`}
        </Typography>
        <IconButton onClick={resetAndClose} size="small" className="bg-slate-50 dark:bg-slate-800">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent className="p-6">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
            >
              <Grid container spacing={2}>
                {pointTypes.map((t) => (
                  <Grid size={12} key={t.id}>
                    <Box
                      onClick={() => handleTypeSelect(t.id as PointType)}
                      className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-50/10 cursor-pointer transition-all group"
                      sx={{
                        '&:hover': {
                          borderColor: t.color,
                          bgcolor: t.color + '10'
                        }
                      }}
                    >
                      <Box 
                        className="p-3 rounded-xl transition-transform group-hover:scale-110" 
                        sx={{ bgcolor: t.color + '15', color: t.color }}
                      >
                        {t.icon}
                      </Box>
                      <Box className="flex-1">
                        <Typography variant="subtitle2" className="font-black text-slate-800 dark:text-slate-100">
                          {t.label}
                        </Typography>
                        <Typography variant="caption" className="text-slate-400 font-medium">
                          Add a {t.id} to this agenda
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Stack spacing={4}>
                {renderForm()}
                <TextField
                  fullWidth
                  placeholder="Group Name (Optional)"
                  label="Group"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleCreate}
                  disabled={!isFormValid() || loading}
                  className="py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 normal-case font-black text-lg"
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Confirm & Add'}
                </Button>
                <Button 
                  fullWidth 
                  onClick={() => setStep(1)} 
                  className="text-slate-400 font-bold normal-case"
                >
                  Back to types
                </Button>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default NewPointModal;
