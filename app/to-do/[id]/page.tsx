'use client';
import {
  Box,
  Chip,
  Typography,
  CircularProgress,
  Stack,
  Divider,
  IconButton,
  Select,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Paper,
  LinearProgress,
} from '@mui/material';
import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useParams } from 'next/navigation';
import { Todo } from '@/app/lib/interface';
import moment from 'moment-timezone';
import { useAuth } from '@/app/lib/context/userContext';
import DeleteConfirmModal from '@/app/components/global/DeleteConfirmModal';
import PrivacyModal from '@/app/components/global/PrivacyModal';
import OptionModal from '@/app/components/global/LevelModal';
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '@/app/lib/constant';
import DeleteIcon from '@mui/icons-material/Delete';
import PublicIcon from '@mui/icons-material/Public';

export default function TodoDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [todo, setTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [buffer, setBuffer] = useState(10);
  const progressRef = useRef(() => {});

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const fetchTodo = async () => {
    if (!id) return;
    try {
      const snap = await getDoc(doc(db, 'todos', id as string));
      if (snap.exists()) {
        const data = snap.data();
        const steps = data.steps || [];

        const completed = steps.filter((s) => s.status === 'completed').length;
        const total = steps.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        setTodo({ id: snap.id, ...data, progressPercent: progress } as Todo);
      }
    } catch (err) {
      console.error('Error fetching todo detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStepStatus = async (stepIndex: number, newStatus: string) => {
    if (!todo?.steps) return;

    const updatedSteps = [...todo.steps];
    updatedSteps[stepIndex].status = newStatus as Todo['steps'][0]['status'];

    const completed = updatedSteps.filter(
      (s) => s.status === 'completed'
    ).length;
    const total = updatedSteps.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    await updateDoc(doc(db, 'todos', todo.id!), {
      steps: updatedSteps,
      progressPercent: progress,
    });

    setTodo((prev) =>
      prev ? { ...prev, steps: updatedSteps, progressPercent: progress } : prev
    );
  };

  const handleDelete = async () => {
    if (!todo?.id) return;
    await updateDoc(doc(db, 'todos', todo.id), { deleted: true });
    setDeleteOpen(false);
  };

  useEffect(() => {
    fetchTodo();
  }, [id]);

  // Linear progress dummy buffer effect
  useEffect(() => {
    progressRef.current = () => {
      if (!todo?.steps || todo.steps.length === 0) return;
      setBuffer((prev) => (prev < 100 ? prev + 2 + Math.random() * 6 : 100));
    };
  });

  useEffect(() => {
    const timer = setInterval(() => {
      progressRef.current();
    }, 200);
    return () => clearInterval(timer);
  }, [todo?.steps]);

  if (loading) {
    return (
      <Box textAlign="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  if (!todo) return <Typography>Task not found.</Typography>;

  const actualProgress =
    todo.steps?.length > 0
      ? todo.progressPercent
      : todo.status === 'completed'
      ? 100
      : 0;

  return (
    <Box mt={4} p={2} maxWidth="700px" mx="auto">
      <Typography variant="h5" fontWeight="bold">
        {todo.title}
      </Typography>
      <br />
      <Divider />
      <br />

      <Stack
        direction="row"
        spacing={1}
        mt={1}
        flexWrap="wrap"
        useFlexGap
        sx={{ overflowX: 'auto' }}
      >
        {/* Priority Chip */}
        <Chip
          label={`Priority: ${todo.priority}`}
          onClick={() => setPriorityOpen(true)}
          sx={{
            bgcolor:
              todo.priority === 'critical'
                ? '#d32f2f' // red
                : todo.priority === 'urgent'
                ? '#f57c00' // orange
                : todo.priority === 'routine'
                ? '#9e9e9e' // blue
                : '#9e9e9e', // grey
            color: '#fff',
          }}
        />

        {/* Status Chip */}
        <Chip
          label={`Status: ${todo.status}`}
          onClick={() => setStatusOpen(true)}
          sx={{
            bgcolor:
              todo.status === 'completed'
                ? '#2e7d32' // green
                : todo.status === 'in_progress'
                ? '#0288d1' // blue
                : todo.status === 'hold'
                ? '#ffa000' // amber
                : todo.status === 'left-over'
                ? '#6d4c41' // brown
                : '#9e9e9e',
            color: '#fff',
          }}
        />

        {/* Due Date Chip */}
        {todo.dueDate && (
          <Chip
            label={`Due: ${moment((todo.dueDate as Timestamp).toDate()).format(
              'MMM D, YYYY'
            )}`}
            sx={{
              bgcolor: (() => {
                const due = moment((todo.dueDate as Timestamp).toDate());
                const now = moment();
                const diffDays = due.diff(now, 'days');

                if (diffDays <= 0) return '#d32f2f'; // overdue or today
                if (diffDays <= 3) return '#f57c00'; // due soon
                return '#e0e0e0'; // not urgent
              })(),
              color: (() => {
                const due = moment((todo.dueDate as Timestamp).toDate());
                const now = moment();
                const diffDays = due.diff(now, 'days');
                return diffDays <= 3 ? '#fff' : '#000';
              })(),
            }}
          />
        )}
      </Stack>

      {/* Progress Bar */}
      <Box mt={3}>
        <Typography variant="subtitle2" fontWeight="500">
          {todo.progressPercent || 0}%
        </Typography>
        <LinearProgress
          variant="buffer"
          value={actualProgress}
          valueBuffer={buffer}
          sx={{ mt: 1, height: 8, borderRadius: 4 }}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      {todo.steps?.length > 0 && (
        <Box>
          <Stepper activeStep={activeStep} orientation="vertical">
            {todo.steps.map((step, index) => (
              <Step key={index} completed={step.status === 'completed'}>
                <StepLabel>{`Step ${index + 1}: ${step.text}`}</StepLabel>
                <StepContent>
                  <Typography
                    variant="caption"
                    sx={{ fontStyle: 'italic', mb: 1 }}
                  >
                    Dummy description...
                  </Typography>
                  <Select
                    size="small"
                    value={step.status}
                    onChange={(e) => updateStepStatus(index, e.target.value)}
                    sx={{ fontSize: '12px', mt: 1 }}
                  >
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="hold">Hold</MenuItem>
                    <MenuItem value="left-over">Left Over</MenuItem>
                  </Select>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep((prev) => prev + 1)}
                      disabled={index === todo.steps.length - 1}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      Next
                    </Button>
                    <Button
                      disabled={index === 0}
                      onClick={() => setActiveStep((prev) => prev - 1)}
                      sx={{ mt: 1 }}
                    >
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {activeStep === todo.steps.length && (
            <Paper square elevation={0} sx={{ p: 2 }}>
              <Typography>All steps completed - nice work!</Typography>
              <Button onClick={() => setActiveStep(0)} sx={{ mt: 1 }}>
                Reset
              </Button>
            </Paper>
          )}
        </Box>
      )}

      {todo.notes && (
        <Box mt={2}>
          <Typography variant="h6">Notes</Typography>
          <Typography variant="body2">{todo.notes}</Typography>
        </Box>
      )}
      <br />
      <Divider />

      {/* Footer Actions */}
      <Stack direction="row" justifyContent="flex-end" spacing={1} mt={4}>
        <IconButton onClick={() => setPrivacyOpen(true)}>
          <PublicIcon />
        </IconButton>
        <IconButton onClick={() => setDeleteOpen(true)}>
          <DeleteIcon color="error" />
        </IconButton>
      </Stack>

      {/* Modals */}
      {todo && user && (
        <>
          <DeleteConfirmModal
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            onConfirm={handleDelete}
            itemLabel="todo"
          />
          <PrivacyModal
            collectionName="todos"
            open={privacyOpen}
            onClose={() => setPrivacyOpen(false)}
            currentPrivacy={todo.privacy}
            sharedWith={todo.sharedWith}
            docId={todo.id!}
            user={user}
          />
          <OptionModal
            open={priorityOpen}
            onClose={() => setPriorityOpen(false)}
            docId={todo.id!}
            collectionName="todos"
            field="priority"
            currentValue={todo.priority}
            options={PRIORITY_OPTIONS.map((opt) => ({
              key: opt.value,
              label: opt.label,
            }))}
            onChange={(newVal) => {
              setPriorityOpen(false);
              setTodo((prev) =>
                prev
                  ? {
                      ...prev,
                      priority: newVal as 'routine' | 'urgent' | 'critical',
                    }
                  : prev
              );
            }}
          />
          <OptionModal
            open={statusOpen}
            onClose={() => setStatusOpen(false)}
            docId={todo.id!}
            collectionName="todos"
            field="status"
            currentValue={todo.status}
            options={STATUS_OPTIONS.map((opt) => ({
              key: opt.value,
              label: opt.label,
            }))}
            onChange={(newVal) => {
              setStatusOpen(false);
              setTodo((prev) =>
                prev
                  ? {
                      ...prev,
                      status: newVal as
                        | 'in_progress'
                        | 'completed'
                        | 'hold'
                        | 'left-over',
                    }
                  : prev
              );
            }}
          />
        </>
      )}
    </Box>
  );
}
