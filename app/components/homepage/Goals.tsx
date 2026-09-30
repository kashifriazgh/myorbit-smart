'use client';

import React, { useMemo, useState } from 'react';
import { Card, Typography, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { useGoals } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { Add, ArrowForward, Edit } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import GoalModal from '../goals/GoalModal';
import { Goal, GoalType } from '../../lib/interface';
import { sortGoalsByPriorityIndex } from '../../lib/utils/goalSorting';

/* ---------- Simple white line icons (64x64) ---------- */
const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const icons: Record<string, React.ReactNode> = {
  family: (
    <>
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      <circle cx="28" cy="16" r="5" fill="currentColor" />
      <circle cx="42" cy="16" r="5" fill="currentColor" />
      <circle cx="54" cy="12" r="5" fill="currentColor" />
      <path {...S} d="M12 22v30M28 24v28M42 24v28M54 22v30M20 40v12M48 40v12" />
    </>
  ),
  bowl: (
    <>
      <path fill="currentColor" d="M6 32h52c0 14-11 24-26 24S6 46 6 32z" />
      <path {...S} d="M20 22c-3-4 3-6 0-12M32 22c-3-4 3-6 0-12M44 22c-3-4 3-6 0-12" />
    </>
  ),
  health: (
    <>
      <path {...S} d="M4 36h12l6-12 8 26 10-38 6 14" />
      <path fill="currentColor" d="M52 56s-10-6-10-12a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 6-10 12-10 12z" />
    </>
  ),
  book: (
    <>
      <path {...S} d="M6 14l24 4v34L6 48zM58 14l-24 4v34l24-4z" />
      <path {...S} d="M30 18h4" />
    </>
  ),
  gender: (
    <>
      <circle {...S} cx="26" cy="26" r="14" />
      <path {...S} d="M26 40v18M16 50h20M36 16l16-12M40 4h12v12M20 24h12M20 30h12" />
    </>
  ),
  water: (
    <>
      <path {...S} d="M12 8h40l-6 30H18zM32 38v18M24 50l8 8 8-8" />
      <path fill="currentColor" d="M32 18c-5 6-6 8-6 11a6 6 0 0 0 12 0c0-3-1-5-6-11z" />
    </>
  ),
  energy: (
    <>
      <circle {...S} cx="32" cy="32" r="12" />
      <path {...S} d="M32 6v8M32 50v8M6 32h8M50 32h8M13 13l6 6M45 45l6 6M13 51l6-6M45 19l6-6" />
    </>
  ),
  work: (
    <>
      <path {...S} d="M6 52l16-18 12 10 24-30" />
      <path {...S} d="M44 14h14v14" />
    </>
  ),
};

const DEFAULT_COLORS = [
  '#E5243B',
  '#DDA63A',
  '#4C9F38',
  '#C5192D',
  '#FF3A21',
  '#26BDE2',
  '#FCC30B',
  '#A21942',
];

export interface DummyGoal extends Partial<Goal> {
  isDummy?: boolean;
  defaultType?: GoalType;
}

export const DEFAULT_DUMMY_GOALS: DummyGoal[] = [
  { id: 'dummy-1', title: 'Save Money', color: '#E5243B', icon: 'family', isDummy: true, defaultType: 'finance' },
  { id: 'dummy-2', title: 'Healthy Lifestyle', color: '#4C9F38', icon: 'health', isDummy: true, defaultType: 'health' },
  { id: 'dummy-3', title: 'Learn New Skill', color: '#C5192D', icon: 'book', isDummy: true, defaultType: 'learning' },
  { id: 'dummy-4', title: 'Career Growth', color: '#A21942', icon: 'work', isDummy: true, defaultType: 'work' },
];

function getGoalIconKey(goal: Partial<Goal>): string {
  if (goal.icon && icons[goal.icon]) return goal.icon;

  const cat = (goal.type || '').toLowerCase();
  const sub = (goal.subcategory || '').toLowerCase();
  const title = (goal.title || '').toLowerCase();

  if (sub.includes('poverty') || sub.includes('family') || sub.includes('savings') || title.includes('poverty') || title.includes('save money')) return 'family';
  if (sub.includes('hunger') || sub.includes('food') || sub.includes('nutrition') || title.includes('hunger')) return 'bowl';
  if (cat === 'health' || sub.includes('health') || sub.includes('fitness') || sub.includes('medical') || sub.includes('weight') || sub.includes('sleep') || title.includes('health') || title.includes('lifestyle')) return 'health';
  if (cat === 'learning' || sub.includes('education') || sub.includes('book') || sub.includes('reading') || sub.includes('course') || title.includes('education') || title.includes('learn')) return 'book';
  if (sub.includes('gender') || sub.includes('equality') || cat === 'personal_growth' || cat === 'lifestyle' || title.includes('gender')) return 'gender';
  if (sub.includes('water') || sub.includes('sanitation') || cat === 'habit' || title.includes('water')) return 'water';
  if (sub.includes('energy') || sub.includes('clean') || cat === 'travel' || title.includes('energy')) return 'energy';
  if (cat === 'work' || cat === 'finance' || sub.includes('work') || sub.includes('income') || sub.includes('growth') || sub.includes('career') || sub.includes('business') || title.includes('work') || title.includes('career')) return 'work';

  return 'work';
}

function getGoalColor(goal: Partial<Goal>, index: number): string {
  if (goal.color) return goal.color;

  const cat = (goal.type || '').toLowerCase();
  switch (cat) {
    case 'finance': return '#E5243B';
    case 'health': return '#4C9F38';
    case 'learning': return '#C5192D';
    case 'habit': return '#26BDE2';
    case 'work': return '#A21942';
    case 'personal_growth': return '#FF3A21';
    case 'travel': return '#FCC30B';
    case 'lifestyle': return '#DDA63A';
    default: return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  }
}

/* ---------- Card Component ---------- */
function GoalCard({
  index,
  goal,
  onClick,
  onEditPriority,
}: {
  index: number;
  goal: DummyGoal;
  onClick?: (goal: DummyGoal) => void;
  onEditPriority?: (goal: Goal) => void;
}) {
  const goalColor = getGoalColor(goal, index - 1);
  const iconKey = getGoalIconKey(goal);

  return (
    <button
      type="button"
      onClick={() => onClick?.(goal)}
      style={{ backgroundColor: goalColor }}
      className="group relative flex aspect-square w-full flex-col overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 text-left text-white transition-all duration-200 active:scale-95 hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 cursor-pointer"
    >
      {/* number + title */}
      <div className="flex items-start gap-2 sm:gap-3 min-h-[3rem] w-full">
        <span className="text-3xl sm:text-4xl md:text-5xl font-bold leading-none tracking-tight shrink-0 [font-family:'Oswald',var(--font-oswald),'Bebas_Neue','Arial_Narrow',sans-serif]">
          {index}
        </span>
        <span
          title={goal.title}
          className="pt-0.5 text-xs sm:text-sm md:text-base font-bold uppercase leading-[1.1] tracking-tight line-clamp-2 overflow-hidden text-ellipsis break-words [font-family:'Oswald',var(--font-oswald),'Bebas_Neue','Arial_Narrow',sans-serif]"
        >
          {goal.title || 'Untitled Goal'}
        </span>
      </div>

      {/* Priority Edit Badge on hover if real user goal */}
      {!goal.isDummy && goal.id && onEditPriority && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onEditPriority(goal as Goal);
          }}
          title="Change priority index"
          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 hover:bg-black/70 p-1.5 rounded-full text-white"
        >
          <Edit sx={{ fontSize: 14 }} />
        </span>
      )}

      {/* icon */}
      <div className="mt-auto flex flex-1 items-center justify-center py-1">
        {goal.img ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={goal.img}
            alt=""
            className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 object-contain drop-shadow-md"
          />
        ) : (
          <svg
            viewBox="0 0 64 64"
            className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 drop-shadow-md"
            aria-hidden="true"
          >
            {icons[iconKey] || icons.work}
          </svg>
        )}
      </div>

      {/* Dummy Goal Action Label/Button */}
      {goal.isDummy && (
        <div className="mt-auto pt-2 w-full">
          <div className="w-full flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-full bg-white/20 group-hover:bg-white/35 backdrop-blur-md text-white font-bold text-[11px] sm:text-xs tracking-wider uppercase transition-all shadow-sm">
            <span>Create It Now</span>
            <Add sx={{ fontSize: 14 }} />
          </div>
        </div>
      )}
    </button>
  );
}

