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
import { useEffect, useMemo, useState } from 'react';
import {
  TransactionSource,
  Bank,
  CustomPaymentHead,
  TotalCashSnapshot,
  FundOwnershipState,
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

export interface TransferEnvelopeMeta {
  fromEnvelopeId?: string;
  fromEnvelopeName?: string;
  fromFundState?: FundOwnershipState;
  toEnvelopeId?: string;
  toEnvelopeName?: string;
  toFundState?: FundOwnershipState;
}

interface TransferEnvelopeItem {
  id: string;
  name: string;
  owner: string;
  fundState: FundOwnershipState;
  isLocked: boolean;
  amount: number;
}

interface Props {
  snapshot?: TotalCashSnapshot | null;
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
    meta?: TransferEnvelopeMeta,
  ) => Promise<void>;
  saving: boolean;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  initialFromSource?: TransactionSource;
  initialFromBankName?: string;
  initialFromCustomName?: string;
}

const STATE_BADGE_STYLES: Record<
  FundOwnershipState,
  { label: string; bg: string; color: string; dot: string }
> = {
  spendable: { label: 'Spendable', bg: 'rgba(16,185,129,0.16)', color: '#10b981', dot: '#10b981' },
  reserved: { label: 'Reserved', bg: 'rgba(59,130,246,0.16)', color: '#3b82f6', dot: '#3b82f6' },
  savings: { label: 'Savings', bg: 'rgba(245,158,11,0.16)', color: '#f59e0b', dot: '#f59e0b' },
  amanat: { label: 'Amanat', bg: 'rgba(168,85,247,0.16)', color: '#a855f7', dot: '#a855f7' },
};

function resolveWalletEnvelopes(
  snapshot: TotalCashSnapshot | null | undefined,
  walletKey: string,
  walletBalance: number
): TransferEnvelopeItem[] {
  if (!walletKey || !snapshot?.sourceOwnership) return [];
  const ownership = snapshot.sourceOwnership[walletKey];
  const allocs = ownership?.allocations;
  if (!allocs || allocs.length === 0) return [];
  const hasCustom = allocs.length > 1 || !allocs[0].id.startsWith('default_');
  if (!hasCustom) return [];

  const allocatedSum = allocs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const unallocatedDiff = Math.max(0, walletBalance - allocatedSum);

  return allocs.map((a, idx) => {
    const isDefault = a.id.startsWith('default_') || idx === 0;
    const baseAmt = Number(a.amount) || 0;
    const effectiveAmt = isDefault ? baseAmt + unallocatedDiff : baseAmt;
    const ownerLower = (a.owner || '').trim().toLowerCase();

    let fundState: FundOwnershipState = 'spendable';
    if (a.fundState) {
      fundState = a.fundState;
    } else if (a.availabilityStatus === 'external') {
      fundState = 'amanat';
    } else if (a.availabilityStatus === 'savings' || ownerLower === 'savings') {
      fundState = 'savings';
    } else if (
      a.availabilityStatus === 'reserved' ||
      ownerLower === 'reserved' ||
      (a.reservedAmount !== undefined &&
        a.reservedAmount >= baseAmt &&
        baseAmt > 0 &&
        (ownerLower === 'you' || ownerLower === 'self' || ownerLower === ''))
    ) {
      fundState = 'reserved';
    } else if (ownerLower && ownerLower !== 'you' && ownerLower !== 'self') {
      fundState = 'amanat';
    }

    const displayOwner =
      fundState === 'amanat'
        ? a.owner && ownerLower !== 'amanat'
          ? `Amanat · ${a.owner}`
          : 'Amanat'
        : STATE_BADGE_STYLES[fundState].label;

    return {
      id: a.id,
      name: a.purpose || (isDefault ? 'Main Envelope' : `Envelope ${idx + 1}`),
      owner: displayOwner,
      fundState,
      isLocked: Boolean(a.isLocked),
      amount: effectiveAmt,
    };
  });
}

