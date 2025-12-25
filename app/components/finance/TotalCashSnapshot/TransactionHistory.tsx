'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Chip,
  
  IconButton,
  useTheme,
  useMediaQuery,
  Paper,
  Avatar,
  Fade,
} from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp,
  TrendingDown,
  SwapHoriz,
  History,
} from '@mui/icons-material';
import { db } from '@/app/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { CashTransaction } from '@/app/lib/interface';
import { formatCurrency } from '@/app/lib/utilts';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface TransactionHistoryProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  open,
  onClose,
  userId,
}) => {
  const { theme } = useCustomTheme();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);

  useEffect(() => {
    if (!open || !userId) return;

    const fetchTransactions = async () => {
      setLoading(true);
      try {
        // Calculate date 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);

        // Query with date filter (can filter on same field multiple times)
        const q = query(
          collection(db, 'cashTransactions'),
          where('createdAt', '>=', thirtyDaysAgoTimestamp),
          orderBy('createdAt', 'desc'),
          limit(1000) // Reasonable limit for 30 days
        );

        const querySnapshot = await getDocs(q);
        const fetchedTransactions: CashTransaction[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Filter by userId on client-side
          if (data.userId === userId) {
            fetchedTransactions.push({
              id: doc.id,
              ...data,
              createdAt:
                data.createdAt instanceof Timestamp
                  ? data.createdAt.toDate()
                  : new Date(data.createdAt),
            } as CashTransaction);
          }
        });

        // Sort by date (most recent first)
        fetchedTransactions.sort((a, b) => {
          const dateA = a.createdAt instanceof Date 
            ? a.createdAt 
            : (a.createdAt instanceof Timestamp ? a.createdAt.toDate() : new Date());
          const dateB = b.createdAt instanceof Date 
            ? b.createdAt 
            : (b.createdAt instanceof Timestamp ? b.createdAt.toDate() : new Date());
          return dateB.getTime() - dateA.getTime();
        });

        setTransactions(fetchedTransactions);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [open, userId]);

  const getTransactionColor = (type: string, note?: string): string => {
    // Check if it's a loan transaction
    const isLoanBorrow = note?.toLowerCase().includes('loan borrow');
    const isLoanLend = note?.toLowerCase().includes('loan lend');

    if (type === 'add' || isLoanBorrow) {
      return '#10b981'; // Green for add/borrow
    } else if (type === 'deduct' || isLoanLend) {
      return '#ef4444'; // Red for deduct/lend
    } else if (type === 'freeze_transfer') {
      return '#8b5cf6'; // Purple for freeze transfer
    }
    return '#6b7280'; // Default gray
  };

  const getTransactionIcon = (type: string, note?: string) => {
    const isLoanBorrow = note?.toLowerCase().includes('loan borrow');
    const isLoanLend = note?.toLowerCase().includes('loan lend');

    if (type === 'add' || isLoanBorrow) {
      return <TrendingUp />;
    } else if (type === 'deduct' || isLoanLend) {
      return <TrendingDown />;
    } else if (type === 'freeze_transfer') {
      return <SwapHoriz />;
    }
    return <History />;
  };

  const getTransactionLabel = (type: string, note?: string): string => {
    const isLoanBorrow = note?.toLowerCase().includes('loan borrow');
    const isLoanLend = note?.toLowerCase().includes('loan lend');

    if (isLoanBorrow) return 'Borrowed';
    if (isLoanLend) return 'Lent';
    if (type === 'add') return 'Added';
    if (type === 'deduct') return 'Deducted';
    if (type === 'freeze_transfer') return 'Frozen Transfer';
    return type;
  };

  const getSourceDisplayName = (transaction: CashTransaction): string => {
    if (transaction.source === 'bank' && transaction.BankName) {
      return `Bank (${transaction.BankName})`;
    }
    if (transaction.source === 'custom' && transaction.customPaymentHeadName) {
      return transaction.customPaymentHeadName;
    }
    // Format predefined sources
    const sourceMap: Record<string, string> = {
      in_hand: 'In Hand',
      easypaisa: 'Easypaisa',
      jazzcash: 'JazzCash',
      other: 'Other',
    };
    return sourceMap[transaction.source] || transaction.source;
  };

  const formatDate = (date: Date | Timestamp): string => {
    const d = date instanceof Date ? date : date.toDate();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const transactionDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (transactionDate.getTime() === today.getTime()) {
      return `Today, ${d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else if (transactionDate.getTime() === yesterday.getTime()) {
      return `Yesterday, ${d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      }) + `, ${d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
  };

  const groupTransactionsByDate = (
    transactions: CashTransaction[]
  ): Record<string, CashTransaction[]> => {
    const groups: Record<string, CashTransaction[]> = {};

    transactions.forEach((transaction) => {
      const date = transaction.createdAt instanceof Date
        ? transaction.createdAt
        : (transaction.createdAt as Timestamp).toDate();
      const dateKey = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(transaction);
    });

    return groups;
  };

  const groupedTransactions = groupTransactionsByDate(transactions);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e5e7eb'}`,
          pb: 2,
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar
            sx={{
              bgcolor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
              width: 40,
              height: 40,
            }}
          >
            <History />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Transaction History
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last 30 days
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight={400}
          >
            <CircularProgress />
          </Box>
        ) : transactions.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight={400}
            p={4}
            textAlign="center"
          >
            <History
              sx={{
                fontSize: 64,
                opacity: 0.3,
                color: theme?.mode === 'dark' ? '#fff' : '#6b7280',
                mb: 2,
              }}
            />
            <Typography variant="h6" fontWeight="bold" mb={1}>
              No Transactions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your transaction history will appear here
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
            {Object.entries(groupedTransactions).map(([dateKey, dateTransactions], idx) => (
              <Fade in={true} timeout={300 + idx * 50} key={dateKey}>
                <Box>
                  <Box
                    sx={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#f9fafb',
                      px: 3,
                      py: 1.5,
                      borderBottom: `2px solid ${theme?.mode === 'dark' ? '#334155' : '#e5e7eb'}`,
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      fontWeight="bold"
                      color="text.secondary"
                      sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                    >
                      {dateKey}
                    </Typography>
                  </Box>

                  {dateTransactions.map((transaction, transactionIdx) => {
                    const color = getTransactionColor(transaction.type, transaction.note);
                    const icon = getTransactionIcon(transaction.type, transaction.note);
                    const label = getTransactionLabel(transaction.type, transaction.note);
                    const sourceDisplay = getSourceDisplayName(transaction);

                    return (
                      <Paper
                        key={transaction.id || transactionIdx}
                        elevation={0}
                        sx={{
                          mx: 2,
                          my: 1.5,
                          p: 2,
                          borderRadius: 2,
                          border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e5e7eb'}`,
                          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: theme?.mode === 'dark'
                              ? '0 4px 12px rgba(0,0,0,0.3)'
                              : '0 4px 12px rgba(0,0,0,0.1)',
                          },
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={2}>
                          {/* Icon */}
                          <Avatar
                            sx={{
                              bgcolor: `${color}20`,
                              color: color,
                              width: 48,
                              height: 48,
                            }}
                          >
                            {icon}
                          </Avatar>

                          {/* Transaction Details */}
                          <Box flex={1} minWidth={0}>
                            <Box
                              display="flex"
                              alignItems="center"
                              justifyContent="space-between"
                              gap={2}
                              mb={0.5}
                            >
                              <Typography
                                variant="body1"
                                fontWeight="bold"
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {transaction.note || label}
                              </Typography>
                              <Typography
                                variant="h6"
                                fontWeight="bold"
                                sx={{ color, flexShrink: 0 }}
                              >
                                {(transaction.type === 'deduct' ||
                                  transaction.note?.toLowerCase().includes('loan lend'))
                                  ? '-'
                                  : transaction.type === 'freeze_transfer'
                                  ? ''
                                  : '+'}
                                {formatCurrency(transaction.amount, 'PKR')}
                              </Typography>
                            </Box>

                            <Box
                              display="flex"
                              alignItems="center"
                              gap={1.5}
                              flexWrap="wrap"
                            >
                              <Chip
                                label={label}
                                size="small"
                                sx={{
                                  bgcolor: `${color}20`,
                                  color: color,
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  height: 24,
                                }}
                              />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: '0.75rem' }}
                              >
                                From: {sourceDisplay}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: '0.75rem' }}
                              >
                                • {formatDate(transaction.createdAt)}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>
              </Fade>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          borderTop: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e5e7eb'}`,
          px: 3,
          py: 2,
        }}
      >
        <Box flex={1}>
          <Typography variant="body2" color="text.secondary">
            Total Transactions: {transactions.length}
          </Typography>
        </Box>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransactionHistory;

