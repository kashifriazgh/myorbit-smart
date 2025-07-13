'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Checkbox,
  useTheme,
  CircularProgress,
  Stack,
} from '@mui/material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import {
  IncomeSource,
  CashTransaction,
  TransactionSource,
} from '@/app/lib/interface';
import { INCOME_CATEGORIES } from '@/app/lib/constant';
import ChartViewByCategory from './ChartViewByCategories';

export default function IncomeSourceComponent({ userId }: { userId: string }) {
  const { theme } = useCustomTheme();
  const muiTheme = useTheme();

  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'one-time' | 'recurring'>('one-time');
  const [frequency, setFrequency] = useState<
    'monthly' | 'weekly' | 'daily' | 'one_time'
  >('one_time');
  const [category, setCategory] = useState('');
  const [expectedDate, setExpectedDate] = useState<Date | null>(null);
  const [isReceived, setIsReceived] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // *** New states for confirmation flow ***
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<IncomeSource | null>(
    null
  );
  const [actionLoading, setActionLoading] = useState(false);
  const SOURCE_OPTIONS: TransactionSource[] = [
    'bank',
    'in_hand',
    'easypaisa',
    'jazzcash',
    'other',
  ];
  const [incomeSourceForMainFund, setIncomeSourceForMainFund] =
    useState<TransactionSource>('in_hand');
  const [availableFunds, setAvailableFunds] = useState(0);
  const [sourceBalanceWarning, setSourceBalanceWarning] = useState(false);

  useEffect(() => {
    async function fetchSources() {
      const snap = await getDocs(collection(db, 'incomeSources'));
      const docs = snap.docs
        .map((d) => {
          const data = d.data() as IncomeSource;
          const expected = data.expectedDate as Timestamp | undefined;
          return {
            ...data,
            id: d.id,
            createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
            expectedDate: expected ? expected.toDate() : undefined,
          };
        })
        .filter((e) => e.userId === userId)
        .sort(
          (a, b) =>
            (a.expectedDate?.getTime() ?? 0) - (b.expectedDate?.getTime() ?? 0)
        );
      setSources(docs);
      setLoading(false);
    }
    fetchSources();
  }, [userId]);

  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of sources) {
      const cat = item.category || 'Uncategorized';
      map[cat] = (map[cat] || 0) + item.amount;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [sources]);

  const totalAmount = sources.reduce((sum, e) => sum + e.amount, 0);

  // Open confirm dialog
  const onClickMark = async (src: IncomeSource) => {
    setSelectedIncome(src);
    setIncomeSourceForMainFund('in_hand');

    try {
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const sources = data.sources || {};
        const available = sources['in_hand'] || 0;
        setAvailableFunds(available);
        setSourceBalanceWarning(available < 0); // warn if previously overdrawn
      } else {
        setAvailableFunds(0);
        setSourceBalanceWarning(true);
      }
    } catch (err) {
      console.error('Error fetching snapshot:', err);
      setAvailableFunds(0);
      setSourceBalanceWarning(true);
    }

    setConfirmDialogOpen(true);
  };

  // If user picks Yes

  const handleConfirmYes = async () => {
    if (!selectedIncome) return;
    setActionLoading(true);

    try {
      // 1. Mark as received in incomeSources
      await updateDoc(doc(db, 'incomeSources', selectedIncome.id!), {
        isReceived: true,
        updatedAt: serverTimestamp(),
      });

      // 2. Add cash transaction
      const txn: CashTransaction = {
        userId,
        amount: selectedIncome.amount,
        type: 'add',
        source: incomeSourceForMainFund,
        category: 'income',
        note: `Income: ${selectedIncome.title}`,
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'cashTransactions'), {
        ...txn,
        createdAt: serverTimestamp(),
      });

      // 3. Update totalCashSnapshots
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const docSnap = await getDoc(docRef);

      let updatedSources = {
        in_hand: 0,
        bank: 0,
        easypaisa: 0,
        jazzcash: 0,
        other: 0,
      };
      let prevFreeze = 0;
      let prevTotal = 0;

      if (docSnap.exists()) {
        const data = docSnap.data();
        updatedSources = { ...updatedSources, ...data.sources };
        prevTotal = data.totalAmount || 0;
        prevFreeze = data.freezeAmount || 0;
      }

      updatedSources[incomeSourceForMainFund] += selectedIncome.amount;

      const updatedSnapshot = {
        userId,
        sources: updatedSources,
        freezeAmount: prevFreeze,
        totalAmount: prevTotal + selectedIncome.amount,
        updatedAt: new Date(),
      };

      await setDoc(docRef, {
        ...updatedSnapshot,
        updatedAt: serverTimestamp(),
      });

      // 4. Update local state
      setSources((prev) =>
        prev.map((i) =>
          i.id === selectedIncome.id ? { ...i, isReceived: true } : i
        )
      );

      setConfirmDialogOpen(false);
      setSelectedIncome(null);
    } catch (error) {
      console.error('Error marking as received:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // If user picks No
  const handleConfirmNo = () => {
    setConfirmDialogOpen(false);
    setSelectedIncome(null);
  };

  if (!theme || loading)
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );

  const isDark = theme.mode === 'dark';

  return (
    <Box
      sx={{
        maxWidth: 600,
        mx: 'auto',
        my: 4,
        p: 4,
        boxShadow: 6,
        borderRadius: 3,
        bgcolor: isDark ? muiTheme.palette.background.paper : '#fff',
      }}
    >
      <ChartViewByCategory data={categoryChartData} />

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h5" fontWeight="bold">
          Income Sources
        </Typography>
        <Button variant="contained" onClick={() => setOpenModal(true)}>
          + Add Income
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Total ({sources.length}) – Rs {totalAmount.toLocaleString()}
      </Typography>

      {sources.map((src) => (
        <Box
          key={src.id}
          sx={{
            my: 2,
            p: 2,
            borderLeft: `4px solid ${isDark ? '#60a5fa' : '#3b82f6'}`,
            borderRadius: 2,
            backgroundColor: isDark ? '#1e293b' : '#f9fafb',
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
          >
            <Typography fontWeight="bold">{src.title}</Typography>
            <TextField
              type="number"
              variant="standard"
              value={src.amount}
              size="small"
              onChange={(e) => {
                const newAmt = Number(e.target.value);
                setSources((prev) =>
                  prev.map((i) =>
                    i.id === src.id ? { ...i, amount: newAmt } : i
                  )
                );
              }}
              onBlur={() =>
                src.id != null &&
                updateDoc(doc(db, 'incomeSources', src.id), {
                  amount: src.amount,
                  updatedAt: serverTimestamp(),
                })
              }
              inputProps={{
                style: {
                  maxWidth: 80,
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: '#2563eb',
                },
              }}
            />
          </Stack>
          <Typography variant="body2" mt={0.5}>
            {src.category} · {src.frequency}
          </Typography>
          {src.expectedDate && (
            <Typography variant="body2" color="text.secondary">
              Expected:{' '}
              {src.expectedDate instanceof Timestamp
                ? src.expectedDate.toDate().toLocaleDateString()
                : src.expectedDate.toLocaleDateString()}
            </Typography>
          )}
          <Typography variant="body2" mt={0.5}>
            {src.isReceived ? '✅ Received' : '❌ Not Received'}
          </Typography>
          {src.notes && (
            <Typography variant="body2" mt={1} color="text.secondary">
              📝 {src.notes}
            </Typography>
          )}

          <Button
            variant="outlined"
            size="small"
            color="error"
            sx={{ mt: 1, mr: 1 }}
          >
            Delete
          </Button>
          {!src.isReceived && (
            <Button
              variant="outlined"
              size="small"
              color="primary"
              sx={{ mt: 1 }}
              onClick={() => onClickMark(src)}
              disabled={actionLoading}
            >
              {actionLoading && selectedIncome?.id === src.id ? (
                <CircularProgress size={18} />
              ) : (
                'Mark as Received'
              )}
            </Button>
          )}
        </Box>
      ))}

      {/* Confirm Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Add to main fund?</DialogTitle>
        <DialogContent>
          <Typography>
            Do you want to add the amount{' '}
            <strong>Rs {selectedIncome?.amount}</strong> from{' '}
            <em>{selectedIncome?.title}</em> to your main fund?
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Source in Fund</InputLabel>
            <Select
              value={incomeSourceForMainFund}
              onChange={async (e) => {
                const mode = e.target.value as TransactionSource;
                setIncomeSourceForMainFund(mode);

                try {
                  const docRef = doc(db, 'totalCashSnapshots', userId);
                  const docSnap = await getDoc(docRef);
                  if (docSnap.exists()) {
                    const sources = docSnap.data()?.sources || {};
                    const available = sources[mode] || 0;
                    setAvailableFunds(available);
                    setSourceBalanceWarning(available < 0);
                  } else {
                    setAvailableFunds(0);
                    setSourceBalanceWarning(true);
                  }
                } catch (err) {
                  console.error('Error getting balance:', err);
                  setAvailableFunds(0);
                  setSourceBalanceWarning(true);
                }
              }}
              label="Source in Fund"
            >
              {SOURCE_OPTIONS.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              ))}
            </Select>
            <Typography mt={1} fontSize={14}>
              Available in <strong>{incomeSourceForMainFund}</strong>: Rs{' '}
              {availableFunds.toLocaleString()}
            </Typography>

            {sourceBalanceWarning && (
              <Typography mt={1} color="error" fontWeight="bold" fontSize={13}>
                ⚠️ This source previously had negative or no balance.
              </Typography>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleConfirmNo}
            disabled={actionLoading || availableFunds < -5000}
          >
            No
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmYes}
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={18} /> : 'Yes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Income Modal omitted \*/}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} fullWidth>
        <DialogTitle>Add Income</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            margin="dense"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            fullWidth
            label="Amount"
            type="number"
            margin="dense"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Type</InputLabel>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <MenuItem value="one-time">One-time</MenuItem>
              <MenuItem value="recurring">Recurring</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Frequency</InputLabel>
            <Select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <MenuItem value="one_time">One-time</MenuItem>
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Category</InputLabel>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {INCOME_CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">Expected Date</Typography>

            <DatePicker
              selected={expectedDate}
              onChange={(date: Date | null) => {
                console.log('Selected:', date);
                setExpectedDate(date);
              }}
              dateFormat="yyyy-MM-dd"
              className="custom-datepicker"
              placeholderText="Select expected date"
            />
          </Box>

          <TextField
            fullWidth
            label="Notes"
            multiline
            rows={3}
            margin="dense"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <FormControl fullWidth margin="dense">
            <Checkbox
              checked={isReceived}
              onChange={(e) => setIsReceived(e.target.checked)}
            />
            <Typography variant="body2" component="span">
              Mark as received now
            </Typography>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={saving || !title || !amount}
            onClick={async () => {
              setSaving(true);
              try {
                const payload: IncomeSource = {
                  userId,
                  title,
                  amount: Number(amount),
                  type,
                  frequency,
                  category,
                  expectedDate: expectedDate || null,
                  isReceived,
                  notes,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
                const res = await addDoc(collection(db, 'incomeSources'), {
                  ...payload,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                setSources((prev) => [...prev, { ...payload, id: res.id }]);
                setOpenModal(false);
                // Reset fields
                setTitle('');
                setAmount('');
                setCategory('');
                setType('one-time');
                setFrequency('one_time');
                setExpectedDate(null);
                setIsReceived(false);
                setNotes('');
              } catch (err) {
                console.error('Error saving income:', err);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <CircularProgress size={18} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
