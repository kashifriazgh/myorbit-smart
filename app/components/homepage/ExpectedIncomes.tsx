'use client';

import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  useTheme as useMuiTheme,
  MobileStepper,
  Skeleton,
} from '@mui/material';

import { useState } from 'react';
import moment from 'moment-timezone';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useIncomeSources } from '@/app/lib/context/IncomeSourcesContext';
import { IncomeSource, TransactionSource } from '@/app/lib/interface';
import MarkAsReceivedDialog from '../finance/MarkAsReceivedDialog';
import RescheduleDialog from '../finance/RescheduleDialog';
import { Event } from '@mui/icons-material';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';

export default function ExpectedIncome() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const muiTheme = useMuiTheme();
  const {
    incomeSources,
    banks,
    loading,
    markAsReceived,
    rescheduleIncome,
    addNewBank,
  } = useIncomeSources();

  const [removingId, setRemovingId] = useState<string | null>(null); // For fade-out
  const [activeStep, setActiveStep] = useState(0);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [markAsReceivedOpen, setMarkAsReceivedOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<IncomeSource | null>(
    null
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const now = moment().startOf('day');
  const endOfMonth = moment().endOf('month');

  // Filter income sources for expected incomes
  const items = incomeSources
    .filter((inc) => {
      const expected = inc.expectedDate;
      const due = moment(expected);
      return (
        inc.userId === user?.uid &&
        !inc.isReceived &&
        due.isSameOrAfter(now) &&
        due.isSameOrBefore(endOfMonth)
      );
    })
    .sort((a, b) => {
      const aDue = moment(a.expectedDate);
      const bDue = moment(b.expectedDate);
      return aDue.diff(bDue);
    })
    .slice(0, 6);

  const handleMarkAsReceived = (inc: IncomeSource) => {
    setSelectedIncome(inc);
    setMarkAsReceivedOpen(true);
  };

  const handleMarkAsReceivedConfirm = async (
    updateMainFund: boolean,
    fundSource?: TransactionSource,
  bankId?: string,
  customPaymentHeadId?: string
  ) => {
    if (!selectedIncome) return;
    setActionLoading(true);
    try {
    await markAsReceived(
      selectedIncome,
      updateMainFund,
      fundSource,
      bankId,
      customPaymentHeadId
    );
      setMarkAsReceivedOpen(false);
      setSelectedIncome(null);

      // Start fade-out transition
      setRemovingId(selectedIncome.id!);
      setTimeout(() => {
        setRemovingId(null);
        if (activeStep >= items.length - 1) {
          setActiveStep(Math.max(items.length - 2, 0));
        }
      }, 300);
    } catch (error) {
      console.error('Error marking as received:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = (item: IncomeSource) => {
    setSelectedIncome(item);
    setRescheduleOpen(true);
  };

  const handleRescheduleConfirm = async (newDate: Date) => {
    if (!selectedIncome?.id) return;
    setRescheduleLoading(true);
    try {
      await rescheduleIncome(selectedIncome.id, newDate);
      setRescheduleOpen(false);
      setSelectedIncome(null);
    } catch (error) {
      console.error('Error rescheduling:', error);
    } finally {
      setRescheduleLoading(false);
    }
  };

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
              onClick={() => handleMarkAsReceived(activeItem)}
              disabled={actionLoading}
              startIcon={actionLoading ? <CircularProgress size={16} /> : null}
            >
              {actionLoading ? 'Updating...' : 'Mark as Received'}
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

      {/* Mark as Received Dialog */}
      <MarkAsReceivedDialog
        open={markAsReceivedOpen}
        onClose={() => setMarkAsReceivedOpen(false)}
        income={selectedIncome}
        banks={banks}
        onConfirm={handleMarkAsReceivedConfirm}
        onAddBank={addNewBank}
        loading={actionLoading}
      />

      {/* Reschedule Dialog */}
      <RescheduleDialog
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        income={selectedIncome}
        onConfirm={handleRescheduleConfirm}
        loading={rescheduleLoading}
      />
    </Box>
  );
}
