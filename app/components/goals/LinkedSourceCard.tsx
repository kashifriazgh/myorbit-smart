'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  LinearProgress,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  AccountBalanceWallet,
  History as HistoryIcon,
  Close as CloseIcon,
  NorthEast as ArrowUpRight,
  SouthEast as ArrowDownRight,
  Add as AddIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  AutoAwesome,
} from '@mui/icons-material';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { GoalStep } from '../../lib/interface';
import { useGoals } from '../../lib/context/GoalsContext';

function formatPKR(n: number): string {
  return '₨' + (n || 0).toLocaleString('en-PK');
}

interface LinkedSourceCardProps {
  goalId: string;
  step: GoalStep;
  goalTargetValue?: number;
  onStepsChange?: () => void;
}

interface TransactionItem {
  id: string;
  date: string;
  type: 'add' | 'deduct' | string;
  amount: number;
  note?: string;
  balanceAfter?: number;
}

export default function LinkedSourceCard({
  goalId,
  step,
  goalTargetValue,
  onStepsChange,
}: LinkedSourceCardProps) {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const { updateGoalStep } = useGoals();
  const isDark = theme?.mode === 'dark';

  const sourceName = step.title
    .replace(/^Source of Fund:\s*/i, '')
    .replace(/^Finance Fund:\s*/i, '')
    .trim();

  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [lastUpdatedText, setLastUpdatedText] = useState<string>('recently');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [submittingAddMoney, setSubmittingAddMoney] = useState(false);
  const [historyList, setHistoryList] = useState<TransactionItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Target amount setting
  const initialTarget = typeof step.targetAmount === 'number' ? step.targetAmount : (goalTargetValue || null);
  const [targetAmount, setTargetAmount] = useState<number | null>(initialTarget);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState<string>(initialTarget ? String(initialTarget) : '');

  // Fetch current live balance from totalCashSnapshots
  const fetchLiveBalance = React.useCallback(async () => {
    if (!user) return;
    try {
      const snapRef = doc(db, 'totalCashSnapshots', user.uid);
      const snap = await getDoc(snapRef);
      if (snap.exists()) {
        const data = snap.data();
        const customSources = typeof data?.sources?.custom === 'object' ? data.sources.custom : {};
        const bal = Number(customSources[sourceName] || 0);
        setCurrentBalance(bal);
      }
    } catch (err) {
      console.warn('Error fetching live source balance:', err);
    }
  }, [user, sourceName]);

  useEffect(() => {
    fetchLiveBalance();
  }, [fetchLiveBalance]);

  // Fetch history transactions
  const fetchHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'cashTransactions'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      let cumulativeBalance = 0;
      const list: TransactionItem[] = [];

      const filteredDocs = snap.docs.filter((d) => {
        const data = d.data();
        return (
          data.customPaymentHeadName === sourceName ||
          data.source === sourceName ||
          (typeof data.note === 'string' && data.note.toLowerCase().includes(sourceName.toLowerCase()))
        );
      });

      // Sort by createdAt ascending to compute running balance
      filteredDocs.sort((a, b) => {
        const tA = a.data().createdAt?.seconds || 0;
        const tB = b.data().createdAt?.seconds || 0;
        return tA - tB;
      });

      filteredDocs.forEach((d) => {
        const data = d.data();
        const amt = Number(data.amount || 0);
        const type = data.type === 'deduct' || data.type === 'expense' ? 'deduct' : 'add';

        if (type === 'add') {
          cumulativeBalance += amt;
        } else {
          cumulativeBalance -= amt;
        }

        let dateStr = 'Unknown date';
        if (data.createdAt?.toDate) {
          dateStr = data.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } else if (data.createdAt?.seconds) {
          dateStr = new Date(data.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        list.push({
          id: d.id,
          date: dateStr,
          type,
          amount: amt,
          note: data.note || '',
          balanceAfter: cumulativeBalance,
        });
      });

      // Reverse list to show newest on top
      list.reverse();
      setHistoryList(list);

      if (list.length > 0) {
        setLastUpdatedText(list[0].date);
      }
    } catch (err) {
      console.warn('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenHistory = () => {
    setHistoryOpen(true);
    fetchHistory();
  };

  const handleSaveTarget = async () => {
    const num = Number(targetInput);
    if (!isNaN(num) && num > 0) {
      setTargetAmount(num);
      await updateGoalStep(goalId, step.id, { targetAmount: num });
      onStepsChange?.();
    }
    setIsEditingTarget(false);
  };

  const handleDirectAddMoney = async () => {
    const amt = Number(amountInput);
    if (!user || isNaN(amt) || amt <= 0) return;
    setSubmittingAddMoney(true);

    try {
      // 1. Add cash transaction
      await addDoc(collection(db, 'cashTransactions'), {
        userId: user.uid,
        amount: amt,
        type: 'add',
        source: 'other',
        category: 'manual',
        note: noteInput.trim() || `Added to ${sourceName}`,
        customPaymentHeadName: sourceName,
        createdAt: Timestamp.now(),
      });

      // 2. Update snapshot
      const snapRef = doc(db, 'totalCashSnapshots', user.uid);
      const snap = await getDoc(snapRef);
      if (snap.exists()) {
        const data = snap.data();
        const customSources = typeof data?.sources?.custom === 'object' ? { ...data.sources.custom } : {};
        const oldVal = Number(customSources[sourceName] || 0);
        const newVal = oldVal + amt;
        customSources[sourceName] = newVal;
        const newTotal = Number(data?.totalAmount || 0) + amt;

        await updateDoc(snapRef, {
          'sources.custom': customSources,
          totalAmount: newTotal,
          updatedAt: serverTimestamp(),
        });
        setCurrentBalance(newVal);
      }

      setAddMoneyOpen(false);
      setAmountInput('');
      setNoteInput('');
      onStepsChange?.();
    } catch (err) {
      console.error('Error in direct add money:', err);
    } finally {
      setSubmittingAddMoney(false);
    }
  };

  const pct = targetAmount && targetAmount > 0
    ? Math.min(100, Math.round((currentBalance / targetAmount) * 100))
    : null;

  return (
    <Box
      sx={{
        borderRadius: '20px',
        border: `1.5px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0'}`,
        bgcolor: isDark ? 'rgba(15, 23, 42, 0.9)' : '#ffffff',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 16px rgba(16, 185, 129, 0.05)',
      }}
    >
      {/* Header Row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '14px',
            bgcolor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AccountBalanceWallet sx={{ fontSize: 24, color: '#10b981' }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a' }}>
              {sourceName}
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
              {formatPKR(currentBalance)}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: isDark ? '#94a3b8' : '#64748b', mt: 0.25 }}>
            Linked source · updated {lastUpdatedText}
          </Typography>
        </Box>
      </Box>

      {/* Target & Progress Bar */}
      <Box sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', p: 1.5, borderRadius: '14px', border: `1px solid ${isDark ? '#334155' : '#f1f5f9'}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: isDark ? '#cbd5e1' : '#475569' }}>
            {pct !== null ? `${pct}% of target` : 'Target Amount'}
          </Typography>
          
          {isEditingTarget ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', mt: 0.5, mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TextField
                  size="small"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="Target Amount (PKR)"
                  type="number"
                  fullWidth
                  sx={{ '& input': { py: 0.4, px: 1, fontSize: 11, fontWeight: 700 } }}
                />
                <IconButton size="small" onClick={handleSaveTarget} sx={{ color: '#10b981', bgcolor: 'rgba(16, 185, 129, 0.15)', p: 0.5 }}>
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Box>

              {typeof goalTargetValue === 'number' && goalTargetValue > 0 && (
                <Chip
                  icon={<AutoAwesome sx={{ fontSize: 13, color: '#f59e0b !important' }} />}
                  label={`💡 Use Goal Target: ₨${goalTargetValue.toLocaleString('en-PK')}`}
                  onClick={() => setTargetInput(String(goalTargetValue))}
                  size="small"
                  sx={{
                    alignSelf: 'flex-start',
                    fontWeight: 800,
                    fontSize: 10.5,
                    bgcolor: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.25)' },
                  }}
                />
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>
                {targetAmount ? formatPKR(targetAmount) : 'Not set'}
              </Typography>
              <IconButton size="small" onClick={() => setIsEditingTarget(true)} sx={{ p: 0.3, color: isDark ? '#64748b' : '#94a3b8' }}>
                <EditIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Box>
          )}
        </Box>

        {pct !== null && (
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 7,
              borderRadius: 4,
              bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: 'linear-gradient(90deg, #34d399 0%, #10b981 100%)',
              },
            }}
          />
        )}
      </Box>

      {/* Action Buttons Row */}
      <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
        <Button
          size="small"
          onClick={handleOpenHistory}
          startIcon={<HistoryIcon sx={{ fontSize: 15 }} />}
          sx={{
            textTransform: 'none',
            fontSize: 12,
            fontWeight: 700,
            color: '#10b981',
            borderRadius: '10px',
            px: 1.5,
            bgcolor: 'rgba(16, 185, 129, 0.1)',
            '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.2)' },
          }}
        >
          View History
        </Button>

        <Button
          size="small"
          onClick={() => setAddMoneyOpen(true)}
          startIcon={<AddIcon sx={{ fontSize: 15 }} />}
          sx={{
            textTransform: 'none',
            fontSize: 12,
            fontWeight: 800,
            borderRadius: '10px',
            px: 2,
            bgcolor: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            '&:hover': { opacity: 0.95 },
          }}
        >
          💵 Add Money
        </Button>
      </Stack>

      {/* Simplified Direct Add Money Modal */}
      <Dialog
        open={addMoneyOpen}
        onClose={() => setAddMoneyOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1,
            maxWidth: 380,
            width: '100%',
            bgcolor: isDark ? '#0f172a' : '#ffffff',
          },
        }}
      >
        <DialogTitle sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceWallet sx={{ color: '#10b981' }} />
            <Typography variant="h6" fontWeight={850} fontSize="1.1rem">
              Add Money to {sourceName}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAddMoneyOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2, pt: 1 }}>
          <Stack spacing={2}>
            <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <Typography sx={{ fontSize: 11.5, color: '#10b981', fontWeight: 700 }}>
                Current Balance: {formatPKR(currentBalance)}
              </Typography>
            </Box>

            <TextField
              label="Amount to Add (PKR)"
              type="number"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              fullWidth
              autoFocus
              InputProps={{
                startAdornment: <InputAdornment position="start">₨</InputAdornment>,
              }}
            />

            <TextField
              label="Note (Optional)"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g. Monthly savings contribution"
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleDirectAddMoney}
            disabled={submittingAddMoney || !amountInput || Number(amountInput) <= 0}
            sx={{
              borderRadius: '12px',
              py: 1.2,
              fontWeight: 800,
              bgcolor: '#10b981',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            {submittingAddMoney ? 'Saving...' : 'Add Money Now'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transaction History Dialog */}
      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1,
            maxWidth: 420,
            width: '100%',
            bgcolor: isDark ? '#0a1523' : '#ffffff',
          },
        }}
      >
        <DialogTitle sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}` }}>
          <Box>
            <Typography sx={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
              {sourceName}
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a' }}>
              {formatPKR(currentBalance)}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setHistoryOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2, maxHeight: 360, overflowY: 'auto' }}>
          {loadingHistory ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <LinearProgress color="success" />
            </Box>
          ) : historyList.length === 0 ? (
            <Typography sx={{ fontSize: 13, textAlign: 'center', color: isDark ? '#64748b' : '#94a3b8', py: 3 }}>
              No transactions recorded for this source yet.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {historyList.map((h) => {
                const isAdd = h.type === 'add';
                return (
                  <Box
                    key={h.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: '14px',
                      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                      '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        bgcolor: isAdd ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        color: isAdd ? '#10b981' : '#f43f5e',
                      }}
                    >
                      {isAdd ? <ArrowUpRight sx={{ fontSize: 18 }} /> : <ArrowDownRight sx={{ fontSize: 18 }} />}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                        {isAdd ? 'Added' : 'Deducted'} {h.note ? `• ${h.note}` : ''}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' }}>
                        {h.date}
                      </Typography>
                    </Box>

                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: isAdd ? '#10b981' : '#f43f5e' }}>
                        {isAdd ? '+' : '-'}{formatPKR(h.amount)}
                      </Typography>
                      {typeof h.balanceAfter === 'number' && (
                        <Typography sx={{ fontSize: 10.5, color: isDark ? '#64748b' : '#94a3b8' }}>
                          Bal: {formatPKR(h.balanceAfter)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setHistoryOpen(false)} variant="outlined" color="inherit" fullWidth sx={{ borderRadius: '12px', fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
