// components/global/AddStepModal.tsx
'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Button,
  Stack,
  Collapse,
  IconButton,
  MenuItem,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState, useEffect } from 'react';

type NewStepPayload = {
  text: string;
  description?: string;
  assignee?: string;
  dueDate?: Date | null;
  precedence?: 'routine' | 'urgent' | 'critical';
  weightPercent?: number;
};

export default function AddStepModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (step: NewStepPayload) => void;
}) {
  const [text, setText] = useState('');
  const [desc, setDesc] = useState('');

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [precedence, setPrecedence] = useState<'routine' | 'urgent' | 'critical'>('routine');
  const [weightPercent, setWeightPercent] = useState<string>('');

  const handleAdd = () => {
    if (!text.trim()) return;

    const payload: NewStepPayload = {
      text: text.trim(),
      description: desc.trim() || undefined,
    };

    if (assignee.trim()) payload.assignee = assignee.trim();
    if (dueDate) payload.dueDate = new Date(dueDate);
    if (weightPercent) {
      const num = Number(weightPercent);
      if (!Number.isNaN(num) && num >= 0 && num <= 100) {
        payload.weightPercent = num;
      }
    }
    if (precedence) payload.precedence = precedence;

    onAdd(payload);

    setText('');
    setDesc('');
    setAssignee('');
    setDueDate('');
    setWeightPercent('');
    setPrecedence('routine');
    setAdvancedOpen(false);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  useEffect(() => {
    if (open) {
      setText('');
      setDesc('');
      setAssignee('');
      setDueDate('');
      setWeightPercent('');
      setPrecedence('routine');
      setAdvancedOpen(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add New Step</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Step Title"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            fullWidth
            size="small"
          />
          <TextField
            label="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyPress={handleKeyPress}
            fullWidth
            multiline
            minRows={2}
            size="small"
          />

          {/* Advanced fields toggle */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mt: 1, cursor: 'pointer' }}
            onClick={() => setAdvancedOpen((prev) => !prev)}
          >
            <Typography variant="body2" color="text.secondary">
              More step details (assignee, due date, precedence, weight)
            </Typography>
            <IconButton size="small">
              <ExpandMoreIcon
                sx={{
                  transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </IconButton>
          </Stack>

          <Collapse in={advancedOpen}>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Assignee (optional)"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Due date (optional)"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                select
                label="Precedence (optional)"
                value={precedence}
                onChange={(e) =>
                  setPrecedence(e.target.value as 'routine' | 'urgent' | 'critical')
                }
                size="small"
                fullWidth
              >
                <MenuItem value="routine">Routine</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </TextField>
              <TextField
                label="Weight (%) (optional)"
                type="number"
                inputProps={{ min: 0, max: 100 }}
                value={weightPercent}
                onChange={(e) => setWeightPercent(e.target.value)}
                size="small"
                fullWidth
              />
            </Stack>
          </Collapse>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={!text.trim()}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
