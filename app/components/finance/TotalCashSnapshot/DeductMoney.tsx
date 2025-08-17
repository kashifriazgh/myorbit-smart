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
} from '@mui/material';
import { useState, useEffect } from 'react';
import {
  TransactionSource,
  Bank,
  TotalCashSnapshot,
} from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';

interface Props {
  snapshot: TotalCashSnapshot;
  onDeduct: (
    amount: number,
    source: TransactionSource,
    bankId?: string,
    bankName?: string,
    fromFreeze?: boolean
  ) => Promise<void>;
  saving: boolean;
}

export default function DeductMoney({ snapshot, onDeduct, saving }: Props) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [source, setSource] = useState<TransactionSource>('in_hand');
  const [selectedBank, setSelectedBank] = useState('');
  const [fromFreeze, setFromFreeze] = useState(false);

  const [banks, setBanks] = useState<Bank[]>([]);

  // 🔹 Fetch banks for current user
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

  const handleSaveClick = async () => {
    if (!amount || amount <= 0) return;

    let bankId: string | undefined;
    let bankName: string | undefined;

    if (source === 'bank') {
      bankId = selectedBank;
      bankName = banks.find((b) => b.id === selectedBank)?.name;
      if (!bankId || !bankName) return;
    }

    await onDeduct(Number(amount), source, bankId, bankName, fromFreeze);

    setShowModal(false);
    setAmount('');
    setSource('in_hand');
    setSelectedBank('');
    setFromFreeze(false);
  };

  // 🔹 Compute current balance for validation & display
  let balance = 0;
  if (fromFreeze) {
    balance = snapshot.freezeAmount ?? 0;
  } else if (source === 'bank' && selectedBank) {
    balance = snapshot.sources.bank?.[selectedBank] ?? 0; // ✅ key by bankId
  } else if (source !== 'bank') {
    balance = (snapshot.sources[source] as number) ?? 0;
  }

  return (
    <>
      <Button
        variant="outlined"
        color="error"
        sx={{ background: '#fecaca' }}
        onClick={() => setShowModal(true)}
      >
        - Deduct Money
      </Button>

      <Dialog open={showModal} onClose={() => setShowModal(false)}>
        <DialogTitle>Deduct Money</DialogTitle>
        <DialogContent>
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

          {/* Deduct from Freeze or Normal */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Fund Type</InputLabel>
            <Select
              value={fromFreeze ? 'freeze' : 'normal'}
              onChange={(e) => setFromFreeze(e.target.value === 'freeze')}
            >
              <MenuItem value="normal">Normal Balance</MenuItem>
              <MenuItem value="freeze">Freezed Balance</MenuItem>
            </Select>
          </FormControl>

          {/* Only show source selector if deducting from normal funds */}
          {!fromFreeze && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Source</InputLabel>
                <Select
                  value={source}
                  onChange={(e) =>
                    setSource(e.target.value as TransactionSource)
                  }
                  label="Source"
                >
                  <MenuItem value="in_hand">In Hand</MenuItem>
                  <MenuItem value="bank">Bank</MenuItem>
                  <MenuItem value="easypaisa">Easypaisa</MenuItem>
                  <MenuItem value="jazzcash">JazzCash</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>

              {source === 'bank' && (
                <FormControl fullWidth margin="normal">
                  <InputLabel>Select Bank</InputLabel>
                  <Select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    label="Bank"
                  >
                    {banks.length > 0 ? (
                      banks.map((bank) => (
                        <MenuItem key={bank.id} value={bank.id}>
                          {bank.name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>No Banks Available</MenuItem>
                    )}
                  </Select>
                </FormControl>
              )}
            </>
          )}

          <Typography fontSize={13} color="text.secondary">
            Current balance: {balance}
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleSaveClick}
            disabled={saving || (amount !== '' && Number(amount) > balance)}
          >
            {saving ? 'Saving...' : 'Deduct'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
