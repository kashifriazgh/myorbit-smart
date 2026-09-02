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
  TextField
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
  const [deletingId, setDeletingId] = useState<{ type: 'bank' | 'custom' | 'fixed', name: string } | null>(null);
  const [processing, setProcessing] = useState(false);

  // New source state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newSourceType, setNewSourceType] = useState<'bank' | 'custom'>('bank');
  const [newSourceName, setNewSourceName] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  // New holder state
  const [addHolderState, setAddHolderState] = useState<{ type: 'bank' | 'custom' | 'fixed'; name: string } | null>(null);
  const [newHolderName, setNewHolderName] = useState('');
  const [addingHolder, setAddingHolder] = useState(false);

  const getSourceKey = (type: 'bank' | 'custom' | 'fixed', name: string): string => {
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
      } else {
        // Fixed sources: we just reset to 0
        amountToSubtract = updatedSources[deletingId.name] as number || 0;
        updatedSources[deletingId.name] = 0;
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
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link href="/finance" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Typography variant="body2" sx={{ '&:hover': { color: 'primary.main' } }}>Finance</Typography>
        </Link>
        <Typography variant="body2" color="text.primary">Manage Sources</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: '-1px' }}>
            Source Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and manage your cash storage locations
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button 
            startIcon={<AddIcon />} 
            variant="contained" 
            onClick={() => setAddModalOpen(true)}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            Add New Source
          </Button>
          <Link href="/finance" passHref>
            <Button startIcon={<ArrowBackIcon />} variant="outlined" sx={{ borderRadius: 2 }}>
              Back
            </Button>
          </Link>
        </Stack>
      </Box>

      <Stack spacing={3}>
        {/* Bank Accounts Section */}
        <Box>
          <Typography variant="subtitle2" fontWeight="800" color="primary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceIcon sx={{ fontSize: 18 }} /> BANK ACCOUNTS
          </Typography>
          <Card sx={{ 
            borderRadius: 3, 
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`
          }}>
            {Object.keys(snapshot.sources.bank).length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No bank accounts added</Typography>
              </Box>
            ) : (
              Object.entries(snapshot.sources.bank).map(([name, amt], idx, arr) => {
                const sourceKey = `bank:${name}`;
                const holders = snapshot.heldBy?.[sourceKey] || [];
                return (
                  <Box key={name}>
                    <Box sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="body1" fontWeight="700">{name}</Typography>
                          <Typography variant="caption" color="primary" fontWeight="800">
                            {formatCurrency(amt, 'PKR')}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Button
                            size="small"
                            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                            onClick={() => setAddHolderState({ type: 'bank', name })}
                            sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: '0.75rem', py: 0.5, fontWeight: 700 }}
                          >
                            Add Holder
                          </Button>
                          <IconButton 
                            color="error" 
                            size="small" 
                            onClick={() => setDeletingId({ type: 'bank', name })}
                            sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Box>
                      
                      {/* Holders List */}
                      {holders.length > 0 && (
                        <Box sx={{ mt: 1.5, pl: 1.5, borderLeft: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                          <Typography variant="caption" color="text.secondary" fontWeight="800" sx={{ display: 'block', mb: 0.8, letterSpacing: '0.5px' }}>
                            HOLDERS:
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                            {holders.map((h) => (
                              <Box 
                                key={h.holderName} 
                                sx={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  px: 1.2, 
                                  py: 0.5, 
                                  borderRadius: 1.5, 
                                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`
                                }}
                              >
                                <Typography variant="caption" fontWeight="600" sx={{ mr: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  👤 {h.holderName}
                                </Typography>
                                <Typography variant="caption" color="primary" fontWeight="700" sx={{ mr: 0.5 }}>
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
                    {idx < arr.length - 1 && <Divider sx={{ opacity: 0.5 }} />}
                  </Box>
                );
              })
            )}
          </Card>
        </Box>

        {/* Custom Heads Section */}
        <Box>
          <Typography variant="subtitle2" fontWeight="800" color="secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaymentsIcon sx={{ fontSize: 18 }} /> CUSTOM PAYMENT HEADS
          </Typography>
          <Card sx={{ 
            borderRadius: 3, 
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`
          }}>
            {Object.keys(snapshot.sources.custom).length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No custom payment heads added</Typography>
              </Box>
            ) : (
              Object.entries(snapshot.sources.custom).map(([name, amt], idx, arr) => {
                const sourceKey = `custom:${name}`;
                const holders = snapshot.heldBy?.[sourceKey] || [];
                return (
                  <Box key={name}>
                    <Box sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="body1" fontWeight="700">{name}</Typography>
                          <Typography variant="caption" color="secondary" fontWeight="800">
                            {formatCurrency(amt, 'PKR')}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Button
                            size="small"
                            color="secondary"
                            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                            onClick={() => setAddHolderState({ type: 'custom', name })}
                            sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: '0.75rem', py: 0.5, fontWeight: 700 }}
                          >
                            Add Holder
                          </Button>
                          <IconButton 
                            color="error" 
                            size="small" 
                            onClick={() => setDeletingId({ type: 'custom', name })}
                            sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Box>
                      
                      {/* Holders List */}
                      {holders.length > 0 && (
                        <Box sx={{ mt: 1.5, pl: 1.5, borderLeft: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                          <Typography variant="caption" color="text.secondary" fontWeight="800" sx={{ display: 'block', mb: 0.8, letterSpacing: '0.5px' }}>
                            HOLDERS:
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                            {holders.map((h) => (
                              <Box 
                                key={h.holderName} 
                                sx={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  px: 1.2, 
                                  py: 0.5, 
                                  borderRadius: 1.5, 
                                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`
                                }}
                              >
                                <Typography variant="caption" fontWeight="600" sx={{ mr: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  👤 {h.holderName}
                                </Typography>
                                <Typography variant="caption" color="secondary" fontWeight="700" sx={{ mr: 0.5 }}>
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
                    {idx < arr.length - 1 && <Divider sx={{ opacity: 0.5 }} />}
                  </Box>
                );
              })
            )}
          </Card>
        </Box>

        {/* Fixed Sources Section */}
        <Box>
          <Typography variant="subtitle2" fontWeight="800" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <WalletIcon sx={{ fontSize: 18 }} /> FIXED CHANNELS
          </Typography>
          <Card sx={{ 
            borderRadius: 3, 
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`
          }}>
            {['in_hand', 'easypaisa', 'jazzcash', 'other'].map((name, idx, arr) => {
              const amt = snapshot.sources[name] as number;
              const sourceKey = name;
              const holders = snapshot.heldBy?.[sourceKey] || [];
              return (
                <Box key={name}>
                  <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body1" fontWeight="700" sx={{ textTransform: 'capitalize' }}>
                          {name.replace('_', ' ')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight="800">
                          {formatCurrency(amt, 'PKR')}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button
                          size="small"
                          color="inherit"
                          startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                          onClick={() => setAddHolderState({ type: 'fixed', name })}
                          sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: '0.75rem', py: 0.5, fontWeight: 700 }}
                        >
                          Add Holder
                        </Button>
                        {amt > 0 && (
                          <IconButton 
                            color="warning" 
                            size="small" 
                            onClick={() => setDeletingId({ type: 'fixed', name })}
                            sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.2)' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </Box>
                    
                    {/* Holders List */}
                    {holders.length > 0 && (
                      <Box sx={{ mt: 1.5, pl: 1.5, borderLeft: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="800" sx={{ display: 'block', mb: 0.8, letterSpacing: '0.5px' }}>
                          HOLDERS:
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                          {holders.map((h) => (
                            <Box 
                              key={h.holderName} 
                              sx={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                px: 1.2, 
                                py: 0.5, 
                                borderRadius: 1.5, 
                                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`
                              }}
                            >
                              <Typography variant="caption" fontWeight="600" sx={{ mr: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                👤 {h.holderName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" fontWeight="700" sx={{ mr: 0.5 }}>
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
                  {idx < arr.length - 1 && <Divider sx={{ opacity: 0.5 }} />}
                </Box>
              );
            })}
          </Card>
        </Box>
      </Stack>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingId}
        onClose={() => !processing && setDeletingId(null)}
        PaperProps={{
          sx: { borderRadius: 3, p: 1, maxWidth: 400 }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          <Typography variant="h6" fontWeight="800">Confirm Deletion</Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deletingId?.name.replace('_', ' ')}</strong>?
            {deletingId?.type !== 'fixed' ? (
              <> This will permanently remove this source head.</>
            ) : (
              <> This will reset the balance of this channel to zero.</>
            )}
          </DialogContentText>
          
          {(deletingId?.type === 'bank' ? snapshot.sources.bank[deletingId.name] : 
            deletingId?.type === 'custom' ? snapshot.sources.custom[deletingId.name] : 
            snapshot.sources[deletingId?.name || '']) > 0 && (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
              This source has a balance. Deleting it will deduct this amount from your <strong>Total Cash Snapshot</strong>.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
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
            sx={{ borderRadius: 2, fontWeight: 800, px: 3 }}
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
          sx: { borderRadius: 4, p: 1, maxWidth: 450 }
        }}
      >
        <Box sx={{ p: 2, pb: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', color: 'white' }}>
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
            sx={{ borderRadius: 2, fontWeight: 800, px: 4 }}
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
          sx: { borderRadius: 4, p: 1, maxWidth: 450 }
        }}
      >
        <Box sx={{ p: 2, pb: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', color: 'white' }}>
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
              placeholder="e.g., Ali, Mother, Wife, Self"
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
            sx={{ borderRadius: 2, fontWeight: 800, px: 4 }}
            startIcon={addingHolder ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {addingHolder ? 'Adding...' : 'Add Holder'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
