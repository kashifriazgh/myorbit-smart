'use client';

import React from 'react';
import { Point } from '@/app/lib/interface';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { useGoals } from '@/app/lib/context/GoalsContext';
import { 
  Delete as DeleteIcon,
  DriveFileRenameOutline as MoveIcon,
  CheckCircle as DoneIcon
} from '@mui/icons-material';
import { Box, Typography, IconButton, TextField, ClickAwayListener } from '@mui/material';
import { motion } from 'framer-motion';

interface PointRowProps {
  point: Point;
  onDelete: (pointId: string) => void;
  onUpdate?: (updates: Partial<Point>) => void;
}

const PointRow: React.FC<PointRowProps> = ({ point, onDelete, onUpdate }) => {
  const { todos, updateTodo } = useTodoContext();
  const { allSchedules } = useSchedules();
  const { goals, updateGoal } = useGoals();
  const [isEditingGroup, setIsEditingGroup] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState(point.groupName || '');

  const handleUpdateGroup = () => {
    if (onUpdate) {
      onUpdate({ groupName: newGroupName.trim() || undefined });
    }
    setIsEditingGroup(false);
  };

  const getColorClasses = (scheme?: string) => {
    switch (scheme) {
      case 'success': return { border: '#10b981', text: '#065f46', bg: '#ecfdf5' };
      case 'warning': return { border: '#f59e0b', text: '#92400e', bg: '#fffbeb' };
      case 'error': return { border: '#ef4444', text: '#991b1b', bg: '#fef2f2' };
      case 'info': return { border: '#0ea5e9', text: '#075985', bg: '#f0f9ff' };
      case 'grey': return { border: '#94a3b8', text: '#1e293b', bg: '#f8fafc' };
      default: return { border: '#7c3aed', text: '#6b21a8', bg: '#faf5ff' };
    }
  };

  const renderContent = () => {
    switch (point.type) {
      case 'string': {
        const colors = getColorClasses(point.colorScheme);
        return (
          <Box 
            className="py-2.5 px-3.5 my-1.5 rounded-r-lg border-l-[3px]"
            sx={{ 
              borderColor: colors.border, 
              bgcolor: colors.bg,
            }}
          >
            <Typography variant="body2" sx={{ color: colors.text, fontSize: '13px', lineHeight: 1.55, fontWeight: 500 }}>
              {point.content}
            </Typography>
          </Box>
        );
      }

      case 'todo': {
        const todo = todos.find((t) => t.id === point.todoId);
        if (!todo) return <Typography variant="caption" className="text-slate-400 italic">Todo not found</Typography>;
        
        const isDone = todo.status === 'completed';
        const accent = "#4f46e5";

        return (
          <Box className="flex items-center gap-3 py-2.5 px-3.5 border-b border-slate-50 dark:border-slate-800/50">
            <Box 
              onClick={(e) => {
                e.stopPropagation();
                updateTodo(todo.id!, { status: isDone ? 'in_progress' : 'completed' });
              }}
              sx={{ 
                width: 18, height: 18, borderRadius: '5px', 
                border: `2px solid ${isDone ? accent : "#cbd5e1"}`,
                bgcolor: isDone ? accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: 'pointer', flexShrink: 0
              }}
            >
              {isDone && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </Box>
            <Typography 
              variant="body2" 
              className="flex-1"
              sx={{ 
                fontSize: '13px', 
                color: isDone ? "#94a3b8" : "#1e293b", 
                textDecoration: isDone ? "line-through" : "none",
                fontWeight: 500
              }}
            >
              {todo.title}
            </Typography>
          </Box>
        );
      }

      case 'schedule': {
        const schedule = allSchedules.find((s) => s.id === point.scheduleId);
        if (!schedule) return <Typography variant="caption" className="text-slate-400 italic">Schedule not found</Typography>;
        const accent = "#0891b2";

        return (
          <Box className="flex items-center gap-3 py-2.5 px-3.5 border-b border-slate-50 dark:border-slate-800/50">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <Typography variant="body2" sx={{ fontSize: '13px', color: "#374151", fontWeight: 600 }}>
              {schedule.title} — {schedule.startTime}
            </Typography>
          </Box>
        );
      }

      case 'goal': {
        const goal = goals.find((g) => g.id === point.goalId);
        if (!goal) return <Typography variant="caption" className="text-slate-400 italic">Goal not found</Typography>;

        const isCompleted = goal.status === 'Completed';
        const accent = "#059669";

        return (
          <Box className="flex items-center gap-3 py-2.5 px-3.5 border-b border-slate-50 dark:border-slate-800/50">
            <Box 
              onClick={(e) => {
                e.stopPropagation();
                updateGoal(goal.id!, { status: isCompleted ? 'In Progress' : 'Completed' });
              }}
              sx={{ 
                width: 18, height: 18, borderRadius: '50%', 
                border: `2px solid ${isCompleted ? accent : "#cbd5e1"}`,
                bgcolor: isCompleted ? accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: 'pointer', flexShrink: 0
              }}
            >
              {isCompleted && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </Box>
            <Typography 
              variant="body2" 
              className="flex-1"
              sx={{ 
                fontSize: '13px', 
                color: isCompleted ? "#94a3b8" : "#1e293b", 
                textDecoration: isCompleted ? "line-through" : "none",
                fontWeight: 700
              }}
            >
              {goal.title}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '10px', fontWeight: 900, color: accent, 
                border: `1px solid ${accent}44`, padding: "1px 7px", borderRadius: '20px',
                letterSpacing: '0.5px'
              }}
            >
              GOAL
            </Typography>
          </Box>
        );
      }

      case 'keyvalue': {
        const accent = "#db2777";
        return (
          <Box className="flex items-center gap-4 py-2.5 px-3.5 border-b border-slate-50 dark:border-slate-800/50">
            <Typography variant="body2" sx={{ fontSize: '13px', color: "#64748b", fontWeight: 500 }}>
              {point.key}:
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                fontSize: '13px', fontWeight: 700, color: accent, 
                bgcolor: accent + '15', padding: "2px 10px", borderRadius: '20px' 
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
          <Box className="flex items-center gap-3 py-2.5 px-3.5 border-b border-slate-50 dark:border-slate-800/50">
            <span style={{ fontSize: 16 }}>🔥</span>
            <Typography variant="body2" className="flex-1" sx={{ fontSize: '13px', color: "#374151", fontWeight: 600 }}>
              {point.content}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '11px', fontWeight: 800, color: accent, 
                bgcolor: accent + '20', padding: "2px 9px", borderRadius: '20px' 
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
    >
      <Box className="flex-1 overflow-hidden">
        {renderContent()}
      </Box>

      {isEditingGroup ? (
        <ClickAwayListener onClickAway={() => setIsEditingGroup(false)}>
          <Box className="absolute right-0 top-0 bottom-0 bg-white dark:bg-slate-900 z-20 flex items-center gap-1 px-2 shadow-xl rounded-lg border border-slate-200 dark:border-slate-800">
            <TextField
              size="small"
              autoFocus
              placeholder="Group Name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateGroup()}
              sx={{ 
                '& .MuiInputBase-input': { fontSize: '12px', py: 0.5 },
                width: 120
              }}
            />
            <IconButton size="small" onClick={handleUpdateGroup} color="primary">
              <DoneIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </ClickAwayListener>
      ) : (
        <Box className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 z-10 transition-all">
          <IconButton 
            size="small" 
            onClick={() => setIsEditingGroup(true)}
            className="text-slate-300 hover:text-indigo-500 transition-all"
          >
            <MoveIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => onDelete(point.id)}
            className="text-slate-300 hover:text-red-500 transition-all"
          >
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      )}
    </motion.div>
  );
};

export default PointRow;
