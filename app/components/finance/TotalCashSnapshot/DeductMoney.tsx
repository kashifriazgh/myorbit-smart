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
  Stack,
  Box,
  Avatar,
  IconButton,
  Fade,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import { useState, useEffect } from 'react';
import {
  TransactionSource,
  Bank,
  TotalCashSnapshot,
  CustomPaymentHead,
} from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import CloseIcon from '@mui/icons-material/Close';
import DeductIcon from '@mui/icons-material/RemoveCircle';
import BankIcon from '@mui/icons-material/AccountBalance';
import WalletIcon from '@mui/icons-material/Wallet';
import BalanceIcon from '@mui/icons-material/AccountBalanceWallet';
import NoteIcon from '@mui/icons-material/Description';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { formatCurrency } from '@/app/lib/utilts';
import { getSourceKey } from '../TotalCashSnapshot';

interface Props {
  snapshot: TotalCashSnapshot;
  onDeduct: (
    amount: number,
    source: TransactionSource,
    bankId?: string,
    bankName?: string,
    fromFreeze?: boolean,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string,
    note?: string,
    holderName?: string
  ) => Promise<void>;
  saving: boolean;
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

const SOURCE_ICONS: Record<string, string> = {
  in_hand: '💵',
  bank: '🏦',
  easypaisa: '📱',
  jazzcash: '📱',
  other: '💼',
  custom: '🗂️',
};

const SOURCE_LABELS: Record<string, string> = {
  in_hand: 'Cash in Hand',
  bank: 'Bank Account',
  easypaisa: 'EasyPaisa',
  jazzcash: 'JazzCash',
  other: 'Other',
  custom: 'Custom Wallet',
};

const SOURCE_OPTIONS: TransactionSource[] = ['in_hand', 'bank', 'easypaisa', 'jazzcash', 'other', 'custom'];

export default function DeductMoney({ snapshot, onDeduct, saving, externalOpen, onExternalClose }: Props) {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [source, setSource] = useState<TransactionSource>('in_hand');
  const [selectedBank, setSelectedBank] = useState('');
  const [note, setNote] = useState('');
  const [selectedHolder, setSelectedHolder] = useState('Unassigned');

  const [banks, setBanks] = useState<Bank[]>([]);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);
  const [selectedCustomPaymentHead, setSelectedCustomPaymentHead] = useState('');

  // Sync with external open state from FAB
  useEffect(() => {
    if (externalOpen !== undefined) setShowModal(externalOpen);
  }, [externalOpen]);

