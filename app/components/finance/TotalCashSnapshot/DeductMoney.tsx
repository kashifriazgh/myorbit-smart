import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
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

interface Props {
  snapshot: TotalCashSnapshot;
  onDeduct: (
    amount: number,
    source: TransactionSource,
    bankId?: string,
    bankName?: string,
    fromFreeze?: boolean,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string
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

  const [banks, setBanks] = useState<Bank[]>([]);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);
  const [selectedCustomPaymentHead, setSelectedCustomPaymentHead] = useState('');

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
      customPaymentHeadName
    );

    setShowModal(false);
    setAmount('');
    setSource('in_hand');
    setSelectedBank('');
    setSelectedCustomPaymentHead('');
    setFromFreeze(false);
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

  return (
    <>
      <Button
        variant="outlined"
        color="error"
        sx={{ background: '#fecaca' }}
        onClick={() => setShowModal(true)}
      >
        - Deduct Money
      </Button>

      <Dialog open={showModal} onClose={() => setShowModal(false)}>
        <DialogTitle>Deduct Money</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === '' ? '' : Number(e.target.value))
            }
            margin="normal"
          />

          {/* Deduct from Freeze or Normal */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Fund Type</InputLabel>
            <Select
              value={fromFreeze ? 'freeze' : 'normal'}
              onChange={(e) => setFromFreeze(e.target.value === 'freeze')}
            >
              <MenuItem value="normal">Normal Balance</MenuItem>
              <MenuItem value="freeze">Freezed Balance</MenuItem>
            </Select>
          </FormControl>

          {/* Only show source selector if deducting from normal funds */}
          {!fromFreeze && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Source</InputLabel>
                <Select
                  value={source}
                  onChange={(e) =>
                    setSource(e.target.value as TransactionSource)
                  }
                  label="Source"
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
                <FormControl fullWidth margin="normal">
                  <InputLabel>Select Bank</InputLabel>
                  <Select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    label="Bank"
                  >
                    {banks.length > 0 ? (
                      banks.map((bank) => (
                        <MenuItem key={bank.id} value={bank.id}>
                          {bank.name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>No Banks Available</MenuItem>
                    )}
                  </Select>
                </FormControl>
              )}

              {source === 'custom' && (
                <FormControl fullWidth margin="normal">
                  <InputLabel>Select Payment Head</InputLabel>
                  <Select
                    value={selectedCustomPaymentHead}
                    onChange={(e) => setSelectedCustomPaymentHead(e.target.value)}
                    label="Payment Head"
                  >
                    {customPaymentHeads.length > 0 ? (
                      customPaymentHeads.map((head) => (
                        <MenuItem key={head.id} value={head.id}>
                          {head.name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>No Payment Heads Available</MenuItem>
                    )}
                  </Select>
                </FormControl>
              )}
            </>
          )}

          <Typography fontSize={13} color="text.secondary">
            Current balance: {balance}
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleSaveClick}
            disabled={
              saving ||
              (amount !== '' && Number(amount) > balance) ||
              (source === 'bank' && !selectedBank) ||
              (source === 'custom' && !selectedCustomPaymentHead)
            }
          >
            {saving ? 'Saving...' : 'Deduct'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
