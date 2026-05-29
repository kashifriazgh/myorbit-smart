'use client';

import React, { useState } from 'react';
import { 
  Dialog, DialogContent, Box, Typography, Button, TextField, 
  IconButton, MenuItem, Stack, Grid, useTheme, useMediaQuery, 
  CircularProgress 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ProjectIcon from '@mui/icons-material/Assignment';
import LearningIcon from '@mui/icons-material/School';
import FreelanceIcon from '@mui/icons-material/Work';
import HealthIcon from '@mui/icons-material/Favorite';
import PersonalIcon from '@mui/icons-material/Person';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjects } from '@/app/lib/context/ProjectsContext';
import { useAuth } from '@/app/lib/context/userContext';
import { ProjectType, ProjectStatus } from '@/app/lib/interface';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useRouter } from 'next/navigation';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
}

const types = [
  { id: 'general', label: 'General', icon: <ProjectIcon />, color: '#64748b' },
  { id: 'learning', label: 'Learning', icon: <LearningIcon />, color: '#3b82f6' },
  { id: 'freelance', label: 'Freelance', icon: <FreelanceIcon />, color: '#d946ef' },
  { id: 'health', label: 'Health', icon: <HealthIcon />, color: '#10b981' },
  { id: 'personal', label: 'Personal', icon: <PersonalIcon />, color: '#f59e0b' },
];

const NewProjectModal: React.FC<NewProjectModalProps> = ({ open, onClose }) => {
  const { user } = useAuth();
  const { addProject } = useProjects();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'general' as ProjectType,
    status: 'active' as ProjectStatus,
    budget: '',
    estimatedCompletion: new Date(),
    assignees: '',
  });

  const getFieldSx = () => ({
    '& .MuiOutlinedInput-root': {
      borderRadius: '16px',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff',
      color: isDark ? '#f1f5f9' : '#0f172a',
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
    '& .MuiInputLabel-root': {
      color: isDark ? '#94a3b8' : '#6b7280',
      '&.Mui-focused': {
        color: '#6366f1',
      }
    },
    '& .MuiInputBase-input': {
      color: isDark ? '#f1f5f9' : '#0f172a',
    }
  });

  const handleTypeSelect = (type: ProjectType) => {
    setFormData(prev => ({ ...prev, type }));
    setStep(2);
  };

  const handleCreate = async () => {
    if (!formData.title || !user) return;
    setLoading(true);
    try {
      const projectId = await addProject({
        userId: user.uid,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        status: formData.status,
        budget: formData.type === 'freelance' ? parseFloat(formData.budget) || 0 : 0,
        estimatedCompletion: formData.estimatedCompletion,
        progress: 0,
        assignees: formData.assignees.split(',').map(s => s.trim()).filter(s => s),
        agendas: [],
        completedAt: null,
      });
      onClose();
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setFormData({
      title: '',
      description: '',
      type: 'general',
      status: 'active',
      budget: '',
      estimatedCompletion: new Date(),
      assignees: '',
    });
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={resetAndClose}
      fullScreen={isMobile}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: isMobile ? 0 : '28px', 
          bgcolor: isDark ? '#0f172a' : '#ffffff', 
          color: isDark ? '#f1f5f9' : '#0f172a',
          overflow: 'hidden' 
        }
      }}
    >
      <Box 
        className="p-6 flex justify-between items-center border-b"
        sx={{ borderColor: isDark ? '#1e293b' : '#f1f5f9' }}
      >
        <Typography variant="h6" className="font-black tracking-tight" sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
          {step === 1 ? 'Select Project Type' : 'Project Details'}
        </Typography>
        <IconButton onClick={resetAndClose} size="small" className={isDark ? "bg-slate-800 text-slate-400" : "bg-slate-50 text-slate-500"}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent className="p-6" sx={{ bgcolor: isDark ? '#0f172a' : '#ffffff' }}>
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Grid container spacing={2}>
                {types.map((t) => (
                  <Grid size={{ xs: 6, sm: 4 }} key={t.id}>
                    <Box
                      onClick={() => handleTypeSelect(t.id as ProjectType)}
                      className="flex flex-col items-center justify-center p-6 rounded-[24px] border hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer transition-all group"
                      sx={{
                        borderColor: isDark ? '#1e293b' : '#f1f5f9',
                        bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                      }}
                    >
                      <Box 
                        className="p-4 rounded-2xl mb-3 group-hover:scale-110 transition-transform" 
                        sx={{ bgcolor: t.color + '15', color: t.color }}
                      >
                        {t.icon}
                      </Box>
                      <Typography variant="body2" className="font-black" sx={{ color: isDark ? '#cbd5e1' : '#334155' }}>
                        {t.label}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Stack spacing={4}>
                <Box>
                  <Typography className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Title *</Typography>
                  <TextField
                    fullWidth
                    placeholder="Enter project title..."
                    variant="outlined"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    sx={getFieldSx()}
                  />
                </Box>

                <Box>
                  <Typography className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Type & Status</Typography>
                  <Box className="grid grid-cols-2 gap-4">
                    <TextField
                      select
                      fullWidth
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as ProjectType })}
                      sx={getFieldSx()}
                    >
                      {types.map(t => <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      fullWidth
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                      sx={getFieldSx()}
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="planning">Planning</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="on-hold">On Hold</MenuItem>
                    </TextField>
                  </Box>
                </Box>

                <Box>
                  <Typography className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Description</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="What is this project about?"
                    variant="outlined"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    sx={getFieldSx()}
                  />
                </Box>

                <Box className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Box>
                    <Typography className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Deadline</Typography>
                    <DatePicker
                      selected={formData.estimatedCompletion}
                      onChange={(date: Date | null) => setFormData(prev => ({ ...prev, estimatedCompletion: date || new Date() }))}
                      className={`w-full p-4 rounded-[16px] border font-bold ${
                        isDark ? 'border-slate-800 bg-slate-900/50 text-white' : 'border-slate-200 bg-transparent text-slate-800'
                      }`}
                    />
                  </Box>
                  {formData.type === 'freelance' && (
                    <Box>
                      <Typography className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Budget ($)</Typography>
                      <TextField
                        fullWidth
                        type="number"
                        placeholder="0.00"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        sx={getFieldSx()}
                      />
                    </Box>
                  )}
                </Box>

                <Box>
                  <Typography className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Assignees (Comma separated)</Typography>
                  <TextField
                    fullWidth
                    placeholder="Alice, Bob..."
                    value={formData.assignees}
                    onChange={(e) => setFormData({ ...formData, assignees: e.target.value })}
                    sx={getFieldSx()}
                  />
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleCreate}
                  disabled={!formData.title || loading}
                  className="py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 normal-case font-black text-lg text-white"
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Project'}
                </Button>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default NewProjectModal;
