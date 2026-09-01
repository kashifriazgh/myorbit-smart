import {
  Box,
  Typography,
  Button,
  Collapse,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { TotalCashSnapshot, CustomPaymentHead, HolderAmount } from '@/app/lib/interface';
import { formatCurrency } from '@/app/lib/utilts';
import Link from 'next/link';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentsIcon from '@mui/icons-material/Payments';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { db } from '@/app/lib/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, addDoc } from 'firebase/firestore';

interface Props {
  snapshot: TotalCashSnapshot;
  currency: 'PKR' | 'USD';
  isDark: boolean;
  userId?: string;
  onUpdateSnapshot?: (updated: TotalCashSnapshot) => void;
}

export default function AccountBreakdown({
  snapshot,
  currency,
  isDark,
  userId,
  onUpdateSnapshot,
}: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [editOwnership, setEditOwnership] = useState<{
    key: string;
    displayName: string;
  } | null>(null);
  const [hasOwnThisMoney, setHasOwnThisMoney] = useState(true);
  const [ownerName, setOwnerName] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [savingOwnership, setSavingOwnership] = useState(false);

  // Custom multi-holders states
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);
  const [localHolders, setLocalHolders] = useState<HolderAmount[]>([]);
  const [newHolderName, setNewHolderName] = useState('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferFrom, setTransferFrom] = useState<string>('Self');
  const [transferTo, setTransferTo] = useState<string>('Self');
  const [pendingTransfers, setPendingTransfers] = useState<{ amount: number; fromHolder: string; toHolder: string }[]>([]);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');

  useEffect(() => {
    if (!userId) return;
    const fetchCustom = async () => {
      const q = query(collection(db, 'customPaymentHeads'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const heads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCustomPaymentHeads(heads as CustomPaymentHead[]);
    };
    fetchCustom();
  }, [userId]);

  const handleOpenEditOwnership = (key: string, displayName: string) => {
    const current = snapshot.sourceOwnership?.[key] || { hasOwnThisMoney: true, ownerName: '', isLocked: false };
    setHasOwnThisMoney(current.hasOwnThisMoney !== false);
    setOwnerName(current.ownerName || current.ownserName || '');
    setIsLocked(current.isLocked === true);
    setLocalHolders(snapshot.heldBy?.[key] || []);
    setNewHolderName('');
    setTransferAmount('');
    setTransferFrom('Self');
    setTransferTo('Self');
    setPendingTransfers([]);
    setTransferError('');
    setTransferSuccess('');
    setEditOwnership({ key, displayName });
  };

  const handleSaveOwnership = async () => {
    if (!editOwnership || !userId || !onUpdateSnapshot) return;
    setSavingOwnership(true);
    try {
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const isCustom = editOwnership.key.startsWith('custom:');

      const val = hasOwnThisMoney ? '' : ownerName.trim();
      const updatedOwnership = {
        ...(snapshot.sourceOwnership || {}),
        [editOwnership.key]: {
          hasOwnThisMoney: isCustom ? true : hasOwnThisMoney,
          ownerName: isCustom ? '' : val,
          ownserName: isCustom ? '' : val,
          isLocked,
        },
      };

      const cleanedHolders = localHolders.filter(h => h.amount > 0);

      const updatedHeldBy = {
        ...(snapshot.heldBy || {}),
        [editOwnership.key]: cleanedHolders,
      };

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sourceOwnership: updatedOwnership,
        heldBy: updatedHeldBy,
        updatedAt: new Date(),
      };

      await setDoc(docRef, {
        ...updatedSnapshot,
        updatedAt: serverTimestamp(),
      });

      // Write pending transfers to transactions
      if (isCustom) {
        const customName = editOwnership.key.replace('custom:', '');
        const customId = customPaymentHeads.find(c => c.name === customName)?.id || null;

        for (const t of pendingTransfers) {
          await addDoc(collection(db, 'cashTransactions'), {
            userId,
            amount: t.amount,
            type: 'transfer',
            source: 'custom',
            category: 'transfer',
            note: `Transferred ${t.amount} PKR from ${t.fromHolder} to ${t.toHolder} in ${customName}`,
            fromHolderName: t.fromHolder === 'Self' ? null : t.fromHolder,
            toHolderName: t.toHolder === 'Self' ? null : t.toHolder,
            customPaymentHeadId: customId,
            customPaymentHeadName: customName,
            createdAt: serverTimestamp(),
          });
        }
      }

      onUpdateSnapshot(updatedSnapshot);
      setEditOwnership(null);
    } catch (err) {
      console.error('Error saving source ownership:', err);
      alert('Failed to save source ownership config.');
    } finally {
      setSavingOwnership(false);
    }
  };

  const renderOwnership = (sourceKey: string) => {
    const ownership = snapshot.sourceOwnership?.[sourceKey];
    if (!ownership || ownership.hasOwnThisMoney !== false) return null;
    const ownerName = ownership.ownerName || ownership.ownserName || 'Unknown';

    return (
      <Box
        mt={0.5}
        display="inline-flex"
        alignItems="center"
        sx={{
          px: 0.9,
          py: 0.2,
          borderRadius: 99,
          bgcolor: isDark ? 'rgba(251,191,36,0.12)' : '#fef9c3',
          border: `1px solid ${isDark ? 'rgba(251,191,36,0.3)' : '#fde68a'}`,
          width: 'fit-content',
        }}
      >
        <Typography
          component="span"
          fontSize="0.65rem"
          fontWeight={700}
          sx={{ color: isDark ? '#fde68a' : '#78350f' }}
        >
          {ownerName}
        </Typography>
      </Box>
    );
  };

  const renderHolders = (sourceKey: string, totalAmount: number) => {
    const allHolders = snapshot.heldBy?.[sourceKey] || [];
    // Only show holders that have a positive (non-zero) amount
    const holders = allHolders.filter((h) => h.amount > 0);
    if (holders.length === 0 && totalAmount < 1) return null;

    const holdersSum = allHolders.reduce((s, h) => s + h.amount, 0);
    const unassigned = totalAmount - holdersSum;

    // If there are no named holders, the whole amount is self-owned — no need to show Self row
    if (holders.length === 0) return null;

    return (
      <Stack spacing={0.5} sx={{ pl: 2, mt: 0.8, borderLeft: `2.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}` }}>
        {holders.map((h) => (
          <Box key={h.holderName} display="flex" justifyContent="space-between" alignItems="center">
            <Typography fontSize="0.74rem" color="text.secondary" sx={{ fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              👤 {h.holderName}
            </Typography>
            <Typography fontSize="0.74rem" fontWeight="600" color="text.secondary">
              {formatCurrency(h.amount, currency)}
            </Typography>
          </Box>
        ))}
        {/* Only show Self row when there are named holders and some remainder exists */}
        {holders.length > 0 && unassigned >= 1 && (
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography fontSize="0.74rem" color="text.secondary" sx={{ fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              👤 Self
            </Typography>
            <Typography fontSize="0.74rem" fontWeight="600" color="text.secondary">
              {formatCurrency(unassigned, currency)}
            </Typography>
          </Box>
        )}
      </Stack>
    );
  };

  const isCustom = editOwnership?.key.startsWith('custom:');

  // Compute total, sum, and unassigned amount
  let totalAmount = 0;
  if (editOwnership) {
    const { key } = editOwnership;
    if (key.startsWith('custom:')) {
      const customName = key.replace('custom:', '');
      totalAmount = snapshot.sources.custom?.[customName] ?? 0;
    } else if (key.startsWith('bank:')) {
      const bankName = key.replace('bank:', '');
      totalAmount = snapshot.sources.bank?.[bankName] ?? 0;
    } else {
      totalAmount = (snapshot.sources[key] as number) ?? 0;
    }
  }

  const assignedSum = localHolders.reduce((s, h) => s + h.amount, 0);
  const unassignedAmount = totalAmount - assignedSum;

  return (
    <>
      <Button onClick={() => setShowBreakdown((p) => !p)} size="small">
        {showBreakdown ? 'Hide' : 'Show'} Account Breakdown
      </Button>

      <Collapse in={showBreakdown}>
        <Box
          mt={2}
          borderRadius={3}
          p={2}
          bgcolor={isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc'}
          border={`1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`}
        >
          {Object.entries(snapshot.sources || {}).map(([name, amt]) => {
            // Filter: only show if amount is >= 1 (or has sub-accounts with amount >= 1)
            
            if (name === 'bank' && typeof amt === 'object') {
              const bankAccounts = Object.entries(amt as Record<string, number>).filter(([, v]) => v >= 1);
              if (bankAccounts.length === 0) return null;

              return (
                <Box key={name} mb={2}>
                  <Typography
                    variant="caption"
                    fontWeight="800"
                    color="primary"
                    sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >
                    <AccountBalanceIcon sx={{ fontSize: 14 }} /> Bank Accounts
                  </Typography>
                  <Stack spacing={0.8}>
                    {bankAccounts.map(([bankName, bankAmt]) => {
                      const bankKey = `bank:${bankName}`;
                      return (
                        <Box
                          key={bankName}
                          sx={{
                            borderRadius: 1.5,
                            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9'}`,
                            p: 1.2,
                          }}
                        >
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography fontSize="0.82rem" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {bankName} {snapshot.sourceOwnership?.[bankKey]?.isLocked && <LockIcon sx={{ fontSize: 13, color: 'error.main' }} />}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <Typography fontSize="0.82rem" fontWeight="900" color="primary">
                                {formatCurrency(bankAmt, currency)}
                              </Typography>
                              {userId && onUpdateSnapshot && (
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenEditOwnership(bankKey, bankName)}
                                  sx={{ p: 0.2, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                                >
                                  <EditIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              )}
                            </Box>
                          </Box>
                          {renderOwnership(bankKey)}
                          {renderHolders(bankKey, bankAmt)}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              );
            }

            if (name === 'custom' && typeof amt === 'object') {
              const customHeads = Object.entries(amt as Record<string, number>).filter(([, v]) => v >= 1);
              if (customHeads.length === 0) return null;

              return (
                <Box key={name} mb={2}>
                  <Typography
                    variant="caption"
                    fontWeight="800"
                    color="secondary"
                    sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >
                    <PaymentsIcon sx={{ fontSize: 14 }} /> Custom Payment Heads
                  </Typography>
                  <Stack spacing={0.8}>
                    {customHeads.map(([customName, customAmt]) => {
                      const customKey = `custom:${customName}`;
                      return (
                        <Box
                          key={customName}
                          sx={{
                            borderRadius: 1.5,
                            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9'}`,
                            p: 1.2,
                          }}
                        >
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography fontSize="0.82rem" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {customName} {snapshot.sourceOwnership?.[customKey]?.isLocked && <LockIcon sx={{ fontSize: 13, color: 'error.main' }} />}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <Typography fontSize="0.82rem" fontWeight="900" color="secondary">
                                {formatCurrency(customAmt, currency)}
                              </Typography>
                              {userId && onUpdateSnapshot && (
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenEditOwnership(customKey, customName)}
                                  sx={{ p: 0.2, color: 'text.secondary', '&:hover': { color: 'secondary.main' } }}
                                >
                                  <EditIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              )}
                            </Box>
                          </Box>
                          {renderOwnership(customKey)}
                          {renderHolders(customKey, customAmt)}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              );
            }

            // default (normal field like in_hand, easypaisa, etc.)
            const val = amt as number;
            if (val < 1) return null;

            return (
              <Box
                key={name}
                mb={0.5}
                sx={{
                  borderRadius: 1.5,
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`,
                  p: 1.2,
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography
                    fontSize="0.82rem"
                    fontWeight={700}
                    color="text.secondary"
                    sx={{ textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    {name.replace('_', ' ')} {snapshot.sourceOwnership?.[name]?.isLocked && <LockIcon sx={{ fontSize: 13, color: 'error.main' }} />}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Typography fontSize="0.82rem" fontWeight="900">
                      {formatCurrency(val, currency)}
                    </Typography>
                    {userId && onUpdateSnapshot && (
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditOwnership(name, name.replace('_', ' '))}
                        sx={{ p: 0.2, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                      >
                        <EditIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    )}
                  </Box>
                </Box>
                {renderOwnership(name)}
                {renderHolders(name, val)}
              </Box>
            );
          })}

          <Box mt={2} pt={1} borderTop={`1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`} textAlign="center">
            <Link href="/finance/manage-sources" style={{ textDecoration: 'none' }}>
              <Button 
                size="small" 
                startIcon={<SettingsIcon sx={{ fontSize: 16 }} />}
                sx={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  color: isDark ? '#94a3b8' : '#64748b',
                  '&:hover': { color: 'primary.main' }
                }}
              >
                Manage Sources
              </Button>
            </Link>
          </Box>
        </Box>
      </Collapse>

      <Dialog
        open={!!editOwnership}
        onClose={() => !savingOwnership && setEditOwnership(null)}
        PaperProps={{
          sx: { borderRadius: 4, p: 1, maxWidth: 450, width: '100%' }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight="900">
            Ownership - {editOwnership?.displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Configure who owns the funds in this source location
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <Stack spacing={3}>
            {isCustom ? (
              <>
                {/* Lock custom source */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={isLocked}
                      onChange={(e) => setIsLocked(e.target.checked)}
                      color="error"
                    />
                  }
                  label={
                    <Box>
                      <Typography fontSize="0.9rem" fontWeight={600}>
                        Lock this Source
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Prevent any deductions or transfers from this source
                      </Typography>
                    </Box>
                  }
                />

                <Divider sx={{ my: 1 }} />

                {/* Total amount overview */}
                <Box sx={{ p: 2, bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc', borderRadius: 2, border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}` }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={800} display="block" sx={{ letterSpacing: '0.5px' }}>
                    TOTAL AMOUNT IN SOURCE
                  </Typography>
                  <Typography variant="h5" fontWeight="900" color="primary">
                    {formatCurrency(totalAmount, currency)}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" mt={1.5}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight="700">Self</Typography>
                      <Typography variant="body2" fontWeight="800">{formatCurrency(unassignedAmount, currency)}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight="700">Assigned to Holders</Typography>
                      <Typography variant="body2" fontWeight="800">{formatCurrency(assignedSum, currency)}</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* List of current holders */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={800} display="block" sx={{ mb: 1, letterSpacing: '0.5px' }}>
                    👥 CURRENT HOLDERS
                  </Typography>
                  <Stack spacing={1}>
                    {/* Self holder */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ p: 1, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#ffffff', borderRadius: 1, border: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9'}` }}>
                      <Typography fontSize="0.85rem" fontWeight="600">👤 Self</Typography>
                      <Typography fontSize="0.85rem" fontWeight="700">{formatCurrency(unassignedAmount, currency)}</Typography>
                    </Box>
                    {localHolders.map((h) => (
                      <Box key={h.holderName} display="flex" justifyContent="space-between" alignItems="center" sx={{ p: 1, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#ffffff', borderRadius: 1, border: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9'}` }}>
                        <Typography fontSize="0.85rem" fontWeight="600">👤 {h.holderName}</Typography>
                        <Typography fontSize="0.85rem" fontWeight="700">{formatCurrency(h.amount, currency)}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                {/* Add Holder Form */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={800} display="block" sx={{ mb: 1, letterSpacing: '0.5px' }}>
                    ➕ ADD NEW HOLDER
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="e.g. John, Wife, Emergency Pot"
                      value={newHolderName}
                      onChange={(e) => setNewHolderName(e.target.value)}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => {
                        const name = newHolderName.trim();
                        if (!name) return;
                        if (localHolders.some(h => h.holderName.toLowerCase() === name.toLowerCase())) {
                          setTransferError('Holder name already exists.');
                          return;
                        }
                        setLocalHolders([...localHolders, { holderName: name, amount: 0 }]);
                        setNewHolderName('');
                        setTransferError('');
                      }}
                      sx={{ minWidth: 90, textTransform: 'none', fontWeight: 800 }}
                      startIcon={<PersonAddIcon sx={{ fontSize: 16 }} />}
                    >
                      Add
                    </Button>
                  </Stack>
                </Box>

                {/* Transfer Funds between holders utility */}
                <Box sx={{ p: 2, bgcolor: isDark ? 'rgba(99,102,241,0.03)' : '#fefeff', borderRadius: 2, border: `1px dashed ${isDark ? 'rgba(99,102,241,0.2)' : '#c084fc'}` }}>
                  <Typography variant="caption" color="secondary" fontWeight={800} display="block" sx={{ mb: 1.5, letterSpacing: '0.5px' }}>
                    🔄 TRANSFER BETWEEN HOLDERS
                  </Typography>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FormControl fullWidth size="small">
                        <InputLabel>From</InputLabel>
                        <Select
                          value={transferFrom}
                          label="From"
                          onChange={(e) => setTransferFrom(e.target.value)}
                        >
                          <MenuItem value="Self">Self (₨{unassignedAmount.toLocaleString()})</MenuItem>
                          {localHolders.map(h => (
                            <MenuItem key={h.holderName} value={h.holderName}>
                              {h.holderName} (₨{h.amount.toLocaleString()})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <SwapHorizIcon sx={{ color: 'text.secondary' }} />
                      <FormControl fullWidth size="small">
                        <InputLabel>To</InputLabel>
                        <Select
                          value={transferTo}
                          label="To"
                          onChange={(e) => setTransferTo(e.target.value)}
                        >
                          <MenuItem value="Self">Self (₨{unassignedAmount.toLocaleString()})</MenuItem>
                          {localHolders.map(h => (
                            <MenuItem key={h.holderName} value={h.holderName}>
                              {h.holderName} (₨{h.amount.toLocaleString()})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <TextField
                        size="small"
                        fullWidth
                        type="number"
                        label="Amount to Transfer"
                        placeholder="0.00"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                      />
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => {
                          const amt = parseFloat(transferAmount);
                          if (isNaN(amt) || amt <= 0) {
                            setTransferError('Please enter a valid amount.');
                            return;
                          }
                          if (transferFrom === transferTo) {
                            setTransferError('Source and destination holders must be different.');
                            return;
                          }
                          const available = transferFrom === 'Self'
                            ? unassignedAmount
                            : (localHolders.find(h => h.holderName === transferFrom)?.amount ?? 0);

                          if (amt > available) {
                            setTransferError(`Insufficient funds in ${transferFrom}. (Available: ₨${available.toLocaleString()})`);
                            return;
                          }

                          const updated = localHolders.map(h => {
                            let newAmt = h.amount;
                            if (h.holderName === transferFrom) newAmt -= amt;
                            if (h.holderName === transferTo) newAmt += amt;
                            return { ...h, amount: newAmt };
                          });

                          setLocalHolders(updated);
                          setPendingTransfers([...pendingTransfers, { amount: amt, fromHolder: transferFrom, toHolder: transferTo }]);
                          setTransferAmount('');
                          setTransferError('');
                          setTransferSuccess(`Transferred ₨${amt.toLocaleString()} from ${transferFrom} to ${transferTo}!`);
                          setTimeout(() => setTransferSuccess(''), 3000);
                        }}
                        sx={{ minWidth: 100, textTransform: 'none', fontWeight: 800 }}
                      >
                        Transfer
                      </Button>
                    </Stack>

                    {transferError && (
                      <Typography color="error" variant="caption" fontWeight="bold">
                        ⚠️ {transferError}
                      </Typography>
                    )}
                    {transferSuccess && (
                      <Typography color="success.main" variant="caption" fontWeight="bold">
                        ✅ {transferSuccess}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </>
            ) : (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={hasOwnThisMoney}
                      onChange={(e) => setHasOwnThisMoney(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Typography fontSize="0.9rem" fontWeight={600}>
                      I own this money
                    </Typography>
                  }
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={isLocked}
                      onChange={(e) => setIsLocked(e.target.checked)}
                      color="error"
                    />
                  }
                  label={
                    <Box>
                      <Typography fontSize="0.9rem" fontWeight={600}>
                        Lock this Source
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Prevent any deductions or transfers from this source
                      </Typography>
                    </Box>
                  }
                />

                {!hasOwnThisMoney && (
                  <TextField
                    fullWidth
                    label="Real Owner's Name"
                    placeholder="e.g., Mother, Wife, John Doe"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && ownerName.trim() && !savingOwnership) {
                        handleSaveOwnership();
                      }
                    }}
                  />
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setEditOwnership(null)} disabled={savingOwnership}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveOwnership}
            variant="contained"
            disabled={savingOwnership || (!hasOwnThisMoney && !ownerName.trim())}
            sx={{ borderRadius: 2, fontWeight: 800, px: 4 }}
          >
            {savingOwnership ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
