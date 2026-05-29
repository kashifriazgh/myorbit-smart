'use client';

import React, { useState } from 'react';
import { 
  Dialog, DialogContent, Box, Typography, Button, TextField, 
  IconButton, Stack 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useProjects } from '@/app/lib/context/ProjectsContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface NewAgendaModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

const NewAgendaModal: React.FC<NewAgendaModalProps> = ({ open, onClose, projectId }) => {
  const { addAgenda } = useProjects();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';

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
        sx: { 
          borderRadius: '28px', 
          maxWidth: '400px', 
          width: '100%',
          bgcolor: isDark ? '#0f172a' : '#ffffff',
          color: isDark ? '#f1f5f9' : '#0f172a',
          backgroundImage: 'none'
        }
      }}
    >
      <Box 
        className="p-6 flex justify-between items-center border-b"
        sx={{
          bgcolor: isDark ? '#0f172a' : '#ffffff',
          borderColor: isDark ? '#1e293b' : '#f1f5f9'
        }}
      >
        <Typography variant="h6" className="font-black tracking-tight" sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>New Agenda</Typography>
        <IconButton onClick={onClose} size="small" className={isDark ? "bg-slate-800 text-slate-400" : "bg-slate-50 text-slate-500"}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <DialogContent className="p-6" sx={{ bgcolor: isDark ? '#0f172a' : '#ffffff' }}>
        <Stack spacing={4}>
          <Box>
            <Typography className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Agenda Name</Typography>
            <TextField
              fullWidth
              autoFocus
              placeholder="e.g. Sprint 1, Phase 2..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ 
                '& .MuiOutlinedInput-root': { 
                  borderRadius: '16px', 
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  fontWeight: 700,
                  '& fieldset': {
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                  '&:hover fieldset': {
                    borderColor: '#6366f1',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#6366f1',
                  },
                },
                '& .MuiInputBase-input': {
                  color: isDark ? '#f1f5f9' : '#0f172a',
                }
              }}
            />
          </Box>
          <Button
            fullWidth
            variant="contained"
            onClick={handleCreate}
            disabled={!title.trim() || loading}
            className="py-4 rounded-2xl normal-case font-black text-lg shadow-xl"
            sx={{
              bgcolor: isDark ? '#ffffff' : '#0f172a',
              color: isDark ? '#0f172a' : '#ffffff',
              '&:hover': {
                bgcolor: isDark ? '#cbd5e1' : '#1e293b'
              }
            }}
          >
            {loading ? 'Creating...' : 'Create Agenda'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default NewAgendaModal;