function resolveWalletDefaultState(
  snapshot: TotalCashSnapshot | null | undefined,
  walletKey: string,
  walletBalance: number
): FundOwnershipState {
  if (!walletKey || !snapshot?.sourceOwnership) return 'spendable';
  const o = snapshot.sourceOwnership[walletKey];
  if (!o) return 'spendable';
  const defAlloc =
    o.allocations && o.allocations.length > 0
      ? o.allocations.find((a) => a.id.startsWith('default_')) || o.allocations[0]
      : null;
  if (defAlloc) {
    const ownerLower = (defAlloc.owner || '').trim().toLowerCase();
    if (defAlloc.fundState) return defAlloc.fundState;
    if (defAlloc.availabilityStatus === 'external') return 'amanat';
    if (defAlloc.availabilityStatus === 'savings' || ownerLower === 'savings') return 'savings';
    if (defAlloc.availabilityStatus === 'reserved' || ownerLower === 'reserved') return 'reserved';
    if (ownerLower && ownerLower !== 'you' && ownerLower !== 'self') return 'amanat';
  }
  if (o.fundState) return o.fundState;
  if (o.hasOwnThisMoney === false) return 'amanat';
  const savingsRegex = /saving|emergency|goal|fund|invest/i;
  if ((Number(o.reservedAmount) || 0) > 0 && walletBalance > 0 && (Number(o.reservedAmount) || 0) >= walletBalance) {
    return savingsRegex.test(`${o.purpose || ''} ${walletKey}`) ? 'savings' : 'reserved';
  }
  return 'spendable';
}

const SOURCE_ICONS: Record<string, string> = {
  in_hand: '💵',
  bank: '🏦',
  easypaisa: '📱',
  jazzcash: '📱',
  other: '💳',
  custom: '🗂️',
};

const SOURCE_LABELS: Record<string, string> = {
  in_hand: 'Cash in Hand',
  bank: 'Bank Account',
  easypaisa: 'EasyPaisa',
  jazzcash: 'JazzCash',
  other: 'Personal Spending',
  custom: 'Custom Wallet',
};

const SOURCE_OPTIONS: TransactionSource[] = ['other', 'easypaisa', 'jazzcash', 'in_hand', 'bank', 'custom'];

// Steps: 0 = From, 1 = To, 2 = Amount + confirm
type Step = 0 | 1 | 2;

const STEP_TITLES = ['Where from?', 'Where to?', 'How much?'];
const STEP_SUBTITLES = [
  'Select the source wallet to transfer from',
  'Select the destination wallet',
  'Enter the amount to transfer',
];

