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
} from '@mui/material';
import { useState, useEffect } from 'react';
import {
  TransactionSource,
  Bank,
  TotalCashSnapshot,
  CustomPaymentHead,
} from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where, addDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import { 
  Close as CloseIcon,
  RemoveCircle as DeductIcon,
  AccountBalance as BankIcon,
  Wallet as WalletIcon,
  Payments as PaymentsIcon,
  AttachMoney as MoneyIcon,
  AccountBalanceWallet as BalanceIcon,
  Layers as LayersIcon
} from '@mui/icons-material';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { formatCurrency } from '@/app/lib/utilts';

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
    note?: string
  ) => Promise<void>;
  saving: boolean;
}

export default function DeductMoney({ snapshot, onDeduct, saving }: Props) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [source, setSource] = useState<TransactionSource>('in_hand');
  const [selectedBank, setSelectedBank] = useState('');
  const [fromFreeze, setFromFreeze] = useState(false);
  const [note, setNote] = useState('');

  const [banks, setBanks] = useState<Bank[]>([]);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);
  const [selectedCustomPaymentHead, setSelectedCustomPaymentHead] = useState('');
  
  const [newBankName, setNewBankName] = useState('');
  const [newCustomPaymentHeadName, setNewCustomPaymentHeadName] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  // 🔹 Fetch banks for current user
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

  // 🔹 Fetch custom payment heads for current user
  useEffect(() => {
    if (!user) return;
    const fetchCustomPaymentHeads = async () => {
      const q = query(collection(db, 'customPaymentHeads'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched: CustomPaymentHead[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<CustomPaymentHead, 'id'>),
      }));
      setCustomPaymentHeads(fetched);
    };
    fetchCustomPaymentHeads();
  }, [user]);

  const handleAddBank = async () => {
    if (!user || !newBankName.trim()) return;
    setAddingSource(true);
    try {
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
    } finally {
      setAddingSource(false);
    }
  };

  const handleAddCustomPaymentHead = async () => {
    if (!user || !newCustomPaymentHeadName.trim()) return;
    setAddingSource(true);
    try {
      const docRef = await addDoc(collection(db, 'customPaymentHeads'), {
        userId: user.uid,
        name: newCustomPaymentHeadName.trim(),
        createdAt: Timestamp.now(),
      });
      const newCustomPaymentHead: CustomPaymentHead = {
        id: docRef.id,
        userId: user.uid,
        name: newCustomPaymentHeadName.trim(),
        createdAt: Timestamp.now(),
      };
      setCustomPaymentHeads((prev) => [...prev, newCustomPaymentHead]);
      setSelectedCustomPaymentHead(newCustomPaymentHead.id!);
      setNewCustomPaymentHeadName('');
    } finally {
      setAddingSource(false);
    }
  };

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

    await onDeduct(
      Number(amount),
      source,
      bankId,
      bankName,
      fromFreeze,
      customPaymentHeadId,
      customPaymentHeadName,
      note
    );

    setShowModal(false);
    setAmount('');
    setSource('in_hand');
    setSelectedBank('');
    setSelectedCustomPaymentHead('');
    setFromFreeze(false);
    setNote('');
  };

  // 🔹 Compute current balance for validation & display
  let balance = 0;
  if (fromFreeze) {
    balance = snapshot.freezeAmount ?? 0;
  } else if (source === 'bank' && selectedBank) {
    const selectedBankName = banks.find((b) => b.id === selectedBank)?.name;
    balance = selectedBankName
      ? snapshot.sources.bank?.[selectedBankName] ?? 0
      : 0; // key by bank name in snapshot
  } else if (source === 'custom' && selectedCustomPaymentHead) {
    const selectedCustomPaymentHeadName = customPaymentHeads.find((c) => c.id === selectedCustomPaymentHead)?.name;
    balance = selectedCustomPaymentHeadName
      ? snapshot.sources.custom?.[selectedCustomPaymentHeadName] ?? 0
      : 0; // key by custom payment head name in snapshot
  } else if (source !== 'bank' && source !== 'custom') {
    balance = (snapshot.sources[source] as number) ?? 0;
  }

  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  return (
    <>
      <Button
        variant="outlined"
        color="error"
        onClick={() => setShowModal(true)}
        sx={{ 
          borderRadius: 2,
          fontWeight: 700,
          textTransform: 'none',
          borderColor: isDark ? 'rgba(239, 68, 68, 0.5)' : '#ef4444',
          color: isDark ? '#fca5a5' : '#b91c1c',
          bgcolor: isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.05)',
          '&:hover': {
            bgcolor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: '#ef4444'
          }
        }}
        startIcon={<DeductIcon sx={{ fontSize: 18 }} />}
      >
        Deduct Money
      </Button>

      <Dialog 
        open={showModal} 
        onClose={() => !saving && setShowModal(false)}
        fullWidth
        maxWidth="xs"
        TransitionComponent={Fade}
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
          }
        }}
      >
        <Box sx={{ 
          background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
          p: 3,
          color: 'white',
          position: 'relative'
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              <DeductIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>
                Deduct Funds
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
                Withdraw or spend from your balance
              </Typography>
            </Box>
          </Stack>
          <IconButton 
            onClick={() => setShowModal(false)}
            sx={{ 
              position: 'absolute', 
              right: 12, 
              top: 12, 
              color: 'white',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
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
                startAdornment: <MoneyIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
              }}
              placeholder="0.00"
              error={amount !== '' && Number(amount) > balance}
              helperText={amount !== '' && Number(amount) > balance ? "Insufficient funds" : ""}
            />

            <FormControl fullWidth>
              <InputLabel>Fund Type</InputLabel>
              <Select
                value={fromFreeze ? 'freeze' : 'normal'}
                onChange={(e) => setFromFreeze(e.target.value === 'freeze')}
                label="Fund Type"
                startAdornment={<LayersIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
              >
                <MenuItem value="normal">Normal Balance</MenuItem>
                <MenuItem value="freeze">Freezed Balance</MenuItem>
              </Select>
            </FormControl>

            {!fromFreeze && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Source</InputLabel>
                  <Select
                    value={source}
                    onChange={(e) =>
                      setSource(e.target.value as TransactionSource)
                    }
                    label="Source"
                    startAdornment={<PaymentsIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
                  >
                    <MenuItem value="in_hand">In Hand</MenuItem>
                    <MenuItem value="bank">Bank</MenuItem>
                    <MenuItem value="easypaisa">Easypaisa</MenuItem>
                    <MenuItem value="jazzcash">JazzCash</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                    <MenuItem value="custom">Custom Payment Head</MenuItem>
                  </Select>
                </FormControl>

                {source === 'bank' && (
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>Select Bank</InputLabel>
                      <Select
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        label="Select Bank"
                        startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
                      >
                        <MenuItem value=""><em>-- Add New Bank --</em></MenuItem>
                        {banks.map((bank) => (
                          <MenuItem key={bank.id} value={bank.id}>
                            {bank.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {!selectedBank && (
                      <Box sx={{ 
                        p: 2, 
                        borderRadius: 2, 
                        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff5f5',
                        border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : '#feb2b2'}`
                      }}>
                        <Typography variant="caption" fontWeight="700" color="#b91c1c" sx={{ mb: 1, display: 'block' }}>
                          NEW BANK ACCOUNT
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Bank Name"
                            value={newBankName}
                            onChange={(e) => setNewBankName(e.target.value)}
                          />
                          <Button
                            variant="contained"
                            color="error"
                            size="small"
                            onClick={handleAddBank}
                            disabled={!newBankName.trim() || addingSource}
                            sx={{ whiteSpace: 'nowrap', borderRadius: 1.5 }}
                          >
                            Add
                          </Button>
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                )}

                {source === 'custom' && (
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>Select Payment Head</InputLabel>
                      <Select
                        value={selectedCustomPaymentHead}
                        onChange={(e) => setSelectedCustomPaymentHead(e.target.value)}
                        label="Select Payment Head"
                        startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
                      >
                        <MenuItem value=""><em>-- Add New Head --</em></MenuItem>
                        {customPaymentHeads.map((head) => (
                          <MenuItem key={head.id} value={head.id}>
                            {head.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {!selectedCustomPaymentHead && (
                      <Box sx={{ 
                        p: 2, 
                        borderRadius: 2, 
                        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff5f5',
                        border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : '#feb2b2'}`
                      }}>
                        <Typography variant="caption" fontWeight="700" color="#b91c1c" sx={{ mb: 1, display: 'block' }}>
                          NEW PAYMENT HEAD
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Head Name"
                            value={newCustomPaymentHeadName}
                            onChange={(e) => setNewCustomPaymentHeadName(e.target.value)}
                          />
                          <Button
                            variant="contained"
                            color="error"
                            size="small"
                            onClick={handleAddCustomPaymentHead}
                            disabled={!newCustomPaymentHeadName.trim() || addingSource}
                            sx={{ whiteSpace: 'nowrap', borderRadius: 1.5 }}
                          >
                            Add
                          </Button>
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                )}
              </>
            )}

            <Box 
              sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5
              }}
            >
              <BalanceIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="700">
                  CURRENT BALANCE
                </Typography>
                <Typography variant="body2" fontWeight="900" color={balance < (amount || 0) ? 'error.main' : 'text.primary'}>
                  {formatCurrency(balance, 'PKR')}
                </Typography>
              </Box>
            </Box>

            <TextField
              fullWidth
              label="Note / Reason"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Rent, Grocery, Bill payment, etc."
              size="small"
              multiline
              rows={2}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 3, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fcfcfc', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <Button onClick={() => setShowModal(false)} sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleSaveClick}
            disabled={
              saving ||
              (amount !== '' && Number(amount) > balance) ||
              (!fromFreeze && source === 'bank' && !selectedBank) ||
              (!fromFreeze && source === 'custom' && !selectedCustomPaymentHead) ||
              !amount || amount <= 0
            }
            sx={{ 
              borderRadius: 2, 
              fontWeight: 800, 
              px: 4,
              boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.39)',
              textTransform: 'none'
            }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : 'Complete Deduction'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
