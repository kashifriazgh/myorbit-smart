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
} from '@mui/material';
import { useState } from 'react';
import { TotalCashSnapshot } from '@/app/lib/interface';
import { formatCurrency } from '@/app/lib/utilts';
import Link from 'next/link';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentsIcon from '@mui/icons-material/Payments';
import EditIcon from '@mui/icons-material/Edit';
import { db } from '@/app/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

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
  const [savingOwnership, setSavingOwnership] = useState(false);

  const handleOpenEditOwnership = (key: string, displayName: string) => {
    const current = snapshot.sourceOwnership?.[key] || { hasOwnThisMoney: true, ownerName: '' };
    setHasOwnThisMoney(current.hasOwnThisMoney !== false);
    setOwnerName(current.ownerName || current.ownserName || '');
    setEditOwnership({ key, displayName });
  };

  const handleSaveOwnership = async () => {
    if (!editOwnership || !userId || !onUpdateSnapshot) return;
    setSavingOwnership(true);
    try {
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const val = hasOwnThisMoney ? '' : ownerName.trim();
      const updatedOwnership = {
        ...(snapshot.sourceOwnership || {}),
        [editOwnership.key]: {
          hasOwnThisMoney,
          ownerName: val,
          ownserName: val,
        },
      };

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sourceOwnership: updatedOwnership,
        updatedAt: new Date(),
      };

      await setDoc(docRef, {
        ...updatedSnapshot,
        updatedAt: serverTimestamp(),
      });

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
                            <Typography fontSize="0.82rem" fontWeight={600}>
                              {bankName}
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
                            <Typography fontSize="0.82rem" fontWeight={600}>
                              {customName}
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
                    sx={{ textTransform: 'capitalize' }}
                  >
                    {name.replace('_', ' ')}
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
