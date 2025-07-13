// 💼 TotalCashSnapshotComponent.tsx

'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  CircularProgress,
  IconButton,
  Collapse,
  Checkbox,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  TotalCashSnapshot,
  CashTransaction,
  TransactionSource,
} from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { formatCurrency } from '@/app/lib/utilts';

const SOURCE_OPTIONS: TransactionSource[] = [
  'bank',
  'in_hand',
  'easypaisa',
  'jazzcash',
  'other',
];

export default function TotalCashSnapshotComponent({
  userId,
}: {
  userId: string;
}) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [snapshot, setSnapshot] = useState<TotalCashSnapshot | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newMode, setNewMode] = useState<TransactionSource>('in_hand');
  const [isFreezed, setIsFreezed] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFreeze, setShowFreeze] = useState(true);

  const [freezeAmount, setFreezeAmount] = useState<number | ''>('');
  const [freezeFrom, setFreezeFrom] = useState<TransactionSource>('in_hand');

  const currency = 'PKR';

  useEffect(() => {
    const fetchSnapshot = async () => {
      setLoading(true);
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as TotalCashSnapshot;
        setSnapshot(data);
      } else {
        const initial: TotalCashSnapshot = {
          userId,
          sources: {
            in_hand: 0,
            bank: 0,
            easypaisa: 0,
            jazzcash: 0,
            other: 0,
          },
          totalAmount: 0,
          freezeAmount: 0,
          updatedAt: new Date(),
          createdAt: new Date(),
        };
        await setDoc(docRef, initial);
        setSnapshot(initial);
      }
      setLoading(false);
    };
    fetchSnapshot();
  }, [userId]);

  const handleSave = async () => {
    if (!newAmount || newAmount <= 0 || !newMode) return;
    setSaving(true);
    const now = new Date();

    const txn: CashTransaction = {
      userId,
      amount: Number(newAmount),

      type: 'freeze_transfer', // ✅ NEW keyword instead of 'deduct'
      source: newMode,
      category: 'manual',
      note: isFreezed ? 'Freezed addition' : 'Manual addition',
      createdAt: now,
    };

    await addDoc(collection(db, 'cashTransactions'), {
      ...txn,
      createdAt: serverTimestamp(),
    });

    const docRef = doc(db, 'totalCashSnapshots', userId);

    const updatedSources = snapshot?.sources || {
      in_hand: 0,
      bank: 0,
      easypaisa: 0,
      jazzcash: 0,
      other: 0,
    };

    updatedSources[newMode] += Number(newAmount);

    const updatedSnapshot: TotalCashSnapshot = {
      ...snapshot!,
      sources: updatedSources,
      freezeAmount: isFreezed
        ? (snapshot?.freezeAmount || 0) + Number(newAmount)
        : snapshot?.freezeAmount || 0,
      totalAmount: (snapshot?.totalAmount || 0) + Number(newAmount),
      updatedAt: new Date(),
    };

    await setDoc(docRef, {
      ...updatedSnapshot,
      updatedAt: serverTimestamp(),
    });

    setSnapshot(updatedSnapshot);
    setShowModal(false);
    setNewAmount('');
    setNewMode('in_hand');
    setIsFreezed(false);
    setSaving(false);
  };

  const handleFreezeTransfer = async () => {
    if (!freezeAmount || freezeAmount <= 0 || !freezeFrom) return;

    setSaving(true); // ✅ Start loader
    const amount = Number(freezeAmount);

    const sourceBalance = snapshot?.sources?.[freezeFrom] || 0;
    if (amount > sourceBalance) {
      alert(`Not enough balance in ${freezeFrom}`);
      setSaving(false); // ❗Don't forget to reset if early return
      return;
    }

    const docRef = doc(db, 'totalCashSnapshots', userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      setSaving(false);
      return;
    }

    const data = docSnap.data() as TotalCashSnapshot;
    const updatedSources = { ...data.sources };
    updatedSources[freezeFrom] -= amount;

    const updatedSnapshot: TotalCashSnapshot = {
      ...data,
      sources: updatedSources,
      freezeAmount: (data.freezeAmount || 0) + amount,
      updatedAt: new Date(),
    };

    await setDoc(docRef, {
      ...updatedSnapshot,
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, 'cashTransactions'), {
      userId,
      amount,
      type: 'freeze_transfer',
      source: freezeFrom,
      category: 'freeze',
      note: 'Transferred to Freezed',
      createdAt: serverTimestamp(),
    });

    setSnapshot(updatedSnapshot);
    setFreezeAmount('');
    setFreezeFrom('in_hand');
    setShowFreezeModal(false);
    setSaving(false); // ✅ End loader
  };

  const freezeDisplay = snapshot?.freezeAmount || 0;
  const totalDisplay = snapshot?.totalAmount || 0;
  const available = totalDisplay - freezeDisplay;

  if (loading || !theme || !snapshot) {
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h6" fontWeight="bold" mb={1}>
        You have
      </Typography>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography color="text.secondary">
          Freezed:{' '}
          {showFreeze ? formatCurrency(freezeDisplay, currency) : '•••••••'}
        </Typography>
        <IconButton size="small" onClick={() => setShowFreeze((p) => !p)}>
          {showFreeze ? (
            <VisibilityOff fontSize="small" />
          ) : (
            <Visibility fontSize="small" />
          )}
        </IconButton>
      </Box>

      <Typography variant="h4" fontWeight="bold">
        {formatCurrency(available, currency)}
      </Typography>

      <Button onClick={() => setShowBreakdown((p) => !p)} size="small">
        {showBreakdown ? 'Hide' : 'Show'} Account Breakdown
      </Button>

      <Collapse in={showBreakdown}>
        <Box
          mt={2}
          borderRadius={2}
          p={1}
          bgcolor={isDark ? '#1f2937' : '#f9f9f9'}
        >
          {Object.entries(snapshot.sources || {}).map(([name, amt]) => (
            <Box
              key={name}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              py={0.5}
              px={1}
              sx={{
                fontSize: '0.82rem',
                borderBottom: '1px solid',
                borderColor: isDark ? '#374151' : '#e0e0e0',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Typography
                fontSize="0.82rem"
                fontWeight={500}
                color="text.secondary"
              >
                {name}
              </Typography>
              <Typography fontSize="0.82rem" fontWeight={600}>
                {formatCurrency(amt, currency)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>

      <Box mt={2} display="flex" gap={1}>
        <Button variant="contained" onClick={() => setShowModal(true)}>
          + Add Money
        </Button>
        <Button variant="outlined" onClick={() => setShowFreezeModal(true)}>
          Transfer to Freezed
        </Button>
      </Box>

      {/* Add Money Modal */}
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
          <FormControl fullWidth margin="normal">
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
          <Box display="flex" alignItems="center" mt={2}>
            <Checkbox
              size="small"
              checked={isFreezed}
              onChange={(e) => setIsFreezed(e.target.checked)}
            />
            <Typography fontSize={13} component="span">
              Add to Freezed balance
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer to Freezed Modal */}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFreezeModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleFreezeTransfer}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Confirm Transfer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