  // Fetch banks
  useEffect(() => {
    if (!user) return;
    const fetchBanks = async () => {
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setBanks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bank, 'id'>) })));
    };
    fetchBanks();
  }, [user]);

  // Fetch custom heads
  useEffect(() => {
    if (!user) return;
    const fetchCustom = async () => {
      const q = query(collection(db, 'customPaymentHeads'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setCustomPaymentHeads(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomPaymentHead, 'id'>) })));
    };
    fetchCustom();
  }, [user]);

  // Reset selected holder when source changes
  useEffect(() => {
    setSelectedHolder('Unassigned');
  }, [source, selectedBank, selectedCustomPaymentHead]);

  const handleSaveClick = async () => {
    if (!amount || amount <= 0) return;

    let bankId: string | undefined;
    let bankName: string | undefined;
    let customPaymentHeadId: string | undefined;
    let customPaymentHeadName: string | undefined;

    if (source === 'bank') {
      bankId = selectedBank;
      bankName = banks.find((b) => b.id === selectedBank)?.name;
      if (!bankId || !bankName) return;
    }
    if (source === 'custom') {
      customPaymentHeadId = selectedCustomPaymentHead;
      customPaymentHeadName = customPaymentHeads.find((c) => c.id === selectedCustomPaymentHead)?.name;
      if (!customPaymentHeadId || !customPaymentHeadName) return;
    }

    const holderToSave = selectedHolder === 'Unassigned' ? undefined : selectedHolder;

    await onDeduct(Number(amount), source, bankId, bankName, false, customPaymentHeadId, customPaymentHeadName, note, holderToSave);

    setShowModal(false);
    onExternalClose?.();
    setAmount('');
    setSource('in_hand');
    setSelectedBank('');
    setSelectedCustomPaymentHead('');
    setSelectedHolder('Unassigned');
    setNote('');
  };

  // Balance computation
  const bankName = banks.find((b) => b.id === selectedBank)?.name;
  const customPaymentHeadName = customPaymentHeads.find((c) => c.id === selectedCustomPaymentHead)?.name;
  const sourceKey = getSourceKey(source, bankName, customPaymentHeadName);
  const existingHolders = snapshot.heldBy?.[sourceKey] || [];

  let balance = 0;
  if (source === 'bank' && bankName) {
    balance = snapshot.sources.bank?.[bankName] ?? 0;
  } else if (source === 'custom' && customPaymentHeadName) {
    balance = snapshot.sources.custom?.[customPaymentHeadName] ?? 0;
  } else if (source !== 'bank' && source !== 'custom') {
    balance = (snapshot.sources[source] as number) ?? 0;
  }

  const holdersSum = existingHolders.reduce((s, h) => s + h.amount, 0);
  let activeBalance = balance;
  if (existingHolders.length > 0) {
    activeBalance = selectedHolder === 'Unassigned' ? balance - holdersSum : (existingHolders.find((h) => h.holderName === selectedHolder)?.amount ?? 0);
  }

  const handleClose = () => {
    if (saving) return;
    setShowModal(false);
    onExternalClose?.();
  };

  const isInsufficient = amount !== '' && Number(amount) > activeBalance;

  return (
    <>
      <Dialog
        open={showModal}
        onClose={handleClose}
        fullWidth maxWidth="xs"
        TransitionComponent={Fade}
        PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden', backgroundColor: isDark ? '#0f172a' : '#ffffff' } }}
      >
        {/* Header */}
        <Box sx={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', p: 2.5, color: 'white', position: 'relative' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', width: 36, height: 36 }}>
              <DeductIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>Deduct Funds</Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>Withdraw or spend from your balance</Typography>
            </Box>
          </Stack>
          <IconButton onClick={handleClose} size="small"
            sx={{ position: 'absolute', right: 12, top: 12, color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent sx={{ px: 3, py: 2.5 }}>
          <Stack spacing={2}>

            {/* Amount */}
            <TextField
              fullWidth size="small" label="Amount" type="number"
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
              error={isInsufficient}
              helperText={isInsufficient ? 'Insufficient funds' : ''}
              autoFocus
            />

            {/* Source — icon cards */}
            <Box>
              <Typography variant="caption" fontWeight={800} color="text.secondary"
                sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Deduct from which account?
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
                {SOURCE_OPTIONS.map((opt) => (
                  <Box
                    key={opt}
                    onClick={() => { setSource(opt); setSelectedBank(''); setSelectedCustomPaymentHead(''); }}
                    sx={{
                      flex: '1 1 28%', p: 1.2, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                      border: `2px solid ${source === opt ? '#ef4444' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                      bgcolor: source === opt ? (isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2') : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { border: '2px solid #ef4444', bgcolor: isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2' },
                    }}
                  >
                    <Typography fontSize="1.2rem">{SOURCE_ICONS[opt]}</Typography>
                    <Typography variant="caption" fontWeight={700} display="block" sx={{ fontSize: '0.68rem', lineHeight: 1.3 }}>
                      {SOURCE_LABELS[opt]}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* Bank selector (no create option) */}
            {source === 'bank' && (
              <FormControl fullWidth size="small">
                <InputLabel>Select Bank</InputLabel>
                <Select value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)} label="Select Bank"
                  startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                  <MenuItem value=""><em>— Choose a bank —</em></MenuItem>
                  {banks.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            {/* Custom wallet selector (no create option) */}
            {source === 'custom' && (
              <FormControl fullWidth size="small">
                <InputLabel>Select Custom Wallet</InputLabel>
                <Select value={selectedCustomPaymentHead} onChange={(e) => setSelectedCustomPaymentHead(e.target.value)} label="Select Custom Wallet"
                  startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                  <MenuItem value=""><em>— Choose a wallet —</em></MenuItem>
                  {customPaymentHeads.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            {/* Holder selector (if holders exist) */}
            {existingHolders.length > 0 && (
              <FormControl fullWidth size="small">
                <InputLabel>Deduct from person (optional)</InputLabel>
                <Select value={selectedHolder} onChange={(e) => setSelectedHolder(e.target.value)} label="Deduct from person (optional)">
                  <MenuItem value="Unassigned">
                    General / Self ({formatCurrency(balance - holdersSum, 'PKR')})
                  </MenuItem>
                  {existingHolders.map((h) => (
                    <MenuItem key={h.holderName} value={h.holderName}>
                      {h.holderName} ({formatCurrency(h.amount, 'PKR')})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Balance chip */}
            <Box sx={{
              p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5,
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
            }}>
              <BalanceIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {selectedHolder === 'Unassigned' ? 'AVAILABLE BALANCE' : `${selectedHolder.toUpperCase()}'S BALANCE`}
                </Typography>
                <Typography variant="body2" fontWeight="900" color={isInsufficient ? 'error.main' : 'text.primary'}>
                  {formatCurrency(activeBalance, 'PKR')}
                </Typography>
              </Box>
            </Box>

            {/* Lock warning */}
            {snapshot.sourceOwnership?.[sourceKey]?.isLocked && (
              <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="error.main" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  🔒 This source is locked. Unlock it in Account Breakdown to deduct funds.
                </Typography>
              </Box>
            )}

            {/* Note */}
            <TextField
              fullWidth size="small" label="Note (optional)" value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Rent, Grocery, Bill payment…"
              multiline rows={2}
              InputProps={{ startAdornment: <NoteIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18, mt: 0.5, alignSelf: 'flex-start' }} /> }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fafafa', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0'}` }}>
          <Button onClick={handleClose} sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained" color="error"
            onClick={handleSaveClick}
            disabled={
              saving || isInsufficient || !!snapshot.sourceOwnership?.[sourceKey]?.isLocked ||
              (source === 'bank' && !selectedBank) ||
              (source === 'custom' && !selectedCustomPaymentHead) ||
              !amount || amount <= 0
            }
            sx={{ borderRadius: 2, fontWeight: 800, px: 3.5, textTransform: 'none', boxShadow: '0 4px 14px rgba(239,68,68,0.35)' }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : 'Deduct Funds'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
