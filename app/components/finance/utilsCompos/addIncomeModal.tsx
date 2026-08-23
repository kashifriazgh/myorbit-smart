'use client';
import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Collapse,
  IconButton,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  Chip,
  Fade,
  Avatar,
  InputAdornment,
} from '@mui/material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CategoryIcon from '@mui/icons-material/Category';
import TitleIcon from '@mui/icons-material/Title';
import CloseIcon from '@mui/icons-material/Close';

import { INCOME_CATEGORIES } from '@/app/lib/constant';
import { IncomeSource } from '@/app/lib/interface';
import { saveIncomeSource } from '@/app/lib/functions/incomeSources';
import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function AddIncomeModal({
  open,
  onClose,
  onAdded,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (income: IncomeSource & { id: string }) => void;
  userId: string;
}) {
  const { theme } = useCustomTheme();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'one-time' | 'recurring'>('one-time');
  const [frequency, setFrequency] = useState<
    'monthly' | 'weekly' | 'daily' | 'one_time'
  >('one_time');
  const [category, setCategory] = useState('');
  const [expectedDate, setExpectedDate] = useState<Date | null>(new Date());
  const [effectiveFromDate, setEffectiveFromDate] = useState<Date | null>(
    new Date()
  );
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(null);
  const [isReceived, setIsReceived] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
        newErrors.frequency = 'Please select a frequency for recurring income';
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
      setEffectiveFromDate(null);
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

  const handleSave = async () => {
    // Validate form before saving
    if (!validateForm()) {
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      const payload: IncomeSource = {
        userId,
        title,
        amount: Number(amount),
        type,
        frequency,
        category,
        isReceived,
        notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (type === 'one-time') {
        payload.expectedDate = expectedDate || new Date();
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

      const id = await saveIncomeSource(payload);
      onAdded({ ...payload, id });
      onClose();

      // Reset form
      setTitle('');
      setAmount('');
      setCategory('');
      setType('one-time');
      setFrequency('one_time');
      setExpectedDate(new Date());
      setEffectiveFromDate(new Date());
      setDayOfWeek(null);
      setDayOfMonth(null);
      setIsReceived(false);
      setNotes('');
      setNotesOpen(false);
      setErrors({});
    } catch (err) {
      console.error('Error saving income:', err);
    } finally {
      setSaving(false);
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
        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        p: 3,
        color: 'white',
        position: 'relative'
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
            <AccountBalanceWalletIcon />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight="900" sx={{ letterSpacing: '-0.5px' }}>
              Add Income
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
              Track your new earnings
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
            label="Income Title"
            placeholder="e.g., Monthly Salary"
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
              {INCOME_CATEGORIES.map((cat) => (
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

          {/* Income Type & Frequency */}
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Income Type</InputLabel>
              <Select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  handleFieldChange('type');
                }}
              >
                <MenuItem value="one-time">One-time</MenuItem>
                <MenuItem value="recurring">Recurring</MenuItem>
              </Select>
            </FormControl>

            {type === 'recurring' && (
              <FormControl fullWidth error={!!errors.frequency} required>
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={frequency}
                  onChange={(e) => {
                    setFrequency(e.target.value);
                    handleFieldChange('frequency');
                  }}
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
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
              <InputLabel>Day of Week</InputLabel>
              <Select
                value={dayOfWeek ?? ''}
                onChange={(e) => {
                  setDayOfWeek(Number(e.target.value));
                  handleFieldChange('dayOfWeek');
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
                  <MenuItem key={idx} value={idx}>
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
              <InputLabel>Day of Month</InputLabel>
              <Select
                value={dayOfMonth ?? ''}
                onChange={(e) => {
                  setDayOfMonth(Number(e.target.value));
                  handleFieldChange('dayOfMonth');
                }}
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                  <MenuItem key={day} value={day}>
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
                bgcolor: theme?.mode === 'dark' ? '#1e293b' : '#f8f9ff',
                border: theme?.mode === 'dark' ? '2px solid #334155' : '2px solid #e3f2fd',
                borderRadius: 2,
                '& .react-datepicker-wrapper': { width: '100%' },
                '& .react-datepicker__input-container input': {
                  width: '100%',
                  padding: '12px',
                  border: theme?.mode === 'dark' ? '2px solid #475569' : '2px solid #2196f3',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: theme?.mode === 'dark' ? '#334155' : '#fff',
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                  '&:focus': {
                    borderColor: theme?.mode === 'dark' ? '#64748b' : '#1976d2',
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
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#1976d2' 
                }}
              >
                📅 Expected Date
              </Typography>
              <DatePicker
                selected={expectedDate}
                onChange={(date: Date | null) => setExpectedDate(date)}
                dateFormat="yyyy-MM-dd"
                className="custom-datepicker"
                placeholderText="Select expected date"
              />
            </Box>
          )}

          {type === 'recurring' && (
            <Box
              sx={{
                p: 2,
                bgcolor: theme?.mode === 'dark' ? '#1e293b' : '#f3e5f5',
                border: theme?.mode === 'dark' ? '2px solid #334155' : '2px solid #e1bee7',
                borderRadius: 2,
                '& .react-datepicker-wrapper': { width: '100%' },
                '& .react-datepicker__input-container input': {
                  width: '100%',
                  padding: '12px',
                  border: theme?.mode === 'dark' ? '2px solid #475569' : '2px solid #9c27b0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: theme?.mode === 'dark' ? '#334155' : '#fff',
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                  '&:focus': {
                    borderColor: theme?.mode === 'dark' ? '#64748b' : '#7b1fa2',
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
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#7b1fa2' 
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
              <Typography variant="body2" fontWeight="medium">
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
                      checked={isReceived}
                      onChange={(e) => setIsReceived(e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        Mark as received now
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Check this if you&apos;ve already received this income
                      </Typography>
                    </Box>
                  }
                />
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Add any additional notes about this income source..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Stack>
            </Collapse>
          </Box>
        </Stack>

        {/* Validation Summary */}
        {Object.keys(errors).length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
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
          sx={{ 
            px: 4, 
            py: 1, 
            borderRadius: 2, 
            fontWeight: 800,
            boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
            textTransform: 'none'
          }}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {saving ? 'Creating...' : 'Add Income Source'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
