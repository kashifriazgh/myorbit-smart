'use client';

import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  IconButton,
  Modal,
  Tooltip,
  TextField,
  useTheme as useMuiTheme,
  MobileStepper,
  Skeleton,
} from '@mui/material';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  Timestamp,
  updateDoc,
  doc,
} from 'firebase/firestore';
import moment from 'moment-timezone';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { IncomeSource } from '@/app/lib/interface';
import { Event } from '@mui/icons-material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';

export default function ExpectedIncome() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const muiTheme = useMuiTheme();

  const [items, setItems] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null); // For fade-out
  const [activeStep, setActiveStep] = useState(0);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState<IncomeSource | null>(
    null
  );
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false); // New loading state for save button

  const now = moment().startOf('day');
  const endOfMonth = moment().endOf('month');

  const fetchIncome = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const snap = await getDocs(collection(db, 'incomeSources'));
      const allIncome = snap.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as IncomeSource[];

      const filtered = allIncome
        .filter((inc) => {
          const expected =
            (inc.expectedDate as Timestamp)?.toDate?.() || inc.expectedDate;
          const due = moment(expected);
          return (
            inc.userId === user.uid &&
            !inc.isReceived &&
            due.isSameOrAfter(now) &&
            due.isSameOrBefore(endOfMonth)
          );
        })
        .sort((a, b) => {
          const aDue = moment(
            (a.expectedDate as Timestamp)?.toDate?.() || a.expectedDate
          );
          const bDue = moment(
            (b.expectedDate as Timestamp)?.toDate?.() || b.expectedDate
          );
          return aDue.diff(bDue);
        })
        .slice(0, 6);

      setItems(filtered);
    } catch (err) {
      console.error('❌ Failed to load expected income:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsReceived = async (inc: IncomeSource) => {
    if (!inc.id) return;

    setMarkingId(inc.id);

    try {
      await updateDoc(doc(db, 'incomeSources', inc.id), {
        isReceived: true,
        updatedAt: new Date(),
      });

      // Start fade-out transition
      setRemovingId(inc.id);

      // After fade-out delay, remove the item
      setTimeout(() => {
        setItems((prev) => {
          const updated = prev.filter((item) => item.id !== inc.id);
          if (activeStep >= updated.length) {
            setActiveStep(Math.max(updated.length - 1, 0));
          }
          return updated;
        });
        setRemovingId(null);
      }, 300); // match transition duration
    } catch (err) {
      console.error('❌ Failed to mark income as received:', err);
    } finally {
      setMarkingId(null);
    }
  };

  const handleReschedule = (item: IncomeSource) => {
    setRescheduleItem(item);
    const date =
      item.expectedDate instanceof Timestamp
        ? item.expectedDate.toDate()
        : new Date(item.expectedDate as Date);
    setNewDate(date);
    setRescheduleOpen(true);
  };

  const updateExpectedDate = async () => {
    if (!rescheduleItem || !newDate) return;
    setReschedulingLoading(true);
    try {
      await updateDoc(doc(db, 'incomeSources', rescheduleItem.id), {
        expectedDate: Timestamp.fromDate(newDate),
        updatedAt: new Date(),
      });
      setRescheduleOpen(false);
      setRescheduleItem(null);
      fetchIncome();
    } catch (err) {
      console.error('❌ Failed to reschedule income:', err);
    } finally {
      setReschedulingLoading(false);
    }
  };

  useEffect(() => {
    fetchIncome();
  }, [user]);

  if (!theme) return null; // or return a loading skeleton

  if (loading) {
    return (
      <Box mt={3}>
        <Typography fontWeight={700} fontSize={18} mb={2} color="#10b981">
          💰 Upcoming Income
        </Typography>

        {/* Skeleton for card */}
        <Box
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 2,
            background: theme.mode === 'dark' ? '#1f2937' : '#f0fdf4',
            boxShadow: muiTheme.shadows[1],
            borderLeft: `4px solid #10b981`,
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Skeleton width={120} height={20} />
              <Skeleton width={80} height={16} sx={{ mt: 0.5 }} />
            </Box>

            <Skeleton width={60} height={20} />
          </Stack>

          <Stack direction="row" spacing={1} mt={2}>
            <Skeleton variant="rectangular" width={120} height={32} />
            <Skeleton variant="circular" width={32} height={32} />
          </Stack>
        </Box>
      </Box>
    );
  }

  if (items.length === 0) return null;

  const bgColor = theme.mode === 'dark' ? '#1f2937' : '#f0fdf4';
  const textColor = theme.mode === 'dark' ? '#e2e8f0' : '#064e3b';
  const borderColor = '#10b981';
  const activeItem = items[activeStep] ?? items[items.length - 1];

  return (
    <Box mt={3}>
      <Typography fontWeight={700} fontSize={18} mb={2} color={borderColor}>
        💰 Upcoming Income
      </Typography>

      {activeItem && (
        <Box
          key={activeItem.id}
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 2,
            background: bgColor,
            color: textColor,
            boxShadow: muiTheme.shadows[1],
            borderLeft: `4px solid ${borderColor}`,
            opacity: removingId === activeItem.id ? 0 : 1,
            transition: 'opacity 300ms ease',
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Typography fontWeight={600}>{activeItem.title}</Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                Expected:{' '}
                {moment(
                  (activeItem.expectedDate as Timestamp)?.toDate?.() ||
                    activeItem.expectedDate
                ).format('MMM D')}
              </Typography>
            </Box>

            <Typography fontWeight={600}>
              Rs {activeItem.amount.toLocaleString()}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} mt={2}>
            <Button
              size="small"
              variant="outlined"
              sx={{
                fontSize: 12,
                borderColor: borderColor,
                color: borderColor,
                '&:hover': {
                  backgroundColor:
                    theme.mode === 'dark' ? '#064e3b' : '#d1fae5',
                  borderColor: '#047857',
                },
              }}
              onClick={() => markAsReceived(activeItem)}
              disabled={markingId === activeItem.id}
              startIcon={
                markingId === activeItem.id ? (
                  <CircularProgress size={16} />
                ) : null
              }
            >
              {markingId === activeItem.id ? 'Updating...' : 'Mark as Received'}
            </Button>

            <Tooltip title="Reschedule">
              <IconButton
                size="small"
                onClick={() => handleReschedule(activeItem)}
                sx={{
                  color: '#10b981',
                  border: '1px solid #10b981',
                  borderRadius: 1,
                  height: 32,
                  width: 32,
                }}
              >
                <Event fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}

      <MobileStepper
        variant="dots"
        steps={items.length}
        position="static"
        activeStep={activeStep}
        nextButton={
          <Button
            size="small"
            onClick={() => setActiveStep((prev) => prev + 1)}
            disabled={activeStep >= items.length - 1}
          >
            Next
            <KeyboardArrowRight />
          </Button>
        }
        backButton={
          <Button
            size="small"
            onClick={() => setActiveStep((prev) => prev - 1)}
            disabled={activeStep === 0}
          >
            <KeyboardArrowLeft />
            Back
          </Button>
        }
      />

      <Modal open={rescheduleOpen} onClose={() => setRescheduleOpen(false)}>
        <Box
          sx={{
            p: 3,
            backgroundColor: theme.mode === 'dark' ? '#1e293b' : '#fff',
            borderRadius: 2,
            width: 300,
            mx: 'auto',
            mt: '15%',
            boxShadow: muiTheme.shadows[5],
          }}
        >
          <Typography fontWeight={600} mb={2}>
            Reschedule Income
          </Typography>

          <DatePicker
            selected={newDate}
            onChange={(date: Date | null) => setNewDate(date)}
            minDate={new Date()}
            dateFormat="yyyy-MM-dd"
            customInput={
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                label="New Expected Date"
              />
            }
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
            <Button onClick={() => setRescheduleOpen(false)}>Cancel</Button>
            <Button
              onClick={updateExpectedDate}
              variant="contained"
              disabled={!newDate || reschedulingLoading}
            >
              {reschedulingLoading ? (
                <CircularProgress size={20} sx={{ color: 'white' }} />
              ) : (
                'Save'
              )}
            </Button>
          </Stack>
        </Box>
      </Modal>
    </Box>
  );
}
