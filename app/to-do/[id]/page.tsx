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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
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

// --- Premium UI Helper Components ---

function Checkmark({
  done,
  onToggle,
  size = 'md',
  isDark,
}: {
  done: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
  isDark: boolean;
}) {
  const base = size === 'sm' ? 'w-5 h-5 rounded-md' : 'w-6 h-6 rounded-lg';
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={done ? 'Mark as not done' : 'Mark as done'}
      className={`
        flex-shrink-0 ${base} border-2 transition-all duration-200 flex items-center justify-center
        focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1
        ${
          done
            ? 'bg-indigo-500 border-indigo-500 shadow-sm shadow-indigo-200'
            : isDark
            ? 'border-slate-600 bg-slate-800 hover:border-indigo-400 hover:bg-slate-700'
            : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50'
        }
      `}
    >
      {done && (
        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 12 10" fill="none">
          <path
            d="M1 5l3.5 3.5L11 1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function SubStepRow({
  sub,
  onToggle,
  onDelete,
  isDark,
}: {
  sub: { done?: boolean; text: string; status?: string };
  onToggle: () => void;
  onDelete: () => void;
  isDark: boolean;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`flex items-center gap-3 px-3 py-2 rounded-xl border-2 border-red-200 dark:border-red-900/30 ${
          isDark ? 'bg-red-900/10' : 'bg-red-50'
        }`}
      >
        <span className="text-[11px] font-black text-red-600 uppercase tracking-widest flex-1">
          Delete?
        </span>
        <button
          onClick={() => {
            setIsConfirming(false);
            onDelete();
          }}
          className="text-[11px] font-black text-red-600 uppercase tracking-widest hover:underline"
        >
          Confirm
        </button>
        <div className={`w-px h-4 ${isDark ? 'bg-red-900/30' : 'bg-red-200'}`} />
        <button
          onClick={() => setIsConfirming(false)}
          className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-600"
        >
          Cancel
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      exit={{ opacity: 0, x: -20 }}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 group
        ${sub.done ? 'opacity-60' : ''}
        ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}
      `}
    >
      <Checkmark done={sub.done} onToggle={onToggle} size="sm" isDark={isDark} />
      <span
        onClick={onToggle}
        className={`flex-1 text-sm font-medium transition-all duration-150 cursor-pointer ${
          sub.done
            ? 'line-through text-slate-400'
            : isDark
            ? 'text-slate-300'
            : 'text-slate-600'
        }`}
      >
        {sub.text}
      </span>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          setIsConfirming(true);
        }}
        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500 p-0.5"
      >
        <DeleteIcon sx={{ fontSize: '1rem' }} />
      </IconButton>
    </motion.div>
  );
}

function AddSubStepRow({ onAdd, isDark }: { onAdd: (text: string) => void; isDark: boolean }) {
  const [active, setActive] = useState(false);
  const [val, setVal] = useState('');

  const commit = () => {
    if (val.trim()) {
      onAdd(val.trim());
      setVal('');
    }
    setActive(false);
  };

  if (!active)
    return (
      <button
        onClick={() => setActive(true)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-150 w-full text-left
          focus:outline-none focus:ring-2 focus:ring-indigo-300
          ${
            isDark
              ? 'text-slate-500 hover:text-indigo-400 hover:bg-slate-800/50'
              : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'
          }
        `}
      >
        <span
          className={`w-5 h-5 rounded-md border-2 border-dashed flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
            isDark ? 'border-slate-700' : 'border-slate-300'
          }`}
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1v10M1 6h10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
        Add sub-step
      </button>
    );

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="w-5 h-5 rounded-md border-2 border-indigo-400 flex-shrink-0" />
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setActive(false);
            setVal('');
          }
        }}
        onBlur={commit}
        placeholder="Sub-step title…"
        className={`
          flex-1 text-sm bg-transparent border-b-2 border-indigo-400
          focus:outline-none placeholder:text-slate-500 pb-0.5
          ${isDark ? 'text-slate-200' : 'text-slate-700'}
        `}
      />
    </div>
  );
}

