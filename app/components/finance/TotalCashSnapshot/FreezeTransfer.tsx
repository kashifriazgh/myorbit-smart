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
  CircularProgress,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { TransactionSource, Bank } from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';

const SOURCE_OPTIONS: TransactionSource[] = [
  'bank',
  'in_hand',
  'easypaisa',
  'jazzcash',
  'other',
];

interface Props {
  onFreeze: (
    amount: number,
    fromSource: TransactionSource,
    bankId?: string,
    bankName?: string
  ) => Promise<void>;
  saving: boolean;
}

export default function FreezeTransfer({ onFreeze, saving }: Props) {
  const { user } = useAuth();
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeAmount, setFreezeAmount] = useState<number | ''>('');
  const [freezeFrom, setFreezeFrom] = useState<TransactionSource>('in_hand');

  // bank-specific state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [newBankName, setNewBankName] = useState('');

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

  const handleFreezeClick = async () => {
    if (!freezeAmount || freezeAmount <= 0) return;

    const bank =
      freezeFrom === 'bank'
        ? banks.find((b) => b.id === selectedBank)
        : undefined;

    await onFreeze(Number(freezeAmount), freezeFrom, bank?.id, bank?.name);

    setShowFreezeModal(false);
    setFreezeAmount('');
    setFreezeFrom('in_hand');
    setSelectedBank('');
  };

  return (
    <>
      <Button
        variant="outlined"
        sx={{ background: '#fef9c3' }}
        onClick={() => setShowFreezeModal(true)}
      >
        Freeze
      </Button>

      <Dialog open={showFreezeModal} onClose={() => setShowFreezeModal(false)}>
        <DialogTitle>Transfer to Freezed</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Amount to Freeze"
            type="number"
            value={freezeAmount}
            onChange={(e) =>
              setFreezeAmount(
                e.target.value === '' ? '' : Number(e.target.value)
              )
            }
            margin="normal"
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>From Source</InputLabel>
            <Select
              value={freezeFrom}
              onChange={(e) =>
                setFreezeFrom(e.target.value as TransactionSource)
              }
              label="From Source"
            >
              {SOURCE_OPTIONS.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Extra bank select if source = bank */}
          {freezeFrom === 'bank' && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Select Bank</InputLabel>
                <Select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  label="Bank"
                >
                  {banks.map((bank) => (
                    <MenuItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="New Bank Name"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                margin="normal"
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddBank}
                disabled={!newBankName.trim()}
              >
                + Add Bank
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFreezeModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleFreezeClick}
            disabled={saving || (freezeFrom === 'bank' && !selectedBank)}
          >
            {saving ? <CircularProgress size={20} /> : 'Confirm Transfer'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
