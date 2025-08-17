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
  FormControlLabel,
  useTheme,
  CircularProgress,
  Stack,
  Collapse,
  IconButton,
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
  deleteDoc,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function IncomeSourceComponent({ userId }: { userId: string }) {
  const { theme } = useCustomTheme();
  const muiTheme = useTheme();

  const [sources, setSources] = useState<
    (IncomeSource & { isHiding?: boolean })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'one-time' | 'recurring'>('one-time');
  const [frequency, setFrequency] = useState<
    'monthly' | 'weekly' | 'daily' | 'one_time'
  >('one_time');
  const [category, setCategory] = useState('');
  const [expectedDate, setExpectedDate] = useState<Date | null>(new Date());
  const [isReceived, setIsReceived] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingAmountId, setUpdatingAmountId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  // Confirm dialog states
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
          const expected = data.expectedDate as Timestamp | Date | undefined;
          return {
            ...data,
            id: d.id,
            createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
            expectedDate:
              expected instanceof Timestamp
                ? expected.toDate()
                : expected || undefined,
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

  // Filtered sources for display
  const displayedSources = sources.filter(
    (src) => !src.isReceived || src.type === 'recurring'
  );

  // Total only for displayed items
  const totalAmount = displayedSources.reduce((sum, e) => sum + e.amount, 0);

  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of displayedSources) {
      const cat = item.category || 'Uncategorized';
      map[cat] = (map[cat] || 0) + item.amount;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [displayedSources]);

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
        setSourceBalanceWarning(available < 0);
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

  const markAsReceived = async (src: IncomeSource, updateMainFund: boolean) => {
    try {
      // Update income source as received
      await updateDoc(doc(db, 'incomeSources', src.id!), {
        isReceived: true,
        updatedAt: serverTimestamp(),
      });

      if (updateMainFund) {
        // Add cash transaction
        const txn: CashTransaction = {
          userId,
          amount: src.amount,
          type: 'add',
          source: incomeSourceForMainFund,
          category: 'income',
          note: `Income: ${src.title}`,
          createdAt: new Date(),
        };
        await addDoc(collection(db, 'cashTransactions'), {
          ...txn,
          createdAt: serverTimestamp(),
        });

        // Update totalCashSnapshots
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
        updatedSources[incomeSourceForMainFund] += src.amount;
        const updatedSnapshot = {
          userId,
          sources: updatedSources,
          freezeAmount: prevFreeze,
          totalAmount: prevTotal + src.amount,
          updatedAt: new Date(),
        };
        await setDoc(docRef, {
          ...updatedSnapshot,
          updatedAt: serverTimestamp(),
        });
      }

      // Update local state with smooth hiding
      if (src.type === 'one-time') {
        setSources((prev) =>
          prev.map((i) => (i.id === src.id ? { ...i, isHiding: true } : i))
        );
        setTimeout(() => {
          setSources((prev) =>
            prev.filter((i) => !(i.id === src.id && i.type === 'one-time'))
          );
        }, 300);
      } else {
        setSources((prev) =>
          prev.map((i) => (i.id === src.id ? { ...i, isReceived: true } : i))
        );
      }
    } catch (err) {
      console.error('Error marking received:', err);
    }
  };

  const handleConfirmYes = async () => {
    if (!selectedIncome) return;
    setActionLoading(true);
    await markAsReceived(selectedIncome, true);
    setActionLoading(false);
    setConfirmDialogOpen(false);
    setSelectedIncome(null);
  };

  const handleConfirmNo = async () => {
    if (!selectedIncome) return;
    setActionLoading(true);
    await markAsReceived(selectedIncome, false);
    setActionLoading(false);
    setConfirmDialogOpen(false);
    setSelectedIncome(null);
  };

  const handleDelete = (src: IncomeSource) => {
    setSources((prev) =>
      prev.map((i) => (i.id === src.id ? { ...i, isHiding: true } : i))
    );
    setTimeout(async () => {
      try {
        if (src.id) await deleteDoc(doc(db, 'incomeSources', src.id));
      } catch (err) {
        console.error('Error deleting income:', err);
      }
      setSources((prev) => prev.filter((i) => i.id !== src.id));
    }, 300);
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
        Total ({displayedSources.length}) – Rs {totalAmount.toLocaleString()}
      </Typography>

      {displayedSources.map((src) => (
        <Box
          key={src.id}
          sx={{
            my: 2,
            p: 2,
            borderLeft: `4px solid ${isDark ? '#60a5fa' : '#3b82f6'}`,
            borderRadius: 2,
            backgroundColor: isDark ? '#1e293b' : '#f9fafb',
            opacity: src.isHiding ? 0 : 1,
            transition: 'opacity 0.3s ease',
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
          >
            <Typography fontWeight="bold">{src.title}</Typography>
            <Box sx={{ position: 'relative' }}>
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
                onBlur={async () => {
                  if (!src.id) return;
                  setUpdatingAmountId(src.id);
                  try {
                    await updateDoc(doc(db, 'incomeSources', src.id), {
                      amount: src.amount,
                      updatedAt: serverTimestamp(),
                    });
                  } catch (err) {
                    console.error('Error updating amount:', err);
                  } finally {
                    setUpdatingAmountId(null);
                  }
                }}
                inputProps={{
                  style: {
                    maxWidth: 80,
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#2563eb',
                  },
                }}
              />
              {updatingAmountId === src.id && (
                <CircularProgress
                  size={16}
                  sx={{
                    position: 'absolute',
                    right: -24,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
              )}
            </Box>
          </Stack>
          <Typography variant="body2" mt={0.5}>
            {src.category} · {src.frequency}
          </Typography>
          {src.expectedDate && (
            <Typography variant="body2" color="text.secondary">
              Expected:{' '}
              {src.expectedDate instanceof Date
                ? src.expectedDate.toLocaleDateString()
                : src.expectedDate instanceof Timestamp
                ? src.expectedDate.toDate().toLocaleDateString()
                : new Date(src.expectedDate).toLocaleDateString()}
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
            onClick={() => handleDelete(src)}
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
          <Button onClick={handleConfirmNo} disabled={actionLoading}>
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

      {/* Add Income Modal */}
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

          {/* Type and Frequency inline */}
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth margin="dense">
              <InputLabel>Type</InputLabel>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <MenuItem value="one-time">One-time</MenuItem>
                <MenuItem value="recurring">Recurring</MenuItem>
              </Select>
            </FormControl>
            {type === 'recurring' && (
              <FormControl fullWidth margin="dense">
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>

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
              onChange={(date: Date | null) => setExpectedDate(date)}
              dateFormat="yyyy-MM-dd"
              className="custom-datepicker"
              placeholderText="Select expected date"
            />
          </Box>

          {/* Collapsible Notes */}
          <Box sx={{ mt: 2 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ cursor: 'pointer' }}
              onClick={() => setNotesOpen((prev) => !prev)}
            >
              <Typography>Notes</Typography>
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
              <TextField
                fullWidth
                multiline
                rows={3}
                margin="dense"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Collapse>
          </Box>

          {/* Checkbox aligned */}
          <FormControlLabel
            control={
              <Checkbox
                checked={isReceived}
                onChange={(e) => setIsReceived(e.target.checked)}
              />
            }
            label="Mark as received now"
          />
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
                  expectedDate: expectedDate || new Date(),
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
                setTitle('');
                setAmount('');
                setCategory('');
                setType('one-time');
                setFrequency('one_time');
                setExpectedDate(new Date());
                setIsReceived(false);
                setNotes('');
                setNotesOpen(false);
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
