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
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { LoanRecord } from '@/app/lib/interface';
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
} from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import PaymentIcon from '@mui/icons-material/Payment';
import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function LoanRecordsPage() {
  const { user } = useAuth();
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

      // Fix: borrow = toPay, lend = toReceive
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
    fetchLoans();
  }, [fetchLoans]);

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

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Please log in to view loan records.</Typography>
      </Container>
    );
  }

  // ✅ Properly typed (no `any`)
  const formatDate = (date?: Date | Timestamp | null): string => {
    if (!date) return 'N/A';

    if (date instanceof Date) {
      return date.toLocaleDateString();
    }

    if (date instanceof Timestamp) {
      return date.toDate().toLocaleDateString();
    }

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
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Link href="/finance" passHref>
          <Button
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            sx={{ textTransform: 'none' }}
          >
            Back
          </Button>
        </Link>
        <Typography variant="h4" fontWeight="bold">
          Loan Records
        </Typography>
      </Box>

      {/* Totals Summary */}
      {loading ? (
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Skeleton variant="rectangular" width="100%" height={100} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <Card
            sx={{
              flex: 1,
              minWidth: 200,
              background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Total To Pay Back
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                ₨{totals.toPay.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>

          <Card
            sx={{
              flex: 1,
              minWidth: 200,
              background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Total To Receive
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                ₨{totals.toReceive.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Active Loans */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Active Loans ({activeLoans.length})
        </Typography>

        {loading ? (
          <Stack spacing={2}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={100} />
            ))}
          </Stack>
        ) : activeLoans.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary" textAlign="center" py={2}>
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
                  elevation={2}
                  sx={{
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0'}`,
                    backgroundColor: isDark 
                      ? (loan.type === 'borrow' ? 'rgba(255, 152, 0, 0.05)' : 'rgba(76, 175, 80, 0.05)')
                      : (loan.type === 'borrow' ? '#fff3e0' : '#e8f5e8'),
                    position: 'relative',
                    overflow: 'visible',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : 4,
                    },
                  }}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 2,
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="h6" fontWeight="bold">
                            {loan.counterparty}
                          </Typography>
                          <Chip
                            label={loan.type === 'borrow' ? 'Borrow' : 'Lend'}
                            color={loan.type === 'borrow' ? 'warning' : 'success'}
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {loan.type === 'borrow' ? 'You borrowed' : 'You lent'} •
                          Due: {formatDate(loan.dueDate)}
                        </Typography>
                        {loan.note && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            mt={1}
                          >
                            Note: {loan.note}
                          </Typography>
                        )}
                        
                        {/* Progress Bar */}
                        <Box sx={{ mt: 2, mb: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              Progress: ₨{paid.toLocaleString()} / ₨{loan.amount.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" fontWeight="bold">
                              {Math.round(progress)}%
                            </Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={progress} 
                            sx={{ 
                              height: 6, 
                              borderRadius: 3,
                              bgcolor: 'rgba(0,0,0,0.05)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                              }
                            }} 
                          />
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        <Typography variant="h6" fontWeight="bold">
                          ₨{(loan.amount - paid).toLocaleString()}
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ textAlign: 'right' }}>
                            remaining
                          </Typography>
                        </Typography>
                        
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Update Progress">
                            <IconButton 
                              size="small" 
                              onClick={() => {
                                setSelectedLoan(loan);
                                setUpdateAmount(loan.paidAmount?.toString() || '0');
                                setProgressDialogOpen(true);
                              }}
                              sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
                            >
                              <PaymentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Record">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setDeleteDialogOpen(true);
                              }}
                              sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
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
          <Typography variant="h6" fontWeight="bold" mb={2}>
            Settled Loans ({settledLoans.length})
          </Typography>
          <Stack spacing={2}>
            {settledLoans.map((loan) => (
              <Card 
                key={loan.id} 
                elevation={1}
                sx={{ 
                  opacity: 0.7,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`,
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight="bold">
                        {loan.counterparty}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {loan.type === 'borrow' ? 'You borrowed' : 'You lent'} •
                        Due: {formatDate(loan.dueDate)}
                      </Typography>
                    </Box>

                    <Box sx={{ textAlign: 'right' }}>
                      <Typography
                        variant="h6"
                        sx={{ textDecoration: 'line-through' }}
                      >
                        ₨{loan.amount?.toLocaleString()}
                      </Typography>
                      <Chip label="Settled" size="small" />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* Update Progress Dialog */}
      <Dialog open={progressDialogOpen} onClose={() => !actionLoading && setProgressDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 'bold' }}>Update Progress</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Update how much has been {selectedLoan?.type === 'borrow' ? 'paid back' : 'received'} so far for this loan.
            </Typography>
            <Typography variant="subtitle2" fontWeight="bold">
              Total Loan Amount: ₨{selectedLoan?.amount.toLocaleString()}
            </Typography>
            <TextField
              fullWidth
              label="Total Paid Amount"
              type="number"
              value={updateAmount}
              onChange={(e) => setUpdateAmount(e.target.value)}
              placeholder="e.g. 5000"
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>₨</Typography>,
              }}
              disabled={actionLoading}
              autoFocus
            />
            {selectedLoan && parseFloat(updateAmount) >= selectedLoan.amount && (
              <Chip label="This will mark the loan as Settled" color="success" size="small" sx={{ alignSelf: 'flex-start' }} />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setProgressDialogOpen(false)} disabled={actionLoading}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateProgress} 
            disabled={actionLoading || !updateAmount || isNaN(parseFloat(updateAmount))}
          >
            {actionLoading ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !actionLoading && setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Delete Record?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this loan record? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleDelete}
            disabled={actionLoading}
          >
            {actionLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
