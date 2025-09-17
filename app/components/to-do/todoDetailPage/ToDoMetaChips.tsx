'use client';
import { Chip, Stack, Modal, Box, Typography, TextField, Button, CircularProgress } from '@mui/material';
import moment from 'moment-timezone';
import { useState } from 'react';
import OptionModal from '@/app/components/global/LevelModal';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '@/app/lib/constant';
import { Todo } from '@/app/lib/interface';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface TodoMetaChipsProps {
  todo: Todo;
  onUpdate: (updates: Partial<Todo>) => void;
}

export default function TodoMetaChips({ todo, onUpdate }: TodoMetaChipsProps) {
  const { theme } = useCustomTheme();
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false);

  const updateDueDate = async () => {
    if (!todo.id || !newDueDate) return;
    setReschedulingLoading(true);
    try {
      await updateDoc(doc(db, 'todos', todo.id), {
        dueDate: Timestamp.fromDate(newDueDate),
        updatedAt: new Date(),
      });
      onUpdate({ dueDate: newDueDate });
      setDueDateOpen(false);
    } catch (err) {
      console.error('❌ Failed to reschedule:', err);
    } finally {
      setReschedulingLoading(false);
    }
  };

  return (
    <>
      <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
        <Chip
          label={` ${todo.priority}`}
          onClick={() => setPriorityOpen(true)}
          sx={{
            bgcolor: {
              critical: '#d32f2f',
              urgent: '#f57c00',
              routine: '#9e9e9e',
            }[todo.priority],
            color: '#fff',
          }}
        />
        <Chip
          label={`${todo.status}`}
          onClick={() => setStatusOpen(true)}
          sx={{
            bgcolor: {
              completed: '#2e7d32',
              in_progress: '#0288d1',
              hold: '#ffa000',
              'left-over': '#6d4c41',
            }[todo.status],
            color: '#fff',
          }}
        />
        {todo.dueDate && (
          <Chip
            label={`Due by: ${
              todo.dueDate instanceof Date
                ? moment(todo.dueDate).format('MMM D, YYYY')
                : moment(todo.dueDate.toDate()).format('MMM D, YYYY')
            }`}
            onClick={() => {
              const date = todo.dueDate instanceof Date 
                ? todo.dueDate 
                : todo.dueDate.toDate();
              setNewDueDate(date);
              setDueDateOpen(true);
            }}
            sx={{ cursor: 'pointer' }}
          />
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
        onChange={(value) =>
          onUpdate({ priority: value as 'routine' | 'urgent' | 'critical' })
        }
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
        onChange={(value) =>
          onUpdate({
            status: value as 'in_progress' | 'completed' | 'hold' | 'left-over',
          })
        }
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
    </>
  );
}
