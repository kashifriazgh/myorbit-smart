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
  AttachMoney as MoneyIcon,
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
}

const SOURCE_OPTIONS: TransactionSource[] = [
  'bank',
  'in_hand',
  'easypaisa',
  'jazzcash',
  'other',
  'custom',
];

export default function TransferFunds({ snapshot, onTransfer, saving }: Props) {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');

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

  const [note, setNote] = useState('');

  // Fetch banks & custom heads
  const [banks, setBanks] = useState<Bank[]>([]);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<
    CustomPaymentHead[]
  >([]);

  useEffect(() => {
    if (!user) return;
    const fetchBanks = async () => {
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setBanks(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bank));
    };
    const fetchCustom = async () => {
      const q = query(
        collection(db, 'customPaymentHeads'),
        where('userId', '==', user.uid),
      );
      const snap = await getDocs(q);
      setCustomPaymentHeads(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CustomPaymentHead),
      );
    };
    fetchBanks();
    fetchCustom();
  }, [user]);

  // Names helpers
  const fromBankName = banks.find((b) => b.id === fromBankId)?.name;
  const fromCustomName = customPaymentHeads.find(
    (c) => c.id === fromCustomId,
  )?.name;
  const toBankName = banks.find((b) => b.id === toBankId)?.name;
  const toCustomName = customPaymentHeads.find(
    (c) => c.id === toCustomId,
  )?.name;

  // From Source Key & Balance
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
    if (fromHolder === 'Unassigned') {
      activeFromBalance = fromUnassignedBalance;
    } else {
      activeFromBalance =
        fromHolders.find((h) => h.holderName === fromHolder)?.amount || 0;
    }
  }

  // To Source Key
  const toKey = getSourceKey(toSource, toBankName, toCustomName);
  const toHolders = snapshot.heldBy?.[toKey] || [];

  const handleSaveClick = async () => {
    if (!amount || amount <= 0 || amount > activeFromBalance) return;

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
    );

    // Reset
    setOpen(false);
    setAmount('');
    setFromSource('in_hand');
    setFromBankId('');
    setFromCustomId('');
    setFromHolder('Unassigned');
    setToSource('in_hand');
    setToBankId('');
    setToCustomId('');
    setToHolder('Unassigned');
    setNewHolderName('');
    setNote('');
  };

  return (
    <>
      <Button
        variant="outlined"
        color="primary"
        onClick={() => setOpen(true)}
        sx={{
          borderRadius: 2,
          fontWeight: 700,
          textTransform: 'none',
          borderColor: isDark ? 'rgba(59, 130, 246, 0.5)' : '#3b82f6',
          color: isDark ? '#93c5fd' : '#1d4ed8',
          bgcolor: isDark
            ? 'rgba(59, 130, 246, 0.05)'
            : 'rgba(59, 130, 246, 0.05)',
          '&:hover': {
            bgcolor: isDark
              ? 'rgba(59, 130, 246, 0.1)'
              : 'rgba(59, 130, 246, 0.1)',
            borderColor: '#3b82f6',
          },
        }}
        startIcon={<SwapIcon sx={{ fontSize: 18 }} />}
      >
        Transfer Funds
      </Button>

      <Dialog
        open={open}
        onClose={() => !saving && setOpen(false)}
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
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            p: 3,
            color: 'white',
            position: 'relative',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              <SwapIcon />
            </Avatar>
            <Box>
              <Typography
                variant="h6"
                fontWeight="900"
                sx={{ lineHeight: 1.2 }}
              >
                Transfer Funds
              </Typography>
              <Typography
                variant="caption"
                sx={{ opacity: 0.8, fontWeight: 600 }}
              >
                Transfer between sources or holders
              </Typography>
            </Box>
          </Stack>
          <IconButton
            onClick={() => setOpen(false)}
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
              onChange={(e) =>
                setAmount(e.target.value === '' ? '' : Number(e.target.value))
              }
              InputProps={{
                startAdornment: (
                  <MoneyIcon
                    sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }}
                  />
                ),
              }}
              placeholder="0.00"
              error={amount !== '' && Number(amount) > activeFromBalance}
              helperText={
                amount !== '' && Number(amount) > activeFromBalance
                  ? 'Insufficient funds'
                  : ''
              }
            />

            {/* From Source Details */}
            <Box
              sx={{
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
                borderRadius: 2,
                p: 2,
              }}
            >
              <Typography
                variant="caption"
                fontWeight="800"
                color="primary"
                sx={{ mb: 1.5, display: 'block' }}
              >
                FROM SOURCE & HOLDER
              </Typography>
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Source Type</InputLabel>
                  <Select
                    value={fromSource}
                    onChange={(e) => {
                      setFromSource(e.target.value as TransactionSource);
                      setFromBankId('');
                      setFromCustomId('');
                      setFromHolder('Unassigned');
                    }}
                    label="Source Type"
                  >
                    {SOURCE_OPTIONS.map((mode) => (
                      <MenuItem
                        key={mode}
                        value={mode}
                        sx={{ textTransform: 'capitalize' }}
                      >
                        {mode.replace('_', ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {fromSource === 'bank' && (
                  <FormControl fullWidth>
                    <InputLabel>Select Bank</InputLabel>
                    <Select
                      value={fromBankId}
                      onChange={(e) => {
                        setFromBankId(e.target.value);
                        setFromHolder('Unassigned');
                      }}
                      label="Select Bank"
                    >
                      {banks.map((bank) => (
                        <MenuItem key={bank.id} value={bank.id}>
                          {bank.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {fromSource === 'custom' && (
                  <FormControl fullWidth>
                    <InputLabel>Select Custom Head</InputLabel>
                    <Select
                      value={fromCustomId}
                      onChange={(e) => {
                        setFromCustomId(e.target.value);
                        setFromHolder('Unassigned');
                      }}
                      label="Select Custom Head"
                    >
                      {customPaymentHeads.map((head) => (
                        <MenuItem key={head.id} value={head.id}>
                          {head.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {fromHolders.length > 0 && (
                  <FormControl fullWidth>
                    <InputLabel>Select Holder</InputLabel>
                    <Select
                      value={fromHolder}
                      onChange={(e) => setFromHolder(e.target.value)}
                      label="Select Holder"
                    >
                      <MenuItem value="Unassigned">
                        Unassigned / Self (
                        {formatCurrency(fromUnassignedBalance, 'PKR')})
                      </MenuItem>
                      {fromHolders.map((h) => (
                        <MenuItem key={h.holderName} value={h.holderName}>
                          {h.holderName} ({formatCurrency(h.amount, 'PKR')})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontWeight: 600 }}
                >
                  Available in selection:{' '}
                  <strong>{formatCurrency(activeFromBalance, 'PKR')}</strong>
                </Typography>
              </Stack>
            </Box>

            {/* To Source Details */}
            <Box
              sx={{
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
                borderRadius: 2,
                p: 2,
              }}
            >
              <Typography
                variant="caption"
                fontWeight="800"
                color="secondary"
                sx={{ mb: 1.5, display: 'block' }}
              >
                TO SOURCE & HOLDER
              </Typography>
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Source Type</InputLabel>
                  <Select
                    value={toSource}
                    onChange={(e) => {
                      setToSource(e.target.value as TransactionSource);
                      setToBankId('');
                      setToCustomId('');
                      setToHolder('Unassigned');
                    }}
                    label="Source Type"
                  >
                    {SOURCE_OPTIONS.map((mode) => (
                      <MenuItem
                        key={mode}
                        value={mode}
                        sx={{ textTransform: 'capitalize' }}
                      >
                        {mode.replace('_', ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {toSource === 'bank' && (
                  <FormControl fullWidth>
                    <InputLabel>Select Bank</InputLabel>
                    <Select
                      value={toBankId}
                      onChange={(e) => {
                        setToBankId(e.target.value);
                        setToHolder('Unassigned');
                      }}
                      label="Select Bank"
                    >
                      {banks.map((bank) => (
                        <MenuItem key={bank.id} value={bank.id}>
                          {bank.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {toSource === 'custom' && (
                  <FormControl fullWidth>
                    <InputLabel>Select Custom Head</InputLabel>
                    <Select
                      value={toCustomId}
                      onChange={(e) => {
                        setToCustomId(e.target.value);
                        setToHolder('Unassigned');
                      }}
                      label="Select Custom Head"
                    >
                      {customPaymentHeads.map((head) => (
                        <MenuItem key={head.id} value={head.id}>
                          {head.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <FormControl fullWidth>
                  <InputLabel>Select Target Holder</InputLabel>
                  <Select
                    value={toHolder}
                    onChange={(e) => setToHolder(e.target.value)}
                    label="Select Target Holder"
                  >
                    <MenuItem value="Unassigned">Unassigned / Self</MenuItem>
                    {toHolders.map((h) => (
                      <MenuItem key={h.holderName} value={h.holderName}>
                        {h.holderName} ({formatCurrency(h.amount, 'PKR')})
                      </MenuItem>
                    ))}
                    <MenuItem value="new">
                      <em>-- Create New Holder --</em>
                    </MenuItem>
                  </Select>
                </FormControl>

                {toHolder === 'new' && (
                  <TextField
                    fullWidth
                    label="New Holder Name"
                    value={newHolderName}
                    onChange={(e) => setNewHolderName(e.target.value)}
                    placeholder="e.g. Ali, Wife, etc."
                    size="small"
                  />
                )}
              </Stack>
            </Box>

            <TextField
              fullWidth
              label="Note / Reference"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Giving monthly home allowance"
              size="small"
              multiline
              rows={2}
            />
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
          <Button
            onClick={() => setOpen(false)}
            sx={{ fontWeight: 700, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveClick}
            disabled={
              saving ||
              !amount ||
              amount <= 0 ||
              amount > activeFromBalance ||
              (fromSource === 'bank' && !fromBankId) ||
              (fromSource === 'custom' && !fromCustomId) ||
              (toSource === 'bank' && !toBankId) ||
              (toSource === 'custom' && !toCustomId) ||
              (toHolder === 'new' && !newHolderName.trim())
            }
            sx={{
              borderRadius: 2,
              fontWeight: 800,
              px: 4,
              boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
              textTransform: 'none',
            }}
          >
            {saving ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              'Transfer'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
