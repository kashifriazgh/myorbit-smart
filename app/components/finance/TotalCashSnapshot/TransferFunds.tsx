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
  Avatar,
  IconButton,
  Fade,
  Box,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  TransactionSource,
  Bank,
  CustomPaymentHead,
  TotalCashSnapshot,
} from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import {
  Close as CloseIcon,
  SwapHoriz as SwapIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  AccountBalance as BankIcon,
  Wallet as WalletIcon,
} from '@mui/icons-material';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { getSourceKey } from '../TotalCashSnapshot';
import { formatCurrency } from '@/app/lib/utilts';

interface Props {
  snapshot: TotalCashSnapshot;
  onTransfer: (
    amount: number,
    fromSource: TransactionSource,
    fromBankName?: string,
    fromCustomName?: string,
    fromHolder?: string,
    toSource?: TransactionSource,
    toBankName?: string,
    toCustomName?: string,
    toHolder?: string,
    note?: string,
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

// Steps: 0 = From, 1 = To, 2 = Amount + confirm
type Step = 0 | 1 | 2;

const STEP_TITLES = ['Where from?', 'Where to?', 'How much?'];
const STEP_SUBTITLES = [
  'Select the source account to transfer from',
  'Select the destination account',
  'Enter the amount to transfer',
];

export default function TransferFunds({ snapshot, onTransfer, saving, externalOpen, onExternalClose }: Props) {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);

  // Sync with external open state from FAB
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
      if (externalOpen) setStep(0); // always start at step 0
    }
  }, [externalOpen]);

  // From state
  const [fromSource, setFromSource] = useState<TransactionSource>('in_hand');
  const [fromBankId, setFromBankId] = useState('');
  const [fromCustomId, setFromCustomId] = useState('');
  const [fromHolder, setFromHolder] = useState('Unassigned');

  // To state
  const [toSource, setToSource] = useState<TransactionSource>('in_hand');
  const [toBankId, setToBankId] = useState('');
  const [toCustomId, setToCustomId] = useState('');
  const [toHolder, setToHolder] = useState('Unassigned');
  const [newHolderName, setNewHolderName] = useState('');

  // Amount & note
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');

  const [banks, setBanks] = useState<Bank[]>([]);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchBanks = async () => {
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setBanks(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bank));
    };
    const fetchCustom = async () => {
      const q = query(collection(db, 'customPaymentHeads'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setCustomPaymentHeads(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CustomPaymentHead));
    };
    fetchBanks();
    fetchCustom();
  }, [user]);

  // Derived names
  const fromBankName = banks.find((b) => b.id === fromBankId)?.name;
  const fromCustomName = customPaymentHeads.find((c) => c.id === fromCustomId)?.name;
  const toBankName = banks.find((b) => b.id === toBankId)?.name;
  const toCustomName = customPaymentHeads.find((c) => c.id === toCustomId)?.name;

  // From balance
  const fromKey = getSourceKey(fromSource, fromBankName, fromCustomName);
  let fromSourceBalance = 0;
  if (fromSource === 'bank' && fromBankName) {
    fromSourceBalance = snapshot.sources.bank?.[fromBankName] || 0;
  } else if (fromSource === 'custom' && fromCustomName) {
    fromSourceBalance = snapshot.sources.custom?.[fromCustomName] || 0;
  } else {
    fromSourceBalance = (snapshot.sources[fromSource] as number) || 0;
  }
  const fromHolders = snapshot.heldBy?.[fromKey] || [];
  const fromHoldersSum = fromHolders.reduce((s, h) => s + h.amount, 0);
  const fromUnassignedBalance = fromSourceBalance - fromHoldersSum;
  let activeFromBalance = fromSourceBalance;
  if (fromHolders.length > 0) {
    activeFromBalance = fromHolder === 'Unassigned' ? fromUnassignedBalance : (fromHolders.find((h) => h.holderName === fromHolder)?.amount || 0);
  }

  // To holders
  const toKey = getSourceKey(toSource, toBankName, toCustomName);
  const toHolders = snapshot.heldBy?.[toKey] || [];

  const isInsufficient = amount !== '' && Number(amount) > activeFromBalance;

  const handleSaveClick = async () => {
    if (!amount || amount <= 0 || isInsufficient) return;
    const finalToHolder = toHolder === 'new' ? newHolderName.trim() : toHolder;
    if (toHolder === 'new' && !finalToHolder) return;

    await onTransfer(
      Number(amount),
      fromSource, fromBankName, fromCustomName,
      fromHolder === 'Unassigned' ? undefined : fromHolder,
      toSource, toBankName, toCustomName,
      finalToHolder === 'Unassigned' ? undefined : finalToHolder,
      note,
    );

    // Reset
    setOpen(false);
    onExternalClose?.();
    setStep(0);
    setAmount('');
    setFromSource('in_hand'); setFromBankId(''); setFromCustomId(''); setFromHolder('Unassigned');
    setToSource('in_hand'); setToBankId(''); setToCustomId(''); setToHolder('Unassigned');
    setNewHolderName('');
    setNote('');
  };

  const handleClose = () => {
    if (saving) return;
    setOpen(false);
    onExternalClose?.();
    setTimeout(() => setStep(0), 300);
  };

  const isFromLocked = snapshot.sourceOwnership?.[fromKey]?.isLocked;

  const canProceedStep0 = !(fromSource === 'bank' && !fromBankId) && !(fromSource === 'custom' && !fromCustomId) && !isFromLocked;
  const canProceedStep1 = !(toSource === 'bank' && !toBankId) && !(toSource === 'custom' && !toCustomId);
  const canSubmit = !!amount && amount > 0 && !isInsufficient && canProceedStep0 && canProceedStep1 && !(toHolder === 'new' && !newHolderName.trim()) && !isFromLocked;

  const fromLabel = `${SOURCE_ICONS[fromSource]} ${fromBankName || fromCustomName || SOURCE_LABELS[fromSource]}`;
  const toLabel = `${SOURCE_ICONS[toSource]} ${toBankName || toCustomName || SOURCE_LABELS[toSource]}`;

  // Gradient per step
  const gradients = [
    'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
    'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  ];

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth maxWidth="xs"
        TransitionComponent={Fade}
        PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden', backgroundColor: isDark ? '#0f172a' : '#ffffff' } }}
      >
        {/* Header */}
        <Box sx={{ background: gradients[step], pb: 0, color: 'white', position: 'relative', transition: 'background 0.4s ease' }}>
          <Box sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              {step > 0 && (
                <IconButton size="small" onClick={() => setStep((s) => (s - 1) as Step)}
                  sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              )}
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', width: 36, height: 36 }}>
                <SwapIcon fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.1 }}>
                  {STEP_TITLES[step]}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>
                  {STEP_SUBTITLES[step]}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Step progress bar */}
          <LinearProgress
            variant="determinate"
            value={((step + 1) / 3) * 100}
            sx={{
              height: 3,
              bgcolor: 'rgba(255,255,255,0.2)',
              '& .MuiLinearProgress-bar': { bgcolor: 'rgba(255,255,255,0.9)' },
            }}
          />

          <IconButton onClick={handleClose} size="small"
            sx={{ position: 'absolute', right: 12, top: 12, color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* ── STEP 0: From ── */}
        {step === 0 && (
          <DialogContent sx={{ px: 3, py: 3 }}>
            <Stack spacing={2}>
              <Stack direction="row" flexWrap="wrap" gap={1.2} useFlexGap>
                {SOURCE_OPTIONS.map((opt) => (
                  <Box
                    key={opt}
                    onClick={() => { setFromSource(opt); setFromBankId(''); setFromCustomId(''); setFromHolder('Unassigned'); }}
                    sx={{
                      flex: '1 1 28%', py: 2, px: 1, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
                      border: `2px solid ${fromSource === opt ? '#6366f1' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                      bgcolor: fromSource === opt ? (isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff') : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { border: '2px solid #6366f1', bgcolor: isDark ? 'rgba(99,102,241,0.1)' : '#eef2ff' },
                    }}
                  >
                    <Typography fontSize="1.8rem">{SOURCE_ICONS[opt]}</Typography>
                    <Typography fontWeight={700} fontSize="0.8rem" mt={0.5}>{SOURCE_LABELS[opt]}</Typography>
                  </Box>
                ))}
              </Stack>

              {fromSource === 'bank' && (
                <FormControl fullWidth size="small">
                  <InputLabel>Select Bank</InputLabel>
                  <Select value={fromBankId} onChange={(e) => { setFromBankId(e.target.value); setFromHolder('Unassigned'); }} label="Select Bank"
                    startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                    <MenuItem value=""><em>— Choose a bank —</em></MenuItem>
                    {banks.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              {fromSource === 'custom' && (
                <FormControl fullWidth size="small">
                  <InputLabel>Select Custom Wallet</InputLabel>
                  <Select value={fromCustomId} onChange={(e) => { setFromCustomId(e.target.value); setFromHolder('Unassigned'); }} label="Select Custom Wallet"
                    startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                    <MenuItem value=""><em>— Choose a wallet —</em></MenuItem>
                    {customPaymentHeads.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              {fromHolders.length > 0 && (
                <FormControl fullWidth size="small">
                  <InputLabel>Transfer from person (optional)</InputLabel>
                  <Select value={fromHolder} onChange={(e) => setFromHolder(e.target.value)} label="Transfer from person (optional)">
                    <MenuItem value="Unassigned">General / Self ({formatCurrency(fromUnassignedBalance, 'PKR')})</MenuItem>
                    {fromHolders.map((h) => <MenuItem key={h.holderName} value={h.holderName}>{h.holderName} ({formatCurrency(h.amount, 'PKR')})</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              {/* Balance pill */}
              <Box sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">AVAILABLE</Typography>
                <Typography fontWeight={900} fontSize="1.5rem" color="#6366f1">{formatCurrency(activeFromBalance, 'PKR')}</Typography>
              </Box>

              {/* Lock warning */}
              {isFromLocked && (
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                  <Typography variant="caption" color="error.main" fontWeight="bold">
                    🔒 This source is locked. Unlock it in Account Breakdown to transfer funds.
                  </Typography>
                </Box>
              )}
            </Stack>
          </DialogContent>
        )}

        {/* ── STEP 1: To ── */}
        {step === 1 && (
          <DialogContent sx={{ px: 3, py: 3 }}>
            <Stack spacing={2}>
              {/* From summary pill */}
              <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: isDark ? 'rgba(99,102,241,0.1)' : '#eef2ff', border: '1px solid rgba(99,102,241,0.25)' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>TRANSFERRING FROM</Typography>
                <Typography fontWeight={900} fontSize="1rem" color="#6366f1">{fromLabel}</Typography>
              </Box>

              <Stack direction="row" flexWrap="wrap" gap={1.2} useFlexGap>
                {SOURCE_OPTIONS.map((opt) => (
                  <Box
                    key={opt}
                    onClick={() => { setToSource(opt); setToBankId(''); setToCustomId(''); setToHolder('Unassigned'); }}
                    sx={{
                      flex: '1 1 28%', py: 2, px: 1, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
                      border: `2px solid ${toSource === opt ? '#0ea5e9' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                      bgcolor: toSource === opt ? (isDark ? 'rgba(14,165,233,0.12)' : '#f0f9ff') : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { border: '2px solid #0ea5e9', bgcolor: isDark ? 'rgba(14,165,233,0.08)' : '#f0f9ff' },
                    }}
                  >
                    <Typography fontSize="1.8rem">{SOURCE_ICONS[opt]}</Typography>
                    <Typography fontWeight={700} fontSize="0.8rem" mt={0.5}>{SOURCE_LABELS[opt]}</Typography>
                  </Box>
                ))}
              </Stack>

              {toSource === 'bank' && (
                <FormControl fullWidth size="small">
                  <InputLabel>Select Bank</InputLabel>
                  <Select value={toBankId} onChange={(e) => { setToBankId(e.target.value); setToHolder('Unassigned'); }} label="Select Bank"
                    startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                    <MenuItem value=""><em>— Choose a bank —</em></MenuItem>
                    {banks.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              {toSource === 'custom' && (
                <FormControl fullWidth size="small">
                  <InputLabel>Select Custom Wallet</InputLabel>
                  <Select value={toCustomId} onChange={(e) => { setToCustomId(e.target.value); setToHolder('Unassigned'); }} label="Select Custom Wallet"
                    startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                    <MenuItem value=""><em>— Choose a wallet —</em></MenuItem>
                    {customPaymentHeads.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              <FormControl fullWidth size="small">
                <InputLabel>For person (optional)</InputLabel>
                <Select value={toHolder} onChange={(e) => setToHolder(e.target.value)} label="For person (optional)">
                  <MenuItem value="Unassigned">General / Self</MenuItem>
                  {toHolders.map((h) => <MenuItem key={h.holderName} value={h.holderName}>{h.holderName} ({formatCurrency(h.amount, 'PKR')})</MenuItem>)}
                  <MenuItem value="new"><em>+ Add new person</em></MenuItem>
                </Select>
              </FormControl>

              {toHolder === 'new' && (
                <TextField fullWidth size="small" label="New Person Name" value={newHolderName} onChange={(e) => setNewHolderName(e.target.value)} placeholder="e.g. Ali, Wife, etc." />
              )}
            </Stack>
          </DialogContent>
        )}

        {/* ── STEP 2: Amount ── */}
        {step === 2 && (
          <DialogContent sx={{ px: 3, py: 3 }}>
            <Stack spacing={2.5} alignItems="center">
              {/* From → To summary */}
              <Stack direction="row" alignItems="center" spacing={1} justifyContent="center"
                sx={{ p: 1.5, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', width: '100%', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}` }}>
                <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">FROM</Typography>
                  <Typography fontWeight={900} fontSize="0.85rem" color="#6366f1">{fromLabel}</Typography>
                </Box>
                <ArrowForwardIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">TO</Typography>
                  <Typography fontWeight={900} fontSize="0.85rem" color="#0ea5e9">{toLabel}</Typography>
                </Box>
              </Stack>

              {/* Big amount input */}
              <Box sx={{ width: '100%', textAlign: 'center', py: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" mb={1.5} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Enter Amount (PKR)
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  autoFocus
                  error={isInsufficient}
                  helperText={isInsufficient ? `Max: ${formatCurrency(activeFromBalance, 'PKR')}` : ''}
                  inputProps={{ style: { fontSize: '2.5rem', fontWeight: 900, textAlign: 'center', letterSpacing: '-0.02em', padding: '12px 0' } }}
                  sx={{
                    '& .MuiOutlinedInput-root': { borderRadius: 3 },
                    '& .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
                  }}
                />
              </Box>

              {/* Available balance */}
              <Typography variant="body2" color={isInsufficient ? 'error.main' : 'text.secondary'} fontWeight={700}>
                Available: <strong style={{ color: isInsufficient ? undefined : '#10b981' }}>{formatCurrency(activeFromBalance, 'PKR')}</strong>
              </Typography>

              {/* Note */}
              <TextField
                fullWidth size="small" label="Note (optional)" value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Monthly home allowance, savings transfer…"
                multiline rows={2}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Stack>
          </DialogContent>
        )}

        {/* Actions */}
        <DialogActions sx={{ px: 3, py: 2, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fafafa', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0'}` }}>
          <Button onClick={handleClose} sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'none' }}>Cancel</Button>

          {step < 2 ? (
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              disabled={(step === 0 && !canProceedStep0) || (step === 1 && !canProceedStep1)}
              onClick={() => setStep((s) => (s + 1) as Step)}
              sx={{
                borderRadius: 2, fontWeight: 800, px: 3, textTransform: 'none',
                bgcolor: step === 0 ? '#6366f1' : '#0ea5e9',
                '&:hover': { bgcolor: step === 0 ? '#4338ca' : '#0369a1' },
                boxShadow: step === 0 ? '0 4px 14px rgba(99,102,241,0.35)' : '0 4px 14px rgba(14,165,233,0.35)',
              }}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleSaveClick}
              disabled={saving || !canSubmit}
              sx={{
                borderRadius: 2, fontWeight: 800, px: 3.5, textTransform: 'none',
                bgcolor: '#10b981',
                boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              {saving ? <CircularProgress size={20} color="inherit" /> : 'Confirm Transfer'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