export default function TransferFunds({
  snapshot,
  onTransfer,
  saving,
  externalOpen,
  onExternalClose,
  initialFromSource,
  initialFromBankName,
  initialFromCustomName,
}: Props) {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);

  // From state
  const [fromSource, setFromSource] = useState<TransactionSource>('in_hand');
  const [fromBankId, setFromBankId] = useState('');
  const [fromCustomId, setFromCustomId] = useState('');
  const [fromHolder, setFromHolder] = useState('Unassigned');
  const [fromEnvelopeId, setFromEnvelopeId] = useState('');

  // To state
  const [toSource, setToSource] = useState<TransactionSource>('in_hand');
  const [toBankId, setToBankId] = useState('');
  const [toCustomId, setToCustomId] = useState('');
  const [toHolder, setToHolder] = useState('Unassigned');
  const [toEnvelopeId, setToEnvelopeId] = useState('');
  const [newHolderName, setNewHolderName] = useState('');

  // Re-confirmation dialog when deducting from Amanat or Savings
  const [confirmKind, setConfirmKind] = useState<'amanat' | 'savings' | null>(null);

  // Amount & note
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');

  const [banks, setBanks] = useState<Bank[]>([]);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);

  // Sync with external open state from FAB / wallet card
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
      if (externalOpen) {
        if (initialFromSource) {
          setFromSource(initialFromSource);
          setStep(1); // Jump straight to "Where to?" step
        } else {
          setStep(0);
        }
      }
    }
  }, [externalOpen, initialFromSource]);

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

  useEffect(() => {
    if (initialFromBankName && banks.length > 0) {
      const b = banks.find((item) => item.name === initialFromBankName);
      if (b?.id) setFromBankId(b.id);
    }
  }, [initialFromBankName, banks]);

  useEffect(() => {
    if (initialFromCustomName && customPaymentHeads.length > 0) {
      const c = customPaymentHeads.find((item) => item.name === initialFromCustomName);
      if (c?.id) setFromCustomId(c.id);
    }
  }, [initialFromCustomName, customPaymentHeads]);

  useEffect(() => {
    if (fromSource === 'bank' && banks.length === 1 && !fromBankId && banks[0]?.id) {
      setFromBankId(banks[0].id);
    } else if (fromSource === 'custom' && customPaymentHeads.length === 1 && !fromCustomId && customPaymentHeads[0]?.id) {
      setFromCustomId(customPaymentHeads[0].id);
    }
  }, [fromSource, banks, customPaymentHeads, fromBankId, fromCustomId]);

  useEffect(() => {
    if (toSource === 'bank' && banks.length === 1 && !toBankId && banks[0]?.id) {
      setToBankId(banks[0].id);
    } else if (toSource === 'custom' && customPaymentHeads.length === 1 && !toCustomId && customPaymentHeads[0]?.id) {
      setToCustomId(customPaymentHeads[0].id);
    }
  }, [toSource, banks, customPaymentHeads, toBankId, toCustomId]);

  // Derived names
  const fromBankName = banks.find((b) => b.id === fromBankId)?.name;
  const fromCustomName = customPaymentHeads.find((c) => c.id === fromCustomId)?.name;
  const toBankName = banks.find((b) => b.id === toBankId)?.name;
  const toCustomName = customPaymentHeads.find((c) => c.id === toCustomId)?.name;

  // Immediate tile balances
  const getTileBalance = (src: TransactionSource): number => {
    if (!snapshot?.sources) return 0;
    if (src === 'bank') {
      return Object.values(snapshot.sources.bank || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    }
    if (src === 'custom') {
      return Object.values(snapshot.sources.custom || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    }
    return Number(snapshot.sources[src] ?? 0);
  };

  // From balance & envelopes
  const fromKey =
    (fromSource === 'bank' && !fromBankName) || (fromSource === 'custom' && !fromCustomName)
      ? ''
      : getSourceKey(fromSource, fromBankName, fromCustomName);

  let fromSourceBalance = 0;
  if (fromSource === 'bank' && fromBankName) {
    fromSourceBalance = snapshot?.sources?.bank?.[fromBankName] || 0;
  } else if (fromSource === 'custom' && fromCustomName) {
    fromSourceBalance = snapshot?.sources?.custom?.[fromCustomName] || 0;
  } else if (fromSource !== 'bank' && fromSource !== 'custom') {
    fromSourceBalance = (snapshot?.sources?.[fromSource] as number) || 0;
  }

  const fromEnvelopes = useMemo(
    () => resolveWalletEnvelopes(snapshot, fromKey, fromSourceBalance),
    [snapshot, fromKey, fromSourceBalance]
  );

  // Auto-select valid From envelope when switching From wallets
  useEffect(() => {
    if (fromEnvelopes.length === 0) {
      if (fromEnvelopeId !== '') setFromEnvelopeId('');
      return;
    }
    const stillValid = fromEnvelopes.some((e) => e.id === fromEnvelopeId);
    if (!stillValid) {
      const preferred =
        fromEnvelopes.find((e) => !e.isLocked && e.fundState === 'spendable' && e.amount > 0) ||
        fromEnvelopes.find((e) => !e.isLocked && e.amount > 0) ||
        fromEnvelopes[0];
      setFromEnvelopeId(preferred?.id || '');
    }
  }, [fromEnvelopes, fromEnvelopeId]);

  const selectedFromEnvelope = useMemo(
    () => fromEnvelopes.find((e) => e.id === fromEnvelopeId) ?? null,
    [fromEnvelopes, fromEnvelopeId]
  );

  const fromDefaultState = useMemo(
    () => resolveWalletDefaultState(snapshot, fromKey, fromSourceBalance),
    [snapshot, fromKey, fromSourceBalance]
  );

  const effectiveFromState: FundOwnershipState = selectedFromEnvelope
    ? selectedFromEnvelope.fundState
    : fromDefaultState;

  const fromHolders = fromKey ? snapshot?.heldBy?.[fromKey] || [] : [];
  const fromHoldersSum = fromHolders.reduce((s, h) => s + h.amount, 0);
  const fromUnassignedBalance = fromSourceBalance - fromHoldersSum;
  let activeFromBalance = selectedFromEnvelope ? selectedFromEnvelope.amount : fromSourceBalance;
  if (!selectedFromEnvelope && fromHolders.length > 0) {
    activeFromBalance =
      fromHolder === 'Unassigned'
        ? fromUnassignedBalance
        : fromHolders.find((h) => h.holderName === fromHolder)?.amount || 0;
  }

  // To balance, holders & envelopes
  const toKey =
    (toSource === 'bank' && !toBankName) || (toSource === 'custom' && !toCustomName)
      ? ''
      : getSourceKey(toSource, toBankName, toCustomName);

  let toSourceBalance = 0;
  if (toSource === 'bank' && toBankName) {
    toSourceBalance = snapshot?.sources?.bank?.[toBankName] || 0;
  } else if (toSource === 'custom' && toCustomName) {
    toSourceBalance = snapshot?.sources?.custom?.[toCustomName] || 0;
  } else if (toSource !== 'bank' && toSource !== 'custom') {
    toSourceBalance = (snapshot?.sources?.[toSource] as number) || 0;
  }

  const toEnvelopes = useMemo(
    () => resolveWalletEnvelopes(snapshot, toKey, toSourceBalance),
    [snapshot, toKey, toSourceBalance]
  );

  useEffect(() => {
    if (toEnvelopes.length === 0) {
      if (toEnvelopeId !== '') setToEnvelopeId('');
      return;
    }
    const stillValid = toEnvelopes.some((e) => e.id === toEnvelopeId);
    if (!stillValid) {
      setToEnvelopeId('');
    }
  }, [toEnvelopes, toEnvelopeId]);

  const selectedToEnvelope = useMemo(
    () => toEnvelopes.find((e) => e.id === toEnvelopeId) ?? null,
    [toEnvelopes, toEnvelopeId]
  );

  const toDefaultState = useMemo(
    () => resolveWalletDefaultState(snapshot, toKey, toSourceBalance),
    [snapshot, toKey, toSourceBalance]
  );

  const toHolders = toKey ? snapshot?.heldBy?.[toKey] || [] : [];

  const isInsufficient = amount !== '' && Number(amount) > activeFromBalance;

  const executeTransfer = async () => {
    if (!amount || amount <= 0 || isInsufficient) return;
    const finalToHolder = toHolder === 'new' ? newHolderName.trim() : toHolder;
    if (toHolder === 'new' && !finalToHolder) return;

    await onTransfer(
      Number(amount),
      fromSource,
      fromBankName,
      fromCustomName,
      fromHolder === 'Unassigned' ? undefined : fromHolder,
      toSource,
      toBankName,
      toCustomName,
      finalToHolder === 'Unassigned' ? undefined : finalToHolder,
      note,
      {
        fromEnvelopeId: selectedFromEnvelope?.id,
        fromEnvelopeName: selectedFromEnvelope?.name,
        fromFundState: effectiveFromState,
        toEnvelopeId: selectedToEnvelope?.id,
        toEnvelopeName: selectedToEnvelope?.name,
        toFundState: selectedToEnvelope?.fundState || toDefaultState,
      }
    );

    // Reset
    setConfirmKind(null);
    setOpen(false);
    onExternalClose?.();
    setStep(0);
    setAmount('');
    setFromSource('in_hand');
    setFromBankId('');
    setFromCustomId('');
    setFromHolder('Unassigned');
    setFromEnvelopeId('');
    setToSource('in_hand');
    setToBankId('');
    setToCustomId('');
    setToHolder('Unassigned');
    setToEnvelopeId('');
    setNewHolderName('');
    setNote('');
  };

  const handleSaveClick = async () => {
    if (!amount || amount <= 0 || isInsufficient) return;
    const finalToHolder = toHolder === 'new' ? newHolderName.trim() : toHolder;
    if (toHolder === 'new' && !finalToHolder) return;

    // Require explicit re-confirmation before deducting from Amanat or Savings
    if (effectiveFromState === 'amanat' || effectiveFromState === 'savings') {
      setConfirmKind(effectiveFromState);
      return;
    }

    await executeTransfer();
  };

  const handleClose = () => {
    if (saving) return;
    setConfirmKind(null);
    setOpen(false);
    onExternalClose?.();
    setTimeout(() => setStep(0), 300);
  };

  const isFromLocked = Boolean(
    (fromKey && snapshot?.sourceOwnership?.[fromKey]?.isLocked) ||
      selectedFromEnvelope?.isLocked
  );

  const canProceedStep0 =
    !(fromSource === 'bank' && !fromBankId) &&
    !(fromSource === 'custom' && !fromCustomId) &&
    !(fromEnvelopes.length > 0 && !selectedFromEnvelope) &&
    !isFromLocked;
  const canProceedStep1 =
    !(toSource === 'bank' && !toBankId) && !(toSource === 'custom' && !toCustomId);
  const canSubmit =
    !!amount &&
    amount > 0 &&
    !isInsufficient &&
    canProceedStep0 &&
    canProceedStep1 &&
    !(toHolder === 'new' && !newHolderName.trim()) &&
    !isFromLocked;

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
                    onClick={() => {
                      setFromSource(opt);
                      setFromBankId('');
                      setFromCustomId('');
                      setFromHolder('Unassigned');
                      setFromEnvelopeId('');
                    }}
                    sx={{
                      flex: '1 1 28%', py: 1.5, px: 1, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
                      border: `2px solid ${fromSource === opt ? '#6366f1' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                      bgcolor: fromSource === opt ? (isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff') : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { border: '2px solid #6366f1', bgcolor: isDark ? 'rgba(99,102,241,0.1)' : '#eef2ff' },
                    }}
                  >
                    <Typography fontSize="1.6rem">{SOURCE_ICONS[opt]}</Typography>
                    <Typography fontWeight={700} fontSize="0.78rem" mt={0.25}>{SOURCE_LABELS[opt]}</Typography>
                    <Typography fontSize="0.7rem" fontWeight={700} color="#10b981" mt={0.25}>
                      {formatCurrency(getTileBalance(opt), 'PKR')}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              {fromSource === 'bank' && (
                <FormControl fullWidth size="small">
                  <InputLabel>Select Bank</InputLabel>
                  <Select value={fromBankId} onChange={(e) => { setFromBankId(e.target.value); setFromHolder('Unassigned'); setFromEnvelopeId(''); }} label="Select Bank"
                    startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                    <MenuItem value=""><em>— Choose a bank —</em></MenuItem>
                    {banks.map((b) => (
                      <MenuItem key={b.id} value={b.id}>
                        {b.name} ({formatCurrency(snapshot?.sources?.bank?.[b.name] ?? 0, 'PKR')})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {fromSource === 'custom' && (
                <FormControl fullWidth size="small">
                  <InputLabel>Select Custom Wallet</InputLabel>
                  <Select value={fromCustomId} onChange={(e) => { setFromCustomId(e.target.value); setFromHolder('Unassigned'); setFromEnvelopeId(''); }} label="Select Custom Wallet"
                    startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                    <MenuItem value=""><em>— Choose a wallet —</em></MenuItem>
                    {customPaymentHeads.map((h) => (
                      <MenuItem key={h.id} value={h.id}>
                        {h.name} ({formatCurrency(snapshot?.sources?.custom?.[h.name] ?? 0, 'PKR')})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Source Envelopes (with ownership state & balance) */}
              {fromEnvelopes.length > 0 && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2.5,
                    border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : '#c7d2fe'}`,
                    bgcolor: isDark ? 'rgba(15,23,42,0.65)' : '#f8fafc',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="caption" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Select Source Envelope
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fromEnvelopes.length} envelopes
                    </Typography>
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    {fromEnvelopes.map((env) => {
                      const isSelected = fromEnvelopeId === env.id;
                      const st = STATE_BADGE_STYLES[env.fundState];
                      return (
                        <Box
                          key={env.id}
                          onClick={() => !env.isLocked && setFromEnvelopeId(env.id)}
                          sx={{
                            p: 1.2,
                            borderRadius: 2,
                            cursor: env.isLocked ? 'not-allowed' : 'pointer',
                            opacity: env.isLocked ? 0.5 : 1,
                            border: `1.5px solid ${
                              isSelected ? '#6366f1' : isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'
                            }`,
                            bgcolor: isSelected
                              ? isDark
                                ? 'rgba(99,102,241,0.18)'
                                : '#eef2ff'
                              : isDark
                              ? 'rgba(255,255,255,0.03)'
                              : '#ffffff',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Typography fontSize="0.76rem" fontWeight={800} noWrap>
                            ✉️ {env.name}
                          </Typography>
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-block',
                              mt: 0.4,
                              px: 0.9,
                              py: 0.15,
                              borderRadius: 99,
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              bgcolor: st.bg,
                              color: st.color,
                            }}
                          >
                            {env.owner}
                          </Box>
                          <Typography fontSize="0.74rem" fontWeight={700} mt={0.5}>
                            {formatCurrency(env.amount, 'PKR')}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {/* Ownership state hint when wallet has no multiple envelopes */}
              {fromEnvelopes.length === 0 && fromKey && (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Box
                    component="span"
                    sx={{
                      px: 1.5,
                      py: 0.4,
                      borderRadius: 99,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      bgcolor: STATE_BADGE_STYLES[fromDefaultState].bg,
                      color: STATE_BADGE_STYLES[fromDefaultState].color,
                    }}
                  >
                    State: {STATE_BADGE_STYLES[fromDefaultState].label}
                  </Box>
                </Box>
              )}

              {fromHolders.length > 0 && (
                <FormControl fullWidth size="small">
                  <InputLabel>Transfer from person (optional)</InputLabel>
                  <Select value={fromHolder} onChange={(e) => setFromHolder(e.target.value)} label="Transfer from person (optional)">
                    <MenuItem value="Unassigned">Self ({formatCurrency(fromUnassignedBalance, 'PKR')})</MenuItem>
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
                <Typography fontWeight={900} fontSize="0.95rem" color="#6366f1">
                  {fromLabel}
                  {selectedFromEnvelope ? ` · ${selectedFromEnvelope.name}` : ''}
                </Typography>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    mt: 0.4,
                    px: 1,
                    py: 0.15,
                    borderRadius: 99,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    bgcolor: STATE_BADGE_STYLES[effectiveFromState].bg,
                    color: STATE_BADGE_STYLES[effectiveFromState].color,
                  }}
                >
                  {selectedFromEnvelope?.owner || STATE_BADGE_STYLES[effectiveFromState].label}
                </Box>
              </Box>

              <Stack direction="row" flexWrap="wrap" gap={1.2} useFlexGap>
                {SOURCE_OPTIONS.map((opt) => (
                  <Box
                    key={opt}
                    onClick={() => {
                      setToSource(opt);
                      setToBankId('');
                      setToCustomId('');
                      setToHolder('Unassigned');
                      setToEnvelopeId('');
                    }}
                    sx={{
                      flex: '1 1 28%', py: 1.5, px: 1, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
                      border: `2px solid ${toSource === opt ? '#0ea5e9' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                      bgcolor: toSource === opt ? (isDark ? 'rgba(14,165,233,0.12)' : '#f0f9ff') : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { border: '2px solid #0ea5e9', bgcolor: isDark ? 'rgba(14,165,233,0.08)' : '#f0f9ff' },
                    }}
                  >
                    <Typography fontSize="1.6rem">{SOURCE_ICONS[opt]}</Typography>
                    <Typography fontWeight={700} fontSize="0.78rem" mt={0.25}>{SOURCE_LABELS[opt]}</Typography>
                    <Typography fontSize="0.7rem" fontWeight={700} color="#0ea5e9" mt={0.25}>
                      {formatCurrency(getTileBalance(opt), 'PKR')}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              {toSource === 'bank' && (
                <FormControl fullWidth size="small">
                  <InputLabel>Select Bank</InputLabel>
                  <Select value={toBankId} onChange={(e) => { setToBankId(e.target.value); setToHolder('Unassigned'); setToEnvelopeId(''); }} label="Select Bank"
                    startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                    <MenuItem value=""><em>— Choose a bank —</em></MenuItem>
                    {banks.map((b) => (
                      <MenuItem key={b.id} value={b.id}>
                        {b.name} ({formatCurrency(snapshot?.sources?.bank?.[b.name] ?? 0, 'PKR')})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {toSource === 'custom' && (
                <FormControl fullWidth size="small">
                  <InputLabel>Select Custom Wallet</InputLabel>
                  <Select value={toCustomId} onChange={(e) => { setToCustomId(e.target.value); setToHolder('Unassigned'); setToEnvelopeId(''); }} label="Select Custom Wallet"
                    startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                    <MenuItem value=""><em>— Choose a wallet —</em></MenuItem>
                    {customPaymentHeads.map((h) => (
                      <MenuItem key={h.id} value={h.id}>
                        {h.name} ({formatCurrency(snapshot?.sources?.custom?.[h.name] ?? 0, 'PKR')})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Destination Envelopes (with ownership state & balance) */}
              {toEnvelopes.length > 0 && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2.5,
                    border: `1px solid ${isDark ? 'rgba(14,165,233,0.3)' : '#bae6fd'}`,
                    bgcolor: isDark ? 'rgba(15,23,42,0.65)' : '#f8fafc',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="caption" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Destination Envelope (Optional)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {toEnvelopes.length} envelopes
                    </Typography>
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    {toEnvelopes.map((env) => {
                      const isSelected = toEnvelopeId === env.id;
                      const st = STATE_BADGE_STYLES[env.fundState];
                      return (
                        <Box
                          key={env.id}
                          onClick={() => setToEnvelopeId(isSelected ? '' : env.id)}
                          sx={{
                            p: 1.2,
                            borderRadius: 2,
                            cursor: 'pointer',
                            border: `1.5px solid ${
                              isSelected ? '#0ea5e9' : isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'
                            }`,
                            bgcolor: isSelected
                              ? isDark
                                ? 'rgba(14,165,233,0.18)'
                                : '#f0f9ff'
                              : isDark
                              ? 'rgba(255,255,255,0.03)'
                              : '#ffffff',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Typography fontSize="0.76rem" fontWeight={800} noWrap>
                            ✉️ {env.name}
                          </Typography>
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-block',
                              mt: 0.4,
                              px: 0.9,
                              py: 0.15,
                              borderRadius: 99,
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              bgcolor: st.bg,
                              color: st.color,
                            }}
                          >
                            {env.owner}
                          </Box>
                          <Typography fontSize="0.74rem" fontWeight={700} mt={0.5}>
                            {formatCurrency(env.amount, 'PKR')}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}

              <FormControl fullWidth size="small">
                <InputLabel>For person (optional)</InputLabel>
                <Select value={toHolder} onChange={(e) => setToHolder(e.target.value)} label="For person (optional)">
                  <MenuItem value="Unassigned">Self</MenuItem>
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
                  <Typography fontWeight={900} fontSize="0.82rem" color="#6366f1">
                    {fromLabel}
                    {selectedFromEnvelope ? ` (${selectedFromEnvelope.name})` : ''}
                  </Typography>
                  <Typography fontSize="0.68rem" fontWeight={700} sx={{ color: STATE_BADGE_STYLES[effectiveFromState].color }}>
                    {selectedFromEnvelope?.owner || STATE_BADGE_STYLES[effectiveFromState].label}
                  </Typography>
                </Box>
                <ArrowForwardIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">TO</Typography>
                  <Typography fontWeight={900} fontSize="0.82rem" color="#0ea5e9">
                    {toLabel}
                    {selectedToEnvelope ? ` (${selectedToEnvelope.name})` : ''}
                  </Typography>
                  <Typography
                    fontSize="0.68rem"
                    fontWeight={700}
                    sx={{ color: STATE_BADGE_STYLES[selectedToEnvelope?.fundState || toDefaultState].color }}
                  >
                    {selectedToEnvelope?.owner || STATE_BADGE_STYLES[toDefaultState].label}
                  </Typography>
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

      {/* Re-confirmation Dialog when deducting from Amanat or Savings */}
      <Dialog
        open={Boolean(confirmKind)}
        onClose={() => !saving && setConfirmKind(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: 4,
            backgroundColor: isDark ? '#1f2430' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
            border:
              confirmKind === 'amanat'
                ? '1.5px solid rgba(168, 85, 247, 0.45)'
                : '1.5px solid rgba(245, 158, 11, 0.45)',
          },
        }}
      >
        <DialogContent sx={{ px: 3, pt: 3.5, pb: 2, textAlign: 'center' }}>
          {confirmKind === 'amanat' ? (
            <Box dir="rtl">
              <Typography
                sx={{
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: isDark ? '#d8b4fe' : '#7e22ce',
                  mb: 1.5,
                }}
              >
                یہ رقم امانت ہے۔
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: isDark ? '#cbd5e1' : '#475569', mb: 1 }}
              >
                {selectedFromEnvelope
                  ? `${selectedFromEnvelope.name} (${selectedFromEnvelope.owner})`
                  : fromLabel}
                {' — '}
                {formatCurrency(Number(amount) || 0, 'PKR')}
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography
                sx={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: isDark ? '#fbbf24' : '#b45309',
                  mb: 1,
                }}
              >
                Confirm Savings Transfer
              </Typography>
              <Typography
                dir="rtl"
                sx={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: isDark ? '#f8fafc' : '#0f172a',
                  mb: 1,
                }}
              >
                یہ رقم بچت کے لیے محفوظ ہے۔ کیا آپ واقعی ٹرانسفر کرنا چاہتے ہیں؟
              </Typography>
              <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                {selectedFromEnvelope ? selectedFromEnvelope.name : fromLabel} ·{' '}
                {formatCurrency(Number(amount) || 0, 'PKR')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 2.5,
            pt: 1,
            display: 'flex',
            justifyContent: 'center',
            gap: 1.5,
          }}
        >
          {confirmKind === 'amanat' ? (
            <>
              <Button
                dir="rtl"
                variant="outlined"
                disabled={saving}
                onClick={() => setConfirmKind(null)}
                sx={{
                  flex: 1,
                  borderRadius: 2.5,
                  py: 1,
                  fontWeight: 700,
                  borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1',
                  color: isDark ? '#e2e8f0' : '#334155',
                }}
              >
                کینسل
              </Button>
              <Button
                dir="rtl"
                variant="contained"
                disabled={saving}
                onClick={executeTransfer}
                sx={{
                  flex: 1,
                  borderRadius: 2.5,
                  py: 1,
                  fontWeight: 800,
                  bgcolor: '#9333ea',
                  '&:hover': { bgcolor: '#7e22ce' },
                }}
              >
                {saving ? <CircularProgress size={18} color="inherit" /> : 'میں جانتا ہوں'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                disabled={saving}
                onClick={() => setConfirmKind(null)}
                sx={{
                  flex: 1,
                  borderRadius: 2.5,
                  py: 1,
                  fontWeight: 700,
                  textTransform: 'none',
                  borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1',
                  color: isDark ? '#e2e8f0' : '#334155',
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                disabled={saving}
                onClick={executeTransfer}
                sx={{
                  flex: 1,
                  borderRadius: 2.5,
                  py: 1,
                  fontWeight: 800,
                  textTransform: 'none',
                  bgcolor: '#d97706',
                  '&:hover': { bgcolor: '#b45309' },
                }}
              >
                {saving ? <CircularProgress size={18} color="inherit" /> : 'Confirm Transfer'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
