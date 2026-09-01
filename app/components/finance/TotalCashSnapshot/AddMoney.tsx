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
  InputAdornment,
  ListSubheader,
} from '@mui/material';
import { useEffect, useState, useMemo } from 'react';
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
import { useGoals } from '@/app/lib/context/GoalsContext';
import {
  Close as CloseIcon,
  Add as AddIcon,
  AccountBalance as BankIcon,
  Wallet as WalletIcon,
  AddCard as AddCardIcon,
  Description as NoteIcon,
} from '@mui/icons-material';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { getSourceKey } from '../TotalCashSnapshot';

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

// Icon map for source types
const SOURCE_ICONS: Record<string, string> = {
  in_hand: '💵',
  bank: '🏦',
  easypaisa: '📱',
  jazzcash: '📱',
  other: '💼',
  custom: '🎯',
};

const SOURCE_LABELS: Record<string, string> = {
  in_hand: 'Cash in Hand',
  bank: 'Bank Account',
  easypaisa: 'EasyPaisa',
  jazzcash: 'JazzCash',
  other: 'Other',
  custom: 'Custom & Goal Wallets',
};

const SOURCE_OPTIONS: TransactionSource[] = ['in_hand', 'bank', 'easypaisa', 'jazzcash', 'other', 'custom'];

