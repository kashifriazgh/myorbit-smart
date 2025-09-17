// components/global/AddSubStepModal.tsx
'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Button,
} from '@mui/material';
import { useState, useEffect } from 'react';

export default function AddSubStepModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (sub: { text: string; description?: string }) => void;
}) {
  const [text, setText] = useState('');
  const [desc, setDesc] = useState('');

  const handleAdd = () => {
    if (!text.trim()) return;
    onAdd({ text: text.trim(), description: desc.trim() });
    setText('');
    setDesc('');
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
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Add New Sub Step</DialogTitle>
      <DialogContent>
        <TextField
          label="Sub Step Title"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        />
        <TextField
          label="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyPress={handleKeyPress}
          fullWidth
          multiline
          size="small"
        />
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
