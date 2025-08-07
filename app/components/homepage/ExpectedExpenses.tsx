// Updated <ExpectedExpenses /> with Stepper and UI improvements
'use client';

import {
  Box,
  CircularProgress,
  Stack,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Modal,
  TextField,
  useTheme as useMuiTheme,
  MobileStepper,
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
import { Expenditure } from '@/app/lib/interface';
import { Event } from '@mui/icons-material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';

export default function ExpectedExpenses() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const muiTheme = useMuiTheme();

  const [items, setItems] = useState<Expenditure[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState<Expenditure | null>(
    null
  );
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'expenditures'));
      const allExpenses = snap.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as Expenditure[];

      const filtered = allExpenses
        .filter((exp) => {
          const due = moment(
            (exp.dueDate as Timestamp)?.toDate?.() || exp.dueDate
          );
          return (
            exp.userId === user.uid &&
            !exp.isPaid &&
            due.isSameOrAfter(moment(), 'day')
          );
        })

        .sort((a, b) => {
          const aDue = moment(
            (a.dueDate as Timestamp)?.toDate?.() || a.dueDate
          );
          const bDue = moment(
            (b.dueDate as Timestamp)?.toDate?.() || b.dueDate
          );
          return aDue.diff(bDue);
        })
        .slice(0, 6);

      setItems(filtered);
      setActiveStep(0);
    } catch (err) {
      console.error('❌ Failed to load expected expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsPaid = async (exp: Expenditure) => {
    if (!exp.id) return;
    setItems((prev) => {
      const updated = prev.filter((item) => item.id !== exp.id);
      if (activeStep >= updated.length) {
        setActiveStep(Math.max(updated.length - 1, 0));
      }
      return updated;
    });

    try {
      setMarkingId(exp.id);
      await updateDoc(doc(db, 'expenditures', exp.id), {
        isPaid: true,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('❌ Failed to mark expense as paid:', err);
    } finally {
      setMarkingId(null);
    }
  };

  const handleReschedule = (item: Expenditure) => {
    setRescheduleItem(item);
    const date =
      item.dueDate instanceof Timestamp
        ? item.dueDate.toDate()
        : new Date(item.dueDate);
    setNewDueDate(date);
    setRescheduleOpen(true);
  };

  const updateDueDate = async () => {
    if (!rescheduleItem || !newDueDate) return;
    try {
      await updateDoc(doc(db, 'expenditures', rescheduleItem.id), {
        dueDate: Timestamp.fromDate(newDueDate),
        updatedAt: new Date(),
      });
      setRescheduleOpen(false);
      setRescheduleItem(null);
      fetchData();
    } catch (err) {
      console.error('❌ Failed to reschedule expense:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (items.length === 0) return null;

  const activeItem = items[activeStep];
  const bgColor = theme.mode === 'dark' ? '#1f2937' : '#fef2f2';
  const textColor = theme.mode === 'dark' ? '#e2e8f0' : '#1f2937';
  const borderColor = '#e11d48';

  return (
    <Box mt={3}>
      <Typography fontWeight={700} fontSize={18} mb={2} color={borderColor}>
        💸 Upcoming Payments
      </Typography>

      {activeItem && (
        <Box
          key={activeItem.id}
          sx={{
            p: 3,
            mb: 2,
            borderRadius: 3,
            background: bgColor,
            color: textColor,
            boxShadow: muiTheme.shadows[3],
            borderLeft: `5px solid ${borderColor}`,
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Typography fontWeight={600} fontSize={16}>
                {activeItem.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Due:{' '}
                {moment(
                  activeItem.dueDate instanceof Timestamp
                    ? activeItem.dueDate.toDate()
                    : activeItem.dueDate
                ).format('MMM D, YYYY')}
              </Typography>
            </Box>
            <Typography fontWeight={600} fontSize={16}>
              Rs {activeItem.amount.toLocaleString()}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} mt={2}>
            <Button
              size="small"
              variant="outlined"
              sx={{
                fontSize: 12,
                borderColor,
                color: borderColor,
                '&:hover': { backgroundColor: '#fee2e2' },
              }}
              onClick={() => markAsPaid(activeItem)}
              disabled={markingId === activeItem.id}
            >
              {markingId === activeItem.id ? 'Updating...' : 'Mark as Paid'}
            </Button>

            <Tooltip title="Reschedule">
              <IconButton
                size="small"
                onClick={() => handleReschedule(activeItem)}
                sx={{
                  color: '#f59e0b',
                  border: '1px solid #f59e0b',
                  borderRadius: 1,
                }}
              >
                <Event fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}

      <MobileStepper
        variant="progress"
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
        sx={{ mt: 1 }}
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
            Reschedule Payment
          </Typography>

          <DatePicker
            selected={newDueDate}
            onChange={(date: Date | null) => setNewDueDate(date)}
            minDate={new Date()}
            dateFormat="yyyy-MM-dd"
            customInput={
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                label="New Due Date"
              />
            }
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
            <Button onClick={() => setRescheduleOpen(false)}>Cancel</Button>
            <Button
              onClick={updateDueDate}
              variant="contained"
              disabled={!newDueDate}
            >
              Save
            </Button>
          </Stack>
        </Box>
      </Modal>
    </Box>
  );
}
