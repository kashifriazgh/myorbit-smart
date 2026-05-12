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
  MenuItem,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCustomTheme } from '@/app/lib/context/themeContext';

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
  
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAdd = () => {
    if (!text.trim()) return;

    const payload: NewStepPayload = {
      text: text.trim(),
      description: desc.trim() || '',
    };

    if (assignee.trim()) payload.assignee = assignee.trim();
    if (dueDate) payload.dueDate = new Date(dueDate);
    if (weightPercent) {
      const num = Number(weightPercent);
      if (!Number.isNaN(num) && num >= 0 && num <= 100) {
        payload.weightPercent = num;
      }
    }
    payload.precedence = precedence || 'routine';

    onAdd(payload);

    // Show success and reset fields for next entry
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);

    setText('');
    setDesc('');
    setAssignee('');
    setDueDate('');
    setWeightPercent('');
    setPrecedence('routine');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  useEffect(() => {
    if (open) {
      setText('');
      setDesc('');
      setAssignee('');
      setDueDate('');
      setWeightPercent('');
      setPrecedence('routine');
      setAdvancedOpen(false);
      setShowSuccess(false);
    }
  }, [open]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: '24px',
          padding: '8px',
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          backgroundImage: 'none',
          color: isDark ? '#f1f5f9' : '#1e293b',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <div className="flex justify-between items-start">
          <div>
            <Typography variant="h5" fontWeight={900} sx={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>
              Add New Step
            </Typography>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: isDark ? '#94a3b8' : '#64748b' }}>
              Break down your task
            </Typography>
          </div>
          <Button 
            variant="contained" 
            onClick={handleAdd} 
            disabled={!text.trim()}
            sx={{ 
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              px: 2,
              py: 0.8,
              backgroundColor: '#6366f1',
              '&:hover': { backgroundColor: '#4f46e5' },
              boxShadow: '0 8px 12px -3px rgba(99, 102, 241, 0.3)',
            }}
          >
            Add Step
          </Button>
        </div>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border px-4 py-2 rounded-xl flex items-center gap-2 ${
                isDark ? 'bg-teal-900/20 border-teal-800 text-teal-400' : 'bg-teal-50 border-teal-100 text-teal-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider">Step added successfully!</span>
            </motion.div>
          )}

          <TextField
            autoFocus
            label="Step Title"
            placeholder="What needs to be done?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            fullWidth
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '16px',
                backgroundColor: isDark ? '#334155' : '#f8fafc',
                '& fieldset': { borderColor: isDark ? '#475569' : '#e2e8f0' },
                '&:hover fieldset': { borderColor: '#6366f1' },
              },
              '& .MuiInputBase-input': { color: isDark ? '#f1f5f9' : '#1e293b' },
              '& .MuiInputLabel-root': { color: isDark ? '#94a3b8' : '#64748b' },
            }}
          />
          
          <TextField
            label="Description (optional)"
            placeholder="Add some details..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyPress={handleKeyPress}
            fullWidth
            multiline
            minRows={3}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '16px',
                backgroundColor: isDark ? '#334155' : '#f8fafc',
                '& fieldset': { borderColor: isDark ? '#475569' : '#e2e8f0' },
                '&:hover fieldset': { borderColor: '#6366f1' },
              },
              '& .MuiInputBase-input': { color: isDark ? '#f1f5f9' : '#1e293b' },
              '& .MuiInputLabel-root': { color: isDark ? '#94a3b8' : '#64748b' },
            }}
          />

          {/* Advanced fields toggle */}
          <button
            onClick={() => setAdvancedOpen((prev) => !prev)}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-2xl transition-colors ${
              isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <Typography variant="caption" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: isDark ? '#94a3b8' : '#64748b' }}>
              Advanced Details
            </Typography>
            <ExpandMoreIcon
              sx={{
                color: isDark ? '#475569' : '#94a3b8',
                transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </button>

          <Collapse in={advancedOpen}>
            <Stack spacing={2} sx={{ p: 1 }}>
              <TextField
                label="Assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#334155' : '#ffffff',
                    '& fieldset': { borderColor: isDark ? '#475569' : '#e2e8f0' },
                  },
                  '& .MuiInputBase-input': { color: isDark ? '#f1f5f9' : '#1e293b' },
                }}
              />
              <TextField
                label="Due date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#334155' : '#ffffff',
                    '& fieldset': { borderColor: isDark ? '#475569' : '#e2e8f0' },
                  },
                  '& .MuiInputBase-input': { color: isDark ? '#f1f5f9' : '#1e293b' },
                }}
              />
              <TextField
                select
                label="Precedence"
                value={precedence}
                onChange={(e) =>
                  setPrecedence(e.target.value as 'routine' | 'urgent' | 'critical')
                }
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#334155' : '#ffffff',
                    '& fieldset': { borderColor: isDark ? '#475569' : '#e2e8f0' },
                  },
                  '& .MuiInputBase-input': { color: isDark ? '#f1f5f9' : '#1e293b' },
                  '& .MuiMenu-paper': { backgroundColor: isDark ? '#1e293b' : '#ffffff' },
                }}
              >
                <MenuItem value="routine">Routine</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </TextField>
              <TextField
                label="Weight (%)"
                type="number"
                inputProps={{ min: 0, max: 100 }}
                value={weightPercent}
                onChange={(e) => setWeightPercent(e.target.value)}
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#334155' : '#ffffff',
                    '& fieldset': { borderColor: isDark ? '#475569' : '#e2e8f0' },
                  },
                  '& .MuiInputBase-input': { color: isDark ? '#f1f5f9' : '#1e293b' },
                }}
              />
            </Stack>
          </Collapse>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'center' }}>
        <Button 
          onClick={onClose}
          fullWidth
          sx={{ 
            color: isDark ? '#94a3b8' : '#64748b', 
            fontWeight: 800, 
            textTransform: 'none',
            py: 1.2,
            borderRadius: '12px',
            '&:hover': { backgroundColor: isDark ? '#334155' : '#f8fafc' }
          }}
        >
          Finished Adding Steps
        </Button>
      </DialogActions>
    </Dialog>
  );
}
