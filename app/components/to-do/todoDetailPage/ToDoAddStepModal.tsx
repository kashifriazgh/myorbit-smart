'use client';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Button,
  Stack,
} from '@mui/material';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (step: { text: string; description?: string }) => void;
}

export default function AddStepModal({ open, onClose, onAdd }: Props) {
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    if (!text.trim()) return;
    onAdd({ text, description });
    setText('');
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Add New Step</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Step Title"
            fullWidth
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <TextField
            label="Description (optional)"
            fullWidth
            multiline
            minRows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
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
