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
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { useEffect, useState } from 'react';
import moment from 'moment-timezone';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Expenditure, TransactionSource } from '@/app/lib/interface';
import { Event } from '@mui/icons-material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import {
  useExpenditures,
  ExpendituresProvider,
} from '@/app/lib/context/ExpendituresContext';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { TotalCashSnapshot } from '@/app/lib/interface';

function ExpectedExpenses() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const muiTheme = useMuiTheme();
  const {
    expenditures,
    banks,
    loading,
    markAsPaid,
    rescheduleExpenditure,
    addNewBank,
  } = useExpenditures();

  const [markingId, setMarkingId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState<Expenditure | null>(
    null
  );
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false);

  // Fund deduction state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedExpenditure, setSelectedExpenditure] =
    useState<Expenditure | null>(null);
  const [deductionSource, setDeductionSource] =
    useState<TransactionSource>('in_hand');
  const [selectedBank, setSelectedBank] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [availableFunds, setAvailableFunds] = useState(0);
  const [insufficientFunds, setInsufficientFunds] = useState(false);

  const SOURCE_OPTIONS: TransactionSource[] = [
    'bank',
    'in_hand',
    'easypaisa',
    'jazzcash',
    'other',
  ];

  // Filter expenditures for upcoming expenses
  const items = expenditures
    .filter((exp) => {
      const due = moment(exp.dueDate);
      return !exp.isPaid && due.isSameOrAfter(moment(), 'day');
    })
    .sort((a, b) => {
      const aDue = moment(a.dueDate);
      const bDue = moment(b.dueDate);
      return aDue.diff(bDue);
    })
    .slice(0, 6);

  const handleMarkAsPaid = async (exp: Expenditure) => {
    if (!exp.id) return;
    setMarkingId(exp.id);
    setSelectedExpenditure(exp);
    setDeductionSource('in_hand');
    setSelectedBank('');
    setConfirmDialogOpen(true);
    setMarkingId(null);
  };

  const markExpensePaid = async (exp: Expenditure, deductFromFund: boolean) => {
    try {
      setMarkingId(exp.id!);
      await markAsPaid(exp, deductFromFund, deductionSource, selectedBank);
      if (activeStep >= items.length - 1) {
        setActiveStep(Math.max(items.length - 2, 0));
      }
    } catch (e) {
      console.error('Error marking expense paid:', e);
    } finally {
      setMarkingId(null);
    }
  };

  const handleReschedule = (item: Expenditure) => {
    setRescheduleItem(item);
    const dueDate =
      item.dueDate instanceof Timestamp ? item.dueDate.toDate() : item.dueDate;
    setNewDueDate(dueDate || new Date());
    setRescheduleOpen(true);
  };

  const updateDueDate = async () => {
    if (!rescheduleItem || !newDueDate) return;
    setReschedulingLoading(true);
    try {
      await rescheduleExpenditure(rescheduleItem.id!, newDueDate);
      setRescheduleOpen(false);
      setRescheduleItem(null);
    } catch (err) {
      console.error('❌ Failed to reschedule expense:', err);
    } finally {
      setReschedulingLoading(false);
    }
  };

  // Available funds refresh
  const refreshAvailableFunds = async (
    source: TransactionSource,
    bankId?: string
  ) => {
    try {
      const docRef = doc(db, 'totalCashSnapshots', user?.uid || '');
      const snap = await getDoc(docRef);
      let available = 0;

      if (snap.exists()) {
        const data = snap.data() as TotalCashSnapshot;

        if (source === 'bank') {
          const bankName = banks.find((b) => b.id === bankId)?.name;
          if (bankName) {
            const bankMap = data.sources?.bank || {};
            available = bankMap[bankName] || 0;
          } else {
            available = 0;
          }
        } else {
          available = (data.sources?.[source] as number) || 0;
        }
      } else {
        available = 0;
      }

      setAvailableFunds(available);
      setInsufficientFunds(
        !!selectedExpenditure && available < selectedExpenditure.amount
      );
    } catch (e) {
      console.error('Error fetching available funds:', e);
      setAvailableFunds(0);
      setInsufficientFunds(true);
    }
  };

  // Refresh available funds whenever dialog opens / selection changes
  useEffect(() => {
    if (!confirmDialogOpen) return;
    if (deductionSource === 'bank') {
      refreshAvailableFunds('bank', selectedBank);
    } else {
      refreshAvailableFunds(deductionSource);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmDialogOpen, deductionSource, selectedBank]);

  const handleConfirmYes = async () => {
    if (!selectedExpenditure) return;
    setActionLoading(true);
    await markExpensePaid(selectedExpenditure, true);
    setActionLoading(false);
    setConfirmDialogOpen(false);
    setSelectedExpenditure(null);
  };

  const handleConfirmNo = async () => {
    if (!selectedExpenditure) return;
    setActionLoading(true);
    await markExpensePaid(selectedExpenditure, false);
    setActionLoading(false);
    setConfirmDialogOpen(false);
    setSelectedExpenditure(null);
  };

  if (!theme) return null; // or return a loading skeleton

  if (loading) {
    return (
      <Box mt={3}>
        <Typography fontWeight={700} fontSize={18} mb={2} color="#10b981">
          💸 Upcoming Expenses
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
                Due: {moment(activeItem.dueDate).format('MMM D, YYYY')}
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
              onClick={() => handleMarkAsPaid(activeItem)}
              disabled={markingId === activeItem.id}
            >
              {markingId === activeItem.id ? (
                <CircularProgress size={20} />
              ) : (
                'Mark as Paid'
              )}
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
              disabled={!newDueDate || reschedulingLoading}
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

      {/* Mark as Paid: Deduct from main fund? */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Deduct from main fund?</DialogTitle>
        <DialogContent>
          <Typography>
            Do you want to deduct{' '}
            <strong>Rs {selectedExpenditure?.amount}</strong> for{' '}
            <em>{selectedExpenditure?.title}</em> from your main fund?
          </Typography>

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Deduct From</InputLabel>
            <Select
              value={deductionSource}
              label="Deduct From"
              onChange={(e) =>
                setDeductionSource(e.target.value as TransactionSource)
              }
            >
              {SOURCE_OPTIONS.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {deductionSource === 'bank' && (
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Bank</InputLabel>
                <Select
                  value={selectedBank}
                  label="Bank"
                  onChange={(e) => setSelectedBank(e.target.value)}
                >
                  {banks.map((bank) => (
                    <MenuItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="New Bank"
                size="small"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={async () => {
                  if (!newBankName.trim()) return;
                  try {
                    const newBank = await addNewBank(newBankName.trim());
                    setSelectedBank(newBank.id);
                    setNewBankName('');
                  } catch (e) {
                    console.error('Error adding bank:', e);
                  }
                }}
                disabled={!newBankName.trim()}
              >
                Add Bank
              </Button>
            </Stack>
          )}

          <Typography mt={1} fontSize={14}>
            Available in <strong>{deductionSource}</strong>
            {deductionSource === 'bank' &&
              selectedBank &&
              ` (${banks.find((b) => b.id === selectedBank)?.name})`}
            : Rs {availableFunds.toLocaleString()}
          </Typography>

          {insufficientFunds && (
            <Typography mt={1} color="error" fontWeight="bold" fontSize={13}>
              ⚠️ Not enough balance in the selected source. You can still mark
              as paid without deduction (press &#34;No&#34;).
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialogOpen(false)}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirmNo} disabled={actionLoading}>
            No
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmYes}
            disabled={
              actionLoading || (deductionSource === 'bank' && !selectedBank)
            }
          >
            {actionLoading ? <CircularProgress size={18} /> : 'Yes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function ExpectedExpensesWithProvider() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <ExpendituresProvider userId={user.uid}>
      <ExpectedExpenses />
    </ExpendituresProvider>
  );
}
