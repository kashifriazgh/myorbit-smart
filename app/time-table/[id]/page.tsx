'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Paper,
  Avatar,
  TextField,
  IconButton,
  Button,
  Chip,
} from '@mui/material';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { TimeTableProps, TimeTableStep } from '@/app/lib/interface';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { TIMETABLE_TYPES, getTimetableTypeInfo } from '@/app/components/time-table/TimeTableModal';

const TimeTableDetail = () => {
  const { id } = useParams(); // get the id from URL
  const { theme } = useCustomTheme();
  const [table, setTable] = useState<TimeTableProps | null>(null);
  const [loading, setLoading] = useState(true);

  // Editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingType, setEditingType] = useState('Learning');
  const [editingSteps, setEditingSteps] = useState<TimeTableStep[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchTable = async () => {
      try {
        const docRef = doc(db, 'timeTables', id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTable({ id: docSnap.id, ...(docSnap.data() as TimeTableProps) });
        } else {
          setTable(null);
        }
      } catch (error) {
        console.error('Error fetching table:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTable();
  }, [id]);

  // Initialize editing state when table data changes
  useEffect(() => {
    if (table) {
      setEditingTitle(table.title);
      setEditingDescription(table.description || '');
      setEditingType(table.type || 'Learning');
      setEditingSteps(table.steps);
    }
  }, [table]);

  // Editing functions
  const startEditing = () => {
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (table) {
      setEditingTitle(table.title);
      setEditingDescription(table.description || '');
      setEditingType(table.type || 'Learning');
      setEditingSteps(table.steps);
    }
    setIsEditing(false);
  };

  const saveChanges = async () => {
    if (!table?.id) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'timeTables', table.id), {
        title: editingTitle,
        description: editingDescription,
        type: editingType,
        steps: editingSteps,
        updatedAt: Timestamp.now(),
      });

      // Update local state
      setTable({
        ...table,
        title: editingTitle,
        description: editingDescription,
        type: editingType,
        steps: editingSteps,
        updatedAt: Timestamp.now(),
      });

      setIsEditing(false);
    } catch (error) {
      console.error('Error updating timetable:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleStepChange = (
    index: number,
    field: 'field1' | 'startTime' | 'endTime',
    value: string
  ) => {
    const newSteps = [...editingSteps];
    newSteps[index][field] = value;
    setEditingSteps(newSteps);
  };

  const addStep = () => {
    setEditingSteps([
      ...editingSteps,
      { field1: '', startTime: '', endTime: '' },
    ]);
  };

  const removeStep = (index: number) => {
    const newSteps = editingSteps.filter((_, i) => i !== index);
    setEditingSteps(
      newSteps.length ? newSteps : [{ field1: '', startTime: '', endTime: '' }]
    );
  };

  if (loading)
    return (
      <Box className="flex justify-center items-center min-h-[300px]">
        <CircularProgress />
      </Box>
    );

  if (!table)
    return (
      <Box p={4} textAlign="center">
        <Typography variant="h6" color="text.secondary">
          No time table found.
        </Typography>
      </Box>
    );

  // Active Type styling
  const activeType = isEditing ? editingType : (table.type || 'Learning');
  const typeInfo = getTimetableTypeInfo(activeType);
  const StepIcon = typeInfo.icon;

  return (
    <LocalizationProvider dateAdapter={AdapterMoment}>
      <Box
        maxWidth="750px"
        mx="auto"
        p={{ xs: 2, md: 4 }}
        sx={{
          backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#ffffff',
          color: theme?.mode === 'dark' ? '#f8fafc' : '#0f172a',
          minHeight: '100vh',
          borderRadius: theme?.mode === 'dark' ? 4 : 0,
          transition: 'all 0.3s ease',
        }}
      >
        {/* Header with Title and Type Chip */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={3}
          gap={2}
        >
          <Box flex={1}>
            {isEditing ? (
              <TextField
                fullWidth
                variant="outlined"
                label="Timetable Title"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                sx={{
                  mb: 1,
                  '& .MuiInputBase-input': {
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    letterSpacing: '-0.025em',
                  },
                }}
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
                  <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: '-0.025em', lineHeight: 1.2 }}>
                    {table.title}
                  </Typography>
                  <Chip
                    icon={<StepIcon sx={{ fontSize: '18px !important', color: `${typeInfo.color} !important` }} />}
                    label={typeInfo.label}
                    sx={{
                      fontWeight: 800,
                      backgroundColor: theme?.mode === 'dark' ? `${typeInfo.color}25` : `${typeInfo.color}15`,
                      color: typeInfo.color,
                      border: '1px solid transparent',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '0.75rem',
                      px: 0.5,
                    }}
                  />
                </Box>
              </Box>
            )}
          </Box>

          <Box sx={{ flexShrink: 0, mt: 0.5 }}>
            {isEditing ? (
              <Stack direction="row" spacing={1}>
                <IconButton
                  onClick={saveChanges}
                  disabled={saving}
                  color="primary"
                  sx={{
                    backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#f1f5f9',
                    '&:hover': { backgroundColor: typeInfo.color, color: 'white' }
                  }}
                >
                  {saving ? <CircularProgress size={20} /> : <SaveIcon />}
                </IconButton>
                <IconButton 
                  onClick={cancelEditing} 
                  disabled={saving}
                  sx={{
                    backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#f1f5f9',
                    '&:hover': { backgroundColor: '#fee2e2', color: '#ef4444' }
                  }}
                >
                  <CancelIcon />
                </IconButton>
              </Stack>
            ) : (
              <IconButton 
                onClick={startEditing} 
                color="primary"
                sx={{
                  backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#f1f5f9',
                  '&:hover': { backgroundColor: typeInfo.color, color: 'white' }
                }}
              >
                <EditIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Timetable Type Switcher when editing */}
        {isEditing && (
          <Box mb={3} sx={{ p: 2, border: '1px solid', borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0', borderRadius: 3, backgroundColor: theme?.mode === 'dark' ? '#1e293b50' : '#f8fafc' }}>
            <Typography fontWeight={700} mb={1.5} variant="subtitle2" sx={{ color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569' }}>
              Change Timetable Type
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                gap: 1,
              }}
            >
              {TIMETABLE_TYPES.map((t) => {
                const IconComponent = t.icon;
                const isSelected = editingType === t.id;
                return (
                  <Box
                    key={t.id}
                    onClick={() => setEditingType(t.id)}
                    sx={{
                      cursor: 'pointer',
                      p: 1.25,
                      borderRadius: 2,
                      border: '2px solid',
                      borderColor: isSelected ? t.color : (theme?.mode === 'dark' ? '#334155' : '#e2e8f0'),
                      backgroundColor: isSelected
                        ? (theme?.mode === 'dark' ? t.bgDark : t.bgLight)
                        : (theme?.mode === 'dark' ? '#1e293b' : '#ffffff'),
                      color: isSelected ? t.color : (theme?.mode === 'dark' ? '#94a3b8' : '#64748b'),
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? `0 2px 8px ${t.color}15` : 'none',
                      '&:hover': {
                        borderColor: t.color,
                        color: t.color,
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    <IconComponent sx={{ fontSize: 18 }} />
                    <Typography variant="caption" fontWeight={700}>
                      {t.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Description */}
        {isEditing ? (
          <TextField
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            label="Description"
            value={editingDescription}
            onChange={(e) => setEditingDescription(e.target.value)}
            placeholder="Add a description for this timetable..."
            sx={{ mb: 4 }}
          />
        ) : (
          table.description && (
            <Typography
              variant="body1"
              sx={{
                mb: 4,
                color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
                fontSize: '1rem',
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              {table.description}
            </Typography>
          )
        )}

        {/* Steps Card */}
        <Paper 
          elevation={0} 
          sx={{ 
            borderRadius: 4, 
            p: { xs: 2, md: 3 },
            border: '1px solid',
            borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0',
            backgroundColor: theme?.mode === 'dark' ? '#1e293b50' : '#f8fafc',
          }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6" fontWeight="800" sx={{ letterSpacing: '-0.015em' }}>
              Schedule Walkthrough
            </Typography>
            {isEditing && (
              <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={addStep}
                variant="outlined"
                sx={{
                  color: typeInfo.color,
                  borderColor: typeInfo.color,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': {
                    borderColor: typeInfo.color,
                    backgroundColor: `${typeInfo.color}10`,
                  }
                }}
              >
                Add Step
              </Button>
            )}
          </Box>
          <Divider sx={{ mb: 3, borderColor: theme?.mode === 'dark' ? '#334155' : '#cbd5e130' }} />

          <Stack spacing={2}>
            {(isEditing ? editingSteps : table.steps).map((step, idx) => (
              <Card
                key={idx}
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: theme?.mode === 'dark' ? '#33415580' : '#e2e8f0',
                  backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#ffffff',
                  boxShadow: '0 2px 4px rgb(0 0 0 / 0.02)',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: '0 4px 8px rgb(0 0 0 / 0.04)',
                    borderColor: typeInfo.color,
                  }
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  {isEditing ? (
                    <Stack spacing={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Step Name *"
                          placeholder="What will you do?"
                          value={step.field1}
                          onChange={(e) =>
                            handleStepChange(idx, 'field1', e.target.value)
                          }
                          InputProps={{ sx: { borderRadius: 2 } }}
                        />
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeStep(idx)}
                          sx={{
                            '&:hover': { backgroundColor: '#fee2e2', color: '#ef4444' }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      <Stack direction="row" spacing={2}>
                        <TimePicker
                          label="Start Time *"
                          value={
                            step.startTime
                              ? moment(step.startTime, 'HH:mm')
                              : null
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
                            value={
                              step.endTime
                                ? moment(step.endTime, 'HH:mm')
                                : null
                            }
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
                            onClick={() =>
                              handleStepChange(idx, 'endTime', '00:00')
                            }
                            sx={{
                              color: typeInfo.color,
                              borderColor: typeInfo.color,
                              borderRadius: 2,
                              fontWeight: 700,
                              textTransform: 'none',
                              border: '1px dashed',
                              flex: 1,
                              '&:hover': {
                                backgroundColor: `${typeInfo.color}10`,
                                borderColor: typeInfo.color,
                              }
                            }}
                          >
                            + Add End Time
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack direction="row" alignItems="center" spacing={2.5}>
                      {/* Colorful category-specific step icon avatar */}
                      <Avatar
                        sx={{ 
                          background: typeInfo.gradient, 
                          color: '#ffffff', 
                          width: 46, 
                          height: 46,
                          boxShadow: `0 4px 12px ${typeInfo.color}35`,
                        }}
                      >
                        <StepIcon sx={{ fontSize: 22 }} />
                      </Avatar>

                      {/* Content */}
                      <Box>
                        <Typography variant="subtitle1" fontWeight="800" sx={{ letterSpacing: '-0.01em', color: theme?.mode === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                          {step.field1}
                        </Typography>
                        <Typography variant="body2" fontWeight="600" color="text.secondary" sx={{ mt: 0.25 }}>
                          {step.startTime}
                          {step.endTime ? ` – ${step.endTime}` : ''}
                        </Typography>
                      </Box>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default TimeTableDetail;
