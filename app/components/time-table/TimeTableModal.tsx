'use client';

import {
  Box,
  Typography,
  Modal,
  TextField,
  Button,
  Stack,
  IconButton,
  CircularProgress,
  Divider,
  useMediaQuery,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import {
  collection,
  addDoc,
  Timestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { TimeTableProps, TimeTableStep } from '@/app/lib/interface';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';

// Type Icons
import MenuBookIcon from '@mui/icons-material/MenuBook'; // Learning
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'; // Health/ fitness
import WorkIcon from '@mui/icons-material/Work'; // work
import SchoolIcon from '@mui/icons-material/School'; // education
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom'; // family
import CommuteIcon from '@mui/icons-material/Commute'; // transport
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement'; // religious
import CelebrationIcon from '@mui/icons-material/Celebration'; // events
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'; // fallback

// Category definitions
export const TIMETABLE_TYPES = [
  { id: 'Learning', label: 'Learning', icon: MenuBookIcon, color: '#3b82f6', bgLight: '#eff6ff', bgDark: '#1e3a8a20', gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' },
  { id: 'Health/ fitness', label: 'Health & Fitness', icon: FitnessCenterIcon, color: '#10b981', bgLight: '#ecfdf5', bgDark: '#064e3b20', gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' },
  { id: 'work', label: 'Work', icon: WorkIcon, color: '#f59e0b', bgLight: '#fffbeb', bgDark: '#78350f20', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  { id: 'education', label: 'Education', icon: SchoolIcon, color: '#8b5cf6', bgLight: '#f5f3ff', bgDark: '#4c1d9520', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' },
  { id: 'family', label: 'Family', icon: FamilyRestroomIcon, color: '#ec4899', bgLight: '#fdf2f8', bgDark: '#83184320', gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' },
  { id: 'transport', label: 'Transport', icon: CommuteIcon, color: '#06b6d4', bgLight: '#ecfeff', bgDark: '#164e6320', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
  { id: 'religious', label: 'Religious', icon: SelfImprovementIcon, color: '#14b8a6', bgLight: '#f0fdfa', bgDark: '#115e5920', gradient: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)' },
  { id: 'events', label: 'Events', icon: CelebrationIcon, color: '#f43f5e', bgLight: '#fff1f2', bgDark: '#88133720', gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' }
];

export const getTimetableTypeInfo = (type?: string) => {
  const normType = type?.toLowerCase().replace('religous', 'religious').trim();
  const info = TIMETABLE_TYPES.find(t => t.id.toLowerCase() === normType || t.label.toLowerCase() === normType || (normType === 'religious' && t.id === 'religious'));
  return info || {
    id: 'general',
    label: 'General',
    icon: CalendarTodayIcon,
    color: '#64748b',
    bgLight: '#f8fafc',
    bgDark: '#33415520',
    gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
  };
};

interface Props {
  open: boolean;
  onClose: () => void;
  editData?: TimeTableProps;
}

const TimeTableModal = ({ open, onClose, editData }: Props) => {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Learning');
  const [steps, setSteps] = useState<TimeTableStep[]>([
    { field1: '', startTime: '', endTime: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const isDesktop = useMediaQuery('(min-width:768px)');
  const selectedTypeInfo = getTimetableTypeInfo(type);

  useEffect(() => {
    if (editData) {
      setTitle(editData.title);
      setDescription(editData.description || '');
      setType(editData.type || 'Learning');
      setSteps(
        editData.steps.length
          ? editData.steps
          : [{ field1: '', startTime: '', endTime: '' }]
      );
    } else {
      setTitle('');
      setDescription('');
      setType('Learning');
      setSteps([{ field1: '', startTime: '', endTime: '' }]);
    }
  }, [editData, open]);

  const handleStepChange = (
    index: number,
    field: 'field1' | 'startTime' | 'endTime',
    value: string
  ) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    setSteps(newSteps);
  };

  const addStep = () =>
    setSteps([...steps, { field1: '', startTime: '', endTime: '' }]);

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(
      newSteps.length ? newSteps : [{ field1: '', startTime: '', endTime: '' }]
    );
  };

  const saveTimeTable = async () => {
    if (!title.trim()) return alert('Title is required');
    for (const step of steps) {
      if (!step.field1.trim() || !step.startTime.trim())
        return alert('Each step requires a name and start time');
    }
    if (!user?.uid) return alert('User not authenticated');

    setSaving(true);
    try {
      type FirestoreTimeTable = Omit<TimeTableProps, 'id'>;

      const data: FirestoreTimeTable = {
        title,
        description,
        type,
        steps,
        userId: user.uid,
        updatedAt: Timestamp.now(),
        createdAt: editData?.createdAt || Timestamp.now(),
      };

      if (editData?.id) {
        await updateDoc(doc(db, 'timeTables', editData.id), data);
      } else {
        await addDoc(collection(db, 'timeTables'), data);
      }

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          p: { xs: 2, md: 4 },
          mx: 'auto',
          mt: isDesktop ? 6 : 0, // small margin on desktop for breathing room
          width: isDesktop ? '700px' : '100%', // narrower on desktop
          height: isDesktop ? 'auto' : '100vh', // full height only on mobile
          maxHeight: '90vh', // prevent overflow on desktop
          overflowY: 'auto',
          backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#ffffff',
          color: theme?.mode === 'dark' ? '#f8fafc' : '#0f172a',
          borderRadius: isDesktop ? 3 : 0, // rounded only on desktop
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
          borderTop: `6px solid ${selectedTypeInfo.color}`,
          transition: 'border-color 0.3s ease, background-color 0.2s',
        }}
      >
        {/* Title Heading */}
        <Typography variant="h5" fontWeight={800} mb={2.5} sx={{ letterSpacing: '-0.025em' }}>
          {editData ? 'Edit Time Table' : 'Create Time Table'}
        </Typography>

        {/* Title & Description Fields */}
        <Stack spacing={2} mb={3}>
          <TextField
            fullWidth
            size="medium"
            label="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            InputProps={{
              sx: { borderRadius: 2 }
            }}
          />

          <TextField
            fullWidth
            size="medium"
            label="Description"
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            InputProps={{
              sx: { borderRadius: 2 }
            }}
          />
        </Stack>

        {/* Dynamic Colorful Category Selector */}
        <Box mb={4}>
          <Typography fontWeight={700} mb={1.5} variant="subtitle2" sx={{ color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569' }}>
            Choose Timetable Type
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: 1.5,
            }}
          >
            {TIMETABLE_TYPES.map((t) => {
              const IconComponent = t.icon;
              const isSelected = type === t.id;
              return (
                <Box
                  key={t.id}
                  onClick={() => setType(t.id)}
                  sx={{
                    cursor: 'pointer',
                    p: 1.5,
                    borderRadius: 3,
                    border: '2px solid',
                    borderColor: isSelected ? t.color : (theme?.mode === 'dark' ? '#334155' : '#e2e8f0'),
                    backgroundColor: isSelected
                      ? (theme?.mode === 'dark' ? t.bgDark : t.bgLight)
                      : (theme?.mode === 'dark' ? '#1e293b' : '#ffffff'),
                    color: isSelected
                      ? t.color
                      : (theme?.mode === 'dark' ? '#94a3b8' : '#64748b'),
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isSelected ? `0 4px 12px ${t.color}20` : 'none',
                    '&:hover': {
                      borderColor: t.color,
                      color: t.color,
                      transform: 'translateY(-2px)',
                      boxShadow: `0 4px 10px ${t.color}15`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: '50%',
                      backgroundColor: isSelected
                        ? (theme?.mode === 'dark' ? `${t.color}30` : `${t.color}15`)
                        : (theme?.mode === 'dark' ? '#2d3748' : '#f1f5f9'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <IconComponent sx={{ fontSize: 24 }} />
                  </Box>
                  <Typography variant="caption" fontWeight={700} align="center">
                    {t.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Steps Section */}
        <Typography fontWeight={700} mb={1.5} variant="subtitle2" sx={{ color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569' }}>
          Schedule Steps
        </Typography>

        <LocalizationProvider dateAdapter={AdapterMoment}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            {steps.map((step, idx) => (
              <Stack
                key={idx}
                spacing={2}
                p={2.5}
                sx={{
                  borderLeft: `4px solid ${selectedTypeInfo.color}`,
                  backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#f8fafc',
                  borderTop: '1px solid',
                  borderRight: '1px solid',
                  borderBottom: '1px solid',
                  borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0',
                  borderRadius: '0 12px 12px 0',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                  },
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    label="Step Name *"
                    placeholder="e.g. Read Book, Cardio, Daily Meeting"
                    value={step.field1}
                    onChange={(e) =>
                      handleStepChange(idx, 'field1', e.target.value)
                    }
                    fullWidth
                    InputProps={{ sx: { borderRadius: 2 } }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removeStep(idx)}
                    sx={{
                      '&:hover': {
                        backgroundColor: '#fee2e2',
                        color: '#ef4444'
                      }
                    }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>

                <Stack direction="row" spacing={2}>
                  <TimePicker
                    label="Start Time *"
                    value={
                      step.startTime ? moment(step.startTime, 'HH:mm') : null
                    }
                    onChange={(newValue) =>
                      handleStepChange(
                        idx,
                        'startTime',
                        newValue ? moment(newValue).format('HH:mm') : ''
                      )
                    }
                    slotProps={{
                      textField: { 
                        size: 'small', 
                        fullWidth: true,
                        InputProps: { sx: { borderRadius: 2 } }
                      },
                    }}
                  />

                  {step.endTime ? (
                    <TimePicker
                      label="End Time"
                      value={step.endTime ? moment(step.endTime, 'HH:mm') : null}
                      onChange={(newValue) =>
                        handleStepChange(
                          idx,
                          'endTime',
                          newValue ? moment(newValue).format('HH:mm') : ''
                        )
                      }
                      slotProps={{
                        textField: { 
                          size: 'small', 
                          fullWidth: true,
                          InputProps: { sx: { borderRadius: 2 } }
                        },
                      }}
                    />
                  ) : (
                    <Button
                      size="small"
                      onClick={() => handleStepChange(idx, 'endTime', '00:00')}
                      sx={{
                        color: selectedTypeInfo.color,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        border: '1px dashed',
                        borderColor: selectedTypeInfo.color,
                        px: 2,
                        flex: 1,
                        '&:hover': {
                          backgroundColor: `${selectedTypeInfo.color}10`,
                          borderColor: selectedTypeInfo.color,
                        }
                      }}
                    >
                      + Add End Time
                    </Button>
                  )}
                </Stack>
              </Stack>
            ))}
          </Box>
        </LocalizationProvider>

        <Button
          startIcon={<Add />}
          size="medium"
          onClick={addStep}
          sx={{
            mb: 3,
            color: selectedTypeInfo.color,
            borderColor: selectedTypeInfo.color,
            borderRadius: 2.5,
            py: 1,
            textTransform: 'none',
            fontWeight: 700,
            borderWidth: '2px',
            '&:hover': {
              borderWidth: '2px',
              backgroundColor: `${selectedTypeInfo.color}10`,
              borderColor: selectedTypeInfo.color,
            },
          }}
          variant="outlined"
          fullWidth
        >
          Add Step to Schedule
        </Button>

        {/* Divider before action buttons */}
        <Divider sx={{ my: 2, borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0' }} />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button 
            onClick={onClose}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b'
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={saveTimeTable} 
            disabled={saving}
            sx={{
              borderRadius: 2.5,
              textTransform: 'none',
              fontWeight: 700,
              px: 4,
              py: 1,
              backgroundColor: selectedTypeInfo.color,
              '&:hover': {
                backgroundColor: selectedTypeInfo.color,
                filter: 'brightness(0.9)',
              },
            }}
          >
            {saving ? (
              <CircularProgress size={20} sx={{ color: 'white' }} />
            ) : (
              'Save Time Table'
            )}
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};

export default TimeTableModal;
