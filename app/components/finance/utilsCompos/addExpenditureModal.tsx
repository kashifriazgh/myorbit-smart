'use client';
import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Stack,
  CircularProgress,
  Collapse,
  IconButton,
  FormControlLabel,
  Chip,
  Fade,
  Avatar,
  Alert,
  InputAdornment,
} from '@mui/material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CategoryIcon from '@mui/icons-material/Category';
import TitleIcon from '@mui/icons-material/Title';
import CloseIcon from '@mui/icons-material/Close';
import { EXPENSE_CATEGORIES } from '@/app/lib/constant';
import { Expenditure } from '@/app/lib/interface';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { db } from '@/app/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export default function AddExpenditureDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (exp: Expenditure & { id: string }) => void;
}) {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const userId = user.uid;

  // ---- Form state ----
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'one-time' | 'recurring'>('one-time');
  const [frequency, setFrequency] = useState<
    'monthly' | 'weekly' | 'daily' | 'one_time'
  >('one_time');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(new Date());
  const [effectiveFromDate, setEffectiveFromDate] = useState<Date | null>(
    new Date()
  );
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // Validation states
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validation logic
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Basic required fields
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!amount || amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!category) {
      newErrors.category = 'Category is required';
    }

    // Type-specific validation
    if (type === 'recurring') {
      if (frequency === 'one_time') {
        newErrors.frequency =
          'Please select a frequency for recurring expenditure';
      }

      if (
        frequency === 'weekly' &&
        (dayOfWeek === null || dayOfWeek === undefined)
      ) {
        newErrors.dayOfWeek = 'Please select a day of the week';
      }

      if (
        frequency === 'monthly' &&
        (dayOfMonth === null || dayOfMonth === undefined)
      ) {
        newErrors.dayOfMonth = 'Please select a day of the month';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Reset validation when type changes
  useEffect(() => {
    if (type === 'one-time') {
      setFrequency('one_time');
      setDayOfWeek(null);
      setDayOfMonth(null);
      setEffectiveFromDate(new Date());
    }
    setErrors({});
  }, [type]);

  // Reset day selections when frequency changes
  useEffect(() => {
    if (frequency !== 'weekly') setDayOfWeek(null);
    if (frequency !== 'monthly') setDayOfMonth(null);
    setErrors({});
  }, [frequency]);

  const handleFieldChange = (field: string) => {
    // Clear error when user starts typing/selecting
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // ---- Reset form ----
  const resetForm = () => {
    setTitle('');
    setAmount('');
    setType('one-time');
    setFrequency('one_time');
    setCategory('');
    setIsPaid(false);
    setNotes('');
    setDueDate(new Date());
    setEffectiveFromDate(new Date());
    setDayOfWeek(null);
    setDayOfMonth(null);
    setNotesOpen(false);
    setErrors({});
  };

  // ---- Local Firestore save ----
  const handleSaveExpense = async (expense: Expenditure): Promise<string> => {
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'expenditures'), {
        ...expense,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    } finally {
      setSaving(false);
    }
  };

  // ---- Save button handler ----
  const handleSave = async () => {
    // Validate form before saving
    if (!validateForm()) {
      return;
    }

    const payload: Expenditure = {
      userId,
      title,
      amount: Number(amount),
      type,
      frequency,
      category,
      isPaid,
      notes,
      createdAt: new Date(), // local timestamps for UI
      updatedAt: new Date(),
    };

    if (type === 'one-time') {
      payload.dueDate = dueDate ?? new Date();
    } else if (type === 'recurring') {
      if (frequency === 'weekly') {
        payload.dayOfWeek = dayOfWeek ?? 0;
      }
      if (frequency === 'monthly') {
        payload.dayOfMonth = dayOfMonth ?? 1;
      }
      // Add effective from date if provided
      if (effectiveFromDate) {
        payload.effectiveFromDate = effectiveFromDate;
      }
    }

    try {
      const id = await handleSaveExpense(payload);
      onAdded({ ...payload, id });
      resetForm();
      onClose();
    } catch (e) {
      console.error('Error saving expenditure:', e);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="sm"
      TransitionComponent={Fade}
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#ffffff',
        }
      }}
    >
      <Box sx={{ 
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        p: 3,
        color: 'white',
        position: 'relative'
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
            <ShoppingCartIcon />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight="900" sx={{ letterSpacing: '-0.5px' }}>
              Add Expense
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
              Record your spending
            </Typography>
          </Box>
        </Stack>
        <IconButton 
          onClick={onClose}
          sx={{ 
            position: 'absolute', 
            right: 16, 
            top: 16, 
            color: 'white',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent sx={{ px: { xs: 2, sm: 4 }, py: 4 }}>
        <Stack spacing={2}>
          {/* Basic Information */}
          <TextField
            fullWidth
            label="Expenditure Title"
            placeholder="e.g., House Rent"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              handleFieldChange('title');
            }}
            error={!!errors.title}
            helperText={errors.title}
            required
            InputProps={{
              startAdornment: <TitleIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
            }}
          />

          <TextField
            fullWidth
            label="Amount (Rs)"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value === '' ? '' : Number(e.target.value));
              handleFieldChange('amount');
            }}
            error={!!errors.amount}
            helperText={errors.amount}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'text.secondary' }}>PKR</Typography>
                </InputAdornment>
              ),
            }}
          />

          <FormControl fullWidth error={!!errors.category} required>
            <InputLabel>Category</InputLabel>
            <Select
              value={category}
              label="Category"
              onChange={(e) => {
                setCategory(e.target.value);
                handleFieldChange('category');
              }}
              startAdornment={<CategoryIcon sx={{ mr: 1, ml: 0.5, color: 'text.secondary', fontSize: 20 }} />}
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </Select>
            {errors.category && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                {errors.category}
              </Typography>
            )}
          </FormControl>

          {/* Expenditure Type & Frequency */}
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                '&.Mui-focused': {
                  color: theme?.mode === 'dark' ? '#cbd5e1' : '#3b82f6',
                },
              }}>Expenditure Type</InputLabel>
              <Select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  handleFieldChange('type');
                }}
                sx={{
                  backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme?.mode === 'dark' ? '#475569' : '#d1d5db',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme?.mode === 'dark' ? '#64748b' : '#9ca3af',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme?.mode === 'dark' ? '#64748b' : '#3b82f6',
                  },
                  '& .MuiSvgIcon-root': {
                    color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  },
                }}
              >
                <MenuItem value="one-time" sx={{
                  backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                  '&:hover': {
                    backgroundColor: theme?.mode === 'dark' ? '#475569' : '#f3f4f6',
                  },
                }}>One-time</MenuItem>
                <MenuItem value="recurring" sx={{
                  backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                  '&:hover': {
                    backgroundColor: theme?.mode === 'dark' ? '#475569' : '#f3f4f6',
                  },
                }}>Recurring</MenuItem>
              </Select>
            </FormControl>

            {type === 'recurring' && (
              <FormControl fullWidth error={!!errors.frequency} required>
                <InputLabel sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  '&.Mui-focused': {
                    color: theme?.mode === 'dark' ? '#cbd5e1' : '#3b82f6',
                  },
                }}>Frequency</InputLabel>
                <Select
                  value={frequency}
                  onChange={(e) => {
                    setFrequency(e.target.value);
                    handleFieldChange('frequency');
                  }}
                  sx={{
                    backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme?.mode === 'dark' ? '#475569' : '#d1d5db',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme?.mode === 'dark' ? '#64748b' : '#9ca3af',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme?.mode === 'dark' ? '#64748b' : '#3b82f6',
                    },
                    '& .MuiSvgIcon-root': {
                      color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                    },
                  }}
                >
                  <MenuItem value="daily" sx={{
                    backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                    '&:hover': {
                      backgroundColor: theme?.mode === 'dark' ? '#475569' : '#f3f4f6',
                    },
                  }}>Daily</MenuItem>
                  <MenuItem value="weekly" sx={{
                    backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                    '&:hover': {
                      backgroundColor: theme?.mode === 'dark' ? '#475569' : '#f3f4f6',
                    },
                  }}>Weekly</MenuItem>
                  <MenuItem value="monthly" sx={{
                    backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                    '&:hover': {
                      backgroundColor: theme?.mode === 'dark' ? '#475569' : '#f3f4f6',
                    },
                  }}>Monthly</MenuItem>
                </Select>
                {errors.frequency && (
                  <Typography
                    variant="caption"
                    color="error"
                    sx={{ mt: 0.5, ml: 2 }}
                  >
                    {errors.frequency}
                  </Typography>
                )}
              </FormControl>
            )}
          </Stack>

          {/* Day Selection - Immediately after frequency */}
          {type === 'recurring' && frequency === 'weekly' && (
            <FormControl fullWidth error={!!errors.dayOfWeek} required>
              <InputLabel sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                '&.Mui-focused': {
                  color: theme?.mode === 'dark' ? '#cbd5e1' : '#3b82f6',
                },
              }}>Day of Week</InputLabel>
              <Select
                value={dayOfWeek ?? ''}
                onChange={(e) => {
                  setDayOfWeek(Number(e.target.value));
                  handleFieldChange('dayOfWeek');
                }}
                sx={{
                  backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme?.mode === 'dark' ? '#475569' : '#d1d5db',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme?.mode === 'dark' ? '#64748b' : '#9ca3af',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme?.mode === 'dark' ? '#64748b' : '#3b82f6',
                  },
                  '& .MuiSvgIcon-root': {
                    color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  },
                }}
              >
                {[
                  'Sunday',
                  'Monday',
                  'Tuesday',
                  'Wednesday',
                  'Thursday',
                  'Friday',
                  'Saturday',
                ].map((day, idx) => (
                  <MenuItem key={idx} value={idx} sx={{
                    backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                    '&:hover': {
                      backgroundColor: theme?.mode === 'dark' ? '#475569' : '#f3f4f6',
                    },
                  }}>
                    {day}
                  </MenuItem>
                ))}
              </Select>
              {errors.dayOfWeek && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ mt: 0.5, ml: 2 }}
                >
                  {errors.dayOfWeek}
                </Typography>
              )}
            </FormControl>
          )}

          {type === 'recurring' && frequency === 'monthly' && (
            <FormControl fullWidth error={!!errors.dayOfMonth} required>
              <InputLabel sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                '&.Mui-focused': {
                  color: theme?.mode === 'dark' ? '#cbd5e1' : '#3b82f6',
                },
              }}>Day of Month</InputLabel>
              <Select
                value={dayOfMonth ?? ''}
                onChange={(e) => {
                  setDayOfMonth(Number(e.target.value));
                  handleFieldChange('dayOfMonth');
                }}
                sx={{
                  backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme?.mode === 'dark' ? '#475569' : '#d1d5db',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme?.mode === 'dark' ? '#64748b' : '#9ca3af',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme?.mode === 'dark' ? '#64748b' : '#3b82f6',
                  },
                  '& .MuiSvgIcon-root': {
                    color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  },
                }}
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                  <MenuItem key={day} value={day} sx={{
                    backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                    '&:hover': {
                      backgroundColor: theme?.mode === 'dark' ? '#475569' : '#f3f4f6',
                    },
                  }}>
                    {day}
                  </MenuItem>
                ))}
              </Select>
              {errors.dayOfMonth && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ mt: 0.5, ml: 2 }}
                >
                  {errors.dayOfMonth}
                </Typography>
              )}
            </FormControl>
          )}

          {/* Date Pickers - Elegant styling */}
          {type === 'one-time' && (
            <Box
              sx={{
                p: 2,
                bgcolor: theme?.mode === 'dark' ? '#1e293b' : '#fff3e0',
                border: theme?.mode === 'dark' ? '2px solid #334155' : '2px solid #ffcc02',
                borderRadius: 2,
                '& .react-datepicker-wrapper': { width: '100%' },
                '& .react-datepicker__input-container input': {
                  width: '100%',
                  padding: '12px',
                  border: theme?.mode === 'dark' ? '2px solid #475569' : '2px solid #ff9800',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: theme?.mode === 'dark' ? '#334155' : '#fff',
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                  '&:focus': {
                    borderColor: theme?.mode === 'dark' ? '#64748b' : '#f57c00',
                    outline: 'none',
                  },
                  '&::placeholder': {
                    color: theme?.mode === 'dark' ? '#94a3b8' : '#666666',
                  },
                },
              }}
            >
              <Typography
                variant="body2"
                fontWeight="medium"
                sx={{ 
                  mb: 1, 
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#f57c00' 
                }}
              >
                📅 Due Date
              </Typography>
              <DatePicker
                selected={dueDate}
                onChange={(date: Date | null) => setDueDate(date)}
                dateFormat="yyyy-MM-dd"
                className="custom-datepicker"
                placeholderText="Select due date"
              />
            </Box>
          )}

          {type === 'recurring' && (
            <Box
              sx={{
                p: 2,
                bgcolor: theme?.mode === 'dark' ? '#1e293b' : '#fce4ec',
                border: theme?.mode === 'dark' ? '2px solid #334155' : '2px solid #f8bbd9',
                borderRadius: 2,
                '& .react-datepicker-wrapper': { width: '100%' },
                '& .react-datepicker__input-container input': {
                  width: '100%',
                  padding: '12px',
                  border: theme?.mode === 'dark' ? '2px solid #475569' : '2px solid #e91e63',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: theme?.mode === 'dark' ? '#334155' : '#fff',
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                  '&:focus': {
                    borderColor: theme?.mode === 'dark' ? '#64748b' : '#c2185b',
                    outline: 'none',
                  },
                  '&::placeholder': {
                    color: theme?.mode === 'dark' ? '#94a3b8' : '#666666',
                  },
                },
              }}
            >
              <Typography
                variant="body2"
                fontWeight="medium"
                sx={{ 
                  mb: 1, 
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#c2185b' 
                }}
              >
                🚀 With Effect From
              </Typography>
              <DatePicker
                selected={effectiveFromDate}
                onChange={(date: Date | null) => setEffectiveFromDate(date)}
                dateFormat="yyyy-MM-dd"
                className="custom-datepicker"
                placeholderText="Select start date"
                minDate={new Date()}
                isClearable
                showYearDropdown
                showMonthDropdown
                dropdownMode="select"
              />
              {effectiveFromDate && (
                <Chip
                  label={`Starts: ${effectiveFromDate.toLocaleDateString()}`}
                  color="secondary"
                  size="small"
                  sx={{ 
                    mt: 1,
                    backgroundColor: theme?.mode === 'dark' ? '#475569' : undefined,
                    color: theme?.mode === 'dark' ? '#f1f5f9' : undefined,
                  }}
                />
              )}
            </Box>
          )}

          {/* Notes & Options Section */}
          <Box>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ cursor: 'pointer', mb: 1 }}
              onClick={() => setNotesOpen(!notesOpen)}
            >
              <Typography variant="body2" fontWeight="medium" sx={{
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
              }}>
                📝 Notes & Options (Optional)
              </Typography>
              <IconButton size="small">
                <ExpandMoreIcon
                  sx={{
                    transform: notesOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}
                />
              </IconButton>
            </Stack>
            <Collapse in={notesOpen}>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isPaid}
                      onChange={(e) => setIsPaid(e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="medium" sx={{
                        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                      }}>
                        Mark as paid now
                      </Typography>
                      <Typography variant="caption" sx={{
                        color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                      }}>
                        Check this if you&apos;ve already paid this expenditure
                      </Typography>
                    </Box>
                  }
                />
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Add any additional notes about this expenditure..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                      color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                      '& fieldset': {
                        borderColor: theme?.mode === 'dark' ? '#475569' : '#d1d5db',
                      },
                      '&:hover fieldset': {
                        borderColor: theme?.mode === 'dark' ? '#64748b' : '#9ca3af',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: theme?.mode === 'dark' ? '#64748b' : '#3b82f6',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                      '&.Mui-focused': {
                        color: theme?.mode === 'dark' ? '#cbd5e1' : '#3b82f6',
                      },
                    },
                  }}
                />
              </Stack>
            </Collapse>
          </Box>
        </Stack>

        {/* Validation Summary */}
        {Object.keys(errors).length > 0 && (
          <Alert severity="error" sx={{ mb: 2, mt: 2 }}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              Please fix the following errors:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>
                  <Typography variant="caption">{error}</Typography>
                </li>
              ))}
            </ul>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, sm: 4 }, py: 3, gap: 1, bgcolor: theme?.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
        <Button 
          onClick={onClose} 
          variant="text" 
          disabled={saving}
          sx={{ fontWeight: 700, color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={saving}
          onClick={handleSave}
          color="error"
          sx={{ 
            px: 4, 
            py: 1, 
            borderRadius: 2, 
            fontWeight: 800,
            boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.39)',
            textTransform: 'none'
          }}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {saving ? 'Creating...' : 'Add Expenditure'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
