'use client';
import { Chip, Stack } from '@mui/material';
import moment from 'moment-timezone';
import { useState } from 'react';
import OptionModal from '@/app/components/global/LevelModal';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '@/app/lib/constant';
import { Todo } from '@/app/lib/interface';

interface TodoMetaChipsProps {
  todo: Todo;
  onUpdate: (updates: Partial<Todo>) => void;
}

export default function TodoMetaChips({ todo, onUpdate }: TodoMetaChipsProps) {
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <>
      <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
        <Chip
          label={`Priority: ${todo.priority}`}
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
          label={`Status: ${todo.status}`}
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
            label={`Due: ${
              todo.dueDate instanceof Date
                ? moment(todo.dueDate).format('MMM D, YYYY')
                : moment(todo.dueDate.toDate()).format('MMM D, YYYY')
            }`}
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
    </>
  );
}
