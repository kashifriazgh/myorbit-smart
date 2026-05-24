'use client';

import React, { useState } from 'react';
import { 
  Dialog, DialogContent, Box, Typography, Button, TextField, 
  IconButton, Stack 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useProjects } from '@/app/lib/context/ProjectsContext';

interface NewAgendaModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

const NewAgendaModal: React.FC<NewAgendaModalProps> = ({ open, onClose, projectId }) => {
  const { addAgenda } = useProjects();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await addAgenda(projectId, { title: title.trim(), points: [] });
      setTitle('');
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: { borderRadius: '28px', maxWidth: '400px', width: '100%' }
      }}
    >
      <Box className="p-6 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
        <Typography variant="h6" className="font-black tracking-tight">New Agenda</Typography>
        <IconButton onClick={onClose} size="small" className="bg-slate-50 dark:bg-slate-800">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <DialogContent className="p-6">
        <Stack spacing={4}>
          <Box>
            <Typography className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Agenda Name</Typography>
            <TextField
              fullWidth
              autoFocus
              placeholder="e.g. Sprint 1, Phase 2..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontWeight: 700 } }}
            />
          </Box>
          <Button
            fullWidth
            variant="contained"
            onClick={handleCreate}
            disabled={!title.trim() || loading}
            className="py-4 rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 normal-case font-black text-lg shadow-xl"
          >
            {loading ? 'Creating...' : 'Create Agenda'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default NewAgendaModal;
