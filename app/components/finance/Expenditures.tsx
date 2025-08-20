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
  Collapse,
  LinearProgress,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
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
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Expenditure, Bank, TotalCashSnapshot } from '@/app/lib/interface';
import { EXPENSE_CATEGORIES } from '@/app/lib/constant';
import ExpenditureChart from './ChartViewByCategories';
import { useAuth } from '@/app/lib/context/userContext';

export default function ExpendituresComponent({ userId }: { userId: string }) {
  const { theme } = useCustomTheme();
  const { user } = useAuth();
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
  const [dueDate, setDueDate] = useState<Date | null>(new Date()); // default date set

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

  // bank-specific state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [newBankName, setNewBankName] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [availableFunds, setAvailableFunds] = useState(0);
  const [insufficientFunds, setInsufficientFunds] = useState(false);

  const [notesOpen, setNotesOpen] = useState(false);
  const [amountUpdatingId, setAmountUpdatingId] = useState<string | null>(null);

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
        .filter((e) => {
          // filtering rule
          if (e.type === 'recurring') return true; // always show recurring
          if (e.type === 'one-time' && !e.isPaid) return true; // show unpaid one-time
          return false;
        })
        .sort((a, b) => {
          const dateA = a.dueDate?.getTime() ?? 0;
          const dateB = b.dueDate?.getTime() ?? 0;
          return dateA - dateB;
        });

      setExpenditures(docs);
      setLoading(false);
    };

    const fetchBanks = async () => {
      if (!user) return;
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched: Bank[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Bank, 'id'>),
      }));
      setBanks(fetched);
    };

    fetchExpenditures();
    fetchBanks();
  }, [userId, user]);

  const totalAmount = expenditures.reduce((sum, e) => sum + e.amount, 0);

  const groupedByType: Record<'one-time' | 'recurring', Expenditure[]> = {
    'one-time': [],
    recurring: [],
  };
  expenditures.forEach((e) => groupedByType[e.type].push(e));

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
      dueDate: dueDate ?? new Date(),
      createdAt: now,
      updatedAt: now,
    };

    const ref = await addDoc(collection(db, 'expenditures'), {
      ...newExp,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

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
    setDueDate(new Date());
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await deleteDoc(doc(db, 'expenditures', deleteId));
    setExpenditures((prev) => prev.filter((e) => e.id !== deleteId));
    setDeleting(false);
    setDeleteId(null);
  };

  const handleAddBank = async () => {
    if (!user || !newBankName.trim()) return;
    const docRef = await addDoc(collection(db, 'banks'), {
      userId: user.uid,
      name: newBankName.trim(),
      createdAt: Timestamp.now(),
    });
    const newBank: Bank = {
      id: docRef.id,
      userId: user.uid,
      name: newBankName.trim(),
      createdAt: Timestamp.now(),
    };
    setBanks((prev) => [...prev, newBank]);
    setSelectedBank(newBank.id!);
    setNewBankName('');
  };

  const handleOpenConfirmDialog = async (exp: Expenditure) => {
    setSelectedExpenditure(exp);
    setConfirmDialogOpen(true);

    // Check available funds based on current deduction source
    await checkAvailableFunds(exp.amount);
  };

  const checkAvailableFunds = async (amount: number) => {
    try {
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as TotalCashSnapshot;
        let available = 0;

        if (deductionSource === 'bank' && selectedBank) {
          available = data.sources.bank[selectedBank] || 0;
        } else if (deductionSource !== 'bank') {
          available = data.sources[deductionSource] || 0;
        }

        setAvailableFunds(available);
        setInsufficientFunds(amount > available);
      }
    } catch (err) {
      console.error('Error getting balance:', err);
      setAvailableFunds(0);
      setInsufficientFunds(true);
    }
  };

  const handleConfirmPaid = async (updateFunds: boolean) => {
    if (!selectedExpenditure) return;
    setActionLoading(true);
    setUpdatingPaidId(selectedExpenditure.id!);
    try {
      // Update expenditure status
      const expRef = doc(db, 'expenditures', selectedExpenditure.id!);
      await updateDoc(expRef, {
        isPaid: true,
        updatedAt: serverTimestamp(),
      });

      if (updateFunds) {
        // Get bank info if source is bank
        let bankId: string | undefined;
        let bankName: string | undefined;

        if (deductionSource === 'bank' && selectedBank) {
          const bank = banks.find((b) => b.id === selectedBank);
          bankId = bank?.id;
          bankName = bank?.name;

          // Debug logging
          console.log('Selected bank ID:', selectedBank);
          console.log('Found bank object:', bank);
          console.log('Bank name to use:', bankName);
        }

        // Save transaction to cashTransactions
        await addDoc(collection(db, 'cashTransactions'), {
          userId,
          amount: selectedExpenditure.amount,
          type: 'deduct',
          source: deductionSource,
          category: 'expenditure',
          note: `Payment for: ${selectedExpenditure.title}`,
          bankId: bankId || null,
          BankName: bankName || null,
          createdAt: serverTimestamp(),
        });

        // Update totalCashSnapshot
        const docRef = doc(db, 'totalCashSnapshots', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as TotalCashSnapshot;
          const updatedSources = { ...data.sources };

          if (deductionSource === 'bank' && bankName) {
            console.log('Updating bank source:', bankName);
            console.log('Current bank sources:', data.sources.bank);
            console.log(
              'Current amount for this bank:',
              data.sources.bank[bankName] || 0
            );
            console.log('Deducting amount:', selectedExpenditure.amount);

            updatedSources.bank[bankName] =
              (updatedSources.bank[bankName] || 0) - selectedExpenditure.amount;

            console.log(
              'New amount for this bank:',
              updatedSources.bank[bankName]
            );
          } else if (deductionSource !== 'bank') {
            updatedSources[deductionSource] =
              (updatedSources[deductionSource] as number) -
              selectedExpenditure.amount;
          }

          const updatedSnapshot: TotalCashSnapshot = {
            ...data,
            sources: updatedSources,
            totalAmount: data.totalAmount - selectedExpenditure.amount,
            updatedAt: new Date(),
          };

          console.log('Final updated sources:', updatedSources);
          console.log('Final updated snapshot:', updatedSnapshot);

          await setDoc(docRef, {
            ...updatedSnapshot,
            updatedAt: serverTimestamp(),
          });
        }
        setUpdatingPaidId(null);
      }

      // Update local state with smooth hiding
      if (selectedExpenditure.type === 'one-time') {
        setExpenditures((prev) =>
          prev.map((item) =>
            item.id === selectedExpenditure.id
              ? { ...item, isPaid: true }
              : item
          )
        );
        setTimeout(() => {
          setExpenditures((prev) =>
            prev.filter(
              (item) =>
                !(
                  item.id === selectedExpenditure.id && item.type === 'one-time'
                )
            )
          );
        }, 300);
      } else {
        setExpenditures((prev) =>
          prev.map((item) =>
            item.id === selectedExpenditure.id
              ? { ...item, isPaid: true }
              : item
          )
        );
      }

      setConfirmDialogOpen(false);
      setSelectedExpenditure(null);
      setDeductionSource('in_hand');
      setSelectedBank('');
      setInsufficientFunds(false);
    } catch (error) {
      console.error('Error updating expenditure:', error);
      alert('Error updating expenditure. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAmountUpdate = async (id: string, newAmount: number) => {
    setAmountUpdatingId(id);
    const ref = doc(db, 'expenditures', id);
    await updateDoc(ref, { amount: newAmount, updatedAt: serverTimestamp() });
    setAmountUpdatingId(null);
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
      <Typography variant="h5" fontWeight="bold" mb={2}>
        Expenditures
      </Typography>

      <ExpenditureChart data={categoryWiseData} />

      <Button
        variant="contained"
        onClick={() => setOpenModal(true)}
        sx={{ mt: 2 }}
      >
        + Add Expense
      </Button>

      <Typography variant="body2" color="text.secondary" mt={2} mb={2}>
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
                  <Box sx={{ minWidth: 100 }}>
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
                    {amountUpdatingId === exp.id && (
                      <LinearProgress sx={{ mt: 0.5 }} />
                    )}
                  </Box>
                </Stack>
                <Typography variant="body2" mt={0.5}>
                  {exp.category && `Category: ${exp.category}`} ·{' '}
                  {exp.frequency}
                </Typography>
                {exp.dueDate && (
                  <Typography variant="body2" color="error" fontWeight="bold">
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
                  <>
                    <Button
                      size="small"
                      onClick={() => setNotesOpen(!notesOpen)}
                      startIcon={notesOpen ? <ExpandLess /> : <ExpandMore />}
                    >
                      Notes
                    </Button>
                    <Collapse in={notesOpen}>
                      <Typography variant="body2" mt={1} color="text.secondary">
                        📝 {exp.notes}
                      </Typography>
                    </Collapse>
                  </>
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
              </Box>
            ))}
          </Box>
        ) : null
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this item?</Typography>
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

      {/* Mark as Paid Confirmation */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Deduct from Fund</DialogTitle>
        <DialogContent>
          <Typography>
            Do you want to deduct Rs{' '}
            <strong>{selectedExpenditure?.amount}</strong> from your main fund
            for <em>{selectedExpenditure?.title}</em>?
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }} size="small">
            <InputLabel>Deduct From</InputLabel>
            <Select
              value={deductionSource}
              onChange={async (e) => {
                const source = e.target.value;
                setDeductionSource(source);
                setSelectedBank(''); // Reset bank selection when source changes

                // Check available funds for the new source
                if (selectedExpenditure) {
                  await checkAvailableFunds(selectedExpenditure.amount);
                }
              }}
              label="Deduct From"
            >
              {['in_hand', 'bank', 'easypaisa', 'jazzcash', 'other'].map(
                (mode) => (
                  <MenuItem key={mode} value={mode}>
                    {mode}
                  </MenuItem>
                )
              )}
            </Select>

            {/* Extra bank select if source = bank */}
            {deductionSource === 'bank' && (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1, mb: 1 }}
                >
                  Please select a bank to deduct from:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Bank</InputLabel>
                    <Select
                      value={selectedBank}
                      label="Bank"
                      onChange={async (e) => {
                        const bankId = e.target.value as string;
                        setSelectedBank(bankId);

                        // Check available funds when bank changes
                        if (selectedExpenditure) {
                          await checkAvailableFunds(selectedExpenditure.amount);
                        }
                      }}
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
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddBank();
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleAddBank}
                    disabled={!newBankName.trim() || actionLoading}
                  >
                    Add Bank
                  </Button>
                </Stack>
              </>
            )}

            {insufficientFunds && (
              <Typography mt={1} color="error" fontWeight="bold" fontSize={14}>
                ⚠️ Insufficient funds in {deductionSource.replace('_', ' ')}
                {deductionSource === 'bank' &&
                  selectedBank &&
                  ` (${banks.find((b) => b.id === selectedBank)?.name})`}
                — Available: Rs {availableFunds.toLocaleString()}
              </Typography>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => handleConfirmPaid(false)}
            color="warning"
            disabled={actionLoading}
          >
            No
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleConfirmPaid(true)}
            disabled={
              actionLoading ||
              insufficientFunds ||
              (deductionSource === 'bank' && !selectedBank)
            }
          >
            {actionLoading ? <CircularProgress size={18} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Expenditure Modal */}
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

          <Stack direction="row" spacing={2} mt={2}>
            <FormControl fullWidth size="small">
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
            {type === 'recurring' && (
              <FormControl fullWidth size="small">
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={frequency}
                  label="Frequency"
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>

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
            <Typography variant="body2" fontWeight={600} mb={0.5} color="error">
              Due Date
            </Typography>
            <DatePicker
              selected={dueDate}
              onChange={(date: Date | null) => setDueDate(date)}
              className="w-full border px-3 py-2 rounded-md text-sm"
            />
          </Box>

          <TextField
            label="Notes"
            fullWidth
            size="small"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            margin="normal"
            multiline
            rows={3}
          />
          <Box display="flex" alignItems="center" mt={2}>
            <Checkbox
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
            />
            <Typography>Mark as Paid</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={18} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
