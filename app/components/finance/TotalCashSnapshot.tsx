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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useEffect, useState } from 'react';
import { TotalCashSnapshot } from '@/app/lib/interface';
import { calculateTotalCash, formatCurrency } from '@/app/lib/utilts';
import { db } from '@/app/lib/firebase';
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { useCustomTheme } from '@/app/lib/context/themeContext';

const CASH_MODES = [
  'inHand',
  'bank',
  'easypaisa',
  'jazzcash',
  'other',
] as const;

type SnapshotGroup = {
  date: string;
  items: TotalCashSnapshot[];
};

export default function TotalCashSnapshotComponent({
  userId,
}: {
  userId: string;
}) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const muiTheme = useTheme();

  const [snapshots, setSnapshots] = useState<TotalCashSnapshot[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newMode, setNewMode] = useState<string>('inHand');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSnapshots = async () => {
      const querySnapshot = await getDocs(collection(db, 'totalCashSnapshots'));
      const docs = querySnapshot.docs
        .map((doc) => {
          const data = doc.data() as TotalCashSnapshot;
          return {
            ...data,
            id: doc.id,
            createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
            effectiveDate:
              (data.effectiveDate as Timestamp)?.toDate?.() ?? new Date(),
          };
        })
        .filter((doc) => doc.userId === userId);
      setSnapshots(docs);
      setLoading(false);
    };
    fetchSnapshots();
  }, [userId]);

  const total = snapshots.reduce((sum, s) => sum + calculateTotalCash(s), 0);

  const handleSave = async () => {
    if (!newAmount || !newMode) return;

    const now = new Date();
    const newSnapshot: TotalCashSnapshot = {
      userId,
      inHand: newMode === 'inHand' ? Number(newAmount) : 0,
      bank: newMode === 'bank' ? Number(newAmount) : 0,
      easypaisa: newMode === 'easypaisa' ? Number(newAmount) : 0,
      jazzcash: newMode === 'jazzcash' ? Number(newAmount) : 0,
      otherWallets:
        newMode === 'other'
          ? [{ name: 'Other', amount: Number(newAmount) }]
          : [],
      note: '',
      effectiveDate: now,
      createdAt: now,
      updatedAt: now,
    };

    await addDoc(collection(db, 'totalCashSnapshots'), {
      ...newSnapshot,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      effectiveDate: serverTimestamp(),
    });

    setSnapshots((prev) => [...prev, newSnapshot]);
    setShowModal(false);
    setNewAmount('');
    setNewMode('inHand');
  };

  const groupedSnapshots: SnapshotGroup[] = Object.values(
    snapshots.reduce((acc: Record<string, SnapshotGroup>, snap) => {
      const dateObj = toDateSafe(snap.createdAt);
      const dateKey = dateObj.toDateString(); // ✅ No TypeScript error
      if (!acc[dateKey]) {
        acc[dateKey] = { date: dateKey, items: [] };
      }
      acc[dateKey].items.push(snap);
      return acc;
    }, {})
  );

  if (loading || !theme) {
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  function toDateSafe(value: Date | Timestamp): Date {
    return value instanceof Timestamp ? value.toDate() : value;
  }
  return (
    <Box
      sx={{
        maxWidth: 600,
        mx: 'auto',
        my: 4,
        p: 4,
        boxShadow: 6,
        borderRadius: 3,
        backgroundColor: isDark ? muiTheme.palette.background.paper : '#fff',
      }}
    >
      {/* Summary Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Box>
          <Typography variant="subtitle2" color="success.main">
            You have
          </Typography>
          <Typography variant="h4" fontWeight="bold">
            {formatCurrency(total, 'PKR')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => setShowModal(true)}
        >
          + Add More
        </Button>
      </Box>

      {/* Grouped Snapshots */}
      {groupedSnapshots.length > 0 && (
        <Box>
          {groupedSnapshots.map((group, i) => (
            <Accordion key={i} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="medium">
                  Cash Records – {group.date}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {group.items.map((snap, idx) => (
                  <Box key={idx} mb={2}>
                    <Typography fontWeight="bold" variant="body2" mb={1}>
                      {`${toDateSafe(
                        snap.createdAt
                      ).toLocaleDateString()} – ${toDateSafe(
                        snap.createdAt
                      ).toLocaleTimeString()}`}
                    </Typography>

                    <Box component="ul" sx={{ pl: 3, mb: 2 }}>
                      {CASH_MODES.map((mode) => {
                        const val = snap[mode as keyof TotalCashSnapshot];
                        return val ? (
                          <li key={mode}>
                            {mode}: {formatCurrency(Number(val), 'PKR')}
                          </li>
                        ) : null;
                      })}
                      {snap.otherWallets?.map((wallet, idx) => (
                        <li key={idx}>
                          Other ({wallet.name}):{' '}
                          {formatCurrency(wallet.amount, 'PKR')}
                        </li>
                      ))}
                    </Box>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Modal Dialog */}
      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Add Money</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            Current Total: {formatCurrency(total, 'PKR')}
          </Typography>
          <TextField
            label="Amount"
            fullWidth
            type="number"
            value={newAmount}
            onFocus={(e) => e.target.select()}
            onChange={(e) =>
              setNewAmount(e.target.value === '' ? '' : Number(e.target.value))
            }
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Mode</InputLabel>
            <Select
              value={newMode}
              label="Mode"
              onChange={(e) => setNewMode(e.target.value)}
            >
              {CASH_MODES.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" color="success">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