function StepCard({
  step,
  index,
  onToggleStep,
  onToggleSubStep,
  onAddSubStep,
  onDeleteStep,
  onDeleteSubStep,
  onStatusChange,
  isDark,
}: {
  step: ToDoStep;
  index: number;
  onToggleStep: (status: string) => void;
  onToggleSubStep: (subIndex: number) => void;
  onAddSubStep: (text: string) => void;
  onDeleteStep: () => void;
  onDeleteSubStep: (subIndex: number) => void;
  onStatusChange: (status: string) => void;
  isDark: boolean;
}) {
  const [expanded, setExpanded] = useState(!step.done);
  const subSteps = step.subSteps || [];
  const total = subSteps.length;
  const completed = subSteps.filter((s: { done?: boolean }) => s.done).length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div
      className={`
        relative rounded-2xl border transition-all duration-300
        ${
          isDark
            ? step.status === 'completed'
              ? 'bg-slate-800/50 border-slate-700 opacity-75'
              : 'bg-slate-800 border-slate-700 shadow-lg'
            : step.status === 'completed'
            ? 'bg-slate-50/50 border-slate-200 opacity-75 shadow-sm'
            : 'bg-white border-slate-200 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12)]'
        }
      `}
    >
      {/* Step number ribbon */}
      <div
        className={`
          absolute -left-px top-4 w-1 h-8 rounded-r-full transition-colors duration-300
          ${step.status === 'completed' ? 'bg-slate-400' : 'bg-indigo-500'}
        `}
      />

      {/* Header */}
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        {/* Index badge */}
        <span
          className={`
            flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5
            transition-colors duration-300
            ${
              step.status === 'completed'
                ? isDark
                  ? 'bg-slate-700 text-slate-500'
                  : 'bg-slate-100 text-slate-400'
                : isDark
                ? 'bg-indigo-900/30 text-indigo-400'
                : 'bg-indigo-50 text-indigo-600'
            }
          `}
        >
          {index + 1}
        </span>

        {/* Title + description */}
        <div className="flex-1 min-w-0" onClick={() => setExpanded((e) => !e)}>
          <h3
            className={`
              font-semibold text-[15px] leading-snug cursor-pointer transition-colors duration-150
              ${
                step.status === 'completed'
                  ? 'line-through text-slate-400'
                  : isDark
                  ? 'text-slate-100'
                  : 'text-slate-800'
              }
            `}
          >
            {step.text}
          </h3>
          {step.description && step.status !== 'completed' && (
            <p
              className={`text-xs mt-0.5 leading-relaxed line-clamp-2 ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {step.description}
            </p>
          )}

          {/* Status & Assignee badges */}
          <div className="flex items-center gap-2 mt-2">
            <Select
              size="small"
              value={step.status}
              onChange={(e) => onStatusChange(e.target.value)}
              variant="standard"
              disableUnderline
              onClick={(e) => e.stopPropagation()}
              className={`
                px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest
                ${
                  step.status === 'completed'
                    ? isDark
                      ? 'bg-teal-400/10 text-teal-400'
                      : 'bg-teal-50 text-teal-600'
                    : isDark
                    ? 'bg-blue-400/10 text-blue-300'
                    : 'bg-blue-50 text-blue-600'
                }
              `}
            >
              {STATUS_OPTIONS.map((status) => (
                <MenuItem
                  key={status.value}
                  value={status.value}
                  className="text-[10px] font-black uppercase tracking-widest"
                >
                  {status.label}
                </MenuItem>
              ))}
            </Select>

            {step.assignee && (
              <Box
                className={`px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                }`}
              >
                <PersonIcon sx={{ fontSize: '0.7rem', color: '#94a3b8' }} />
                <Typography
                  className={`text-[9px] font-bold uppercase ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {step.assignee}
                </Typography>
              </Box>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteStep();
            }}
            className={`hover:text-red-500 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}
          >
            <DeleteIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>

          {(total > 0 || step.status !== 'completed') && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 focus:outline-none ${
                isDark
                  ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <Checkmark
            done={step.status === 'completed'}
            onToggle={() =>
              onToggleStep(step.status === 'completed' ? 'in_progress' : 'completed')
            }
            isDark={isDark}
          />
        </div>
      </div>

      {/* Progress bar (when has substeps) */}
      {total > 0 && (
        <div className="px-5 pb-2">
          <div className="flex items-center gap-2">
            <div
              className={`flex-1 h-1.5 rounded-full overflow-hidden ${
                isDark ? 'bg-slate-700' : 'bg-slate-100'
              }`}
            >
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-400 tabular-nums">
              {completed}/{total}
            </span>
          </div>
        </div>
      )}

      {/* Sub-steps body */}
      {expanded && (
        <div className="px-2 pb-3">
          <div
            className={`mx-3 mb-1 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
          />
          <div className="space-y-0.5">
            <AnimatePresence mode="popLayout">
              {subSteps.map((sub: { text: string; done?: boolean; status?: string }, sIdx: number) => (
                <SubStepRow
                  key={sub.text + sIdx}
                  sub={sub}
                  isDark={isDark}
                  onToggle={() => onToggleSubStep(sIdx)}
                  onDelete={() => onDeleteSubStep(sIdx)}
                />
              ))}
            </AnimatePresence>
            <AddSubStepRow isDark={isDark} onAdd={(text) => onAddSubStep(text)} />
          </div>
        </div>
      )}
    </div>
  );
}

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

    // --- Optimistic UI Update ---
    const updated = [...todo.steps];
    updated[stepIndex] = {
      ...updated[stepIndex],
      status: newStatus as ToDoStep['status'],
      done: newStatus === 'completed',
    };

    const progress = calculateProgress(updated);
    setTodo((prev) =>
      prev ? { ...prev, steps: updated, progressPercent: progress } : prev
    );

    // Context & Firestore update
    await updateStepStatus(todo.id, stepIndex, newStatus);
  };

  const handleTodoUpdate = (updates: Partial<Todo>) => {
    setTodo((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const handleSubStepToggle = async (stepIndex: number, subIndex: number) => {
    if (!todo?.id || !todo.steps) return;

    const updated = [...todo.steps];
    const step = { ...updated[stepIndex] };
    const subSteps = [...(step.subSteps || [])];
    const sub = { ...subSteps[subIndex] };

    const newDone = !sub.done;
    sub.done = newDone;
    sub.status = newDone ? 'completed' : 'in_progress';

    subSteps[subIndex] = sub;
    step.subSteps = subSteps;
    updated[stepIndex] = step;

    // --- Optimistic UI Update ---
    const progress = calculateProgress(updated);
    setTodo((prev) =>
      prev ? { ...prev, steps: updated, progressPercent: progress } : prev
    );

    await updateSubStepStatus(todo.id, stepIndex, subIndex, newDone);
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
        <Box className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-widest uppercase text-indigo-500">
              Execution
            </span>
            <span
              className={`flex-1 h-px ${
                theme?.mode === 'dark' ? 'bg-slate-800' : 'bg-indigo-100'
              }`}
            />
          </div>
          <h1
            className={`text-3xl font-bold leading-tight ${
              theme?.mode === 'dark' ? 'text-slate-100' : 'text-slate-800'
            }`}
          >
            Step-by-Step
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {todo.steps?.filter((s) => s.status === 'completed').length || 0} of{' '}
            {todo.steps?.length || 0} steps completed
          </p>
        </Box>

        <Stack spacing={2}>
          <AnimatePresence mode="popLayout">
            {todo.steps
              ?.map((step, originalIndex) => ({ ...step, originalIndex }))
              .sort((a, b) => {
                if (a.status === 'completed' && b.status !== 'completed') return 1;
                if (a.status !== 'completed' && b.status === 'completed') return -1;
                return 0;
              })
              .map((step) => (
                <motion.div
                  key={step.text}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                    opacity: { duration: 0.2 },
                  }}
                >
                  <StepCard
                    step={step}
                    index={step.originalIndex}
                    isDark={theme?.mode === 'dark'}
                    onToggleStep={(newStatus) =>
                      updateStepStatusLocal(step.originalIndex, newStatus)
                    }
                    onStatusChange={(newStatus) =>
                      updateStepStatusLocal(step.originalIndex, newStatus)
                    }
                    onToggleSubStep={(subIdx) =>
                      handleSubStepToggle(step.originalIndex, subIdx)
                    }
                    onDeleteStep={() =>
                      setConfirmDelete({ type: 'step', stepIndex: step.originalIndex })
                    }
                    onDeleteSubStep={async (subIdx) => {
                      if (!todo?.steps) return;
                      // Optimistic UI Update
                      const updated = [...todo.steps];
                      updated[step.originalIndex].subSteps?.splice(subIdx, 1);
                      const progress = calculateProgress(updated);
                      setTodo((prev) =>
                        prev ? { ...prev, steps: updated, progressPercent: progress } : prev
                      );
                      // Firestore update
                      await updateStepsInFirestore(updated);
                    }}
                    onAddSubStep={async (text) => {
                      const updatedSteps = [...(todo.steps || [])];
                      if (!updatedSteps[step.originalIndex].subSteps) {
                        updatedSteps[step.originalIndex].subSteps = [];
                      }
                      updatedSteps[step.originalIndex].subSteps!.push({
                        text,
                        description: '',
                        done: false,
                        status: 'in_progress',
                      });
                      await updateStepsInFirestore(updatedSteps);
                    }}
                  />
                </motion.div>
              ))}
          </AnimatePresence>
        </Stack>

        {/* All done state celebration */}
        {todo.steps?.length > 0 &&
          todo.steps.every((s) => s.status === 'completed') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-12 text-center py-8"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-200 dark:shadow-none">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 20" fill="none">
                  <path
                    d="M2 10l7 7L22 2"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2
                className={`text-xl font-bold ${
                  theme?.mode === 'dark' ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                All steps complete!
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Great work on finishing this task 🎉
              </p>
            </motion.div>
          )}
      </Box>

      <Box sx={{ mt: 6, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button
          variant="outlined"
          startIcon={<AutoAwesomeIcon />}
          onClick={() => setAiStepModalOpen(true)}
          sx={{
            borderRadius: '14px',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            px: 3,
            py: 1.5,
            borderColor: '#e2e8f0',
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#475569',
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#f8fafc',
            '&:hover': {
              borderColor: '#6366f1',
              backgroundColor: theme?.mode === 'dark' ? '#334155' : '#eff6ff',
              color: '#6366f1',
            },
          }}
        >
          AI Generate
        </Button>

        <IconButton
          onClick={() => setConfirmDelete({ type: 'todo' })}
          sx={{
            color: '#f43f5e',
            backgroundColor: theme?.mode === 'dark' ? '#451225' : '#fff1f2',
            borderRadius: '14px',
            p: 1.5,
            '&:hover': { backgroundColor: '#ffe4e6' },
          }}
        >
          <DeleteIcon />
        </IconButton>
      </Box>

      {/* Floating Action Button for Adding Steps */}
      <motion.div
        className="fixed bottom-8 right-8 z-50"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Button
          variant="contained"
          onClick={() => setStepModalOpen(true)}
          sx={{
            minWidth: '56px',
            height: '56px',
            borderRadius: '18px',
            backgroundColor: '#6366f1',
            boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)',
            '&:hover': { backgroundColor: '#4f46e5' },
          }}
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </Button>
      </motion.div>

      {/* Add Step Modal */}
      <AddStepModal
        open={stepModalOpen}
        onClose={() => setStepModalOpen(false)}
        onAdd={async (stepData) => {
          if (!todo?.steps) return;
          const updatedSteps = [
            ...todo.steps,
            {
              ...stepData,
              done: false,
              status: 'in_progress',
            },
          ] as ToDoStep[];
          await updateStepsInFirestore(updatedSteps);
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
