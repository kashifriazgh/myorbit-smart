'use client';

import React, { useState } from 'react';
import { Point } from '@/app/lib/interface';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { useGoals } from '@/app/lib/context/GoalsContext';
import { 
  Delete as DeleteIcon,
  CalendarToday as CalendarIcon,
  Timer as TimerIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircleOutline as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { Box, Typography, IconButton, LinearProgress, useMediaQuery, useTheme } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import moment from 'moment';
import { toDateSafe } from '@/app/lib/utilts';

interface PointRowProps {
  point: Point;
  onDelete: (pointId: string) => void;
  onUpdate?: (updates: Partial<Point>) => void;
}

const PointRow: React.FC<PointRowProps> = ({ point, onDelete, onUpdate }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { todos, updateTodo } = useTodoContext();
  const { allSchedules } = useSchedules();
  const { goals, updateGoal } = useGoals();
  const [isExpanded, setIsExpanded] = useState(false);

  const getColorClasses = (scheme?: string) => {
    switch (scheme) {
      case 'success': return { border: '#10b981', text: '#065f46', bg: '#ecfdf5', darkBg: '#064e3b', darkText: '#d1fae5' };
      case 'warning': return { border: '#f59e0b', text: '#92400e', bg: '#fffbeb', darkBg: '#78350f', darkText: '#fef3c7' };
      case 'error': return { border: '#ef4444', text: '#991b1b', bg: '#fef2f2', darkBg: '#7f1d1d', darkText: '#fee2e2' };
      case 'info': return { border: '#0ea5e9', text: '#075985', bg: '#f0f9ff', darkBg: '#0c4a6e', darkText: '#e0f2fe' };
      case 'grey': return { border: '#94a3b8', text: '#1e293b', bg: '#f8fafc', darkBg: '#334155', darkText: '#f1f5f9' };
      default: return { border: '#7c3aed', text: '#6b21a8', bg: '#faf5ff', darkBg: '#4c1d95', darkText: '#ede9fe' };
    }
  };

  const renderContent = () => {
    switch (point.type) {
      case 'string': {
        const colors = getColorClasses(point.colorScheme);
        return (
          <Box 
            className="py-4 px-4 my-2 rounded-xl border-l-[4px] shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-slate-900"
            sx={{ 
              borderColor: colors.border, 
              bgcolor: { xs: undefined, sm: colors.bg },
              '&.dark': { bgcolor: colors.darkBg }
            }}
          >
            <Typography variant="body2" className="text-slate-800 dark:text-slate-200" sx={{ fontSize: '15px', lineHeight: 1.6, fontWeight: 500 }}>
              {point.content}
            </Typography>
          </Box>
        );
      }

      case 'todo': {
        const todo = todos.find((t) => t.id === point.todoId);
        if (!todo) return <Typography variant="caption" className="text-slate-400 dark:text-slate-500 italic p-4 block">Todo not found</Typography>;
        
        const isDone = todo.status === 'completed';
        const accent = "#4f46e5";
        const dueDate = toDateSafe(todo.dueDate);

        return (
          <Box className="flex items-start gap-4 py-4 px-4 my-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group/todo">
            <Box 
              onClick={(e) => {
                e.stopPropagation();
                updateTodo(todo.id!, { status: isDone ? 'in_progress' : 'completed' });
              }}
              sx={{ 
                width: 22, height: 22, borderRadius: '6px', 
                border: `2px solid ${isDone ? accent : "#cbd5e1"}`,
                bgcolor: isDone ? accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: 'pointer', flexShrink: 0,
                mt: 0.5,
                transition: 'all 0.2s'
              }}
            >
              {isDone && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </Box>
            <Box className="flex-1">
              <Typography 
                variant="body1" 
                className="text-slate-900 dark:text-slate-100"
                sx={{ 
                  fontSize: '15px', 
                  color: isDone ? "#94a3b8" : undefined, 
                  textDecoration: isDone ? "line-through" : "none",
                  fontWeight: 600,
                  mb: 0.5
                }}
              >
                {todo.title}
              </Typography>
              {dueDate && (
                <Box className="flex items-center gap-1.5 opacity-70">
                  <CalendarIcon sx={{ fontSize: 14, color: isDone ? "#94a3b8" : "#6366f1" }} />
                  <Typography variant="caption" className="text-slate-600 dark:text-slate-400" sx={{ fontSize: '12px', fontWeight: 500 }}>
                    Due: {moment(dueDate).format('MMM DD, YYYY')}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        );
      }

      case 'schedule': {
        const schedule = allSchedules.find((s) => s.id === point.scheduleId);
        if (!schedule) return <Typography variant="caption" className="text-slate-400 dark:text-slate-500 italic p-4 block">Schedule not found</Typography>;
        const accent = "#0891b2";

        return (
          <Box className="flex items-center gap-4 py-4 px-4 my-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
            <Box sx={{ p: 1, bgcolor: `${accent}10`, borderRadius: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </Box>
            <Box>
              <Typography variant="body1" className="text-slate-900 dark:text-slate-100" sx={{ fontSize: '15px', fontWeight: 600 }}>
                {schedule.title}
              </Typography>
              <Box className="flex items-center gap-2 mt-0.5 opacity-70">
                <TimerIcon sx={{ fontSize: 14, color: accent }} />
                <Typography variant="caption" className="text-slate-600 dark:text-slate-400" sx={{ fontSize: '12px', fontWeight: 500 }}>
                  {moment(schedule.date).format('MMM DD')} • {schedule.startTime} {schedule.endTime ? ` - ${schedule.endTime}` : ''}
                </Typography>
              </Box>
            </Box>
          </Box>
        );
      }

      case 'goal': {
        const goal = goals.find((g) => g.id === point.goalId);
        if (!goal) return <Typography variant="caption" className="text-slate-400 dark:text-slate-500 italic p-4 block">Goal not found</Typography>;

        const isCompleted = goal.status === 'Completed';
        const accent = "#059669";
        const progress = goal.progress || 0;

        return (
          <Box className="flex flex-col gap-3 py-4 px-4 my-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
            <Box className="flex items-center gap-4">
              <Box 
                onClick={(e) => {
                  e.stopPropagation();
                  updateGoal(goal.id!, { status: isCompleted ? 'In Progress' : 'Completed' });
                }}
                sx={{ 
                  width: 22, height: 22, borderRadius: '50%', 
                  border: `2px solid ${isCompleted ? accent : "#cbd5e1"}`,
                  bgcolor: isCompleted ? accent : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: 'pointer', flexShrink: 0,
                  transition: 'all 0.2s'
                }}
              >
                {isCompleted && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                )}
              </Box>
              <Typography 
                variant="body1" 
                className="flex-1 text-slate-900 dark:text-slate-100"
                sx={{ 
                  fontSize: '15px', 
                  color: isCompleted ? "#94a3b8" : undefined, 
                  textDecoration: isCompleted ? "line-through" : "none",
                  fontWeight: 700
                }}
              >
                {goal.title}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '11px', fontWeight: 900, color: accent, 
                  border: `1.5px solid ${accent}44`, padding: "2px 10px", borderRadius: '20px',
                  letterSpacing: '0.5px', textTransform: 'uppercase'
                }}
              >
                Goal
              </Typography>
            </Box>

            <Box sx={{ pl: 6.5 }}>
              <Box className="flex justify-between items-center mb-1.5">
                <Typography variant="caption" className="text-slate-500 dark:text-slate-400" sx={{ fontSize: '11px', fontWeight: 600 }}>
                  {goal.overallTargetValue ? `Target: ${goal.overallTargetValue} ${goal.overallTargetUnit || ''}` : `Deadline: ${moment(toDateSafe(goal.dueDate)).format('MMM DD')}`}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '11px', color: accent, fontWeight: 800 }}>
                  {progress}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ 
                  height: 6, 
                  borderRadius: 3,
                  bgcolor: `${accent}15`,
                  '& .MuiLinearProgress-bar': {
                    bgcolor: accent,
                    borderRadius: 3
                  }
                }} 
              />
            </Box>
          </Box>
        );
      }

      case 'keyvalue': {
        const accent = "#db2777";
        return (
          <Box className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-4 px-4 my-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
            <Typography variant="body2" className="text-slate-500 dark:text-slate-400" sx={{ fontSize: '15px', fontWeight: 600, minWidth: '80px' }}>
              {point.key}:
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                fontSize: '15px', fontWeight: 700, color: accent, 
                bgcolor: accent + '10', padding: "4px 14px", borderRadius: '12px',
                display: 'inline-block',
                width: 'fit-content'
              }}
            >
              {point.value}
            </Typography>
          </Box>
        );
      }

      case 'streak': {
        const accent = "#d97706";
        return (
          <Box className="flex items-center gap-4 py-4 px-4 my-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
            <Box sx={{ fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(217, 119, 6, 0.2))' }}>🔥</Box>
            <Typography variant="body1" className="flex-1 text-slate-900 dark:text-slate-100" sx={{ fontSize: '15px', fontWeight: 600 }}>
              {point.content}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '13px', fontWeight: 800, color: accent, 
                bgcolor: accent + '15', padding: "4px 12px", borderRadius: '12px',
                border: `1px solid ${accent}30`
              }}
            >
              {point.count || 0} days
            </Typography>
          </Box>
        );
      }

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="group relative"
      onClick={() => isMobile && setIsExpanded(!isExpanded)}
    >
      <Box className="flex-1 overflow-hidden">
        {renderContent()}
      </Box>

      {/* Mobile Collapsible Actions */}
      <AnimatePresence>
        {isMobile && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-50 dark:bg-slate-800/50 rounded-b-xl border border-t-0 border-slate-100 dark:border-slate-800 mx-1"
          >
            <Box className="flex items-center justify-around py-2">
              <IconButton 
                size="medium" 
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate?.(point); // Pass the whole point for editing
                }}
                className="text-indigo-500 flex flex-col items-center gap-1"
              >
                <EditIcon sx={{ fontSize: 20 }} />
                <Typography variant="caption" className="font-bold text-[10px]">Edit</Typography>
              </IconButton>
              <IconButton 
                size="medium" 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(point.id);
                }}
                className="text-red-500 flex flex-col items-center gap-1"
              >
                <DeleteIcon sx={{ fontSize: 20 }} />
                <Typography variant="caption" className="font-bold text-[10px]">Delete</Typography>
              </IconButton>

              {point.type !== 'todo' && point.type !== 'goal' && (
                <IconButton 
                  size="medium" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate?.({ done: !point.done });
                  }}
                  className={`${point.done ? 'text-emerald-500' : 'text-slate-400'} flex flex-col items-center gap-1`}
                >
                  {point.done ? <CheckCircleIcon sx={{ fontSize: 20 }} /> : <UncheckedIcon sx={{ fontSize: 20 }} />}
                  <Typography variant="caption" className="font-bold text-[10px]">{point.done ? 'Done' : 'Mark'}</Typography>
                </IconButton>
              )}

              <IconButton size="small" className="text-slate-400">
                <ExpandMoreIcon sx={{ fontSize: 18, transform: 'rotate(180deg)' }} />
              </IconButton>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Hover Actions */}
      {!isMobile && (
        <Box className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-10 transition-all">
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              onUpdate?.(point); 
            }}
            className="bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-sm hover:text-indigo-500 transition-all border border-slate-200 dark:border-slate-700"
          >
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(point.id);
            }}
            className="bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-sm hover:text-red-500 transition-all border border-slate-200 dark:border-slate-700"
          >
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>

          {point.type !== 'todo' && point.type !== 'goal' && (
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                onUpdate?.({ done: !point.done });
              }}
              className={`bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-sm ${point.done ? 'text-emerald-500' : 'hover:text-emerald-500'} transition-all border border-slate-200 dark:border-slate-700`}
            >
              {point.done ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <UncheckedIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          )}
        </Box>
      )}
    </motion.div>
  );
};

export default PointRow;

