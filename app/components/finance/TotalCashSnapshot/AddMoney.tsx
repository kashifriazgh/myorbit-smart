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
  Checkbox,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
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
  onSave: (
    amount: number,
    source: TransactionSource,
    isFreezed: boolean,
    bankId?: string,
    bankName?: string
  ) => Promise<void>;
  saving: boolean;
}

export default function AddMoney({ onSave, saving }: Props) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newMode, setNewMode] = useState<TransactionSource>('in_hand');
  const [isFreezed, setIsFreezed] = useState(false);

  // Bank-specific state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');
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

  const handleSaveClick = async () => {
    if (!newAmount || newAmount <= 0) return;

    let bankId: string | undefined;
    let bankName: string | undefined;

    // ✅ Ignore source/bank if freezed
    const sourceToSave: TransactionSource = isFreezed
      ? 'in_hand' // dummy fallback
      : newMode;

    if (!isFreezed && newMode === 'bank') {
      bankId = selectedBank;
      bankName = banks.find((b) => b.id === selectedBank)?.name;
      if (!bankId || !bankName) return; // require valid selection
    }

    await onSave(Number(newAmount), sourceToSave, isFreezed, bankId, bankName);

    // reset state
    setShowModal(false);
    setNewAmount('');
    setNewMode('in_hand');
    setIsFreezed(false);
    setSelectedBank('');
  };

  return (
    <>
      <Button variant="contained" onClick={() => setShowModal(true)}>
        + Add Money
      </Button>

      <Dialog open={showModal} onClose={() => setShowModal(false)}>
        <DialogTitle>Add Money</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={newAmount}
            onChange={(e) =>
              setNewAmount(e.target.value === '' ? '' : Number(e.target.value))
            }
            margin="normal"
          />

          {/* Source dropdown (disabled when freezed) */}
          <FormControl fullWidth margin="normal" disabled={isFreezed}>
            <InputLabel>Source</InputLabel>
            <Select
              value={newMode}
              onChange={(e) => setNewMode(e.target.value as TransactionSource)}
              label="Source"
            >
              {SOURCE_OPTIONS.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Extra bank select if source = bank and not freezed */}
          {!isFreezed && newMode === 'bank' && (
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

              {/* Add new bank */}
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

          <Checkbox
            size="small"
            checked={isFreezed}
            onChange={(e) => {
              const checked = e.target.checked;
              setIsFreezed(checked);

              if (checked) {
                // ✅ reset source & bank when freezed
                setNewMode('in_hand');
                setSelectedBank('');
              }
            }}
          />
          <Typography fontSize={13} component="span">
            Add to Freezed balance
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveClick}
            disabled={
              saving || (!isFreezed && newMode === 'bank' && !selectedBank)
            }
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
