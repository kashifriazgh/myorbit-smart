'use client';
import {
  Dialog,
  DialogTitle,
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
  Tooltip,
  Paper,
  Collapse,
} from '@mui/material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import AddTaskIcon from '@mui/icons-material/PlaylistAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useState } from 'react';
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
      startDate: Timestamp.fromDate(new Date()),
      dueDate: Timestamp.fromDate(dueDate || new Date()),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      privacy,
      isImportant,
    };

    await addDoc(collection(db, 'todos'), docData);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>📝 New To-Do</DialogTitle>
      <DialogContent
        dividers
        sx={{ bgcolor: theme.palette.background.default }}
      >
        <Stack spacing={2}>
          <TextField
            label="Title"
            fullWidth
            multiline
            maxRows={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Collapse in={!showDescription}>
            <Typography
              onClick={() => setShowDescription(true)}
              sx={{
                cursor: 'pointer',
                textDecoration: 'underline',
                color: 'primary.main',
                mt: 1,
              }}
            >
              + Add Task Description
            </Typography>
          </Collapse>

          <Collapse in={showDescription}>
            <Box mt={1}>
              <TextField
                label="Task Description"
                fullWidth
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Typography
                onClick={() => setShowDescription(false)}
                sx={{
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  color: 'secondary.main',
                  mt: 0.5,
                  fontSize: '0.875rem',
                }}
              >
                – Hide Description
              </Typography>
            </Box>
          </Collapse>

          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              size="small"
              fullWidth
              sx={{ flex: 1 }}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Privacy"
              value={privacy}
              onChange={(e) =>
                setPrivacy(e.target.value as 'private' | 'public')
              }
              size="small"
              fullWidth
              sx={{ flex: 1 }}
            >
              <MenuItem value="private">Only Me</MenuItem>
              <MenuItem value="public">Public</MenuItem>
            </TextField>

            <Tooltip title="Mark as Important">
              <IconButton
                color={isImportant ? 'warning' : 'default'}
                onClick={() => setIsImportant(!isImportant)}
              >
                {isImportant ? <StarIcon /> : <StarBorderIcon />}
              </IconButton>
            </Tooltip>
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: theme.palette.action.hover,
              borderColor: theme.palette.primary.light,
            }}
          >
            <Typography variant="subtitle2" mb={1} color="primary">
              Select Due Date
            </Typography>
            <DatePicker
              selected={dueDate}
              onChange={(date: Date | null) => setDueDate(date)}
              className="custom-datepicker"
              dateFormat="MMMM d, yyyy"
              minDate={new Date()}
              wrapperClassName="date-picker-wrapper"
            />
          </Paper>

          <Divider />
          <Typography fontWeight={600}>Task Steps</Typography>

          {steps.map((step, stepIndex) => (
            <Box key={stepIndex} sx={{ mb: 2 }}>
              {/* Step header */}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography fontWeight="bold" color="primary">{`Step ${
                  stepIndex + 1
                }`}</Typography>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeStep(stepIndex)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>

              <Box
                sx={{
                  border: '1px solid #ccc',
                  p: 2,
                  borderRadius: 2,
                  bgcolor: theme.palette.background.paper,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="Step Text"
                    value={step.text}
                    fullWidth
                    size="small"
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[stepIndex].text = e.target.value;
                      setSteps(updated);
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      const updated = [...steps];
                      updated[stepIndex].showDescription =
                        !updated[stepIndex].showDescription;
                      setSteps(updated);
                    }}
                  >
                    {step.showDescription ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )}
                  </IconButton>
                </Stack>

                <Collapse in={step.showDescription}>
                  <TextField
                    label="Step Description"
                    value={step.description}
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[stepIndex].description = e.target.value;
                      setSteps(updated);
                    }}
                    sx={{ mt: 1 }}
                  />
                </Collapse>

                {/* Substeps */}
                <Box mt={1}>
                  <Typography fontSize={14} fontWeight={500} mb={0.5}>
                    SubSteps
                  </Typography>

                  {step.subSteps.map((sub, subIndex) => (
                    <Stack
                      key={subIndex}
                      spacing={1}
                      direction="row"
                      mt={1}
                      alignItems="center"
                    >
                      <TextField
                        label="SubStep Text"
                        value={sub.text}
                        size="small"
                        onChange={(e) => {
                          const updated = [...steps];
                          updated[stepIndex].subSteps[subIndex].text =
                            e.target.value;
                          setSteps(updated);
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => {
                          const updated = [...steps];
                          updated[stepIndex].subSteps[
                            subIndex
                          ].showDescription =
                            !updated[stepIndex].subSteps[subIndex]
                              .showDescription;
                          setSteps(updated);
                        }}
                      >
                        {sub.showDescription ? (
                          <ExpandLessIcon fontSize="small" />
                        ) : (
                          <ExpandMoreIcon fontSize="small" />
                        )}
                      </IconButton>

                      <Collapse in={sub.showDescription}>
                        <TextField
                          label="SubStep Description"
                          value={sub.description}
                          size="small"
                          onChange={(e) => {
                            const updated = [...steps];
                            updated[stepIndex].subSteps[subIndex].description =
                              e.target.value;
                            setSteps(updated);
                          }}
                        />
                      </Collapse>

                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeSubStep(stepIndex, subIndex)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}

                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => addSubStep(stepIndex)}
                    sx={{ mt: 1 }}
                  >
                    + Add SubStep
                  </Button>
                </Box>
              </Box>
            </Box>
          ))}

          <Button
            size="medium"
            variant="contained"
            startIcon={<AddTaskIcon />}
            onClick={addStep}
            sx={{ alignSelf: 'flex-start', bgcolor: 'secondary.main' }}
          >
            Add Step
          </Button>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
