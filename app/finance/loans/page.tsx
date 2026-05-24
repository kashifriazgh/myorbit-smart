'use client';

import {
  Box,
  Typography,
  Button,
  Container,
  Card,
  CardContent,
  Chip,
  Stack,
  Skeleton,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Tooltip,
  Fade,
  Avatar,
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { LoanRecord, TransactionSource, TotalCashSnapshot, CashTransaction } from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
  setDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import PaymentIcon from '@mui/icons-material/Payment';
import LockIcon from '@mui/icons-material/LockOutlined';
import LoginIcon from '@mui/icons-material/Login';
import WalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import LoanDialog from '@/app/components/finance/TotalCashSnapshot/LoanRecord';

export default function LoanRecordsPage() {
  const { user, loading: authLoading } = useAuth();
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';
  const [loading, setLoading] = useState(true);
  const [activeLoans, setActiveLoans] = useState<LoanRecord[]>([]);
  const [settledLoans, setSettledLoans] = useState<LoanRecord[]>([]);
  const [totals, setTotals] = useState({ toPay: 0, toReceive: 0 });

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(null);
  const [updateAmount, setUpdateAmount] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchLoans = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'loans'),
        where('userId', '==', user.uid),
      );

      const snap = await getDocs(q);

      const loans: LoanRecord[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<LoanRecord, 'id'>),
      }));

      const outstanding = loans.filter((l) => !l.isSettled);
      const settled = loans.filter((l) => l.isSettled);

      setActiveLoans(outstanding);
      setSettledLoans(settled);

      const toPay = outstanding
        .filter((l) => l.type === 'borrow')
        .reduce((sum, l) => sum + ((l.amount ?? 0) - (l.paidAmount ?? 0)), 0);

      const toReceive = outstanding
        .filter((l) => l.type === 'lend')
        .reduce((sum, l) => sum + ((l.amount ?? 0) - (l.paidAmount ?? 0)), 0);

      setTotals({ toPay, toReceive });
    } catch (err) {
      console.error('Error fetching loans:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchLoans();
    }
  }, [user, authLoading, fetchLoans]);

  const handleAddMoney = async (
    amount: number,
    source: TransactionSource,
    isFreezed: boolean,
    bankId?: string,
    bankName?: string,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string,
    note?: string
  ) => {
    if (!user) return;
    
    const txn: Omit<CashTransaction, 'id'> = {
      userId: user.uid,
      amount,
      type: isFreezed ? 'freeze_transfer' : 'add',
      source: isFreezed ? 'other' : source,
      category: 'manual',
      note: note || (isFreezed ? 'Freezed addition' : 'Manual addition'),
      createdAt: serverTimestamp() as Timestamp,
    };
    if (bankId && !isFreezed) txn.bankId = bankId;
    if (bankName && !isFreezed) txn.BankName = bankName;
    if (customPaymentHeadId && !isFreezed) txn.customPaymentHeadId = customPaymentHeadId;
    if (customPaymentHeadName && !isFreezed) txn.customPaymentHeadName = customPaymentHeadName;

    await addDoc(collection(db, 'cashTransactions'), txn);

    const docRef = doc(db, 'totalCashSnapshots', user.uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;
    
    const data = docSnap.data() as TotalCashSnapshot;
    const updatedSources: TotalCashSnapshot['sources'] = {
      in_hand: data.sources.in_hand ?? 0,
      bank: data.sources.bank ?? {},
      easypaisa: data.sources.easypaisa ?? 0,
      jazzcash: data.sources.jazzcash ?? 0,
      other: data.sources.other ?? 0,
      custom: data.sources.custom ?? {},
    };

    if (!isFreezed) {
      if (source === 'bank' && bankName) {
        updatedSources.bank[bankName] = (updatedSources.bank[bankName] ?? 0) + amount;
      } else if (source === 'custom' && customPaymentHeadName) {
        updatedSources.custom[customPaymentHeadName] = (updatedSources.custom[customPaymentHeadName] ?? 0) + amount;
      } else if (source !== 'bank' && source !== 'custom') {
        updatedSources[source] = ((updatedSources[source] as number) ?? 0) + amount;
      }
    }

    const updatedSnapshot: TotalCashSnapshot = {
      ...data,
      sources: updatedSources,
      freezeAmount: isFreezed ? (data.freezeAmount || 0) + amount : data.freezeAmount || 0,
      totalAmount: (data.totalAmount || 0) + amount,
      updatedAt: new Date(),
    };

    await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
  };

  const handleDelete = async () => {
    if (!selectedLoan?.id) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'loans', selectedLoan.id));
      setDeleteDialogOpen(false);
      setSelectedLoan(null);
      fetchLoans();
    } catch (err) {
      console.error('Error deleting loan:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateProgress = async () => {
    if (!selectedLoan?.id || !updateAmount) return;
    setActionLoading(true);
    try {
      const paidValue = parseFloat(updateAmount);
      const isSettled = paidValue >= selectedLoan.amount;
      
      await updateDoc(doc(db, 'loans', selectedLoan.id), {
        paidAmount: paidValue,
        isSettled,
        updatedAt: new Date(),
      });
      
      setProgressDialogOpen(false);
      setSelectedLoan(null);
      setUpdateAmount('');
      fetchLoans();
    } catch (err) {
      console.error('Error updating progress:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
        <Skeleton variant="circular" width={60} height={60} sx={{ mx: 'auto', mb: 2 }} />
        <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 4 }} />
      </Container>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 10 }}>
        <Fade in={true}>
          <Card sx={{ 
            borderRadius: 6, 
            textAlign: 'center', 
            p: 4, 
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <Avatar sx={{ 
              width: 80, 
              height: 80, 
              bgcolor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', 
              color: '#3b82f6', 
              mx: 'auto', 
              mb: 3 
            }}>
              <LockIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h5" fontWeight="900" mb={1}>
              Authentication Required
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={4}>
              Please sign in to your account to view and manage your loan records securely.
            </Typography>
            <Link href="/auth/signin" passHref>
              <Button 
                variant="contained" 
                size="large" 
                startIcon={<LoginIcon />}
                fullWidth
                sx={{ borderRadius: 3, py: 1.5, fontWeight: 800, textTransform: 'none' }}
              >
                Sign In Now
              </Button>
            </Link>
          </Card>
        </Fade>
      </Container>
    );
  }

  const formatDate = (date?: Date | Timestamp | null): string => {
    if (!date) return 'N/A';
    if (date instanceof Date) return date.toLocaleDateString();
    if (date instanceof Timestamp) return date.toDate().toLocaleDateString();
    return 'N/A';
  };

  return (
    <Container 
      maxWidth="md" 
      sx={{ 
        mt: 4, 
        mb: 4,
        py: 4,
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#f1f5f9' : '#000000',
        borderRadius: isDark ? '16px' : '0px',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Link href="/finance" passHref>
            <Button
              startIcon={<ArrowBackIcon />}
              variant="outlined"
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Back
            </Button>
          </Link>
          <Typography variant="h4" fontWeight="bold">
            Loan Records
          </Typography>
        </Box>
        <LoanDialog onAddMoney={handleAddMoney} onSuccess={fetchLoans} />
      </Box>

      {/* Totals Summary */}
      {loading ? (
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Skeleton variant="rectangular" width="100%" height={100} sx={{ borderRadius: 4 }} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <Card
            sx={{
              flex: 1,
              minWidth: 200,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
              color: 'white',
              boxShadow: '0 10px 15px -3px rgba(245, 124, 0, 0.3)'
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 700 }}>
                Total To Pay Back
              </Typography>
              <Typography variant="h4" fontWeight="900">
                ₨{totals.toPay.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>

          <Card
            sx={{
              flex: 1,
              minWidth: 200,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
              color: 'white',
              boxShadow: '0 10px 15px -3px rgba(56, 142, 60, 0.3)'
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 700 }}>
                Total To Receive
              </Typography>
              <Typography variant="h4" fontWeight="900">
                ₨{totals.toReceive.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Active Loans */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h6" fontWeight="bold" mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WalletIcon sx={{ color: '#3b82f6' }} /> Active Loans ({activeLoans.length})
        </Typography>

        {loading ? (
          <Stack spacing={2}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={100} sx={{ borderRadius: 4 }} />
            ))}
          </Stack>
        ) : activeLoans.length === 0 ? (
          <Card sx={{ borderRadius: 4, bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: '1px dashed #cbd5e1' }}>
            <CardContent>
              <Typography color="text.secondary" textAlign="center" py={4} fontWeight="600">
                No active loans found.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {activeLoans.map((loan) => {
              const paid = loan.paidAmount || 0;
              const progress = Math.min((paid / loan.amount) * 100, 100);
              
              return (
                <Card
                  key={loan.id}
                  elevation={0}
                  sx={{
                    borderRadius: 4,
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`,
                    backgroundColor: isDark 
                      ? (loan.type === 'borrow' ? 'rgba(255, 152, 0, 0.05)' : 'rgba(76, 175, 80, 0.05)')
                      : (loan.type === 'borrow' ? '#fff3e0' : '#f0fdf4'),
                    position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: isDark ? '0 20px 25px -5px rgba(0, 0, 0, 0.5)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      borderColor: loan.type === 'borrow' ? '#ff9800' : '#4caf50'
                    },
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <Typography variant="h6" fontWeight="900">
                            {loan.counterparty}
                          </Typography>
                          <Chip
                            label={loan.type === 'borrow' ? 'Borrow' : 'Lend'}
                            size="small"
                            sx={{ 
                              fontWeight: 800, 
                              bgcolor: loan.type === 'borrow' ? '#ff9800' : '#4caf50',
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" fontWeight="700">
                          {loan.type === 'borrow' ? 'RECEIVED FROM' : 'LENT TO'} • DUE: {formatDate(loan.dueDate)}
                        </Typography>
                        {loan.note && (
                          <Typography variant="body2" color="text.secondary" mt={1} sx={{ fontStyle: 'italic', opacity: 0.8 }}>
                            &quot;{loan.note}&quot;
                          </Typography>
                        )}
                        
                        <Box sx={{ mt: 3, mb: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="caption" fontWeight="800" color="text.secondary">
                              PROGRESS: ₨{paid.toLocaleString()} / ₨{loan.amount.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" fontWeight="900">
                              {Math.round(progress)}%
                            </Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={progress} 
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                bgcolor: loan.type === 'borrow' ? '#ff9800' : '#4caf50'
                              }
                            }} 
                          />
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5 }}>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="h5" fontWeight="900">
                            ₨{(loan.amount - paid).toLocaleString()}
                          </Typography>
                          <Typography variant="caption" fontWeight="800" color="text.secondary">
                            REMAINING
                          </Typography>
                        </Box>
                        
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Update Progress / Settle">
                            <IconButton 
                              onClick={() => {
                                setSelectedLoan(loan);
                                setUpdateAmount(loan.amount.toString());
                                setProgressDialogOpen(true);
                              }}
                              sx={{ bgcolor: isDark ? '#1e293b' : '#ffffff', boxShadow: 2, '&:hover': { bgcolor: '#3b82f6', color: 'white' } }}
                            >
                              <PaymentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Record">
                            <IconButton 
                              color="error"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setDeleteDialogOpen(true);
                              }}
                              sx={{ bgcolor: isDark ? '#1e293b' : '#ffffff', boxShadow: 2, '&:hover': { bgcolor: '#ef4444', color: 'white' } }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Settled Loans */}
      {settledLoans.length > 0 && (
        <Box>
          <Typography variant="h6" fontWeight="bold" mb={2} sx={{ opacity: 0.6 }}>
            Settled Loans ({settledLoans.length})
          </Typography>
          <Stack spacing={2}>
            {settledLoans.map((loan) => (
              <Card 
                key={loan.id} 
                elevation={0}
                sx={{ 
                  opacity: 0.8,
                  borderRadius: 4,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`,
                }}
              >
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight="800">
                        {loan.counterparty}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight="700">
                        {loan.type === 'borrow' ? 'BORROWED' : 'LENT'} • SETTLED ON {formatDate(loan.updatedAt || loan.dueDate)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="subtitle1" fontWeight="900" sx={{ textDecoration: 'line-through', opacity: 0.5 }}>
                          ₨{loan.amount?.toLocaleString()}
                        </Typography>
                        <Chip label="SETTLED" size="small" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 900, bgcolor: '#94a3b8', color: 'white' }} />
                      </Box>
                      <Tooltip title="Delete Record">
                        <IconButton 
                          size="small"
                          color="error"
                          onClick={() => {
                            setSelectedLoan(loan);
                            setDeleteDialogOpen(true);
                          }}
                          sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* Update Progress Dialog */}
      <Dialog open={progressDialogOpen} onClose={() => !actionLoading && setProgressDialogOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 5 } }}>
        <DialogTitle sx={{ fontWeight: '900', pt: 3 }}>Update Loan Progress</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="body2" color="text.secondary" fontWeight="600">
              Enter the total amount that has been {selectedLoan?.type === 'borrow' ? 'repaid' : 'recovered'} to date.
            </Typography>
            <Box sx={{ p: 2, bgcolor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', borderRadius: 3, border: '1px solid #3b82f6' }}>
              <Typography variant="caption" color="primary" fontWeight="800" display="block" mb={0.5}>
                ORIGINAL LOAN AMOUNT
              </Typography>
              <Typography variant="h5" fontWeight="900" color="primary">
                ₨{selectedLoan?.amount.toLocaleString()}
              </Typography>
            </Box>
            <TextField
              fullWidth
              label="Total Paid Amount"
              type="number"
              value={updateAmount}
              onChange={(e) => setUpdateAmount(e.target.value)}
              placeholder="0.00"
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1, fontWeight: 900 }}>₨</Typography>,
              }}
              disabled={actionLoading}
              autoFocus
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />
            {selectedLoan && parseFloat(updateAmount) >= selectedLoan.amount && (
              <Chip label="This will mark the loan as Settled" color="success" size="small" sx={{ alignSelf: 'flex-start', fontWeight: 800 }} />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setProgressDialogOpen(false)} disabled={actionLoading} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateProgress} 
            disabled={actionLoading || !updateAmount || isNaN(parseFloat(updateAmount))}
            sx={{ borderRadius: 3, px: 4, fontWeight: 900, textTransform: 'none' }}
          >
            {actionLoading ? 'Updating...' : 'Update Progress'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !actionLoading && setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: 5 } }}>
        <DialogTitle sx={{ fontWeight: '900', pt: 3 }}>Delete Record?</DialogTitle>
        <DialogContent>
          <Typography fontWeight="600" color="text.secondary">
            Are you sure you want to permanently delete this loan record? This action cannot be reversed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleDelete}
            disabled={actionLoading}
            sx={{ borderRadius: 3, px: 4, fontWeight: 900, textTransform: 'none' }}
          >
            {actionLoading ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
