'use client';
import {
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Typography,
  MenuItem,
  Box,
  Divider,
  useMediaQuery,
  useTheme,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  PlaylistAdd as AddTaskIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { useState, useRef, useEffect } from 'react';
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { PRIORITY_OPTIONS } from '@/app/lib/constant';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import AIStepGeneratorModal from '@/app/components/to-do/AI/AIStepGeneratorModal';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ToDoModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [title, setTitle] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('routine');
  const [privacy, setPrivacy] = useState<'private' | 'public'>('private');
  const [dueDate, setDueDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [isFlexible, setIsFlexible] = useState(false);
  const [aiStepModalOpen, setAiStepModalOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Small delay to ensure Dialog transition is underway and focus trap is ready
      const timer = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const [assignee, setAssignee] = useState('Me');


  const handleQuickDate = (type: 'tomorrow' | 'afterTomorrow' | 'endOfWeek') => {
    const date = new Date();
    if (type === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    } else if (type === 'afterTomorrow') {
      date.setDate(date.getDate() + 2);
    } else if (type === 'endOfWeek') {
      const day = date.getDay();
      const diff = day === 0 ? 7 : 7 - day;
      date.setDate(date.getDate() + diff);
    }
    setDueDate(date);
  };


  const [steps, setSteps] = useState<
    {
      text: string;
      description: string;
      showDescription: boolean;
      done: boolean;
      status: 'in_progress' | 'completed' | 'hold' | 'left-over';
      subSteps: {
        text: string;
        description: string;
        showDescription: boolean;
        done: boolean;
        status: 'in_progress' | 'completed' | 'hold' | 'left-over';
      }[];
    }[]
  >([]);

  const addStep = () => {
    setSteps((prev) => [
      ...prev.map((step) => ({ ...step, showDescription: false })),
      {
        text: '',
        description: '',
        showDescription: false,
        done: false,
        status: 'in_progress',
        subSteps: [],
      },
    ]);
  };

  const handleAIStepsApply = (
    aiSteps: { text: string; description?: string }[]
  ) => {
    const newSteps = aiSteps.map((aiStep) => ({
      text: aiStep.text,
      description: aiStep.description || '',
      showDescription: false,
      done: false,
      status: 'in_progress' as const,
      subSteps: [],
    }));

    setSteps((prev) => [
      ...prev.map((step) => ({ ...step, showDescription: false })),
      ...newSteps,
    ]);
  };

  const removeStep = (stepIndex: number) => {
    setSteps((prev) => prev.filter((_, index) => index !== stepIndex));
  };

  const addSubStep = (stepIndex: number) => {
    const updated = [...steps];
    updated[stepIndex].subSteps.push({
      text: '',
      description: '',
      showDescription: false,
      done: false,
      status: 'in_progress',
    });
    setSteps(updated);
  };

  const removeSubStep = (stepIndex: number, subIndex: number) => {
    const updated = [...steps];
    updated[stepIndex].subSteps = updated[stepIndex].subSteps.filter(
      (_, idx) => idx !== subIndex
    );
    setSteps(updated);
  };
  // reset the form
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setShowDescription(false);
    setPriority('routine');
    setPrivacy('private');
    setDueDate(new Date());
    setIsImportant(false);
    setIsFlexible(false);
    setAssignee('Me');
    setSteps([]);
    setAiStepModalOpen(false);
    setLoading(false);
  };
  // handle cancle
  const handleCancel = () => {
    resetForm();
    onClose();
  };
    

  const handleSave = async () => {
    if (!title.trim()) return;

    // Check if all steps are empty
    const allStepsEmpty = steps.every((step) => {
      const stepEmpty = !step.text.trim() && !step.description.trim();
      const allSubStepsEmpty = step.subSteps.every(
        (sub) => !sub.text.trim() && !sub.description.trim()
      );
      return stepEmpty && allSubStepsEmpty;
    });

    if (steps.length > 0 && allStepsEmpty) {
      alert('Please fill in at least one step or substep before saving.');
      return;
    }

    setLoading(true);

    const docData = {
      title: title.trim(),
      description,
      steps,
      priority,
      status: 'in_progress',
      progressPercent: 0,
      pinned: false,
      isArchived: false,
      authorId: user!.uid,
      authorName: user!.firstName || '',
      assignedUsers: [],
      sharedWith: [],
      assignee: assignee.trim() || null,
      startDate: Timestamp.fromDate(new Date()),
      dueDate: isFlexible ? null : Timestamp.fromDate(dueDate || new Date()),
      isFlexible,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      privacy,
      isImportant,
    };

    await addDoc(collection(db, 'todos'), docData);
    setLoading(false);
    resetForm();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        className: "rounded-[28px] overflow-hidden shadow-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800",
        sx: { borderRadius: isMobile ? 0 : '28px' }
      }}
    >
      {/* ── Premium Gradient Header ── */}
      <Box className="p-6 bg-gradient-to-br from-teal-500 to-cyan-700 text-white flex justify-between items-center">
        <Box>
          <Typography variant="h6" className="font-extrabold">
            {title ? 'Edit Task' : 'New Task'} 📝
          </Typography>
          <Typography variant="body2" className="opacity-90">
            Stay organized. Stay focused.
          </Typography>
        </Box>
        <Box className="flex items-center gap-2">
          {isMobile && (
            <Button
              variant="contained"
              size="small"
              onClick={handleSave}
              disabled={loading || !title.trim()}
              className="bg-white text-teal-600 font-bold hover:bg-teal-50 rounded-xl mr-2"
            >
              {loading ? 'Saving…' : 'Save'}
            </Button>
          )}
          <IconButton onClick={handleCancel} className="text-white hover:bg-white/20 transition-colors">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      <DialogContent className="p-6">
        <Box className="flex flex-col gap-10 pt-4">
          {/* 1. Title */}
          <Box>
            <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
              🏷️ Task Title <span className="text-red-500">*</span>
            </Typography>
            <TextField
              inputRef={titleInputRef}
              fullWidth
              multiline
              maxRows={3}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '16px',
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  transition: 'all-0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '& fieldset': { borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0' },
                  '&:hover fieldset': { borderColor: '#14b8a6' },
                  '&.Mui-focused fieldset': { borderColor: '#14b8a6', borderWidth: '2px' },
                }
              }}
            />
          </Box>

          {/* 2. Date / Deadline Section */}
          <Box
            className={`
              p-6 rounded-[24px] border transition-all
              ${theme.palette.mode === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-100'}
            `}
          >
            <Box className="flex items-center justify-between mb-4">
              <Typography className="text-[11px] font-extrabold text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em]">
                📅 Deadline
              </Typography>
              <Button
                onClick={() => setIsFlexible(!isFlexible)}
                variant={isFlexible ? 'contained' : 'outlined'}
                size="small"
                className={`rounded-full px-4 font-bold transition-all text-[10px] ${isFlexible ? 'bg-teal-600 shadow-lg shadow-teal-500/30' : ''}`}
              >
                {isFlexible ? '✨ Flexible Active' : 'Make Flexible'}
              </Button>
            </Box>
            
            <Collapse in={!isFlexible}>
              <Box className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                <DatePicker
                  selected={dueDate}
                  onChange={(date: Date | null) => setDueDate(date)}
                  className="custom-datepicker-premium"
                  dateFormat="MMMM d, yyyy"
                  minDate={new Date()}
                />
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {[
                    { label: 'Tomorrow', value: 'tomorrow' },
                    { label: 'After Tomorrow', value: 'afterTomorrow' },
                    { label: 'End of Week', value: 'endOfWeek' },
                  ].map((item) => (
                    <Button
                      key={item.value}
                      variant="outlined"
                      onClick={() => handleQuickDate(item.value as 'tomorrow' | 'afterTomorrow' | 'endOfWeek')}
                      className="rounded-full normal-case text-[12px] font-extrabold px-5 py-1.5 border-slate-200 text-slate-500 hover:border-teal-500 hover:text-teal-600 transition-all"
                    >
                      {item.label}
                    </Button>
                  ))}
                </Stack>
              </Box>
            </Collapse>
          </Box>

          {/* 3. Priority & Privacy & Starred Row */}
          <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                ⚡ Priority
              </Typography>
              <TextField
                select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                    fontWeight: 700,
                  }
                }}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <MenuItem key={p.value} value={p.value} className="font-bold">
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                👤 Assignee
              </Typography>
              <TextField
                placeholder="Who is tackling this?"
                fullWidth
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                  }
                }}
              />
            </Box>

            <Box className="flex items-center gap-4">
              <Box className="flex-1">
                <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                  ⭐ Important
                </Typography>
                <Box 
                  onClick={() => setIsImportant(!isImportant)}
                  className={`
                    flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all
                    ${isImportant 
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' 
                      : 'bg-slate-50 border-slate-100 dark:bg-slate-800/30 dark:border-slate-800'}
                  `}
                >
                  <Typography className={`text-sm font-bold ${isImportant ? 'text-amber-600' : 'text-slate-400'}`}>
                    Mark as Starred
                  </Typography>
                  {isImportant ? <StarIcon className="text-amber-500" /> : <StarBorderIcon className="text-slate-300" />}
                </Box>
              </Box>
            </Box>
          </Box>

          {/* 4. Privacy & Description Toggle */}
          <Box className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                🔒 Privacy
              </Typography>
              <TextField
                select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as 'private' | 'public')}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                    fontWeight: 700,
                  }
                }}
              >
                <MenuItem value="private" className="font-bold">Only Me</MenuItem>
                <MenuItem value="public" className="font-bold">Public</MenuItem>
              </TextField>
            </Box>

            <Box className="pt-7">
              <Collapse in={!showDescription}>
                <Button
                  onClick={() => setShowDescription(true)}
                  startIcon={<ExpandMoreIcon />}
                  className="normal-case font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl px-4"
                >
                  + Add Detailed Description
                </Button>
              </Collapse>
            </Box>
          </Box>

          {/* 5. Description Area */}
          <Collapse in={showDescription}>
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                📝 Description
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Context, details, or notes..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                    '& fieldset': { borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0' },
                  }
                }}
              />
              <Button
                onClick={() => setShowDescription(false)}
                className="normal-case font-bold text-slate-400 hover:text-red-500 mt-2"
                size="small"
              >
                – Hide Description
              </Button>
            </Box>
          </Collapse>

          <Divider className="dark:border-slate-800" />

          {/* ── Task Steps ── */}
          <Box>
            <Box className="flex justify-between items-center mb-6">
              <Typography className="text-sm font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                📋 Execution Steps
              </Typography>
              <Box className="flex gap-3">
                <Button
                  variant="contained"
                  startIcon={<AddTaskIcon />}
                  onClick={addStep}
                  className="rounded-xl font-bold px-4 py-2 bg-teal-600 hover:bg-teal-700 shadow-md transition-all normal-case"
                >
                  Add Step
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={() => setAiStepModalOpen(true)}
                  disabled={!title.trim()}
                  className="rounded-xl font-bold px-4 py-2 border-teal-200 text-teal-600 hover:bg-teal-50 transition-all normal-case"
                >
                  AI Steps
                </Button>
              </Box>
            </Box>

            {/* Steps Instruction */}
            <Box className="flex items-center gap-3 p-4 mb-8 rounded-2xl bg-teal-50/50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/30 text-teal-700 dark:text-teal-300">
              <Typography variant="body2" className="italic font-medium">
                💡 Breakdown your task into actionable steps for better tracking.
              </Typography>
            </Box>

            <Stack gap={3}>
              {steps.map((step, stepIndex) => (
                <Box 
                  key={stepIndex} 
                  className="group p-5 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm transition-all hover:shadow-md"
                >
                  <Box className="flex items-center justify-between mb-4">
                    <Typography className="text-xs font-black text-teal-600 uppercase tracking-[0.2em]">
                      Step {stepIndex + 1}
                    </Typography>
                    <IconButton size="small" onClick={() => removeStep(stepIndex)} className="text-slate-300 hover:text-red-500">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Stack direction="row" spacing={2} alignItems="center" className="mb-2">
                    <TextField
                      fullWidth
                      value={step.text}
                      onChange={(e) => {
                        const updated = [...steps];
                        updated[stepIndex].text = e.target.value;
                        setSteps(updated);
                      }}
                      placeholder={`What's Step ${stepIndex + 1}?`}
                      variant="standard"
                      InputProps={{ disableUnderline: true }}
                      className="font-bold text-slate-700 dark:text-slate-200"
                    />
                    <IconButton size="small" onClick={() => {
                      const updated = [...steps];
                      updated[stepIndex].showDescription = !updated[stepIndex].showDescription;
                      setSteps(updated);
                    }}>
                      {step.showDescription ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Stack>

                  <Collapse in={step.showDescription}>
                    <TextField
                      fullWidth multiline rows={2}
                      value={step.description}
                      onChange={(e) => {
                        const updated = [...steps];
                        updated[stepIndex].description = e.target.value;
                        setSteps(updated);
                      }}
                      placeholder="Add step details..."
                      className="mt-3"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '12px',
                          fontSize: '0.875rem'
                        }
                      }}
                    />
                  </Collapse>

                  {/* Substeps */}
                  <Box className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-800">
                    <Typography className="text-[10px] font-black text-slate-400 uppercase mb-3">Sub-Tasks</Typography>
                    <Stack gap={2}>
                      {step.subSteps.map((sub, subIndex) => (
                        <Box key={subIndex} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                          <TextField
                            fullWidth
                            size="small"
                            value={sub.text}
                            onChange={(e) => {
                              const updated = [...steps];
                              updated[stepIndex].subSteps[subIndex].text = e.target.value;
                              setSteps(updated);
                            }}
                            placeholder="Sub-task name..."
                            variant="standard"
                            InputProps={{ disableUnderline: true }}
                            className="font-bold text-xs"
                          />
                          <IconButton size="small" color="error" onClick={() => removeSubStep(stepIndex, subIndex)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                      <Button
                        size="small"
                        onClick={() => addSubStep(stepIndex)}
                        className="self-start normal-case font-bold text-teal-600 hover:bg-teal-50 rounded-lg px-3"
                      >
                        + Add Sub-task
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions className="p-6 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 gap-3">
        <Button onClick={handleCancel} className="rounded-xl font-bold px-6 py-2 normal-case text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          Cancel
        </Button>
        {!isMobile && (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading || !title.trim()}
            className="rounded-xl font-extrabold px-8 py-2 normal-case bg-gradient-to-r from-teal-500 to-cyan-700 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 transition-all"
          >
            {loading ? 'Saving…' : 'Create Task'}
          </Button>
        )}
      </DialogActions>



      {/* AI Step Generator Modal */}
      <AIStepGeneratorModal
        open={aiStepModalOpen}
        onClose={() => setAiStepModalOpen(false)}
        onApply={handleAIStepsApply}
        taskTitle={title}
        taskDescription={description}
      />
    </Dialog>
  );
}
