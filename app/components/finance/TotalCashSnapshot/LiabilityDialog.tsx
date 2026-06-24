'use client';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  CircularProgress,
  Box,
  Fade,
  Stack,
  Avatar,
  IconButton,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  Bank,
  Liability,
  TotalCashSnapshot,
  CustomPaymentHead,
} from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import {
  collection,
  query,
  where,
  Timestamp,
  getDocs,
} from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import CloseIcon from '@mui/icons-material/Close';
import MoneyIcon from '@mui/icons-material/AttachMoney';
import PersonIcon from '@mui/icons-material/Person';
import DateIcon from '@mui/icons-material/CalendarMonth';
import PaymentsIcon from '@mui/icons-material/Payments';
import NoteIcon from '@mui/icons-material/Description';
import SwapIcon from '@mui/icons-material/SwapHoriz';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useLiabilities } from '@/app/lib/hooks/useLiabilities';

interface Props {
  open: boolean;
  onClose: () => void;
  liability?: Liability | null;
  snapshot?: TotalCashSnapshot | null;
  onSuccess?: () => void;
}

export default function LiabilityDialog({
  open,
  onClose,
  liability,
  onSuccess,
}: Props) {
  const { user } = useAuth();
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';
  const { addLiability, updateLiability } = useLiabilities();

  // Form states
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'lend' | 'borrowed'>('borrowed');
  const [personName, setPersonName] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'settled' | 'overdue'>('active');

  const [banks, setBanks] = useState<Bank[]>([]);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Set default date to today
  useEffect(() => {
    if (open && !liability) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
    }
  }, [open, liability]);

  // Fetch banks & custom payment heads for options dropdown
  useEffect(() => {
    if (!user || !open) return;
    const fetchBanks = async () => {
      try {
        const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        const fetched: Bank[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Bank, 'id'>),
        }));
        setBanks(fetched);
      } catch (err) {
        console.error(err);
      }
    };
    const fetchCustom = async () => {
      try {
        const q = query(collection(db, 'customPaymentHeads'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        const fetched: CustomPaymentHead[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<CustomPaymentHead, 'id'>),
        }));
        setCustomPaymentHeads(fetched);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBanks();
    fetchCustom();
  }, [user, open]);

  // Initialize form when opening/editing
  useEffect(() => {
    if (open) {
      if (liability) {
        setAmount(liability.amount);
        setType(liability.type);
        setPersonName(liability.personName);
        setDescription(liability.description || '');
        setSource(liability.source || '');
        setStatus(liability.status);

        const formatDateStr = (ts?: Timestamp | Date | null) => {
          if (!ts) return '';
          const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
          return d.toISOString().split('T')[0];
        };

        setDate(formatDateStr(liability.date));
        setDueDate(formatDateStr(liability.dueDate));
      } else {
        setAmount('');
        setType('borrowed');
        setPersonName('');
        setDescription('');
        setSource('');
        setDueDate('');
        setStatus('active');
      }
      setError('');
    }
  }, [open, liability]);

  const handleSave = async () => {
    if (!user) return;
    if (!amount || amount <= 0 || !personName.trim() || !date) {
      setError('Please fill in all required fields.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const dateVal = Timestamp.fromDate(new Date(date));
      const dueDateVal = dueDate ? Timestamp.fromDate(new Date(dueDate)) : null;

      const record = {
        type,
        amount: Number(amount),
        personName: personName.trim(),
        description: description.trim() || null,
        source: source || null,
        date: dateVal,
        dueDate: dueDateVal,
        status: status,
        settledOn: status === 'settled' ? Timestamp.now() : null,
      };

      if (liability?.id) {
        // Edit mode
        await updateLiability(liability.id, record);
      } else {
        // Create mode
        await addLiability(record);
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Failed to save liability';
      setError(errMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      TransitionComponent={Fade}
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
        },
      }}
    >
      <Box
        sx={{
          background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
          p: 3,
          color: 'white',
          position: 'relative',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
            <PaymentsIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>
              {liability ? 'Edit Liability' : 'New Liability'}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
              P2P tracking with no cash balance adjustments
            </Typography>
          </Box>
        </Stack>
        <IconButton
          onClick={onClose}
          disabled={saving}
          sx={{
            position: 'absolute',
            right: 12,
            top: 12,
            color: 'white',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 3, py: 3 }}>
        <Stack spacing={2.5}>
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            InputProps={{
              startAdornment: <MoneyIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
            }}
            placeholder="0.00"
            required
            disabled={saving}
          />

          <FormControl fullWidth disabled={saving}>
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as 'lend' | 'borrowed')}
              label="Type"
              startAdornment={<SwapIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
            >
              <MenuItem value="borrowed">Borrowed (To Pay Back)</MenuItem>
              <MenuItem value="lend">Lend (To Receive Back)</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Person Name"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            placeholder="e.g. Alice"
            InputProps={{
              startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
            }}
            required
            disabled={saving}
          />

          <TextField
            fullWidth
            type="date"
            label="Transaction Date"
            InputLabelProps={{ shrink: true }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputProps={{
              startAdornment: <DateIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
            }}
            required
            disabled={saving}
          />

          <TextField
            fullWidth
            type="date"
            label="Return Date"
            InputLabelProps={{ shrink: true }}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            InputProps={{
              startAdornment: <DateIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
            }}
            disabled={saving}
          />

          <FormControl fullWidth disabled={saving}>
            <InputLabel>Cash Source (Cosmetic Only)</InputLabel>
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              label="Cash Source (Cosmetic Only)"
              startAdornment={<PaymentsIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
            >
              <MenuItem value=""><em>None / Unspecified</em></MenuItem>
              <MenuItem value="in_hand">Cash In Hand</MenuItem>
              <MenuItem value="easypaisa">Easypaisa</MenuItem>
              <MenuItem value="jazzcash">Jazzcash</MenuItem>
              <MenuItem value="other">Other</MenuItem>
              {banks.map((b) => (
                <MenuItem key={b.id} value={`bank:${b.name}`}>
                  Bank: {b.name}
                </MenuItem>
              ))}
              {customPaymentHeads.map((c) => (
                <MenuItem key={c.id} value={`custom:${c.name}`}>
                  Custom: {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {liability && (
            <FormControl fullWidth disabled={saving}>
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'settled' | 'overdue')}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
                <MenuItem value="settled">Settled</MenuItem>
              </Select>
            </FormControl>
          )}

          <TextField
            fullWidth
            label="Description / Remark"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. For office lunch share"
            size="small"
            multiline
            rows={2}
            InputProps={{
              startAdornment: (
                <NoteIcon
                  sx={{ mr: 1, color: 'text.secondary', fontSize: 20, mt: 1, alignSelf: 'flex-start' }}
                />
              ),
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            disabled={saving}
          />

          {error && (
            <Typography color="error" variant="caption" fontWeight="bold">
              ⚠️ {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 3,
          bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fcfcfc',
          borderTop: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <Button onClick={onClose} disabled={saving} sx={{ fontWeight: 700, color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !amount || !personName.trim() || !date}
          sx={{
            borderRadius: 2,
            fontWeight: 800,
            px: 4,
            bgcolor: '#ec4899',
            boxShadow: '0 4px 14px 0 rgba(236, 72, 153, 0.39)',
            textTransform: 'none',
            '&:hover': { bgcolor: '#be185d' },
          }}
        >
          {saving ? <CircularProgress size={20} color="inherit" /> : liability ? 'Save Changes' : 'Add Liability'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
