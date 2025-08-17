'use client';

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
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Expenditure } from '@/app/lib/interface';
import { EXPENSE_CATEGORIES } from '@/app/lib/constant';
import ExpenditureChart from './ChartViewByCategories';

export default function ExpendituresComponent({ userId }: { userId: string }) {
  const { theme } = useCustomTheme();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'one-time' | 'recurring'>('one-time');
  const [frequency, setFrequency] = useState<
    'monthly' | 'weekly' | 'daily' | 'one_time'
  >('one_time');
  const [isPaid, setIsPaid] = useState(false);
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  // State additions
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingPaidId, setUpdatingPaidId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedExpenditure, setSelectedExpenditure] =
    useState<Expenditure | null>(null);
  const [deductionSource, setDeductionSource] = useState<
    'in_hand' | 'bank' | 'easypaisa' | 'jazzcash' | 'other'
  >('in_hand');
  const [actionLoading, setActionLoading] = useState(false);
  const [availableFunds, setAvailableFunds] = useState(0);
  const [insufficientFunds, setInsufficientFunds] = useState(false);

  useEffect(() => {
    const fetchExpenditures = async () => {
      const snap = await getDocs(collection(db, 'expenditures'));
      const docs = snap.docs
        .map((d) => {
          const data = d.data() as Expenditure;
          return {
            ...data,
            id: d.id,
            createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
            dueDate: data.dueDate
              ? (data.dueDate as Timestamp).toDate()
              : undefined,
          };
        })
        .filter((e) => e.userId === userId)
        .sort((a, b) => {
          const dateA = a.dueDate?.getTime() ?? 0;
          const dateB = b.dueDate?.getTime() ?? 0;
          return dateA - dateB;
        }); // <-- Sort added here

      setExpenditures(docs);
      setLoading(false);
    };
    fetchExpenditures();
  }, [userId]);

  const totalAmount = expenditures.reduce((sum, e) => sum + e.amount, 0);

  const groupedByType: Record<'one-time' | 'recurring', Expenditure[]> = {
    'one-time': [],
    recurring: [],
  };

  expenditures.forEach((e) => {
    if (e.type === 'one-time' || e.type === 'recurring') {
      groupedByType[e.type].push(e);
    }
  });

  const handleSave = async () => {
    if (!title || !amount) return;
    setSaving(true);
    const now = new Date();
    const newExp: Expenditure = {
      userId,
      title,
      amount: Number(amount),
      type,
      frequency,
      category,
      isPaid,
      notes,
      dueDate: dueDate ?? undefined,
      createdAt: now,
      updatedAt: now,
    };

    const docData = {
      ...newExp,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (dueDate) {
      docData.dueDate = dueDate;
    }

    const ref = await addDoc(collection(db, 'expenditures'), docData);

    setExpenditures((prev) => [...prev, { ...newExp, id: ref.id }]);
    setSaving(false);
    setOpenModal(false);
    setTitle('');
    setAmount('');
    setType('one-time');
    setFrequency('one_time');
    setCategory('');
    setIsPaid(false);
    setNotes('');
    setDueDate(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await deleteDoc(doc(db, 'expenditures', deleteId));
    setExpenditures((prev) => prev.filter((e) => e.id !== deleteId));
    setDeleting(false);
    setDeleteId(null);
  };
  const handleOpenConfirmDialog = async (exp: Expenditure) => {
    setSelectedExpenditure(exp);
    setDeductionSource('in_hand'); // default
    setUpdatingPaidId(exp.id);

    try {
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const sources = docSnap.data()?.sources || {};
        const available = sources['in_hand'] || 0;
        setAvailableFunds(available);
        setInsufficientFunds(exp.amount > available);
      } else {
        setAvailableFunds(0);
        setInsufficientFunds(true); // No snapshot = assume zero
      }
    } catch (error) {
      console.error('Error fetching cash snapshot:', error);
    }

    setConfirmDialogOpen(true);
  };

  const handleConfirmPaid = async () => {
    if (!selectedExpenditure) return;
    setActionLoading(true);
    try {
      const amount = selectedExpenditure.amount;
      const mode = deductionSource;

      // 1. Mark as Paid
      await updateDoc(doc(db, 'expenditures', selectedExpenditure.id!), {
        isPaid: true,
        updatedAt: serverTimestamp(),
      });

      // 2. Add cash transaction
      await addDoc(collection(db, 'cashTransactions'), {
        userId,
        amount,
        type: 'deduct',
        source: mode,
        category: 'expense',
        note: `Expense: ${selectedExpenditure.title}`,
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

      updatedSources[mode] -= amount;

      const updatedSnapshot = {
        userId,
        sources: updatedSources,
        freezeAmount: prevFreeze,
        totalAmount: prevTotal - amount,
        updatedAt: new Date(),
      };

      await setDoc(docRef, {
        ...updatedSnapshot,
        updatedAt: serverTimestamp(),
      });

      // Local state update
      setExpenditures((prev) =>
        prev.map((item) =>
          item.id === selectedExpenditure.id ? { ...item, isPaid: true } : item
        )
      );
    } catch (error) {
      console.error('Error confirming payment:', error);
    } finally {
      setActionLoading(false);
      setConfirmDialogOpen(false);
      setSelectedExpenditure(null);
      setUpdatingPaidId(null);
    }
  };

  const handleAmountUpdate = async (id: string, newAmount: number) => {
    const ref = doc(db, 'expenditures', id);
    await updateDoc(ref, {
      amount: newAmount,
      updatedAt: serverTimestamp(),
    });
  };

  if (!theme || loading) {
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  const isDark = theme.mode === 'dark';
  const getCategoryWiseData = () => {
    const result: Record<string, number> = {};

    expenditures.forEach((exp) => {
      const cat = exp.category || 'Uncategorized';
      result[cat] = (result[cat] || 0) + exp.amount;
    });

    return Object.entries(result).map(([name, value]) => ({ name, value }));
  };
  const categoryWiseData = getCategoryWiseData();

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
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h5" fontWeight="bold">
          Expenditures
        </Typography>
        <Button variant="contained" onClick={() => setOpenModal(true)}>
          + Add Expense
        </Button>
      </Box>

      <ExpenditureChart data={categoryWiseData} />

      <Typography variant="body2" color="text.secondary" mb={2}>
        Total ({expenditures.length}) – Rs {totalAmount.toLocaleString()}
      </Typography>

      {(['one-time', 'recurring'] as const).map((group) =>
        groupedByType[group].length > 0 ? (
          <Box key={group} mb={3}>
            <Typography variant="h6" mb={1}>
              {group === 'one-time'
                ? 'One-Time Expenses'
                : 'Recurring Expenses'}
            </Typography>

            {groupedByType[group].map((exp) => (
              <Box
                key={exp.id}
                sx={{
                  my: 2,
                  p: 2,
                  borderLeft: `4px solid ${isDark ? '#4ade80' : '#22c55e'}`,
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
                  <Typography fontWeight="bold">{exp.title}</Typography>
                  <TextField
                    type="number"
                    variant="standard"
                    value={exp.amount}
                    size="small"
                    onChange={(e) => {
                      const newAmount = Number(e.target.value);
                      setExpenditures((prev) =>
                        prev.map((item) =>
                          item.id === exp.id
                            ? { ...item, amount: newAmount }
                            : item
                        )
                      );
                    }}
                    onBlur={() =>
                      exp.id && handleAmountUpdate(exp.id, exp.amount)
                    }
                    inputProps={{
                      style: {
                        maxWidth: 80,
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: '#16a34a',
                      },
                    }}
                  />
                </Stack>

                <Typography variant="body2" mt={0.5}>
                  {exp.category && `Category: ${exp.category}`} ·{' '}
                  {exp.frequency}
                </Typography>

                {exp.dueDate && (
                  <Typography variant="body2" color="text.secondary">
                    Due Date:{' '}
                    {exp.dueDate instanceof Date
                      ? exp.dueDate.toLocaleDateString()
                      : ''}
                  </Typography>
                )}

                <Typography variant="body2" mt={0.5}>
                  {exp.isPaid ? '✅ Paid' : '❌ Not Paid'}
                </Typography>

                {exp.notes && (
                  <Typography variant="body2" mt={1} color="text.secondary">
                    📝 {exp.notes}
                  </Typography>
                )}

                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  sx={{ mt: 1, mr: 1 }}
                  onClick={() => exp.id && setDeleteId(exp.id)}
                >
                  Delete
                </Button>

                {!exp.isPaid && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="primary"
                    sx={{ mt: 1 }}
                    onClick={() => handleOpenConfirmDialog(exp)}
                    disabled={updatingPaidId === exp.id}
                  >
                    {updatingPaidId === exp.id ? (
                      <CircularProgress size={18} />
                    ) : (
                      'Mark as Paid'
                    )}
                  </Button>
                )}

                <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
                  <DialogTitle>Confirm Deletion</DialogTitle>
                  <DialogContent>
                    <Typography>
                      Are you sure you want to delete this item?
                    </Typography>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setDeleteId(null)}>Cancel</Button>
                    <Button
                      onClick={handleDelete}
                      color="error"
                      disabled={deleting}
                      variant="contained"
                    >
                      {deleting ? <CircularProgress size={20} /> : 'Delete'}
                    </Button>
                  </DialogActions>
                </Dialog>

                {/* confirmation of mark as paid */}
                <Dialog
                  open={confirmDialogOpen}
                  onClose={() => setConfirmDialogOpen(false)}
                >
                  <DialogTitle>Deduct from Fund</DialogTitle>
                  <DialogContent>
                    <Typography>
                      Do you want to deduct Rs{' '}
                      <strong>{selectedExpenditure?.amount}</strong> from your
                      main fund for <em>{selectedExpenditure?.title}</em>?
                    </Typography>
                    <FormControl fullWidth sx={{ mt: 2 }} size="small">
                      <InputLabel>Deduct From</InputLabel>
                      <Select
                        value={deductionSource}
                        onChange={async (e) => {
                          const mode = e.target.value as typeof deductionSource;
                          setDeductionSource(mode);

                          // Re-check funds
                          try {
                            const docRef = doc(
                              db,
                              'totalCashSnapshots',
                              userId
                            );
                            const docSnap = await getDoc(docRef);
                            if (docSnap.exists()) {
                              const sources = docSnap.data()?.sources || {};
                              const available = sources[mode] || 0;
                              setAvailableFunds(available);
                              setInsufficientFunds(
                                (selectedExpenditure?.amount || 0) > available
                              );
                            } else {
                              setAvailableFunds(0);
                              setInsufficientFunds(true);
                            }
                          } catch (error) {
                            console.error('Error checking funds:', error);
                          }
                        }}
                        label="Deduct From"
                      >
                        {[
                          'in_hand',
                          'bank',
                          'easypaisa',
                          'jazzcash',
                          'other',
                        ].map((mode) => (
                          <MenuItem key={mode} value={mode}>
                            {mode}
                          </MenuItem>
                        ))}
                      </Select>
                      {insufficientFunds && (
                        <Typography
                          mt={1}
                          color="error"
                          fontWeight="bold"
                          fontSize={14}
                        >
                          ⚠️ Insufficient funds in{' '}
                          {deductionSource.replace('_', ' ')} — Available: Rs{' '}
                          {availableFunds.toLocaleString()}
                        </Typography>
                      )}
                    </FormControl>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setConfirmDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleConfirmPaid}
                      disabled={actionLoading || insufficientFunds}
                    >
                      {actionLoading ? (
                        <CircularProgress size={18} />
                      ) : (
                        'Confirm'
                      )}
                    </Button>
                  </DialogActions>
                </Dialog>
              </Box>
            ))}
          </Box>
        ) : null
      )}

      {/* Modal */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add Expenditure</DialogTitle>
        <DialogContent>
          <TextField
            label="Title"
            fullWidth
            size="small"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            margin="normal"
          />
          <TextField
            label="Amount"
            fullWidth
            size="small"
            type="number"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === '' ? '' : Number(e.target.value))
            }
            margin="normal"
          />

          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              label="Type"
              onChange={(e) => setType(e.target.value)}
            >
              <MenuItem value="one-time">One-time</MenuItem>
              <MenuItem value="recurring">Recurring</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Frequency</InputLabel>
            <Select
              value={frequency}
              label="Frequency"
              onChange={(e) => setFrequency(e.target.value)}
            >
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="one_time">One Time</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Category</InputLabel>
            <Select
              value={category}
              label="Category"
              onChange={(e) => setCategory(e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box mt={2}>
            <Typography variant="body2" fontWeight={500} mb={0.5}>
              Due Date
            </Typography>
            <DatePicker
              selected={dueDate}
              onChange={(date: Date | null) => setDueDate(date)}
              className="MuiInputBase-input MuiOutlinedInput-input MuiInputBase-inputSizeSmall"
              dateFormat="dd/MM/yyyy"
              placeholderText="Select due date"
            />
          </Box>

          <Box display="flex" alignItems="center" mt={2}>
            <Checkbox
              size="small"
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
            />
            <Typography fontSize={14}>Has been paid</Typography>
          </Box>

          <TextField
            label="Notes"
            size="small"
            fullWidth
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            margin="normal"
            multiline
            rows={2}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="success"
            disabled={saving || !title || amount === ''}
          >
            {saving ? <CircularProgress size={22} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
