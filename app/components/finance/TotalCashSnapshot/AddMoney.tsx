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
  Checkbox,
  Typography,
  Stack,
  Avatar,
  IconButton,
  Fade,
  Box,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { TransactionSource, Bank, CustomPaymentHead, TotalCashSnapshot } from '@/app/lib/interface';
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
import {
  Close as CloseIcon,
  Add as AddIcon,
  AccountBalance as BankIcon,
  Wallet as WalletIcon,
  Payments as PaymentsIcon,
  AttachMoney as MoneyIcon,
  AddCard as AddCardIcon
} from '@mui/icons-material';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { getSourceKey } from '../TotalCashSnapshot';

const SOURCE_OPTIONS: TransactionSource[] = [
  'bank',
  'in_hand',
  'easypaisa',
  'jazzcash',
  'other',
  'custom',
];

interface Props {
  onSave: (
    amount: number,
    source: TransactionSource,
    isFreezed: boolean,
    bankId?: string,
    bankName?: string,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string,
    note?: string,
    holderName?: string
  ) => Promise<void>;
  saving: boolean;
  snapshot?: TotalCashSnapshot | null;
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export default function AddMoney({ onSave, saving, snapshot, externalOpen, onExternalClose }: Props) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  // Sync with external open state from FAB
  useEffect(() => {
    if (externalOpen !== undefined) setShowModal(externalOpen);
  }, [externalOpen]);
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newMode, setNewMode] = useState<TransactionSource>('in_hand');
  const [isFreezed, setIsFreezed] = useState(false);
  const [note, setNote] = useState('');

  // Holder state
  const [selectedHolder, setSelectedHolder] = useState('Unassigned');
  const [newHolderName, setNewHolderName] = useState('');

  // Bank-specific state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [newBankName, setNewBankName] = useState('');

  // Custom payment head state
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);
  const [selectedCustomPaymentHead, setSelectedCustomPaymentHead] = useState<string>('');
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

  const handleSaveClick = async () => {
    if (!newAmount || newAmount <= 0) return;

    let bankId: string | undefined;
    let bankName: string | undefined;
    let customPaymentHeadId: string | undefined;
    let customPaymentHeadName: string | undefined;

    // ✅ Ignore source/bank/custom if freezed
    const sourceToSave: TransactionSource = isFreezed
      ? 'in_hand' // dummy fallback
      : newMode;

    if (!isFreezed && newMode === 'bank') {
      bankId = selectedBank;
      bankName = banks.find((b) => b.id === selectedBank)?.name;
      if (!bankId || !bankName) return; // require valid selection
    }

    if (!isFreezed && newMode === 'custom') {
      customPaymentHeadId = selectedCustomPaymentHead;
      customPaymentHeadName = customPaymentHeads.find((c) => c.id === selectedCustomPaymentHead)?.name;
      if (!customPaymentHeadId || !customPaymentHeadName) return; // require valid selection
    }

    const holderToSave = selectedHolder === 'new' ? newHolderName.trim() : (selectedHolder === 'Unassigned' ? undefined : selectedHolder);

    await onSave(
      Number(newAmount),
      sourceToSave,
      isFreezed,
      bankId,
      bankName,
      customPaymentHeadId,
      customPaymentHeadName,
      note,
      holderToSave
    );

    // reset state
    setShowModal(false);
    onExternalClose?.();
    setNewAmount('');
    setNewMode('in_hand');
    setIsFreezed(false);
    setSelectedBank('');
    setSelectedCustomPaymentHead('');
    setSelectedHolder('Unassigned');
    setNewHolderName('');
    setNote('');
  };

  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const bankName = banks.find((b) => b.id === selectedBank)?.name;
  const customPaymentHeadName = customPaymentHeads.find((c) => c.id === selectedCustomPaymentHead)?.name;
  const sourceKey = getSourceKey(newMode, bankName, customPaymentHeadName);
  const existingHolders = snapshot?.heldBy?.[sourceKey] || [];

  const handleClose = () => {
    if (saving) return;
    setShowModal(false);
    onExternalClose?.();
  };

  return (
    <>
      {/* Trigger button hidden when FAB controls the dialog */}
      {!externalOpen && externalOpen === undefined && (
        <Button
          variant="contained"
          onClick={() => setShowModal(true)}
          startIcon={<AddIcon />}
          sx={{
            borderRadius: 2,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}
        >
          Add Money
        </Button>
      )}

      <Dialog
        open={showModal}
        onClose={handleClose}
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
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          p: 3,
          color: 'white',
          position: 'relative'
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              <AddCardIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>
                Add Funds
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
                Increase your total balance
              </Typography>
            </Box>
          </Stack>
          <IconButton
            onClick={handleClose}
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
        <DialogContent>
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={newAmount}
              onChange={(e) =>
                setNewAmount(e.target.value === '' ? '' : Number(e.target.value))
              }
              InputProps={{
                startAdornment: <MoneyIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
              }}
              placeholder="0.00"
            />

            <FormControl fullWidth disabled={isFreezed}>
              <InputLabel>Source Type</InputLabel>
              <Select
                value={newMode}
                onChange={(e) => {
                  setNewMode(e.target.value as TransactionSource);
                  setSelectedHolder('Unassigned');
                }}
                label="Source Type"
                startAdornment={<PaymentsIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
              >
                {SOURCE_OPTIONS.map((mode) => (
                  <MenuItem key={mode} value={mode} sx={{ textTransform: 'capitalize' }}>
                    {mode.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Extra bank select if source = bank and not freezed */}
            {!isFreezed && newMode === 'bank' && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Select Bank</InputLabel>
                  <Select
                    value={selectedBank}
                    onChange={(e) => {
                      setSelectedBank(e.target.value);
                      setSelectedHolder('Unassigned');
                    }}
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
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                    border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`
                  }}>
                    <Typography variant="caption" fontWeight="700" color="primary" sx={{ mb: 1, display: 'block' }}>
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
                        sx={{ whiteSpace: 'nowrap', borderRadius: 1.5 }}
                      >
                        Add
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}

            {/* Custom payment head select if source = custom and not freezed */}
            {!isFreezed && newMode === 'custom' && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Select Payment Head</InputLabel>
                  <Select
                    value={selectedCustomPaymentHead}
                    onChange={(e) => {
                      setSelectedCustomPaymentHead(e.target.value);
                      setSelectedHolder('Unassigned');
                    }}
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
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                    border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`
                  }}>
                    <Typography variant="caption" fontWeight="700" color="secondary" sx={{ mb: 1, display: 'block' }}>
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
                        color="secondary"
                        size="small"
                        onClick={handleAddCustomPaymentHead}
                        disabled={!newCustomPaymentHeadName.trim()}
                        sx={{ whiteSpace: 'nowrap', borderRadius: 1.5 }}
                      >
                        Add
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}

            {/* Holder Selection (optional) if not freezing */}
            {!isFreezed && (
              <Box sx={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`, borderRadius: 2, p: 2 }}>
                <Typography variant="caption" fontWeight="800" color="primary" sx={{ mb: 1.5, display: 'block' }}>
                  HOLDER ASSIGNMENT (OPTIONAL)
                </Typography>
                <Stack spacing={2}>
                  <FormControl fullWidth>
                    <InputLabel>Select Holder</InputLabel>
                    <Select
                      value={selectedHolder}
                      onChange={(e) => setSelectedHolder(e.target.value)}
                      label="Select Holder"
                    >
                      <MenuItem value="Unassigned">Unassigned / Self</MenuItem>
                      {existingHolders.map((h) => (
                        <MenuItem key={h.holderName} value={h.holderName}>
                          {h.holderName}
                        </MenuItem>
                      ))}
                      <MenuItem value="new"><em>-- Create New Holder --</em></MenuItem>
                    </Select>
                  </FormControl>

                  {selectedHolder === 'new' && (
                    <TextField
                      fullWidth
                      label="New Holder Name"
                      value={newHolderName}
                      onChange={(e) => setNewHolderName(e.target.value)}
                      placeholder="e.g. Ali, Mother, etc."
                      size="small"
                    />
                  )}
                </Stack>
              </Box>
            )}

            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: isFreezed ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                border: `1px solid ${isFreezed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.05)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight="700">Add to Freezed balance</Typography>
                <Typography variant="caption" color="text.secondary">Amount won&apos;t be available for spending</Typography>
              </Box>
              <Checkbox
                checked={isFreezed}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsFreezed(checked);
                  if (checked) {
                    setNewMode('in_hand');
                    setSelectedBank('');
                    setSelectedCustomPaymentHead('');
                    setSelectedHolder('Unassigned');
                  }
                }}
              />
            </Box>

            <TextField
              fullWidth
              label="Note / Reference"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Salary, Birthday gift, etc."
              size="small"
              multiline
              rows={2}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 3, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fcfcfc', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <Button onClick={handleClose} sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveClick}
            disabled={
              saving ||
              (!isFreezed && newMode === 'bank' && !selectedBank) ||
              (!isFreezed && newMode === 'custom' && !selectedCustomPaymentHead) ||
              (selectedHolder === 'new' && !newHolderName.trim()) ||
              !newAmount || newAmount <= 0
            }
            sx={{
              borderRadius: 2,
              fontWeight: 800,
              px: 4,
              boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
              textTransform: 'none'
            }}
          >
            {saving ? 'Processing...' : 'Complete Addition'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
