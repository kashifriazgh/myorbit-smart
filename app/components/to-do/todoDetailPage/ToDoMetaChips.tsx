'use client';
import { Chip, Stack, Modal, Box, Typography, TextField, Button, CircularProgress } from '@mui/material';
import { CalendarToday as CalendarIcon, Person as PersonIcon } from '@mui/icons-material';
import moment from 'moment-timezone';
import { useState } from 'react';
import OptionModal from '@/app/components/global/LevelModal';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '@/app/lib/constant';
import { Todo } from '@/app/lib/interface';
import { Timestamp } from 'firebase/firestore';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { deleteTodoReminder, rescheduleTodoReminder } from '@/app/lib/utils/whatsapp-reminder';
import { incrementTodoRescheduleCount } from '@/app/lib/utilts';

import { useTodoContext } from '@/app/lib/context/todoContext';

interface TodoMetaChipsProps {
  todo: Todo;
  onUpdate: (updates: Partial<Todo>) => void;
}

export default function TodoMetaChips({ todo, onUpdate }: TodoMetaChipsProps) {
  const { theme } = useCustomTheme();
  const { user } = useAuth();
  const { updateTodo } = useTodoContext();
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [newAssignee, setNewAssignee] = useState<string>(todo.assignee || '');

  const updateDueDate = async () => {
    if (!todo.id || !newDueDate) return;
    setReschedulingLoading(true);
    try {
      const oldDate = todo.dueDate
        ? (todo.dueDate instanceof Timestamp ? todo.dueDate.toDate() : new Date(todo.dueDate))
        : null;
      const isDateChanged = oldDate ? !moment(oldDate).isSame(newDueDate, 'day') : true;

      await updateTodo(todo.id, {
        dueDate: Timestamp.fromDate(newDueDate),
        isFlexible: false, // Turn off flexible if date is set
      });

      if (isDateChanged) {
        await incrementTodoRescheduleCount(todo.id).catch((e) => console.error(e));
      }
      
      if (user) {
        await rescheduleTodoReminder(todo.id, newDueDate, user.uid).catch((e) => console.error(e));
      }

      onUpdate({ dueDate: newDueDate, isFlexible: false });
      setDueDateOpen(false);
    } catch (err) {
      console.error('❌ Failed to reschedule:', err);
    } finally {
      setReschedulingLoading(false);
    }
  };

  const updateAssignee = async () => {
    if (!todo.id) return;
    try {
      await updateTodo(todo.id, {
        assignee: newAssignee.trim() || null,
      });
      onUpdate({ assignee: newAssignee.trim() || undefined });
      setAssigneeOpen(false);
    } catch (err) {
      console.error('❌ Failed to update assignee:', err);
    }
  };

  return (
    <>
    <Stack direction="row" spacing={1.5} mt={2} flexWrap="wrap" useFlexGap>
      {/* Assignee Chip */}
      <Chip
        icon={<PersonIcon sx={{ fontSize: '1.1rem !important' }} />}
        label={todo.assignee ? todo.assignee : 'Unassigned'}
        onClick={() => setAssigneeOpen(true)}
        className="rounded-xl px-2 font-bold transition-all hover:scale-105"
        sx={{
          bgcolor: theme?.mode === 'dark' ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
          color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
          border: '1px solid',
          borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0',
          '& .MuiChip-icon': { color: 'inherit' }
        }}
      />

      {/* Priority Chip */}
      <Chip
        label={todo.priority.toUpperCase()}
        onClick={() => setPriorityOpen(true)}
        className="rounded-xl px-2 font-black tracking-wider text-[10px] transition-all hover:scale-105"
        sx={{
          bgcolor: {
            critical: '#fee2e2',
            urgent: '#ffedd5',
            routine: '#f1f5f9',
          }[todo.priority],
          color: {
            critical: '#ef4444',
            urgent: '#f97316',
            routine: '#64748b',
          }[todo.priority],
          border: '1px solid',
          borderColor: {
            critical: '#fca5a5',
            urgent: '#fdba74',
            routine: '#e2e8f0',
          }[todo.priority],
          dark: {
            bgcolor: {
              critical: 'rgba(239, 68, 68, 0.15)',
              urgent: 'rgba(249, 115, 22, 0.15)',
              routine: 'rgba(148, 163, 184, 0.15)',
            }[todo.priority],
          }
        }}
      />

      {/* Status Chip */}
      <Chip
        label={todo.status.replace('_', ' ').toUpperCase()}
        onClick={() => setStatusOpen(true)}
        className="rounded-xl px-2 font-black tracking-wider text-[10px] transition-all hover:scale-105"
        sx={{
          bgcolor: {
            completed: '#f0fdf4',
            in_progress: '#eff6ff',
            hold: '#fffbeb',
            'left-over': '#fafafa',
          }[todo.status],
          color: {
            completed: '#22c55e',
            in_progress: '#3b82f6',
            hold: '#f59e0b',
            'left-over': '#737373',
          }[todo.status],
          border: '1px solid',
          borderColor: {
            completed: '#bbf7d0',
            in_progress: '#bfdbfe',
            hold: '#fef3c7',
            'left-over': '#e5e5e5',
          }[todo.status],
        }}
      />

      {/* Due Date Chip or Flexible Chip */}
      {todo.isFlexible ? (
        <Chip
          icon={<Box sx={{ ml: 0.5, fontSize: '1rem' }}>✨</Box>}
          label="FLEXIBLE"
          onClick={() => {
            setNewDueDate(new Date());
            setDueDateOpen(true);
          }}
          className="rounded-xl px-2 font-black tracking-wider text-[10px] transition-all hover:scale-105"
          sx={{
            bgcolor: theme?.mode === 'dark' ? 'rgba(139, 92, 246, 0.15)' : '#f5f3ff',
            color: '#8b5cf6',
            border: '1px solid #ddd6fe',
            '& .MuiChip-icon': { color: 'inherit' }
          }}
        />
      ) : (
        todo.dueDate && (
          <Chip
            icon={<CalendarIcon sx={{ fontSize: '1rem !important' }} />}
            label={
              todo.dueDate instanceof Date
                ? moment(todo.dueDate).format('MMM D, YYYY')
                : moment(todo.dueDate.toDate()).format('MMM D, YYYY')
            }
            onClick={() => {
              const date = todo.dueDate instanceof Date 
                ? todo.dueDate 
                : todo.dueDate.toDate();
              setNewDueDate(date);
              setDueDateOpen(true);
            }}
            className="rounded-xl px-2 font-bold transition-all hover:scale-105"
            sx={{
              bgcolor: theme?.mode === 'dark' ? 'rgba(20, 184, 166, 0.1)' : '#f0fdfa',
              color: '#0d9488',
              border: '1px solid #ccfbf1',
              '& .MuiChip-icon': { color: 'inherit' }
            }}
          />
        )
      )}
    </Stack>

      {/* Modals */}
      <OptionModal
        open={priorityOpen}
        onClose={() => setPriorityOpen(false)}
        docId={todo.id!}
        collectionName="todos"
        field="priority"
        currentValue={todo.priority}
        options={PRIORITY_OPTIONS.map((o) => ({
          key: o.value,
          label: o.label,
        }))}
        onChange={async (value) => {
          await updateTodo(todo.id!, { priority: value as 'routine' | 'urgent' | 'critical' });
          onUpdate({ priority: value as 'routine' | 'urgent' | 'critical' });
        }}
      />
      <OptionModal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        docId={todo.id!}
        collectionName="todos"
        field="status"
        currentValue={todo.status}
        options={STATUS_OPTIONS.map((o) => ({
          key: o.value,
          label: o.label,
        }))}
        onChange={async (value) => {
          if (value === 'completed') {
            await deleteTodoReminder(todo.id!).catch((e) => console.error(e));
          }
          await updateTodo(todo.id!, {
            status: value as 'in_progress' | 'completed' | 'hold' | 'left-over',
          });
          onUpdate({
            status: value as 'in_progress' | 'completed' | 'hold' | 'left-over',
          });
        }}
      />

      {/* Reschedule Due Date Modal */}
      <Modal open={dueDateOpen} onClose={() => setDueDateOpen(false)}>
        <Box
          className="absolute rounded-lg p-6 shadow-lg"
          sx={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: 320,
            outline: 'none',
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
            border:
              theme?.mode === 'dark'
                ? '1px solid #334155'
                : '1px solid #e5e7eb',
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
            }}
          >
            Reschedule Task
          </Typography>
          <TextField
            fullWidth
            label="Task Title"
            value={todo.title || ''}
            InputProps={{ readOnly: true }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                '& fieldset': {
                  borderColor: theme?.mode === 'dark' ? '#475569' : '#d1d5db',
                },
                '&:hover fieldset': {
                  borderColor: theme?.mode === 'dark' ? '#64748b' : '#9ca3af',
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme?.mode === 'dark' ? '#64748b' : '#3b82f6',
                },
              },
              '& .MuiInputLabel-root': {
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                '&.Mui-focused': {
                  color: theme?.mode === 'dark' ? '#cbd5e1' : '#3b82f6',
                },
              },
            }}
          />
          <Typography
            variant="body2"
            gutterBottom
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
            }}
          >
            New Due Date
          </Typography>
          <Box
            sx={{
              mb: 2,
              '& .react-datepicker-wrapper': { width: '100%' },
              '& .react-datepicker__input-container input': {
                width: '100%',
                padding: '12px',
                border:
                  theme?.mode === 'dark'
                    ? '2px solid #475569'
                    : '2px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                '&:focus': {
                  borderColor: theme?.mode === 'dark' ? '#64748b' : '#3b82f6',
                  outline: 'none',
                },
                '&::placeholder': {
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#666666',
                },
              },
            }}
          >
            <DatePicker
              selected={newDueDate}
              onChange={(date: Date | null) => setNewDueDate(date)}
              dateFormat="yyyy-MM-dd"
              className="w-full"
              placeholderText="Select new date"
            />
          </Box>
          <Stack direction="row" justifyContent="flex-end" mt={3} spacing={2}>
            <Button
              onClick={() => setDueDateOpen(false)}
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                '&:hover': {
                  backgroundColor:
                    theme?.mode === 'dark' ? '#475569' : '#f3f4f6',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={updateDueDate}
              variant="contained"
              color="primary"
              disabled={!newDueDate || reschedulingLoading}
              sx={{
                backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#1976d2',
                '&:hover': {
                  backgroundColor:
                    theme?.mode === 'dark' ? '#2563eb' : '#1565c0',
                },
                '&:disabled': {
                  backgroundColor:
                    theme?.mode === 'dark' ? '#475569' : '#e5e7eb',
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#9ca3af',
                },
              }}
            >
              {reschedulingLoading ? (
                <CircularProgress size={20} sx={{ color: 'white' }} />
              ) : (
                'Save'
              )}
            </Button>
          </Stack>
        </Box>
      </Modal>

      {/* Assignee Modal */}
      <Modal open={assigneeOpen} onClose={() => setAssigneeOpen(false)}>
        <Box
          className="absolute rounded-lg p-6 shadow-lg"
          sx={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: 320,
            outline: 'none',
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
            border:
              theme?.mode === 'dark'
                ? '1px solid #334155'
                : '1px solid #e5e7eb',
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
            }}
          >
            Task Assignee
          </Typography>
          <TextField
            fullWidth
            label="Assignee name (optional)"
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            sx={{ mt: 1, mb: 3 }}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={2}>
            <Button onClick={() => setAssigneeOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={updateAssignee}>
              Save
            </Button>
          </Stack>
        </Box>
      </Modal>
    </>
  );
}
