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
} from '@mui/material';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { TimeTableProps, TimeTableStep } from '@/app/lib/interface';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';

const TimeTableDetail = () => {
  const { id } = useParams(); // get the id from URL
  const [table, setTable] = useState<TimeTableProps | null>(null);
  const [loading, setLoading] = useState(true);

  // Editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
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
        steps: editingSteps,
        updatedAt: Timestamp.now(),
      });

      // Update local state
      setTable({
        ...table,
        title: editingTitle,
        description: editingDescription,
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
      <Box className="flex justify-center items-center min-h-[200px]">
        <CircularProgress />
      </Box>
    );

  if (!table)
    return (
      <Typography variant="body1" color="text.secondary">
        No time table found.
      </Typography>
    );

  return (
    <LocalizationProvider dateAdapter={AdapterMoment}>
      <Box maxWidth="700px" mx="auto" p={2}>
        {/* Header with Edit Button */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Box flex={1}>
            {isEditing ? (
              <TextField
                fullWidth
                variant="outlined"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: '2rem',
                    fontWeight: 'bold',
                  },
                }}
              />
            ) : (
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {table.title}
              </Typography>
            )}
          </Box>

          <Box ml={2}>
            {isEditing ? (
              <Stack direction="row" spacing={1}>
                <IconButton
                  onClick={saveChanges}
                  disabled={saving}
                  color="primary"
                >
                  {saving ? <CircularProgress size={20} /> : <SaveIcon />}
                </IconButton>
                <IconButton onClick={cancelEditing} disabled={saving}>
                  <CancelIcon />
                </IconButton>
              </Stack>
            ) : (
              <IconButton onClick={startEditing} color="primary">
                <EditIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Description */}
        {isEditing ? (
          <TextField
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={editingDescription}
            onChange={(e) => setEditingDescription(e.target.value)}
            placeholder="Add a description..."
            sx={{ mb: 3 }}
          />
        ) : (
          (table.description || isEditing) && (
            <Typography
              variant="body1"
              color="text.secondary"
              gutterBottom
              sx={{ mb: 3 }}
            >
              {table.description || 'No description'}
            </Typography>
          )
        )}

        {/* Steps */}
        <Paper elevation={2} className="rounded-xl p-4">
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6" fontWeight="bold">
              Time Table
            </Typography>
            {isEditing && (
              <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={addStep}
                variant="outlined"
              >
                Add Step
              </Button>
            )}
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Stack spacing={2}>
            {(isEditing ? editingSteps : table.steps).map((step, idx) => (
              <Card
                key={idx}
                className="rounded-lg shadow-sm border border-gray-100"
              >
                <CardContent>
                  {isEditing ? (
                    <Stack spacing={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Step name *"
                          value={step.field1}
                          onChange={(e) =>
                            handleStepChange(idx, 'field1', e.target.value)
                          }
                        />
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeStep(idx)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      <Stack direction="row" spacing={1}>
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
                            textField: { size: 'small', fullWidth: true },
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
                              textField: { size: 'small', fullWidth: true },
                            }}
                          />
                        ) : (
                          <Button
                            size="small"
                            onClick={() =>
                              handleStepChange(idx, 'endTime', '00:00')
                            }
                            variant="outlined"
                          >
                            + Add End Time
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack direction="row" alignItems="center" spacing={2}>
                      {/* Icon */}
                      <Avatar
                        sx={{ bgcolor: 'primary.light', width: 48, height: 48 }}
                      >
                        <CalendarTodayIcon color="primary" />
                      </Avatar>

                      {/* Content */}
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {step.field1}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
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