/* ---------- Main Goals Grid Component ---------- */
interface GoalsProps {
  max?: number;
  onSelect?: (goal: Partial<Goal>) => void;
}

export default function Goals({ max = 8, onSelect }: GoalsProps) {
  const { goals, loading, updateGoal } = useGoals();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const router = useRouter();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedDefaultType, setSelectedDefaultType] = useState<GoalType | undefined>(undefined);
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
  const [selectedGoalForPriority, setSelectedGoalForPriority] = useState<Goal | null>(null);
  const [newPriorityIndex, setNewPriorityIndex] = useState<number | ''>('');
  const [savingPriority, setSavingPriority] = useState(false);

  // Filter user goals & sort by priorityIndex or creation date
  const sortedUserGoals = useMemo(() => {
    if (!goals?.length || !user?.uid) return [];
    const activeGoals = goals.filter(
      (g) => g.userId === user.uid && (g.status === 'In Progress' || g.status === 'Not Started')
    );
    return sortGoalsByPriorityIndex(activeGoals);
  }, [goals, user?.uid]);

  const hasUserGoals = sortedUserGoals.length > 0;

  // Display goals: up to 8 real goals when present, OR max 4 dummy goals when empty/unauthenticated
  const displayGoals: DummyGoal[] = useMemo(() => {
    if (hasUserGoals) {
      return sortedUserGoals.slice(0, max);
    }
    // Show max 4 dummy cards when no goals / unauthenticated
    return DEFAULT_DUMMY_GOALS.slice(0, 4);
  }, [sortedUserGoals, hasUserGoals, max]);

  const handleGoalClick = (goal: DummyGoal) => {
    if (onSelect) {
      onSelect(goal);
      return;
    }
    if (goal.id && !goal.isDummy && sortedUserGoals.some((g) => g.id === goal.id)) {
      router.push(`/goals/${goal.id}`);
    } else {
      setSelectedDefaultType(goal.defaultType);
      setCreateModalOpen(true);
    }
  };

  const handleOpenPriorityEdit = (goal: Goal) => {
    setSelectedGoalForPriority(goal);
    setNewPriorityIndex(goal.priorityIndex !== undefined ? goal.priorityIndex : '');
    setPriorityDialogOpen(true);
  };

  const handleSavePriorityIndex = async () => {
    if (!selectedGoalForPriority || !selectedGoalForPriority.id) return;
    setSavingPriority(true);
    try {
      await updateGoal(selectedGoalForPriority.id, {
        priorityIndex: newPriorityIndex === '' ? undefined : Number(newPriorityIndex),
      });
      setPriorityDialogOpen(false);
    } catch (err) {
      console.error('Failed to update goal priority index:', err);
    } finally {
      setSavingPriority(false);
    }
  };

  if (loading) {
    return (
      <Card
        sx={{
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          borderRadius: '1.25rem',
          p: 3,
          border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
        }}
      >
        <Typography variant="h6" className="font-bold mb-4" sx={{ color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a' }}>
          🎯 Goals
        </Typography>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-square w-full rounded-[1.75rem] animate-pulse bg-gray-200 dark:bg-slate-700"
            />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        borderRadius: '1.25rem',
        p: { xs: 2.5, sm: 3 },
        border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Header */}
      <Box className="flex justify-between items-center mb-4 px-1">
        <Box>
          <Typography
            variant="h6"
            className="font-bold"
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
              fontSize: '1.15rem',
            }}
          >
            🎯 Your Goals
          </Typography>
        </Box>
        <Box className="flex items-center gap-2">
          <Button
            variant="outlined"
            size="small"
            startIcon={<Add />}
            onClick={() => {
              setSelectedDefaultType(undefined);
              setCreateModalOpen(true);
            }}
            sx={{
              borderColor: theme?.mode === 'dark' ? '#475569' : '#cbd5e1',
              color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
              fontSize: '0.75rem',
              textTransform: 'none',
              borderRadius: '0.6rem',
              '&:hover': {
                backgroundColor: theme?.mode === 'dark' ? '#334155' : '#f1f5f9',
                borderColor: theme?.mode === 'dark' ? '#64748b' : '#94a3b8',
              },
            }}
          >
            Add Goal
          </Button>
        </Box>
      </Box>

      {/* Grid of goals (4 for dummy, up to 8 for real goals) */}
      <div className={`grid grid-cols-2 ${hasUserGoals ? 'sm:grid-cols-4' : 'sm:grid-cols-4'} gap-3 sm:gap-4`}>
        {displayGoals.map((goal, i) => (
          <GoalCard
            key={goal.id || i}
            index={i + 1}
            goal={goal}
            onClick={handleGoalClick}
            onEditPriority={handleOpenPriorityEdit}
          />
        ))}
      </div>

      {/* Footer navigation */}
      <Box className="flex justify-between items-center mt-4 pt-2">
        {hasUserGoals && sortedUserGoals.length > max ? (
          <Typography variant="caption" sx={{ color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b' }}>
            Showing 8 of {sortedUserGoals.length} goals
          </Typography>
        ) : (
          <div />
        )}
        <Button
          variant="text"
          size="small"
          endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
          onClick={() => router.push('/goals')}
          sx={{
            color: '#3B82F6',
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'none',
          }}
        >
          View All Goals ({sortedUserGoals.length})
        </Button>
      </Box>

      {/* Goal creation modal */}
      <GoalModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultType={selectedDefaultType}
      />

      {/* Priority Index Edit Dialog */}
      <Dialog
        open={priorityDialogOpen}
        onClose={() => setPriorityDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '1rem',
            p: 1,
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
          },
        }}
      >
        <DialogTitle className="font-bold text-lg">Set Goal Priority / Display Index</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b' }}>
            Goals are ordered on your homepage and listing by their priority index (1 = top priority). If empty, position is set by creation date.
          </Typography>
          <TextField
            autoFocus
            label="Priority Index Number"
            type="number"
            fullWidth
            size="small"
            value={newPriorityIndex}
            onChange={(e) => setNewPriorityIndex(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
            placeholder="e.g. 1, 2, 3..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriorityDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingPriority}
            onClick={handleSavePriorityIndex}
            sx={{ textTransform: 'none', backgroundColor: '#3B82F6' }}
          >
            {savingPriority ? 'Saving...' : 'Save Index'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