export default function AddMoney({ onSave, saving, snapshot, externalOpen, onExternalClose }: Props) {
  const { user } = useAuth();
  const { goals, updateLinkedItemStatusInGoal } = useGoals();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [showModal, setShowModal] = useState(false);

  // Sync with external open state from FAB
  useEffect(() => {
    if (externalOpen !== undefined) setShowModal(externalOpen);
  }, [externalOpen]);

  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newMode, setNewMode] = useState<TransactionSource>('in_hand');
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
    if (!user || !showModal) return;
    const fetchBanks = async () => {
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setBanks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bank, 'id'>) })));
    };
    fetchBanks();
  }, [user, showModal]);

  useEffect(() => {
    if (!user || !showModal) return;
    const fetchCustom = async () => {
      const q = query(collection(db, 'customPaymentHeads'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setCustomPaymentHeads(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomPaymentHead, 'id'>) })));
    };
    fetchCustom();
  }, [user, showModal]);

  // Dynamically merge Goal Sources of Fund into custom payment heads
  const allCustomHeads = useMemo(() => {
    const list: CustomPaymentHead[] = [...customPaymentHeads];
    const existingNames = new Set(list.map((h) => h.name.toLowerCase()));

    (goals || []).forEach((g) => {
      (g.steps || []).forEach((s) => {
        if (s.linkedType === 'finance_source' && s.title) {
          const cleanName = s.title.replace(/^Source of Fund:\s*/i, '').replace(/^Finance Fund:\s*/i, '').trim();
          if (cleanName && !existingNames.has(cleanName.toLowerCase())) {
            list.push({
              id: s.linkedItemId || `goal_src_${g.id}_${cleanName}`,
              userId: user?.uid || '',
              name: cleanName,
              goalId: g.id,
              goalTitle: g.title,
              createdAt: new Date(),
            });
            existingNames.add(cleanName.toLowerCase());
          }
        }
      });
      if (g.linkedSourceId && !existingNames.has(g.linkedSourceId.toLowerCase())) {
        list.push({
          id: `goal_src_${g.id}`,
          userId: user?.uid || '',
          name: g.linkedSourceId,
          goalId: g.id,
          goalTitle: g.title,
          createdAt: new Date(),
        });
        existingNames.add(g.linkedSourceId.toLowerCase());
      }
    });

    return list;
  }, [customPaymentHeads, goals, user?.uid]);

  const goalHeads = useMemo(() => allCustomHeads.filter((h) => !!h.goalTitle || !!h.goalId), [allCustomHeads]);
  const otherHeads = useMemo(() => allCustomHeads.filter((h) => !h.goalTitle && !h.goalId), [allCustomHeads]);

  const handleAddBank = async () => {
    if (!user || !newBankName.trim()) return;
    const docRef = await addDoc(collection(db, 'banks'), {
      userId: user.uid, name: newBankName.trim(), createdAt: Timestamp.now(),
    });
    const newBank: Bank = { id: docRef.id, userId: user.uid, name: newBankName.trim(), createdAt: Timestamp.now() };
    setBanks((prev) => [...prev, newBank]);
    setSelectedBank(newBank.id!);
    setNewBankName('');
  };

  const handleAddCustomPaymentHead = async () => {
    if (!user || !newCustomPaymentHeadName.trim()) return;
    const docRef = await addDoc(collection(db, 'customPaymentHeads'), {
      userId: user.uid, name: newCustomPaymentHeadName.trim(), createdAt: Timestamp.now(),
    });
    const newHead: CustomPaymentHead = { id: docRef.id, userId: user.uid, name: newCustomPaymentHeadName.trim(), createdAt: Timestamp.now() };
    setCustomPaymentHeads((prev) => [...prev, newHead]);
    setSelectedCustomPaymentHead(newHead.id!);
    setNewCustomPaymentHeadName('');
  };

  const handleSaveClick = async () => {
    if (!newAmount || newAmount <= 0) return;

    let bankId: string | undefined;
    let bankName: string | undefined;
    let customPaymentHeadId: string | undefined;
    let customPaymentHeadName: string | undefined;

    if (newMode === 'bank') {
      bankId = selectedBank;
      bankName = banks.find((b) => b.id === selectedBank)?.name;
      if (!bankId || !bankName) return;
    }
    if (newMode === 'custom') {
      customPaymentHeadId = selectedCustomPaymentHead;
      const foundHead = allCustomHeads.find((c) => c.id === selectedCustomPaymentHead || c.name === selectedCustomPaymentHead);
      customPaymentHeadName = foundHead?.name || selectedCustomPaymentHead;
      if (!customPaymentHeadId || !customPaymentHeadName) return;

      // Sync status to linked goal if applicable
      if (foundHead?.goalId) {
        await updateLinkedItemStatusInGoal(foundHead.goalId, foundHead.id!, 'finance_source', true);
      }
    }

    const holderToSave = selectedHolder === 'new' ? newHolderName.trim() : (selectedHolder === 'Unassigned' ? undefined : selectedHolder);

    await onSave(Number(newAmount), newMode, false, bankId, bankName, customPaymentHeadId, customPaymentHeadName, note, holderToSave);

    setShowModal(false);
    onExternalClose?.();
    setNewAmount('');
    setNewMode('in_hand');
    setSelectedBank('');
    setSelectedCustomPaymentHead('');
    setSelectedHolder('Unassigned');
    setNewHolderName('');
    setNote('');
  };

  const bankName = banks.find((b) => b.id === selectedBank)?.name;
  const customPaymentHeadName = allCustomHeads.find((c) => c.id === selectedCustomPaymentHead)?.name;
  const sourceKey = getSourceKey(newMode, bankName, customPaymentHeadName);
  const existingHolders = snapshot?.heldBy?.[sourceKey] || [];

  const handleClose = () => {
    if (saving) return;
    setShowModal(false);
    onExternalClose?.();
  };

  return (
    <>
      {!externalOpen && externalOpen === undefined && (
        <Button
          variant="contained"
          onClick={() => setShowModal(true)}
          startIcon={<AddIcon />}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
        >
          Add Money
        </Button>
      )}

      <Dialog
        open={showModal}
        onClose={handleClose}
        fullWidth maxWidth="xs"
        TransitionComponent={Fade}
        PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden', backgroundColor: isDark ? '#0f172a' : '#ffffff' } }}
      >
        {/* Header */}
        <Box sx={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', p: 2.5, color: 'white', position: 'relative' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', width: 36, height: 36 }}>
              <AddCardIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>Add Funds</Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>Increase your total balance</Typography>
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
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value === '' ? '' : Number(e.target.value))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'text.secondary' }}>PKR</Typography>
                  </InputAdornment>
                ),
              }}
              placeholder="0.00" autoFocus
            />

            {/* Source — icon cards */}
            <Box>
              <Typography variant="caption" fontWeight={800} color="text.secondary"
                sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Add money to which account?
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
                {SOURCE_OPTIONS.map((opt) => (
                  <Box
                    key={opt}
                    onClick={() => { setNewMode(opt); setSelectedBank(''); setSelectedCustomPaymentHead(''); setSelectedHolder('Unassigned'); }}
                    sx={{
                      flex: '1 1 28%', p: 1.2, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                      border: `2px solid ${newMode === opt ? '#3b82f6' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                      bgcolor: newMode === opt ? (isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff') : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { border: `2px solid #3b82f6`, bgcolor: isDark ? 'rgba(59,130,246,0.08)' : '#eff6ff' },
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

            {/* Bank selector */}
            {newMode === 'bank' && (
              <Stack spacing={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Bank</InputLabel>
                  <Select value={selectedBank}
                    onChange={(e) => { setSelectedBank(e.target.value); setSelectedHolder('Unassigned'); }}
                    label="Select Bank"
                    startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                    <MenuItem value=""><em>— Select or add new —</em></MenuItem>
                    {banks.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </Select>
                </FormControl>
                {!selectedBank && (
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}` }}>
                    <Typography variant="caption" fontWeight={800} color="primary" sx={{ mb: 1, display: 'block' }}>ADD NEW BANK</Typography>
                    <Stack direction="row" spacing={1}>
                      <TextField fullWidth size="small" label="Bank Name" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} />
                      <Button variant="contained" size="small" onClick={handleAddBank} disabled={!newBankName.trim()} sx={{ whiteSpace: 'nowrap', borderRadius: 1.5 }}>Add</Button>
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}

            {/* Custom wallet selector */}
            {newMode === 'custom' && (
              <Stack spacing={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Custom Wallet</InputLabel>
                  <Select value={selectedCustomPaymentHead}
                    onChange={(e) => { setSelectedCustomPaymentHead(e.target.value); setSelectedHolder('Unassigned'); }}
                    label="Select Custom Wallet"
                    startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}>
                    <MenuItem value=""><em>— Select or add new —</em></MenuItem>
                    {goalHeads.length > 0 && [
                      <ListSubheader key="hdr-goal" sx={{ fontWeight: 800, color: '#f59e0b', bgcolor: isDark ? '#1e293b' : '#fff', lineHeight: '32px' }}>
                        🎯 Goal Sources of Fund
                      </ListSubheader>,
                      ...goalHeads.map((h) => (
                        <MenuItem key={h.id} value={h.id}>
                          🎯 {h.name} {h.goalTitle ? `(Goal: ${h.goalTitle})` : ''}
                        </MenuItem>
                      )),
                    ]}

                    {otherHeads.length > 0 && [
                      <ListSubheader key="hdr-other" sx={{ fontWeight: 800, color: 'text.secondary', bgcolor: isDark ? '#1e293b' : '#fff', lineHeight: '32px' }}>
                        🗂️ Custom Wallets
                      </ListSubheader>,
                      ...otherHeads.map((h) => (
                        <MenuItem key={h.id} value={h.id}>
                          {h.name}
                        </MenuItem>
                      )),
                    ]}
                  </Select>
                </FormControl>
                {!selectedCustomPaymentHead && (
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}` }}>
                    <Typography variant="caption" fontWeight={800} color="secondary" sx={{ mb: 1, display: 'block' }}>ADD NEW WALLET</Typography>
                    <Stack direction="row" spacing={1}>
                      <TextField fullWidth size="small" label="Wallet Name" value={newCustomPaymentHeadName} onChange={(e) => setNewCustomPaymentHeadName(e.target.value)} />
                      <Button variant="contained" color="secondary" size="small" onClick={handleAddCustomPaymentHead} disabled={!newCustomPaymentHeadName.trim()} sx={{ whiteSpace: 'nowrap', borderRadius: 1.5 }}>Add</Button>
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}

            {/* Holder assignment */}
            <Box sx={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`, borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" fontWeight={800} color="primary" sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Assign to a person (optional)
              </Typography>
              <Stack spacing={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>For person</InputLabel>
                  <Select value={selectedHolder} onChange={(e) => setSelectedHolder(e.target.value)} label="For person">
                    <MenuItem value="Unassigned">Self</MenuItem>
                    {existingHolders.map((h) => <MenuItem key={h.holderName} value={h.holderName}>{h.holderName}</MenuItem>)}
                    <MenuItem value="new"><em>+ Add new person</em></MenuItem>
                  </Select>
                </FormControl>
                {selectedHolder === 'new' && (
                  <TextField fullWidth size="small" label="Person Name" value={newHolderName} onChange={(e) => setNewHolderName(e.target.value)} placeholder="e.g. Ali, Wife, etc." />
                )}
              </Stack>
            </Box>

            {/* Note */}
            <TextField
              fullWidth size="small" label="Note (optional)" value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Salary, Birthday gift, etc."
              multiline rows={2}
              InputProps={{ startAdornment: <NoteIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18, mt: 0.5, alignSelf: 'flex-start' }} /> }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fafafa', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0'}` }}>
          <Button onClick={handleClose} sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveClick}
            disabled={
              saving ||
              (newMode === 'bank' && !selectedBank) ||
              (newMode === 'custom' && !selectedCustomPaymentHead) ||
              (selectedHolder === 'new' && !newHolderName.trim()) ||
              !newAmount || newAmount <= 0
            }
            sx={{ borderRadius: 2, fontWeight: 800, px: 3.5, textTransform: 'none', boxShadow: '0 4px 14px rgba(59,130,246,0.35)' }}
          >
            {saving ? 'Processing…' : 'Add Funds'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
