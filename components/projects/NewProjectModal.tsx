'use client';

import React, { useState } from 'react';
import { 
  Dialog, DialogContent, Box, Typography, Button, TextField, 
  IconButton, MenuItem, Stack, Grid, useTheme, useMediaQuery, 
  CircularProgress 
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Assignment as ProjectIcon,
  School as LearningIcon,
  Work as FreelanceIcon,
  Favorite as HealthIcon,
  Person as PersonalIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjects } from '@/app/lib/context/ProjectsContext';
import { useAuth } from '@/app/lib/context/userContext';
import { ProjectType, ProjectStatus } from '@/app/lib/interface';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useRouter } from 'next/navigation';

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
        sx: { borderRadius: isMobile ? 0 : '28px', bgcolor: 'background.paper', overflow: 'hidden' }
      }}
    >
      <Box className="p-6 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
        <Typography variant="h6" className="font-black tracking-tight">
          {step === 1 ? 'Select Project Type' : 'Project Details'}
        </Typography>
        <IconButton onClick={resetAndClose} size="small" className="bg-slate-50 dark:bg-slate-800">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent className="p-6">
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
                      className="flex flex-col items-center justify-center p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer transition-all group"
                    >
                      <Box 
                        className="p-4 rounded-2xl mb-3 group-hover:scale-110 transition-transform" 
                        sx={{ bgcolor: t.color + '15', color: t.color }}
                      >
                        {t.icon}
                      </Box>
                      <Typography variant="body2" className="font-black text-slate-700 dark:text-slate-300">
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
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontWeight: 700 } }}
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
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontWeight: 700 } }}
                    >
                      {types.map(t => <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      fullWidth
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontWeight: 700 } }}
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
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                  />
                </Box>

                <Box className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Box>
                    <Typography className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Deadline</Typography>
                    <DatePicker
                      selected={formData.estimatedCompletion}
                      onChange={(date: Date | null) => setFormData(prev => ({ ...prev, estimatedCompletion: date || new Date() }))}
                      className="w-full p-4 rounded-[16px] border border-slate-200 dark:border-slate-800 bg-transparent dark:text-white font-bold"
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
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontWeight: 700 } }}
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
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                  />
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleCreate}
                  disabled={!formData.title || loading}
                  className="py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 normal-case font-black text-lg"
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
