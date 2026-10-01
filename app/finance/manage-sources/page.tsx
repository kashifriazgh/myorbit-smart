'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Container, 
  IconButton, 
  Button, 
  Stack, 
  Card, 
  Divider, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions,
  CircularProgress,
  Breadcrumbs,
  Alert,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Switch,
  FormControlLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentsIcon from '@mui/icons-material/Payments';
import WalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WarningIcon from '@mui/icons-material/Warning';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import CloseIcon from '@mui/icons-material/Close';
import LockIcon from '@mui/icons-material/Lock';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import EditIcon from '@mui/icons-material/Edit';
import Link from 'next/link';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useGoals } from '@/app/lib/context/GoalsContext';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, addDoc, collection, Timestamp } from 'firebase/firestore';
import { TotalCashSnapshot } from '@/app/lib/interface';
import { formatCurrency } from '@/app/lib/utilts';

export default function ManageSourcesPage() {
  const { user } = useAuth();
  const { goals } = useGoals();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  
  const [snapshot, setSnapshot] = useState<TotalCashSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<{ type: 'bank' | 'custom', name: string } | null>(null);
  const [processing, setProcessing] = useState(false);

  // New source state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newSourceType, setNewSourceType] = useState<'bank' | 'custom'>('bank');
  const [newSourceName, setNewSourceName] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  // Edit Bank Owner state
  const [editBankOwnerState, setEditBankOwnerState] = useState<{
    name: string;
    isSelf: boolean;
    ownerName: string;
  } | null>(null);
  const [savingBankOwner, setSavingBankOwner] = useState(false);

  // New holder state (Custom heads only)
  const [addHolderState, setAddHolderState] = useState<{ type: 'custom'; name: string } | null>(null);
  const [newHolderName, setNewHolderName] = useState('');
  const [addingHolder, setAddingHolder] = useState(false);

  const getSourceKey = (type: 'bank' | 'custom', name: string): string => {
    if (type === 'bank') return `bank:${name}`;
    if (type === 'custom') return `custom:${name}`;
    return name;
  };

  useEffect(() => {
    if (!user) return;

    const fetchSnapshot = async () => {
      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSnapshot(docSnap.data() as TotalCashSnapshot);
      }
      setLoading(false);
    };

    fetchSnapshot();
  }, [user]);

  const handleDeleteSource = async () => {
    if (!deletingId || !snapshot || !user) return;

    // Protection check: Check if custom source is linked to a Goal
    if (deletingId.type === 'custom') {
      const srcNameClean = deletingId.name.trim().toLowerCase();
      const linkedGoal = (goals || []).find((g) => {
        if (g.linkedSourceId && g.linkedSourceId.trim().toLowerCase() === srcNameClean) return true;
        return (g.steps || []).some((s) => {
          if (s.linkedType === 'finance_source' && s.title) {
            const name = s.title.replace(/^Source of Fund:\s*/i, '').replace(/^Finance Fund:\s*/i, '').trim().toLowerCase();
            return name === srcNameClean;
          }
          return false;
        });
      });

      if (linkedGoal) {
        alert(`⚠️ Cannot delete source "${deletingId.name}". It is associated with Goal "${linkedGoal.title}". Please delete or remove the Source of Fund milestone from the Goal detail page first.`);
        setDeletingId(null);
        return;
      }
    }

    setProcessing(true);

    try {
      const updatedSources = { ...snapshot.sources };
      let amountToSubtract = 0;

      if (deletingId.type === 'bank') {
        amountToSubtract = updatedSources.bank[deletingId.name] || 0;
        const newBank = { ...updatedSources.bank };
        delete newBank[deletingId.name];
        updatedSources.bank = newBank;
      } else if (deletingId.type === 'custom') {
        amountToSubtract = updatedSources.custom[deletingId.name] || 0;
        const newCustom = { ...updatedSources.custom };
        delete newCustom[deletingId.name];
        updatedSources.custom = newCustom;
      }

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sources: updatedSources,
        totalAmount: snapshot.totalAmount - amountToSubtract,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      await setDoc(docRef, { 
        ...updatedSnapshot, 
        updatedAt: serverTimestamp() 
      });

      setSnapshot(updatedSnapshot);
      setDeletingId(null);
    } catch (err) {
      console.error('Error deleting source:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddSource = async () => {
    if (!newSourceName.trim() || !user || !snapshot) return;
    setAddingSource(true);

    try {
      const name = newSourceName.trim();
      const collectionName = newSourceType === 'bank' ? 'banks' : 'customPaymentHeads';
      
      // 1. Add to dedicated collection
      await addDoc(collection(db, collectionName), {
        userId: user.uid,
        name,
        createdAt: Timestamp.now(),
      });

      // 2. Update snapshot sources with 0 balance
      const updatedSources = { ...snapshot.sources };
      if (newSourceType === 'bank') {
        updatedSources.bank = { ...updatedSources.bank, [name]: 0 };
      } else {
        updatedSources.custom = { ...updatedSources.custom, [name]: 0 };
      }

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sources: updatedSources,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      await setDoc(docRef, { 
        ...updatedSnapshot, 
        updatedAt: serverTimestamp() 
      });

      setSnapshot(updatedSnapshot);
      setAddModalOpen(false);
      setNewSourceName('');
    } catch (err) {
      console.error('Error adding source:', err);
    } finally {
      setAddingSource(false);
    }
  };

  const handleSaveBankOwner = async () => {
    if (!editBankOwnerState || !user || !snapshot) return;
    setSavingBankOwner(true);

    try {
      const { name, isSelf, ownerName } = editBankOwnerState;
      const sourceKey = `bank:${name}`;
      const cleanOwnerName = isSelf ? '' : ownerName.trim();

      const currentOwnership = snapshot.sourceOwnership || {};
      const updatedOwnership = {
        ...currentOwnership,
        [sourceKey]: {
          hasOwnThisMoney: isSelf,
          ownerName: cleanOwnerName,
          ownserName: cleanOwnerName,
          isLocked: currentOwnership[sourceKey]?.isLocked || false,
        },
      };

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sourceOwnership: updatedOwnership,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      await setDoc(docRef, {
        ...updatedSnapshot,
        updatedAt: serverTimestamp(),
      });

      setSnapshot(updatedSnapshot);
      setEditBankOwnerState(null);
    } catch (err) {
      console.error('Error updating bank ownership:', err);
      alert('Failed to save bank ownership.');
    } finally {
      setSavingBankOwner(false);
    }
  };

  const handleAddHolder = async () => {
    if (!newHolderName.trim() || !addHolderState || !user || !snapshot) return;
    setAddingHolder(true);

    try {
      const name = newHolderName.trim();
      const sourceKey = getSourceKey(addHolderState.type, addHolderState.name);
      
      const updatedHeldBy = snapshot.heldBy ? { ...snapshot.heldBy } : {};
      const holders = [...(updatedHeldBy[sourceKey] || [])];
      
      // Check if holder already exists
      if (holders.some(h => h.holderName.toLowerCase() === name.toLowerCase())) {
        alert('Holder with this name already exists in this source.');
        setAddingHolder(false);
        return;
      }
      
      holders.push({ holderName: name, amount: 0 });
      updatedHeldBy[sourceKey] = holders;

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        heldBy: updatedHeldBy,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      await setDoc(docRef, { 
        ...updatedSnapshot, 
        updatedAt: serverTimestamp() 
      });

      setSnapshot(updatedSnapshot);
      setAddHolderState(null);
      setNewHolderName('');
    } catch (err) {
      console.error('Error adding holder:', err);
    } finally {
      setAddingHolder(false);
    }
  };

  const handleDeleteHolder = async (sourceKey: string, holderName: string) => {
    if (!snapshot || !user) return;
    
    const holders = snapshot.heldBy?.[sourceKey] || [];
    const holder = holders.find(h => h.holderName === holderName);
    if (!holder) return;

    if (holder.amount > 0) {
      alert(`Cannot delete holder with non-zero balance. Please transfer or deduct the balance first.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete holder "${holderName}"?`)) return;

    try {
      const updatedHeldBy = { ...snapshot.heldBy };
      updatedHeldBy[sourceKey] = holders.filter(h => h.holderName !== holderName);

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        heldBy: updatedHeldBy,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      await setDoc(docRef, { 
        ...updatedSnapshot, 
        updatedAt: serverTimestamp() 
      });

      setSnapshot(updatedSnapshot);
    } catch (err) {
      console.error('Error deleting holder:', err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!snapshot) return null;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2.5, sm: 4 }, px: { xs: 2, sm: 3 } }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumbs sx={{ mb: 2.5 }}>
        <Link href="/finance" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Typography variant="body2" sx={{ '&:hover': { color: 'primary.main' } }}>Finance</Typography>
        </Link>
        <Typography variant="body2" color="text.primary" fontWeight={700}>Manage Sources</Typography>
      </Breadcrumbs>

      {/* Mobile-first Header */}
      <Box 
        sx={{ 
          mb: 3.5, 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' }, 
          alignItems: { xs: 'stretch', sm: 'center' }, 
          justifyContent: 'space-between',
          gap: 2 
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: '-0.5px', fontSize: { xs: '1.6rem', sm: '2.125rem' } }}>
            Source Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and manage your cash storage locations & holders
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Button 
            startIcon={<AddIcon />} 
            variant="contained" 
            onClick={() => setAddModalOpen(true)}
            sx={{ 
              borderRadius: 2.5, 
              fontWeight: 800, 
              flex: { xs: 1, sm: 'initial' },
              py: 1,
              px: 2.5,
              fontSize: '0.875rem'
            }}
          >
            Add Source
          </Button>
          <Link href="/finance" passHref style={{ textDecoration: 'none' }}>
            <Button 
              startIcon={<ArrowBackIcon />} 
              variant="outlined" 
              sx={{ borderRadius: 2.5, fontWeight: 700, py: 1, px: 2 }}
            >
              Back
            </Button>
          </Link>
        </Stack>
      </Box>

      <Stack spacing={3}>
        {/* Built-in Channels Section (Strictly Self Owned Only) */}
        <Box>
          <Typography 
            variant="caption" 
            fontWeight="800" 
            color="text.secondary" 
            sx={{ mb: 1.2, display: 'flex', alignItems: 'center', gap: 0.8, textTransform: 'uppercase', letterSpacing: '0.8px' }}
          >
            <LockIcon sx={{ fontSize: 15 }} /> BUILT-IN CHANNELS
          </Typography>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 3, 
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              backgroundImage: 'none',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
              overflow: 'hidden'
            }}
          >
            {['in_hand', 'easypaisa', 'jazzcash', 'other'].map((name, idx, arr) => {
              const amt = (snapshot.sources[name] as number) ?? 0;
              return (
                <Box key={name}>
                  <Box 
                    sx={{ 
                      p: { xs: 2, sm: 2.5 }, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      gap: 2
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Avatar 
                        sx={{ 
                          width: 40, 
                          height: 40, 
                          bgcolor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff', 
                          color: 'primary.main',
                          borderRadius: 2.5
                        }}
                      >
                        <WalletIcon sx={{ fontSize: 20 }} />
                      </Avatar>
                      <Box>
                        <Typography variant="body1" fontWeight="700" sx={{ textTransform: 'capitalize', fontSize: { xs: '0.92rem', sm: '1rem' } }}>
                          {name.replace('_', ' ')}
                        </Typography>
                        <Chip 
                          label="Self Owned Only" 
                          size="small" 
                          sx={{ 
                            height: 18, 
                            fontSize: '0.65rem', 
                            fontWeight: 700, 
                            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                            color: isDark ? '#94a3b8' : 'text.secondary',
                            mt: 0.3
                          }} 
                        />
                      </Box>
                    </Box>
                    <Typography variant="subtitle1" fontWeight="900" color="text.primary" sx={{ fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
                      {formatCurrency(amt, 'PKR')}
                    </Typography>
                  </Box>
                  {idx < arr.length - 1 && <Divider sx={{ opacity: isDark ? 0.2 : 0.5 }} />}
                </Box>
              );
            })}
          </Card>
        </Box>

        {/* Bank Accounts Section (Editable Ownership Label) */}
        <Box>
          <Typography 
            variant="caption" 
            fontWeight="800" 
            color="primary" 
            sx={{ mb: 1.2, display: 'flex', alignItems: 'center', gap: 0.8, textTransform: 'uppercase', letterSpacing: '0.8px' }}
          >
            <AccountBalanceIcon sx={{ fontSize: 16 }} /> BANK ACCOUNTS
          </Typography>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 3, 
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              backgroundImage: 'none',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
              overflow: 'hidden'
            }}
          >
            {Object.keys(snapshot.sources.bank || {}).length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <AccountBalanceIcon sx={{ fontSize: 32, color: 'text.secondary', opacity: 0.4, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No bank accounts added yet</Typography>
                <Button 
                  size="small" 
                  startIcon={<AddIcon />} 
                  onClick={() => { setNewSourceType('bank'); setAddModalOpen(true); }}
                  sx={{ mt: 1.5, fontWeight: 700, borderRadius: 2 }}
                >
                  Add Bank Account
                </Button>
              </Box>
            ) : (
              Object.entries(snapshot.sources.bank).map(([name, amt], idx, arr) => {
                const sourceKey = `bank:${name}`;
                const ownership = snapshot.sourceOwnership?.[sourceKey];
                const isSelfOwned = ownership ? ownership.hasOwnThisMoney !== false : true;
                const ownerNameVal = ownership?.ownerName || ownership?.ownserName || '';
                const chipLabel = isSelfOwned ? 'My Self Account' : `${ownerNameVal} Account`;

                return (
                  <Box key={name}>
                    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          gap: 1.5 
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Avatar 
                            sx={{ 
                              width: 40, 
                              height: 40, 
                              bgcolor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', 
                              color: '#3b82f6',
                              borderRadius: 2.5
                            }}
                          >
                            <AccountBalanceIcon sx={{ fontSize: 20 }} />
                          </Avatar>
                          <Box>
                            <Typography variant="body1" fontWeight="700" sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                              {name}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={1} mt={0.3}>
                              <Typography variant="caption" color="primary" fontWeight="800">
                                {formatCurrency(amt, 'PKR')}
                              </Typography>
                              <Chip 
                                icon={<PersonOutlineIcon sx={{ fontSize: '11px !important', color: 'inherit' }} />}
                                label={chipLabel} 
                                size="small" 
                                onClick={() => setEditBankOwnerState({
                                  name,
                                  isSelf: isSelfOwned,
                                  ownerName: ownerNameVal
                                })}
                                title="Click to change account owner"
                                sx={{ 
                                  height: 20, 
                                  fontSize: '0.67rem', 
                                  fontWeight: 700, 
                                  cursor: 'pointer',
                                  bgcolor: isSelfOwned
                                    ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff')
                                    : (isDark ? 'rgba(245,158,11,0.15)' : '#fffbeb'),
                                  color: isSelfOwned
                                    ? (isDark ? '#93c5fd' : '#1d4ed8')
                                    : (isDark ? '#fcd34d' : '#b45309'),
                                  border: `1px solid ${
                                    isSelfOwned
                                      ? (isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe')
                                      : (isDark ? 'rgba(245,158,11,0.3)' : '#fde68a')
                                  }`,
                                  '&:hover': {
                                    filter: 'brightness(0.95)'
                                  }
                                }} 
                              />
                            </Box>
                          </Box>
                        </Box>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <IconButton
                            size="small"
                            onClick={() => setEditBankOwnerState({
                              name,
                              isSelf: isSelfOwned,
                              ownerName: ownerNameVal
                            })}
                            sx={{ p: 0.8, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                            title="Edit Owner"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            color="error" 
                            size="small" 
                            onClick={() => setDeletingId({ type: 'bank', name })}
                            sx={{ bgcolor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.25)' }, p: 0.8 }}
                            title="Delete Source"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Box>
                    </Box>
                    {idx < arr.length - 1 && <Divider sx={{ opacity: isDark ? 0.2 : 0.5 }} />}
                  </Box>
                );
              })
            )}
          </Card>
        </Box>

        {/* Custom Heads Section (Has Add Holder & Custom Holders) */}
        <Box>
          <Typography 
            variant="caption" 
            fontWeight="800" 
            color="secondary" 
            sx={{ mb: 1.2, display: 'flex', alignItems: 'center', gap: 0.8, textTransform: 'uppercase', letterSpacing: '0.8px' }}
          >
            <PaymentsIcon sx={{ fontSize: 16 }} /> CUSTOM PAYMENT HEADS
          </Typography>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 3, 
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              backgroundImage: 'none',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
              overflow: 'hidden'
            }}
          >
            {Object.keys(snapshot.sources.custom || {}).length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <PaymentsIcon sx={{ fontSize: 32, color: 'text.secondary', opacity: 0.4, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No custom payment heads added yet</Typography>
                <Button 
                  size="small" 
                  color="secondary"
                  startIcon={<AddIcon />} 
                  onClick={() => { setNewSourceType('custom'); setAddModalOpen(true); }}
                  sx={{ mt: 1.5, fontWeight: 700, borderRadius: 2 }}
                >
                  Add Custom Source
                </Button>
              </Box>
            ) : (
              Object.entries(snapshot.sources.custom).map(([name, amt], idx, arr) => {
                const sourceKey = `custom:${name}`;
                const holders = snapshot.heldBy?.[sourceKey] || [];
                return (
                  <Box key={name}>
                    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          flexDirection: { xs: 'column', sm: 'row' }, 
                          alignItems: { xs: 'flex-start', sm: 'center' }, 
                          justifyContent: 'space-between',
                          gap: 1.5 
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Avatar 
                            sx={{ 
                              width: 40, 
                              height: 40, 
                              bgcolor: isDark ? 'rgba(168,85,247,0.15)' : '#faf5ff', 
                              color: '#a855f7',
                              borderRadius: 2.5
                            }}
                          >
                            <PaymentsIcon sx={{ fontSize: 20 }} />
                          </Avatar>
                          <Box>
                            <Typography variant="body1" fontWeight="700" sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                              {name}
                            </Typography>
                            <Typography variant="caption" color="secondary" fontWeight="800">
                              {formatCurrency(amt, 'PKR')}
                            </Typography>
                          </Box>
                        </Box>
                        <Stack 
                          direction="row" 
                          spacing={1} 
                          alignItems="center" 
                          sx={{ 
                            width: { xs: '100%', sm: 'auto' }, 
                            justifyContent: { xs: 'space-between', sm: 'flex-end' },
                            pt: { xs: 0.5, sm: 0 }
                          }}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                            onClick={() => setAddHolderState({ type: 'custom', name })}
                            sx={{ 
                              borderRadius: 2, 
                              textTransform: 'none', 
                              fontSize: '0.75rem', 
                              py: 0.6, 
                              px: 1.5,
                              fontWeight: 700 
                            }}
                          >
                            Add Holder
                          </Button>
                          <IconButton 
                            color="error" 
                            size="small" 
                            onClick={() => setDeletingId({ type: 'custom', name })}
                            sx={{ bgcolor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.25)' }, p: 0.8 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Box>
                      
                      {/* Holders List */}
                      {holders.length > 0 && (
                        <Box sx={{ mt: 2, pl: 1.5, borderLeft: `2.5px solid ${isDark ? 'rgba(168,85,247,0.3)' : '#e9d5ff'}` }}>
                          <Typography variant="caption" color="text.secondary" fontWeight="800" sx={{ display: 'block', mb: 1, letterSpacing: '0.5px' }}>
                            SECONDARY HOLDERS:
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                            {holders.map((h) => (
                              <Box 
                                key={h.holderName} 
                                sx={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  px: 1.2, 
                                  py: 0.6, 
                                  borderRadius: 2, 
                                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`
                                }}
                              >
                                <Typography variant="caption" fontWeight="600" sx={{ mr: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  👤 {h.holderName}
                                </Typography>
                                <Typography variant="caption" color="secondary" fontWeight="800" sx={{ mr: 0.5 }}>
                                  {formatCurrency(h.amount, 'PKR')}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteHolder(sourceKey, h.holderName)}
                                  sx={{ 
                                    p: 0.2, 
                                    ml: 0.5, 
                                    color: 'text.secondary', 
                                    '&:hover': { color: 'error.main', bgcolor: 'rgba(239,68,68,0.08)' } 
                                  }}
                                >
                                  <CloseIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Box>
                    {idx < arr.length - 1 && <Divider sx={{ opacity: isDark ? 0.2 : 0.5 }} />}
                  </Box>
                );
              })
            )}
          </Card>
        </Box>
      </Stack>

      {/* Edit Bank Owner Dialog */}
      <Dialog
        open={!!editBankOwnerState}
        onClose={() => !savingBankOwner && setEditBankOwnerState(null)}
        PaperProps={{
          sx: { 
            borderRadius: 4, 
            p: 1, 
            maxWidth: 420, 
            width: '100%',
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f8fafc' : 'inherit',
            backgroundImage: 'none',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none'
          }
        }}
      >
        <Box sx={{ p: 2, pb: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 2.5 }}>
            <AccountBalanceIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="900">Bank Account Owner</Typography>
            <Typography variant="caption" color="text.secondary">
              Configure owner for {editBankOwnerState?.name}
            </Typography>
          </Box>
        </Box>

        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={editBankOwnerState?.isSelf ?? true}
                  onChange={(e) =>
                    setEditBankOwnerState((prev) =>
                      prev ? { ...prev, isSelf: e.target.checked } : null
                    )
                  }
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography fontSize="0.9rem" fontWeight={700}>
                    I own this account (My Self Account)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    This balance will be counted towards &quot;I Own&quot; total
                  </Typography>
                </Box>
              }
            />

            {!editBankOwnerState?.isSelf && (
              <TextField
                fullWidth
                label="Owner's Name"
                placeholder="e.g., Wife, Mother, Brother"
                value={editBankOwnerState?.ownerName || ''}
                onChange={(e) =>
                  setEditBankOwnerState((prev) =>
                    prev ? { ...prev, ownerName: e.target.value } : null
                  )
                }
                autoFocus
                helperText="Funds in accounts owned by others will not be counted in your 'I Own' balance"
              />
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setEditBankOwnerState(null)} disabled={savingBankOwner}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveBankOwner} 
            variant="contained" 
            disabled={
              savingBankOwner ||
              (!editBankOwnerState?.isSelf && !editBankOwnerState?.ownerName.trim())
            }
            sx={{ borderRadius: 2.5, fontWeight: 800, px: 4 }}
            startIcon={savingBankOwner ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {savingBankOwner ? 'Saving...' : 'Save Ownership'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingId}
        onClose={() => !processing && setDeletingId(null)}
        PaperProps={{
          sx: { 
            borderRadius: 4, 
            p: 1, 
            maxWidth: 420, 
            width: '100%',
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f8fafc' : 'inherit',
            backgroundImage: 'none',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          <Typography variant="h6" fontWeight="800">Confirm Deletion</Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: isDark ? '#94a3b8' : 'text.secondary' }}>
            Are you sure you want to delete <strong>{deletingId?.name}</strong>? This will permanently remove this source head.
          </DialogContentText>
          
          {deletingId && (
            (deletingId.type === 'bank' ? snapshot.sources.bank[deletingId.name] : snapshot.sources.custom[deletingId.name]) > 0
          ) && (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
              This source has an active balance. Deleting it will deduct this amount from your <strong>Total Cash Snapshot</strong>.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1, gap: 1 }}>
          <Button 
            onClick={() => setDeletingId(null)} 
            disabled={processing}
            sx={{ fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteSource} 
            color="error" 
            variant="contained"
            disabled={processing}
            sx={{ borderRadius: 2.5, fontWeight: 800, px: 3 }}
            startIcon={processing ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
          >
            {processing ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Source Dialog */}
      <Dialog
        open={addModalOpen}
        onClose={() => !addingSource && setAddModalOpen(false)}
        PaperProps={{
          sx: { 
            borderRadius: 4, 
            p: 1, 
            maxWidth: 450, 
            width: '100%',
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f8fafc' : 'inherit',
            backgroundImage: 'none',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none'
          }
        }}
      >
        <Box sx={{ p: 2, pb: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 2.5 }}>
            <AddIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="900">New Financial Source</Typography>
            <Typography variant="caption" color="text.secondary">Create a new location to track funds</Typography>
          </Box>
        </Box>

        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <FormControl fullWidth>
              <InputLabel>Source Type</InputLabel>
              <Select
                value={newSourceType}
                label="Source Type"
                onChange={(e) => setNewSourceType(e.target.value as 'bank' | 'custom')}
              >
                <MenuItem value="bank">Bank Account</MenuItem>
                <MenuItem value="custom">Custom Payment Head</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label={newSourceType === 'bank' ? "Bank Name" : "Source Name"}
              placeholder={newSourceType === 'bank' ? "e.g., HBL, Meezan, SCB" : "e.g., Personal Wallet, Office Drawer"}
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              autoFocus
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setAddModalOpen(false)} disabled={addingSource}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddSource} 
            variant="contained" 
            disabled={addingSource || !newSourceName.trim()}
            sx={{ borderRadius: 2.5, fontWeight: 800, px: 4 }}
            startIcon={addingSource ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {addingSource ? 'Creating...' : 'Create Source'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Holder Dialog */}
      <Dialog
        open={!!addHolderState}
        onClose={() => !addingHolder && setAddHolderState(null)}
        PaperProps={{
          sx: { 
            borderRadius: 4, 
            p: 1, 
            maxWidth: 450, 
            width: '100%',
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f8fafc' : 'inherit',
            backgroundImage: 'none',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none'
          }
        }}
      >
        <Box sx={{ p: 2, pb: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 2.5 }}>
            <PersonIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="900">Add New Holder</Typography>
            <Typography variant="caption" color="text.secondary">
              Assign a holder to {addHolderState?.name}
            </Typography>
          </Box>
        </Box>

        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Holder Name"
              placeholder="e.g., Ali, Mother, Wife"
              value={newHolderName}
              onChange={(e) => setNewHolderName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newHolderName.trim() && !addingHolder) {
                  handleAddHolder();
                }
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setAddHolderState(null)} disabled={addingHolder}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddHolder} 
            variant="contained" 
            disabled={addingHolder || !newHolderName.trim()}
            sx={{ borderRadius: 2.5, fontWeight: 800, px: 4 }}
            startIcon={addingHolder ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {addingHolder ? 'Adding...' : 'Add Holder'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
