'use client';
import {
  Box,
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
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useParams } from 'next/navigation';
import { ToDoStep, Todo } from '@/app/lib/interface';
import { useAuth } from '@/app/lib/context/userContext';
import AddStepModal from '@/app/components/to-do/AddStepModal';
import AddSubStepModal from '@/app/components/to-do/AddSubStepModal';
import TodoHeader from '@/app/components/to-do/todoDetailPage/TodoHeader';
import TodoMetaChips from '@/app/components/to-do/todoDetailPage/ToDoMetaChips';
import TodoProgressBar from '@/app/components/to-do/todoDetailPage/TotDoProgressBar';
import TodoActionButtons from '@/app/components/to-do/todoDetailPage/ToDoActionButtons';
import DeleteIcon from '@mui/icons-material/Delete';
import { STATUS_OPTIONS } from '@/app/lib/constant';

type ConfirmDelete =
  | { type: 'step'; stepIndex: number }
  | { type: 'sub'; stepIndex: number; subIndex: number }
  | null;

export default function TodoDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [todo, setTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);

  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [subStepModalOpen, setSubStepModalOpen] = useState(false);
  const [subStepTargetIndex, setSubStepTargetIndex] = useState<number | null>(
    null
  );

  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const calculateProgress = (steps: Todo['steps']) => {
    let completed = 0;
    let total = 0;
    for (const step of steps) {
      total += 1;
      if (step.status === 'completed') completed += 1;
      if (Array.isArray(step.subSteps)) {
        total += step.subSteps.length;
        completed += step.subSteps.filter((s) => s.done).length;
      }
    }
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const fetchTodo = async () => {
    if (!id) return;
    try {
      const snap = await getDoc(doc(db, 'todos', id as string));
      if (snap.exists()) {
        const data = snap.data();
        const steps = data.steps || [];
        const progress = calculateProgress(steps);
        setTodo({ id: snap.id, ...data, progressPercent: progress } as Todo);
      }
    } catch {
      console.error('Error fetching todo detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodo();
  }, [id]);

  useEffect(() => {
    if (todo?.progressPercent === 100 && todo.status !== 'completed') {
      setCompleteConfirmOpen(true);
    }
  }, [todo?.progressPercent]);

  const updateStepsInFirestore = async (updatedSteps: Todo['steps']) => {
    const progress = calculateProgress(updatedSteps);
    await updateDoc(doc(db, 'todos', todo!.id!), {
      steps: updatedSteps,
      progressPercent: progress,
    });
    setTodo((prev) =>
      prev ? { ...prev, steps: updatedSteps, progressPercent: progress } : prev
    );
  };

  const updateStepStatus = async (stepIndex: number, newStatus: string) => {
    if (!todo?.steps) return;
    const updated = [...todo.steps];
    updated[stepIndex].status = newStatus as Todo['steps'][0]['status'];
    await updateStepsInFirestore(updated);
  };

  const handleTodoUpdate = (updates: Partial<Todo>) => {
    setTodo((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const handleSubStepToggle = async (stepIndex: number, subIndex: number) => {
    if (!todo?.steps) return;
    const updated = [...todo.steps];
    const sub = updated[stepIndex].subSteps?.[subIndex];
    if (!sub) return;
    sub.done = !sub.done;
    if (sub.done) sub.status = 'completed';
    await updateStepsInFirestore(updated);
  };

  const handleDeleteConfirmed = async () => {
    if (!todo || !confirmDelete) return;
    setIsDeleting(true);
    try {
      const updated = [...todo.steps];
      if (confirmDelete.type === 'step') {
        updated.splice(confirmDelete.stepIndex, 1);
      } else {
        updated[confirmDelete.stepIndex].subSteps?.splice(
          confirmDelete.subIndex,
          1
        );
      }
      await updateStepsInFirestore(updated);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(null);
    }
  };

  const markTaskAsComplete = async () => {
    if (!todo?.id) return;
    await updateDoc(doc(db, 'todos', todo.id), { status: 'completed' });
    setTodo((prev) => (prev ? { ...prev, status: 'completed' } : prev));
    setCompleteConfirmOpen(false);
  };

  if (loading)
    return (
      <Box textAlign="center" mt={5}>
        <CircularProgress />
      </Box>
    );

  if (!todo) return <Typography>Task not found.</Typography>;

  return (
    <Box mt={4} p={2} maxWidth="700px" mx="auto">
      <TodoHeader title={todo.title} description={todo.description} />

      <Divider sx={{ my: 2 }} />

      <TodoMetaChips todo={todo} onUpdate={handleTodoUpdate} />

      <TodoProgressBar
        progressPercent={todo.progressPercent}
        status={todo.status}
        hasSteps={!!todo.steps?.length}
      />

      <Divider sx={{ my: 2 }} />

      <Stepper activeStep={activeStep} orientation="vertical">
        {todo.steps.map((step, idx) => (
          <Step key={idx} completed={step.status === 'completed'}>
            <StepLabel>
              <Box
                sx={{
                  position: 'relative',
                  '&:hover .step-delete': { opacity: 1 },
                }}
              >
                {`Step ${idx + 1}: ${step.text}`}
                <IconButton
                  className="step-delete"
                  size="small"
                  onClick={() =>
                    setConfirmDelete({ type: 'step', stepIndex: idx })
                  }
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    opacity: 0,
                    transition: 'opacity 0.2s ease-in-out',
                  }}
                >
                  <DeleteIcon fontSize="small" color="error" />
                </IconButton>
              </Box>
            </StepLabel>

            <StepContent>
              {step.description && (
                <Typography
                  variant="caption"
                  sx={{ fontStyle: 'italic', mb: 1 }}
                >
                  {step.description}
                </Typography>
              )}
              {step.subSteps?.map((sub, sidx) => (
                <Box key={sidx} sx={{ ml: 2, mt: 1 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                      position: 'relative',
                      '&:hover .substep-delete': { opacity: 1 },
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={sub.done}
                      onChange={() => handleSubStepToggle(idx, sidx)}
                    />
                    <Typography fontSize={14} fontWeight={500}>
                      Sub Step {sidx + 1}: {sub.text}
                    </Typography>
                    <IconButton
                      className="substep-delete"
                      size="small"
                      onClick={() =>
                        setConfirmDelete({
                          type: 'sub',
                          stepIndex: idx,
                          subIndex: sidx,
                        })
                      }
                      sx={{
                        position: 'absolute',
                        right: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        opacity: 0,
                        transition: 'opacity 0.2s ease-in-out',
                      }}
                    >
                      <DeleteIcon fontSize="small" color="error" />
                    </IconButton>
                  </Stack>
                  {sub.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      fontSize={13}
                      sx={{ ml: 4, mt: 0.5 }}
                    >
                      {sub.description}
                    </Typography>
                  )}
                </Box>
              ))}

              <Stack direction="row" spacing={2} mt={2}>
                <Button
                  size="small"
                  onClick={() => {
                    setSubStepTargetIndex(idx);
                    setSubStepModalOpen(true);
                  }}
                >
                  New Sub Step
                </Button>
                <Select
                  size="small"
                  value={step.status}
                  onChange={(e) => updateStepStatus(idx, e.target.value)}
                  sx={{
                    fontSize: 10,
                    width: 'fit-content',
                    paddingY: 0,
                    '& .MuiSelect-select': {
                      padding: '2px 6px',
                      minHeight: 'unset',
                      display: 'flex',
                      alignItems: 'center',
                    },
                  }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>

              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => setActiveStep((prev) => prev + 1)}
                  disabled={idx === todo.steps.length - 1}
                  sx={{ mt: 1, mr: 1 }}
                >
                  Next
                </Button>
                <Button
                  onClick={() => setActiveStep((prev) => prev - 1)}
                  disabled={idx === 0}
                  sx={{ mt: 1 }}
                >
                  Back
                </Button>
              </Box>
              <Divider />
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {activeStep === (todo.steps?.length || 0) && (
        <Paper square elevation={0} sx={{ p: 2 }}>
          <Typography>All steps completed – nice work!</Typography>
          <Button onClick={() => setActiveStep(0)} sx={{ mt: 1 }}>
            Reset
          </Button>
        </Paper>
      )}

      <Box mt={3}>
        <Button variant="contained" onClick={() => setStepModalOpen(true)}>
          Add New Step
        </Button>
      </Box>

      {todo.notes && (
        <Box mt={2}>
          <Typography variant="h6">Notes</Typography>
          <Typography variant="body2">{todo.notes}</Typography>
        </Box>
      )}

      <TodoActionButtons
        todo={todo}
        user={user!}
        onDeleted={() => {
          // optional
        }}
      />

      {/* Delete step/substep confirmation */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this{' '}
            {confirmDelete?.type === 'step' ? 'step' : 'sub‑step'}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirmed}
            disabled={isDeleting}
            startIcon={
              isDeleting ? (
                <CircularProgress size={18} sx={{ color: '#fff' }} />
              ) : undefined
            }
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step & SubStep Modals */}
      <AddStepModal
        open={stepModalOpen}
        onClose={() => setStepModalOpen(false)}
        onAdd={async ({ text, description }) => {
          if (!todo) return;
          const newStep = {
            text,
            description,
            done: false, // 🔧 Add this line

            status: 'in_progress' as const,
            subSteps: [],
          };
          const updated: ToDoStep[] = [...(todo.steps || []), newStep];
          await updateStepsInFirestore(updated);
        }}
      />

      <AddSubStepModal
        open={subStepModalOpen}
        onClose={() => setSubStepModalOpen(false)}
        onAdd={async ({ text, description }) => {
          if (subStepTargetIndex === null || !todo) return;
          const updated = [...todo.steps];
          (updated[subStepTargetIndex].subSteps ||= []).push({
            text,
            description,
            done: false,
            status: 'in_progress',
          });
          await updateStepsInFirestore(updated);
        }}
      />

      {/* Completion Modal */}
      <Dialog
        open={completeConfirmOpen}
        onClose={() => setCompleteConfirmOpen(false)}
      >
        <DialogTitle>Mark Task as Completed?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            All steps and sub-steps are completed. Mark as completed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteConfirmOpen(false)}>No</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={markTaskAsComplete}
          >
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
