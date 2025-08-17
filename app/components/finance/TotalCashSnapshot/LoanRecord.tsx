import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  CircularProgress,
  Box,
  Skeleton,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  TransactionSource,
  Bank,
  LoanRecord,
  TotalCashSnapshot,
} from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';

const SOURCE_OPTIONS: TransactionSource[] = [
  'bank',
  'in_hand',
  'easypaisa',
  'jazzcash',
  'other',
];

export default function LoanDialog() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  // loan form state
  const [amount, setAmount] = useState<number | ''>('');
  const [loanType, setLoanType] = useState<'borrow' | 'lend'>('borrow');
  const [counterparty, setCounterparty] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [source, setSource] = useState<TransactionSource>('in_hand');
  const [selectedBank, setSelectedBank] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);

  // totals, error, loading
  const [totals, setTotals] = useState({ toPay: 0, toReceive: 0 });
  const [error, setError] = useState('');
  const [localSaving, setLocalSaving] = useState(false);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [activeLoans, setActiveLoans] = useState<LoanRecord[]>([]);

  // fetch banks
  useEffect(() => {
    if (!user) return;
    const fetchBanks = async () => {
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched: Bank[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Bank, 'id'>),
      }));
      setBanks(fetched);
    };
    fetchBanks();
  }, [user]);

  // fetch loans
  useEffect(() => {
    if (!user || !showModal) return;
    setLoadingLoans(true);
    const fetchLoans = async () => {
      try {
        const q = query(
          collection(db, 'loans'),
          where('userId', '==', user.uid)
        );
        const snap = await getDocs(q);
        const loans: LoanRecord[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<LoanRecord, 'id'>),
        }));
        // filter only active/unsettled loans
        const outstanding = loans.filter((l) => !l.isSettled);
        setActiveLoans(outstanding);

        const toPay = outstanding
          .filter((l) => l.type === 'lend')
          .reduce((sum, l) => sum + (l.amount || 0), 0);
        const toReceive = outstanding
          .filter((l) => l.type === 'borrow')
          .reduce((sum, l) => sum + (l.amount || 0), 0);
        setTotals({ toPay, toReceive });
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingLoans(false);
      }
    };
    fetchLoans();
  }, [user, showModal]);

  // validate and create loan
  const handleCreate = async () => {
    if (!user || !amount || amount <= 0 || !counterparty.trim()) {
      setError('Please fill all required fields.');
      return;
    }
    if (!dueDate) {
      setError('Due date is required.');
      return;
    }

    const bank =
      source === 'bank' ? banks.find((b) => b.id === selectedBank) : undefined;
    setError('');

    try {
      setLocalSaving(true);

      // onCreateLoan function logic (same as before)
      const record: Omit<LoanRecord, 'id' | 'createdAt'> = {
        userId: user.uid,
        amount: Number(amount),
        type: loanType,
        counterparty: counterparty.trim(),
        dueDate: Timestamp.fromDate(new Date(dueDate)),
        note: '',
        isSettled: false,
      };

      // fetch snapshot
      const snapshotRef = doc(db, 'totalCashSnapshots', user.uid);
      const snapshotSnap = await getDoc(snapshotRef);
      const snapshot: TotalCashSnapshot = snapshotSnap.exists()
        ? (snapshotSnap.data() as TotalCashSnapshot)
        : {
            userId: user.uid,
            sources: {
              in_hand: 0,
              bank: {},
              easypaisa: 0,
              jazzcash: 0,
              other: 0,
            },
            totalAmount: 0,
            freezeAmount: 0,
            createdAt: new Date(),
          };

      // normalize bank object
      if (typeof snapshot.sources.bank === 'number')
        snapshot.sources.bank = { Default: snapshot.sources.bank };

      // check available balance
      if (loanType === 'lend') {
        const available =
          source === 'bank' && bank?.name
            ? snapshot.sources.bank?.[bank.name] ?? 0
            : (snapshot.sources[source] as number) ?? 0;
        if (amount > available)
          throw new Error(
            `Insufficient balance in ${source}${
              bank?.name ? ` (${bank.name})` : ''
            }`
          );
      }

      // create loan
      const loanRef = await addDoc(collection(db, 'loans'), {
        ...record,
        createdAt: serverTimestamp(),
      });
      // create transaction
      await addDoc(collection(db, 'cashTransactions'), {
        userId: user.uid,
        amount: record.amount,
        type: loanType === 'lend' ? 'deduct' : 'add',
        source,
        category: 'loan',
        note: `Loan ${loanType} - ${counterparty}`,
        referenceId: loanRef.id,
        createdAt: serverTimestamp(),
        ...(bank?.id ? { bankId: bank.id } : {}),
        ...(bank?.name ? { bankName: bank.name } : {}),
      });

      // update snapshot
      const updatedSources = { ...snapshot.sources };
      if (loanType === 'lend') {
        if (source === 'bank' && bank?.name)
          updatedSources.bank[bank.name] -= amount;
        else (updatedSources[source] as number) -= amount;
        snapshot.totalAmount -= amount;
      } else {
        if (source === 'bank' && bank?.name)
          updatedSources.bank[bank.name] += amount;
        else (updatedSources[source] as number) += amount;
        snapshot.totalAmount += amount;
      }
      await updateDoc(snapshotRef, {
        sources: updatedSources,
        totalAmount: snapshot.totalAmount,
        updatedAt: serverTimestamp(),
      });

      // reset
      setAmount('');
      setCounterparty('');
      setDueDate('');
      setSource('in_hand');
      setSelectedBank('');
      setLoanType('borrow');
      setShowModal(false);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLocalSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        sx={{ background: '#e0f2fe' }}
        onClick={() => setShowModal(true)}
      >
        Outstanding Loan
      </Button>

      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Outstanding Loan</DialogTitle>
        <DialogContent>
          {/* Totals */}
          {loadingLoans ? (
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Skeleton width={120} height={20} />
              <Skeleton width={120} height={20} />
            </Box>
          ) : (
            <>
              <Typography color="error" fontSize={14}>
                Total To Pay Back: {totals.toPay}
              </Typography>
              <Typography color="success.main" fontSize={14}>
                Total To Receive: {totals.toReceive}
              </Typography>

              {/* Active Loans List */}
              {activeLoans.length > 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                    Active Loans ({activeLoans.length})
                  </Typography>
                  {activeLoans.map((loan) => (
                    <Typography
                      key={loan.id}
                      variant="body2"
                      color="text.secondary"
                    >
                      {loan.counterparty}: Rs {loan.amount} ({loan.type})
                    </Typography>
                  ))}
                </Box>
              )}
            </>
          )}

          {/* Loan form */}
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === '' ? '' : Number(e.target.value))
            }
            margin="normal"
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Loan Type</InputLabel>
            <Select
              value={loanType}
              onChange={(e) => setLoanType(e.target.value as 'borrow' | 'lend')}
            >
              <MenuItem value="borrow">Borrow</MenuItem>
              <MenuItem value="lend">Lend</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Counterparty"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            margin="normal"
          />

          <TextField
            fullWidth
            type="date"
            label="Due Date"
            InputLabelProps={{ shrink: true }}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            margin="normal"
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Source</InputLabel>
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value as TransactionSource)}
            >
              {SOURCE_OPTIONS.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {source === 'bank' && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Select Bank</InputLabel>
              <Select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
              >
                {banks.map((bank) => (
                  <MenuItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Error at bottom above Save */}
          {error && (
            <Typography color="error" fontSize={14} sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={localSaving || (source === 'bank' && !selectedBank)}
          >
            {localSaving ? <CircularProgress size={20} /> : 'Save Loan'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
