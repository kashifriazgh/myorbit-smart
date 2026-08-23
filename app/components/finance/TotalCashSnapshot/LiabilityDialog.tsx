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
  Collapse,
  InputAdornment,
  Chip,
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
import PersonIcon from '@mui/icons-material/Person';
import DateIcon from '@mui/icons-material/CalendarMonth';
import BankIcon from '@mui/icons-material/AccountBalance';
import WalletIcon from '@mui/icons-material/Wallet';
import NoteIcon from '@mui/icons-material/Description';
import SwapIcon from '@mui/icons-material/SwapHoriz';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningIcon from '@mui/icons-material/WarningAmber';
import InfoIcon from '@mui/icons-material/InfoOutlined';
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

  const isEditMode = !!liability;

  // Step state — null = type selection screen (only for new records)
  const [loanType, setLoanType] = useState<'borrowed' | 'lend' | null>(null);

  // Form states
  const [amount, setAmount] = useState<number | ''>('');
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

  // Fetch banks & custom payment heads
  useEffect(() => {
    if (!user || !open) return;
    const fetchBanks = async () => {
      try {
        const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        setBanks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bank, 'id'>) })));
      } catch (err) { console.error(err); }
    };
    const fetchCustom = async () => {
      try {
        const q = query(collection(db, 'customPaymentHeads'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        setCustomPaymentHeads(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomPaymentHead, 'id'>) })));
      } catch (err) { console.error(err); }
    };
    fetchBanks();
    fetchCustom();
  }, [user, open]);

  // Initialize form when opening
  useEffect(() => {
    if (open) {
      setError('');
      if (liability) {
        // Edit mode — skip type selection, go straight to form
        setLoanType(liability.type);
        setAmount(liability.amount);
        setPersonName(liability.personName);
        setDescription(liability.description || '');
        setSource(liability.source || '');
        setStatus(liability.status);
        const fmt = (ts?: Timestamp | Date | null) => {
          if (!ts) return '';
          const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
          return d.toISOString().split('T')[0];
        };
        setDate(fmt(liability.date));
        setDueDate(fmt(liability.dueDate));
      } else {
        // New record — show type selection
        setLoanType(null);
        setAmount('');
        setPersonName('');
        setDescription('');
        setSource('');
        setDueDate('');
        setStatus('active');
        const today = new Date().toISOString().split('T')[0];
        setDate(today);
      }
    }
  }, [open, liability]);

  const handleTypeSelect = (type: 'borrowed' | 'lend') => {
    setLoanType(type);
    setError('');
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
    // Reset type step after close animation
    setTimeout(() => {
      if (!liability) setLoanType(null);
    }, 300);
  };

  const handleSave = async () => {
    if (!user || !loanType) return;
    if (!amount || amount <= 0) { setError('Please enter a valid amount.'); return; }
    if (!personName.trim()) { setError('Please enter the person\'s name.'); return; }
    if (!date) { setError('Please select the transaction date.'); return; }

    setSaving(true);
    setError('');

    try {
      const dateVal = Timestamp.fromDate(new Date(date));
      const dueDateVal = dueDate ? Timestamp.fromDate(new Date(dueDate)) : null;

      const record = {
        type: loanType,
        amount: Number(amount),
        personName: personName.trim(),
        description: description.trim() || null,
        source: source || null,
        date: dateVal,
        dueDate: dueDateVal,
        status,
        settledOn: status === 'settled' ? Timestamp.now() : null,
      };

      if (liability?.id) {
        await updateLiability(liability.id, record);
      } else {
        await addLiability(record);
      }

      handleClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Source display options
  const sourceOptions = [
    <MenuItem key="" value=""><em>Not specified</em></MenuItem>,
    <MenuItem key="in_hand" value="in_hand">💵 Cash in Hand</MenuItem>,
    <MenuItem key="easypaisa" value="easypaisa">📱 EasyPaisa</MenuItem>,
    <MenuItem key="jazzcash" value="jazzcash">📱 JazzCash</MenuItem>,
    <MenuItem key="other" value="other">💼 Other</MenuItem>,
    ...banks.map((b) => (
      <MenuItem key={b.id} value={`bank:${b.name}`}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <BankIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <span>{b.name}</span>
        </Stack>
      </MenuItem>
    )),
    ...customPaymentHeads.map((c) => (
      <MenuItem key={c.id} value={`custom:${c.name}`}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WalletIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <span>{c.name}</span>
        </Stack>
      </MenuItem>
    )),
  ];

  const headerGradient = loanType === 'borrowed'
    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    : loanType === 'lend'
      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      : 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)';

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : handleClose}
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
      {/* ── Dialog Header ── */}
      <Box sx={{
        background: headerGradient,
        p: 2.5,
        color: 'white',
        position: 'relative',
        transition: 'background 0.4s ease',
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {loanType !== null && !isEditMode && (
            <IconButton
              onClick={() => setLoanType(null)}
              size="small"
              sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', width: 36, height: 36 }}>
            <SwapIcon fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>
              {isEditMode
                ? 'Edit Liability'
                : loanType === 'borrowed'
                  ? 'Borrowed Record'
                  : loanType === 'lend'
                    ? 'Lend Record'
                    : 'New Liability'}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>
              {loanType === null
                ? 'What kind of transaction is this?'
                : 'Record only — no balance changes in your wallet'}
            </Typography>
          </Box>
        </Stack>
        <IconButton
          onClick={handleClose}
          disabled={saving}
          size="small"
          sx={{ position: 'absolute', right: 12, top: 12, color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ── STEP 1: Type Selection (new records only) ── */}
      {loanType === null && !isEditMode && (
        <DialogContent sx={{ px: 3, py: 3 }}>
          <Stack spacing={2.5}>
            {/* Info banner */}
            <Box sx={{
              p: 1.5, borderRadius: 2, display: 'flex', gap: 1, alignItems: 'flex-start',
              bgcolor: isDark ? 'rgba(236,72,153,0.08)' : '#fdf2f8',
              border: `1px solid ${isDark ? 'rgba(236,72,153,0.2)' : '#fbcfe8'}`,
            }}>
              <InfoIcon sx={{ fontSize: 16, color: '#ec4899', mt: 0.1, flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ lineHeight: 1.5 }}>
                Liabilities are <strong>record-only</strong>. They do not affect your wallet balance — just track what you owe or are owed.
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" fontWeight={600} textAlign="center">
              Choose what you want to record:
            </Typography>

            <Stack direction="row" spacing={2}>
              {/* Borrowed Card */}
              <Box
                onClick={() => handleTypeSelect('borrowed')}
                sx={{
                  flex: 1, p: 2.5, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
                  border: `2px solid ${isDark ? 'rgba(245,158,11,0.3)' : '#fde68a'}`,
                  bgcolor: isDark ? 'rgba(245,158,11,0.07)' : '#fffbeb',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    border: '2px solid #f59e0b',
                    transform: 'translateY(-3px)',
                    boxShadow: '0 8px 20px rgba(245,158,11,0.2)',
                  },
                }}
              >
                <Typography fontSize="2.2rem" mb={0.5}>🤲</Typography>
                <Typography fontWeight={900} fontSize="1.05rem" color="#d97706">Borrowed</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mt={0.5}>
                  You owe someone money
                </Typography>
              </Box>

              {/* Lend Card */}
              <Box
                onClick={() => handleTypeSelect('lend')}
                sx={{
                  flex: 1, p: 2.5, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
                  border: `2px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#a7f3d0'}`,
                  bgcolor: isDark ? 'rgba(16,185,129,0.07)' : '#ecfdf5',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    border: '2px solid #10b981',
                    transform: 'translateY(-3px)',
                    boxShadow: '0 8px 20px rgba(16,185,129,0.2)',
                  },
                }}
              >
                <Typography fontSize="2.2rem" mb={0.5}>🤝</Typography>
                <Typography fontWeight={900} fontSize="1.05rem" color="#059669">Lent</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mt={0.5}>
                  Someone owes you money
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
      )}

      {/* ── STEP 2: Form ── */}
      {(loanType !== null || isEditMode) && (
        <>
          <DialogContent sx={{ px: 3, py: 2.5 }}>
            <Stack spacing={2}>

              {/* Record-only notice */}
              <Box sx={{
                p: 1.2, borderRadius: 2, display: 'flex', gap: 1, alignItems: 'center',
                bgcolor: isDark ? 'rgba(148,163,184,0.07)' : '#f8fafc',
                border: `1px dashed ${isDark ? 'rgba(148,163,184,0.2)' : '#cbd5e1'}`,
              }}>
                <InfoIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
                <Typography variant="caption" color="text.disabled" fontWeight={600}>
                  Record only — your wallet balances won&apos;t change.
                </Typography>
              </Box>

              {/* Amount */}
              <TextField
                fullWidth size="small"
                label="Amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'text.secondary' }}>PKR</Typography>
                    </InputAdornment>
                  ),
                }}
                placeholder="0.00"
                disabled={saving}
                autoFocus={!isEditMode}
              />

              {/* Person name */}
              <TextField
                fullWidth size="small"
                label={loanType === 'borrowed' ? "Who did you borrow from?" : "Who did you lend to?"}
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder={loanType === 'borrowed' ? "e.g. Uncle Ali, a friend" : "e.g. Ahmed, colleague"}
                InputProps={{ startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> }}
                disabled={saving}
              />

              {/* Source (cosmetic / reference only) */}
              <Box>
                <Typography variant="caption" fontWeight={800} color="text.secondary"
                  sx={{ mb: 0.8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Which account was involved? (optional)
                </Typography>
                <FormControl fullWidth size="small" disabled={saving}>
                  <InputLabel>Account / Source</InputLabel>
                  <Select value={source} onChange={(e) => setSource(e.target.value)} label="Account / Source">
                    {sourceOptions}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                  For reference only — no balance changes.
                </Typography>
              </Box>

              {/* Dates row */}
              <Stack direction="row" spacing={1.5}>
                <TextField
                  fullWidth size="small"
                  type="date"
                  label="Transaction Date"
                  InputLabelProps={{ shrink: true }}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  InputProps={{ startAdornment: <DateIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> }}
                  disabled={saving}
                />
                <TextField
                  fullWidth size="small"
                  type="date"
                  label="Return Date (optional)"
                  InputLabelProps={{ shrink: true }}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  InputProps={{ startAdornment: <DateIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> }}
                  disabled={saving}
                />
              </Stack>

              {/* Status (edit mode only) */}
              {isEditMode && (
                <FormControl fullWidth size="small" disabled={saving}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'active' | 'settled' | 'overdue')}
                    label="Status"
                  >
                    <MenuItem value="active">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip label="Active" size="small" sx={{ bgcolor: '#3b82f6', color: 'white', fontWeight: 800, fontSize: '0.65rem' }} />
                      </Stack>
                    </MenuItem>
                    <MenuItem value="overdue">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip label="Overdue" size="small" sx={{ bgcolor: '#ef4444', color: 'white', fontWeight: 800, fontSize: '0.65rem' }} />
                      </Stack>
                    </MenuItem>
                    <MenuItem value="settled">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip label="Settled" size="small" sx={{ bgcolor: '#22c55e', color: 'white', fontWeight: 800, fontSize: '0.65rem' }} />
                      </Stack>
                    </MenuItem>
                  </Select>
                </FormControl>
              )}

              {/* Description */}
              <TextField
                fullWidth size="small"
                label="Note / Reason (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. For office lunch share, car repair…"
                multiline rows={2}
                InputProps={{
                  startAdornment: <NoteIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18, mt: 0.5, alignSelf: 'flex-start' }} />,
                }}
                disabled={saving}
              />

              {/* Error */}
              <Collapse in={!!error}>
                <Box sx={{
                  p: 1.5, borderRadius: 2,
                  bgcolor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                  border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : '#fee2e2'}`,
                }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <WarningIcon color="error" sx={{ fontSize: 18 }} />
                    <Typography color="error" variant="caption" fontWeight="bold">{error}</Typography>
                  </Stack>
                </Box>
              </Collapse>

            </Stack>
          </DialogContent>

          <DialogActions sx={{
            px: 3, py: 2,
            bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fafafa',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0'}`,
          }}>
            <Button onClick={handleClose} disabled={saving} sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !amount || !personName.trim() || !date}
              sx={{
                borderRadius: 2, fontWeight: 800, px: 3.5, textTransform: 'none',
                bgcolor: loanType === 'borrowed' ? '#f59e0b' : loanType === 'lend' ? '#10b981' : '#ec4899',
                boxShadow: loanType === 'borrowed'
                  ? '0 4px 14px rgba(245,158,11,0.35)'
                  : loanType === 'lend'
                    ? '0 4px 14px rgba(16,185,129,0.35)'
                    : '0 4px 14px rgba(236,72,153,0.35)',
                '&:hover': {
                  bgcolor: loanType === 'borrowed' ? '#d97706' : loanType === 'lend' ? '#059669' : '#be185d',
                },
              }}
            >
              {saving
                ? <CircularProgress size={20} color="inherit" />
                : isEditMode
                  ? 'Save Changes'
                  : `Save ${loanType === 'borrowed' ? 'Borrow' : 'Lend'} Record`}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
