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
  CustomPaymentHead,
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
  'custom',
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
  const [selectedCustomPaymentHead, setSelectedCustomPaymentHead] =
    useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<
    CustomPaymentHead[]
  >([]);

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

  // fetch custom payment heads
  useEffect(() => {
    if (!user) return;
    const fetchCustom = async () => {
      const q = query(
        collection(db, 'customPaymentHeads'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const heads: CustomPaymentHead[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<CustomPaymentHead, 'id'>),
      }));
      setCustomPaymentHeads(heads);
    };
    fetchCustom();
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
    if (source === 'bank' && !selectedBank) {
      setError('Please select a bank.');
      return;
    }
    if (source === 'custom' && !selectedCustomPaymentHead) {
      setError('Please select a payment head.');
      return;
    }

    const bank =
      source === 'bank' ? banks.find((b) => b.id === selectedBank) : undefined;
    const customName =
      source === 'custom'
        ? customPaymentHeads.find(
            (c) => c.id === selectedCustomPaymentHead
          )?.name || ''
        : '';
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
              custom: {},
            },
            totalAmount: 0,
            freezeAmount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

      // normalize bank/custom objects
      if (typeof snapshot.sources.bank === 'number')
        snapshot.sources.bank = { Default: snapshot.sources.bank };
      if (typeof snapshot.sources.custom === 'number')
        snapshot.sources.custom = { Default: snapshot.sources.custom };
      if (!snapshot.sources.custom) snapshot.sources.custom = {};

      // check available balance
      if (loanType === 'lend') {
        const available =
          source === 'bank' && bank?.name
            ? snapshot.sources.bank?.[bank.name] ?? 0
            : source === 'custom' && customName
            ? snapshot.sources.custom?.[customName] ?? 0
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
        ...(source === 'custom' && selectedCustomPaymentHead
          ? {
              customPaymentHeadId: selectedCustomPaymentHead,
              customPaymentHeadName:
                customPaymentHeads.find(
                  (c) => c.id === selectedCustomPaymentHead
                )?.name || '',
            }
          : {}),
      });

      // update snapshot
      const updatedSources = { ...snapshot.sources };
      if (loanType === 'lend') {
        if (source === 'bank' && bank?.name) {
          updatedSources.bank[bank.name] -= amount;
        } else if (source === 'custom' && selectedCustomPaymentHead) {
          const customName =
            customPaymentHeads.find(
              (c) => c.id === selectedCustomPaymentHead
            )?.name || '';
          if (customName) {
            updatedSources.custom[customName] =
              (updatedSources.custom[customName] || 0) - amount;
          }
        } else {
          (updatedSources[source] as number) -= amount;
        }
        snapshot.totalAmount -= amount;
      } else {
        if (source === 'bank' && bank?.name) {
          updatedSources.bank[bank.name] += amount;
        } else if (source === 'custom' && selectedCustomPaymentHead) {
          const customName =
            customPaymentHeads.find(
              (c) => c.id === selectedCustomPaymentHead
            )?.name || '';
          if (customName) {
            updatedSources.custom[customName] =
              (updatedSources.custom[customName] || 0) + amount;
          }
        } else {
          (updatedSources[source] as number) += amount;
        }
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
                Total To Pay Back: ₨{totals.toPay.toLocaleString()}
              </Typography>
              <Typography color="success.main" fontSize={14}>
                Total To Receive: ₨{totals.toReceive.toLocaleString()}
              </Typography>
            </>
          )}

          {/* Active Loans List */}
          {!loadingLoans && activeLoans.length > 0 && (
            <Box sx={{ mt: 2, mb: 2 }}>
              <Typography variant="h6" fontSize={16} fontWeight="bold" mb={1}>
                Active Loans ({activeLoans.length})
              </Typography>
              {activeLoans.map((loan) => (
                <Box
                  key={loan.id}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    backgroundColor:
                      loan.type === 'borrow' ? '#fff3e0' : '#e8f5e8',
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {loan.counterparty} - ₨{loan.amount?.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {loan.type === 'borrow' ? 'You borrowed' : 'You lent'} •
                    Due:{' '}
                    {loan.dueDate instanceof Date
                      ? loan.dueDate.toLocaleDateString()
                      : loan.dueDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                  </Typography>
                </Box>
              ))}
            </Box>
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

          {/* Hint for loan type */}
          {loanType === 'borrow' && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Borrow → You are taking money from someone. You will need to
              return it later.
            </Typography>
          )}

          {loanType === 'lend' && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Lend → You are giving money to someone. They will return it to you
              later.
            </Typography>
          )}

          <TextField
            fullWidth
            label="Lender / Borrower Name"
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
              onChange={(e) => {
                const val = e.target.value as TransactionSource;
                setSource(val);
                setSelectedBank('');
                setSelectedCustomPaymentHead('');
              }}
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

          {source === 'custom' && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Select Payment Head</InputLabel>
              <Select
                value={selectedCustomPaymentHead}
                onChange={(e) => setSelectedCustomPaymentHead(e.target.value)}
              >
                {customPaymentHeads.map((head) => (
                  <MenuItem key={head.id} value={head.id}>
                    {head.name}
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
            disabled={
              localSaving ||
              (source === 'bank' && !selectedBank) ||
              (source === 'custom' && !selectedCustomPaymentHead)
            }
          >
            {localSaving ? <CircularProgress size={20} /> : 'Save Loan'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
