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
  CircularProgress,
  Stack,
  Box,
  Typography,
  Avatar,
  IconButton,
  Fade,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { TransactionSource, Bank, CustomPaymentHead } from '@/app/lib/interface';
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
import CloseIcon from '@mui/icons-material/Close';
import FreezeIcon from '@mui/icons-material/AcUnit';
import BankIcon from '@mui/icons-material/AccountBalance';
import WalletIcon from '@mui/icons-material/Wallet';
import PaymentsIcon from '@mui/icons-material/Payments';
import MoneyIcon from '@mui/icons-material/AttachMoney';
import { useCustomTheme } from '@/app/lib/context/themeContext';

const SOURCE_OPTIONS: TransactionSource[] = [
  'bank',
  'in_hand',
  'easypaisa',
  'jazzcash',
  'other',
  'custom',
];

interface Props {
  onFreeze: (
    amount: number,
    fromSource: TransactionSource,
    bankId?: string,
    bankName?: string,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string,
    note?: string
  ) => Promise<void>;
  saving: boolean;
}

export default function FreezeTransfer({ onFreeze, saving }: Props) {
  const { user } = useAuth();
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeAmount, setFreezeAmount] = useState<number | ''>('');
  const [freezeFrom, setFreezeFrom] = useState<TransactionSource>('in_hand');
  const [note, setNote] = useState('');

  // bank-specific state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [newBankName, setNewBankName] = useState('');

  // custom payment head state
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);
  const [selectedCustomPaymentHead, setSelectedCustomPaymentHead] = useState('');
  const [newCustomPaymentHeadName, setNewCustomPaymentHeadName] = useState('');

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

  const handleAddCustomPaymentHead = async () => {
    if (!user || !newCustomPaymentHeadName.trim()) return;
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
  };

  const handleFreezeClick = async () => {
    if (!freezeAmount || freezeAmount <= 0) return;

    const bank =
      freezeFrom === 'bank'
        ? banks.find((b) => b.id === selectedBank)
        : undefined;

    const customPaymentHead =
      freezeFrom === 'custom'
        ? customPaymentHeads.find((c) => c.id === selectedCustomPaymentHead)
        : undefined;

    await onFreeze(
      Number(freezeAmount),
      freezeFrom,
      bank?.id,
      bank?.name,
      customPaymentHead?.id,
      customPaymentHead?.name,
      note
    );

    setShowFreezeModal(false);
    setFreezeAmount('');
    setFreezeFrom('in_hand');
    setSelectedBank('');
    setSelectedCustomPaymentHead('');
    setNote('');
  };

  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  return (
    <>
      <Button
        variant="outlined"
        onClick={() => setShowFreezeModal(true)}
        sx={{ 
          borderRadius: 2,
          fontWeight: 700,
          textTransform: 'none',
          borderColor: isDark ? 'rgba(234, 179, 8, 0.5)' : '#eab308',
          color: isDark ? '#fde047' : '#854d0e',
          bgcolor: isDark ? 'rgba(234, 179, 8, 0.05)' : 'rgba(234, 179, 8, 0.05)',
          '&:hover': {
            bgcolor: isDark ? 'rgba(234, 179, 8, 0.1)' : 'rgba(234, 179, 8, 0.1)',
            borderColor: '#eab308'
          }
        }}
        startIcon={<FreezeIcon sx={{ fontSize: 18 }} />}
      >
        Freeze Funds
      </Button>

      <Dialog 
        open={showFreezeModal} 
        onClose={() => !saving && setShowFreezeModal(false)}
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
          background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
          p: 3,
          color: 'white',
          position: 'relative'
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              <FreezeIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>
                Freeze Transfer
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
                Secure funds in freezed balance
              </Typography>
            </Box>
          </Stack>
          <IconButton 
            onClick={() => setShowFreezeModal(false)}
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
              label="Amount to Freeze"
              type="number"
              value={freezeAmount}
              onChange={(e) =>
                setFreezeAmount(
                  e.target.value === '' ? '' : Number(e.target.value)
                )
              }
              InputProps={{
                startAdornment: <MoneyIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
              }}
              placeholder="0.00"
            />

            <FormControl fullWidth>
              <InputLabel>From Source</InputLabel>
              <Select
                value={freezeFrom}
                onChange={(e) =>
                  setFreezeFrom(e.target.value as TransactionSource)
                }
                label="From Source"
                startAdornment={<PaymentsIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
              >
                {SOURCE_OPTIONS.map((mode) => (
                  <MenuItem key={mode} value={mode} sx={{ textTransform: 'capitalize' }}>
                    {mode.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {freezeFrom === 'bank' && (
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
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fcfce8',
                    border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : '#fde047'}`
                  }}>
                    <Typography variant="caption" fontWeight="700" color="#854d0e" sx={{ mb: 1, display: 'block' }}>
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
                        size="small"
                        onClick={handleAddBank}
                        disabled={!newBankName.trim()}
                        sx={{ 
                          whiteSpace: 'nowrap', 
                          borderRadius: 1.5,
                          bgcolor: '#eab308',
                          '&:hover': { bgcolor: '#ca8a04' }
                        }}
                      >
                        Add
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}

            {freezeFrom === 'custom' && (
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
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fcfce8',
                    border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : '#fde047'}`
                  }}>
                    <Typography variant="caption" fontWeight="700" color="#854d0e" sx={{ mb: 1, display: 'block' }}>
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
                        size="small"
                        onClick={handleAddCustomPaymentHead}
                        disabled={!newCustomPaymentHeadName.trim()}
                        sx={{ 
                          whiteSpace: 'nowrap', 
                          borderRadius: 1.5,
                          bgcolor: '#eab308',
                          '&:hover': { bgcolor: '#ca8a04' }
                        }}
                      >
                        Add
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}

            <TextField
              fullWidth
              label="Note / Reference"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. For car insurance, Savings, etc."
              size="small"
              multiline
              rows={2}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 3, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fcfcfc', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <Button onClick={() => setShowFreezeModal(false)} sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleFreezeClick}
            disabled={
              saving ||
              (freezeFrom === 'bank' && !selectedBank) ||
              (freezeFrom === 'custom' && !selectedCustomPaymentHead) ||
              !freezeAmount || freezeAmount <= 0
            }
            sx={{ 
              borderRadius: 2, 
              fontWeight: 800, 
              px: 4,
              bgcolor: '#eab308',
              boxShadow: '0 4px 14px 0 rgba(234, 179, 8, 0.39)',
              textTransform: 'none',
              '&:hover': { bgcolor: '#ca8a04' },
              '&.Mui-disabled': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
            }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : 'Confirm Transfer'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
