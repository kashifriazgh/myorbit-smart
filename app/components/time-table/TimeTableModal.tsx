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
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';

interface Props {
  open: boolean;
  onClose: () => void;
  editData?: TimeTableProps;
}

const TimeTableModal = ({ open, onClose, editData }: Props) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<TimeTableStep[]>([
    { field1: '', startTime: '', endTime: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const isDesktop = useMediaQuery('(min-width:768px)');

  useEffect(() => {
    if (editData) {
      setTitle(editData.title);
      setDescription(editData.description || '');
      setSteps(
        editData.steps.length
          ? editData.steps
          : [{ field1: '', startTime: '', endTime: '' }]
      );
    } else {
      setTitle('');
      setDescription('');
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
          p: 2,
          mx: 'auto',
          mt: isDesktop ? 8 : 0, // small margin on desktop for breathing room
          width: isDesktop ? '600px' : '100%', // narrower on desktop
          height: isDesktop ? 'auto' : '100vh', // full height only on mobile
          maxHeight: '90vh', // prevent overflow on desktop
          overflowY: 'auto',
          backgroundColor: 'background.paper',
          borderRadius: isDesktop ? 2 : 0, // rounded only on desktop
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Title Heading */}
        <Typography variant="h5" fontWeight={700} mb={2}>
          {editData ? 'Edit Time Table' : 'Create Time Table'}
        </Typography>

        {/* Title field (narrow on desktop) */}
        <TextField
          fullWidth={!isDesktop}
          sx={isDesktop ? { width: '60%', mb: 2 } : { mb: 2 }}
          size="small"
          label="Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <TextField
          fullWidth
          size="small"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Typography fontWeight={500} mb={1}>
          Steps
        </Typography>

        <LocalizationProvider dateAdapter={AdapterMoment}>
          {steps.map((step, idx) => (
            <Stack
              key={idx}
              spacing={1}
              mb={2}
              p={1.5}
              sx={{ border: '1px solid #eee', borderRadius: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Step name *"
                  value={step.field1}
                  onChange={(e) =>
                    handleStepChange(idx, 'field1', e.target.value)
                  }
                  fullWidth
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeStep(idx)}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>

              <Stack direction="row" spacing={1}>
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
                    textField: { size: 'small', fullWidth: true },
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
                      textField: { size: 'small', fullWidth: true },
                    }}
                  />
                ) : (
                  <Button
                    size="small"
                    onClick={() => handleStepChange(idx, 'endTime', '00:00')}
                  >
                    + Add End Time
                  </Button>
                )}
              </Stack>
            </Stack>
          ))}
        </LocalizationProvider>

        <Button
          startIcon={<Add />}
          size="small"
          onClick={addStep}
          sx={{ mb: 2 }}
        >
          Add Step
        </Button>

        {/* Divider before action buttons */}
        <Divider sx={{ my: 2 }} />

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={saveTimeTable} disabled={saving}>
            {saving ? (
              <CircularProgress size={18} sx={{ color: 'white' }} />
            ) : (
              'Save'
            )}
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};

export default TimeTableModal;
