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
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import { ToDoStep, Todo } from '@/app/lib/interface';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import AddStepModal from '@/app/components/to-do/AddStepModal';
import AddSubStepModal from '@/app/components/to-do/AddSubStepModal';
import TodoHeader from '@/app/components/to-do/todoDetailPage/TodoHeader';
import TodoMetaChips from '@/app/components/to-do/todoDetailPage/ToDoMetaChips';
import TodoProgressBar from '@/app/components/to-do/todoDetailPage/TotDoProgressBar';
import TodoActionButtons from '@/app/components/to-do/todoDetailPage/ToDoActionButtons';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { STATUS_OPTIONS } from '@/app/lib/constant';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import AIStepGeneratorModal from '../../components/to-do/AI/AIStepGeneratorModal';

type ConfirmDelete =
  | { type: 'step'; stepIndex: number }
  | { type: 'sub'; stepIndex: number; subIndex: number }
  | { type: 'todo' }
  | null;

export default function TodoDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const { todos, updateStepStatus, updateSubStepStatus } = useTodoContext();

  const [todo, setTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(true);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);

  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [subStepModalOpen, setSubStepModalOpen] = useState(false);
  const [subStepTargetIndex, setSubStepTargetIndex] = useState<number | null>(
    null
  );

  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [aiStepModalOpen, setAiStepModalOpen] = useState(false);

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

  // Find the current todo from context
  useEffect(() => {
    if (id && todos.length > 0) {
      const foundTodo = todos.find((t) => t.id === id);
      if (foundTodo) {
        const steps = foundTodo.steps || [];
        const progress = calculateProgress(steps);
        setTodo({ ...foundTodo, progressPercent: progress });
        setLoading(false);
      }
    }
  }, [id, todos]);

  // Fallback to direct fetch if not found in context
  useEffect(() => {
    if (id && !todo && todos.length > 0) {
      const fetchTodo = async () => {
        try {
          const snap = await getDoc(doc(db, 'todos', id as string));
          if (snap.exists()) {
            const data = snap.data();
            const steps = data.steps || [];
            const progress = calculateProgress(steps);
            setTodo({
              id: snap.id,
              ...data,
              progressPercent: progress,
            } as Todo);
          }
        } catch {
          console.error('Error fetching todo detail');
        } finally {
          setLoading(false);
        }
      };
      fetchTodo();
    }
  }, [id, todo, todos]);

  useEffect(() => {
    if (todo?.progressPercent === 100 && todo.status !== 'completed') {
      setCompleteConfirmOpen(true);
    }
  }, [todo?.progressPercent, todo?.status]);

  const updateStepsInFirestore = async (updatedSteps: Todo['steps']) => {
    if (!todo?.id) return;

    const progress = calculateProgress(updatedSteps);
    await updateDoc(doc(db, 'todos', todo.id), {
      steps: updatedSteps,
      progressPercent: progress,
    });

    setTodo((prev) =>
      prev ? { ...prev, steps: updatedSteps, progressPercent: progress } : prev
    );
  };

  const updateStepStatusLocal = async (
    stepIndex: number,
    newStatus: string
  ) => {
    if (!todo?.id || !todo.steps) return;

    await updateStepStatus(todo.id, stepIndex, newStatus);

    const updated = [...todo.steps];
    updated[stepIndex].status = newStatus as Todo['steps'][0]['status'];
    updated[stepIndex].done = newStatus === 'completed';

    const progress = calculateProgress(updated);
    setTodo((prev) =>
      prev ? { ...prev, steps: updated, progressPercent: progress } : prev
    );
  };

  const handleTodoUpdate = (updates: Partial<Todo>) => {
    setTodo((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const handleSubStepToggle = async (stepIndex: number, subIndex: number) => {
    if (!todo?.id || !todo.steps) return;

    const updated = [...todo.steps];
    const sub = updated[stepIndex].subSteps?.[subIndex];
    if (!sub) return;

    const newDone = !sub.done;
    sub.done = newDone;
    sub.status = newDone ? 'completed' : 'in_progress';

    await updateSubStepStatus(todo.id, stepIndex, subIndex, newDone);

    const progress = calculateProgress(updated);
    setTodo((prev) =>
      prev ? { ...prev, steps: updated, progressPercent: progress } : prev
    );
  };

  const handleDeleteConfirmed = async () => {
    if (!todo || !confirmDelete) return;
    setIsDeleting(true);
    try {
      if (confirmDelete.type === 'todo') {
        await deleteDoc(doc(db, 'todos', todo.id));
        router.push('/to-do'); // 🔹 Redirect after deleting the task
      } else {
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
      }
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

  const handleAIStepsApply = async (
    aiSteps: { text: string; description?: string }[]
  ) => {
    if (!todo?.steps) return;

    const newSteps = aiSteps.map((aiStep) => ({
      text: aiStep.text,
      description: aiStep.description || '',
      status: 'in_progress' as const,
      done: false,
      subSteps: [],
    }));

    const updatedSteps = [...todo.steps, ...newSteps];
    await updateStepsInFirestore(updatedSteps);
  };

  if (loading)
    return (
      <Box textAlign="center" mt={5}>
        <CircularProgress />
      </Box>
    );

  if (!todo) return <Typography>Task not found.</Typography>;

  return (
    <Box
      mt={4}
      p={2}
      maxWidth="700px"
      mx="auto"
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      {todo.assignee && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            mb: 1,
            gap: 1,
          }}
        >
          <PersonIcon fontSize="small" />
          <Typography variant="subtitle1" fontWeight={700}>
            {todo.assignee}
          </Typography>
        </Box>
      )}

      <TodoHeader title={todo.title} description={todo.description} />

      <Divider sx={{ my: 2 }} />

      <TodoMetaChips todo={todo} onUpdate={handleTodoUpdate} />

      <TodoProgressBar
        progressPercent={todo.progressPercent}
        status={todo.status}
        hasSteps={!!todo.steps?.length}
      />

      <Divider sx={{ my: 2 }} />

      {/* ── Mobile-First Execution Dashboard ── */}
      <Box className="mt-8 space-y-4 px-1">
        <Box className="flex justify-between items-center mb-6 px-2">
          <Typography className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            Step-by-Step Execution
          </Typography>
          <Box className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800">
            <Typography className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-tighter">
              {todo.steps?.filter(s => s.status === 'completed').length || 0} / {todo.steps?.length || 0} Done
            </Typography>
          </Box>
        </Box>

        <Stack spacing={1.5}>
          {todo.steps
            ?.sort((a, b) => {
              if (a.status === 'completed' && b.status !== 'completed') return 1;
              if (a.status !== 'completed' && b.status === 'completed') return -1;
              return 0;
            })
            .map((step, idx) => (
              <Box 
                key={idx}
                className={`
                  overflow-hidden rounded-[20px] border transition-all duration-300 active:scale-[0.98]
                  ${step.status === 'completed' 
                    ? 'bg-slate-50/50 dark:bg-slate-700 border-slate-100 dark:border-slate-600 opacity-80' 
                    : 'bg-white dark:bg-slate-700 border-slate-100 dark:border-slate-600 shadow-sm'}
                `}
              >
                {/* Card Main Area */}
                <Box className="p-3.5 flex items-start gap-3">
                  <Checkbox
                    checked={step.status === 'completed'}
                    onChange={(e) => updateStepStatusLocal(idx, e.target.checked ? 'completed' : 'in_progress')}
                    size="small"
                    className={`p-0 ${step.status === 'completed' ? 'text-teal-500 dark:text-teal-400' : 'text-slate-300 dark:text-slate-400'}`}
                    sx={{ '& .MuiSvgIcon-root': { fontSize: 22 } }}
                  />
                  
                  <Box className="flex-1 min-w-0">
                    <Box className="flex justify-between items-start gap-2">
                      <Typography className={`text-[15px] font-extrabold leading-tight ${step.status === 'completed' ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                        {step.text}
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => setConfirmDelete({ type: 'step', stepIndex: idx })}
                        className="text-slate-300 dark:text-slate-400 hover:text-red-500 p-0.5"
                      >
                        <DeleteIcon sx={{ fontSize: '1.1rem' }} />
                      </IconButton>
                    </Box>

                    {/* Step Badges Row */}
                    <Box className="flex flex-wrap gap-2 mt-2">
                      <Select
                        size="small"
                        value={step.status}
                        onChange={(e) => updateStepStatusLocal(idx, e.target.value)}
                        variant="standard"
                        disableUnderline
                        className={`
                          px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest
                          ${step.status === 'completed' ? 'bg-teal-50 text-teal-600 dark:bg-teal-400/20 dark:text-teal-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300'}
                        `}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <MenuItem key={status.value} value={status.value} className="text-[10px] font-black uppercase tracking-widest">
                            {status.label}
                          </MenuItem>
                        ))}
                      </Select>

                      {step.assignee && (
                        <Box className="bg-slate-50 dark:bg-slate-800/50 px-2.5 py-0.5 rounded-full border border-slate-100 dark:border-slate-600 flex items-center gap-1">
                          <PersonIcon sx={{ fontSize: '0.75rem', color: '#94a3b8' }} />
                          <Typography className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase">{step.assignee}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>

                {/* Sub-steps Detail Panel */}
                <Box className="px-4 pb-4 pt-1.5 bg-slate-50/50 dark:bg-slate-600/20 border-t border-slate-50 dark:border-slate-600">
                  <Box className="space-y-2">
                    {step.subSteps?.map((subStep, subIdx) => (
                      <Box 
                        key={subIdx} 
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-600 border border-slate-100 dark:border-slate-500 active:bg-slate-50"
                        onClick={() => handleSubStepToggle(idx, subIdx)}
                      >
                        <Checkbox
                          checked={subStep.done}
                          onChange={() => handleSubStepToggle(idx, subIdx)}
                          size="small"
                          sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 18 } }}
                          className={subStep.done ? 'text-teal-500 dark:text-teal-400' : 'text-slate-300 dark:text-slate-400'}
                        />
                        <Typography className={`text-[13px] font-bold flex-1 ${subStep.done ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-100'}`}>
                          {subStep.text}
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete({ type: 'sub', stepIndex: idx, subIndex: subIdx });
                          }}
                          className="text-slate-200 dark:text-slate-400 p-0.5"
                        >
                          <DeleteIcon sx={{ fontSize: '0.8rem' }} />
                        </IconButton>
                      </Box>
                    ))}

                    <Button
                      fullWidth
                      variant="text"
                      onClick={() => {
                        setSubStepTargetIndex(idx);
                        setSubStepModalOpen(true);
                      }}
                      className="py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-500 text-[10px] font-black text-slate-400 dark:text-slate-300 hover:text-teal-600 hover:border-teal-200 transition-all uppercase tracking-widest"
                    >
                      + Add Sub-Step
                    </Button>
                  </Box>
                </Box>
              </Box>
            ))}
        </Stack>
      </Box>

      <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={() => setStepModalOpen(true)}>
          + Add Step
        </Button>

        <Button
          variant="outlined"
          startIcon={<AutoAwesomeIcon />}
          onClick={() => setAiStepModalOpen(true)}
          sx={{
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              borderColor: 'primary.dark',
              backgroundColor: 'primary.light',
            },
          }}
        >
          AI Generate Steps
        </Button>

        <Button
          variant="outlined"
          color="error"
          onClick={() => setConfirmDelete({ type: 'todo' })}
        >
          Delete Task
        </Button>
      </Box>

      {/* Add Step Modal */}
      <AddStepModal
        open={stepModalOpen}
        onClose={() => setStepModalOpen(false)}
        onAdd={async (stepData) => {
          if (!todo?.steps) return;
          const newStep: ToDoStep = {
            ...stepData,
            description: stepData.description || '',
            status: 'in_progress',
            done: false,
            subSteps: [],
          };
          const updatedSteps = [...todo.steps, newStep];
          await updateStepsInFirestore(updatedSteps);
          setStepModalOpen(false);
        }}
      />

      {/* Add Sub-step Modal */}
      <AddSubStepModal
        open={subStepModalOpen}
        onClose={() => setSubStepModalOpen(false)}
        onAdd={async (subStepData) => {
          if (!todo?.steps || subStepTargetIndex === null) return;
          const updatedSteps = [...todo.steps];
          if (!updatedSteps[subStepTargetIndex].subSteps) {
            updatedSteps[subStepTargetIndex].subSteps = [];
          }
          updatedSteps[subStepTargetIndex].subSteps!.push({
            ...subStepData,
            description: subStepData.description || '',
            done: false,
            status: 'in_progress',
          });
          await updateStepsInFirestore(updatedSteps);
          setSubStepModalOpen(false);
          setSubStepTargetIndex(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this{' '}
            {confirmDelete?.type === 'todo'
              ? 'task'
              : confirmDelete?.type === 'step'
              ? 'step'
              : 'sub-step'}
            ? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirmed}
            color="error"
            disabled={isDeleting}
          >
            {isDeleting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complete Task Confirmation */}
      <Dialog
        open={completeConfirmOpen}
        onClose={() => setCompleteConfirmOpen(false)}
      >
        <DialogTitle>Task Complete!</DialogTitle>
        <DialogContent>
          <DialogContentText>
            All steps have been completed. Would you like to mark this task as
            complete?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteConfirmOpen(false)}>Not Yet</Button>
          <Button onClick={markTaskAsComplete} variant="contained">
            Mark Complete
          </Button>
        </DialogActions>
      </Dialog>

      <TodoActionButtons todo={todo} user={user!} />

      {/* AI Step Generator Modal */}
      <AIStepGeneratorModal
        open={aiStepModalOpen}
        onClose={() => setAiStepModalOpen(false)}
        onApply={handleAIStepsApply}
        taskTitle={todo.title}
        taskDescription={todo.description}
      />
    </Box>
  );
}
