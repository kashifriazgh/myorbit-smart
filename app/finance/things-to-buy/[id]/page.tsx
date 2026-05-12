'use client';

import {
  Box,
  Typography,
  CircularProgress,
  Stack,
  IconButton,
  TextField,
  Checkbox,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Card,
  CardContent,
  LinearProgress,
  useMediaQuery,
  Fade,
  Avatar,
  InputAdornment,
  Collapse,
  Paper,
  Tooltip,
  Zoom,
  Grid,
} from '@mui/material';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { BuyItem } from '@/app/lib/interface';
import moment from 'moment';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  ShoppingCart as ShoppingCartIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  AddShoppingCart as AddItemIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  RemoveShoppingCart as EmptyIcon,
  Payments as PaymentsIcon,
  ReceiptLong as SummaryIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import Link from 'next/link';

const PRIORITY_ORDER = { urgent: 1, needed: 2, optional: 3 };
const PRIORITIES = ['optional', 'needed', 'urgent'] as const;

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'urgent': return '#ef4444';
    case 'needed': return '#3b82f6';
    case 'optional': return '#10b981';
    default: return '#94a3b8';
  }
};

// Animated Counter Component
const AnimatedCounter = ({
  value,
  duration = 500,
}: {
  value: number;
  duration?: number;
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (displayValue !== value) {
      setIsAnimating(true);
      const startValue = displayValue;
      const endValue = value;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = Math.round(
          startValue + (endValue - startValue) * progress
        );

        setDisplayValue(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [value, duration, displayValue]);

  return (
    <Typography
      component="span"
      sx={{
        fontWeight: '900',
        color: isAnimating ? 'primary.main' : 'inherit',
        transition: 'color 0.3s ease',
        transform: isAnimating ? 'scale(1.1)' : 'scale(1)',
        display: 'inline-block',
      }}
    >
      {displayValue}
    </Typography>
  );
};

export default function BuyItemDetailPage() {
  const { id } = useParams();
  const planId = Array.isArray(id) ? id[0] : id ?? '';
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';
  const [plan, setPlan] = useState<BuyItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [buyModal, setBuyModal] = useState<{ index: number; open: boolean }>({
    index: -1,
    open: false,
  });
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    index: number;
  }>({
    open: false,
    index: -1,
  });
  const [newPrice, setNewPrice] = useState<string>('');

  // New item state
  const [itemTitle, setItemTitle] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState<number | ''>('');
  const [priority, setPriority] = useState<'optional' | 'needed' | 'urgent'>(
    'needed'
  );
  const [notes, setNotes] = useState('');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [addError, setAddError] = useState('');
  const [itemSaving, setItemSaving] = useState(false);

  // Budget management state
  const [budgetUpdateOpen, setBudgetUpdateOpen] = useState(false);
  const [newBudgetLimit, setNewBudgetLimit] = useState<number | ''>('');
  const [budgetWarningOpen, setBudgetWarningOpen] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<{
    index: number;
    price: number;
  } | null>(null);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!planId) return;
      const snap = await getDoc(doc(db, 'buyItems', planId));
      if (snap.exists()) setPlan({ ...(snap.data() as BuyItem), id: snap.id });
      setLoading(false);
    };
    fetchPlan();
  }, [planId]);

  const saveItems = async (items: BuyItem['items']) => {
    if (!plan?.id) return;
    await updateDoc(doc(db, 'buyItems', plan.id), {
      items,
      updatedAt: Timestamp.now(),
    });
    setPlan({ ...plan, items, updatedAt: new Date() });
  };

  const totalSpent =
    plan?.items.reduce(
      (sum, i) =>
        sum + (i.isPurchased ? i.purchasedPrice ?? i.estimatedPrice : 0),
      0
    ) ?? 0;

  const totalEstimated =
    plan?.items.reduce((sum, i) => sum + i.estimatedPrice, 0) ?? 0;

  const budgetLimit = plan?.budgetLimit ?? 0;
  const remainingBudget = budgetLimit - totalSpent;
  const budgetUsagePercentage =
    budgetLimit > 0 ? (totalSpent / budgetLimit) * 100 : 0;
  const isOverBudget = totalSpent > budgetLimit;

  const sorted = [...(plan?.items || [])].sort((a, b) => {
    if (a.isPurchased !== b.isPurchased) {
      return a.isPurchased ? 1 : -1; // Unbought first
    }
    const prioA = PRIORITY_ORDER[a.priority ?? 'needed'];
    const prioB = PRIORITY_ORDER[b.priority ?? 'needed'];
    return prioA - prioB;
  });

  const handleAddNewItem = async () => {
    if (!itemTitle || estimatedPrice === '') return;
    setItemSaving(true);
    try {
      setAddError('');
      const newItem = {
        title: itemTitle,
        estimatedPrice: Number(estimatedPrice),
        isPurchased: false,
        priority,
        notes,
      };
      const newItems = [...plan!.items, newItem];
      
      await saveItems(newItems);
      
      setAddSuccess(true);
      setItemTitle('');
      setEstimatedPrice('');
      setPriority('needed');
      setNotes('');
      
      setTimeout(() => setAddSuccess(false), 3000);
    } catch {
      setAddError('Failed to add item. Please try again.');
    } finally {
      setItemSaving(false);
    }
  };

  // Budget validation function
  const validateBudgetBeforePurchase = (itemPrice: number): boolean => {
    if (budgetLimit === 0) return true; // No budget limit set
    const newTotalSpent = totalSpent + itemPrice;
    return newTotalSpent <= budgetLimit;
  };

  // Handle item purchase with budget validation
  const handleItemPurchase = (index: number, price: number) => {
    if (!validateBudgetBeforePurchase(price)) {
      setPendingPurchase({ index, price });
      setBudgetWarningOpen(true);
      return;
    }

    // Proceed with purchase
    const updatedItems = [...plan!.items];
    updatedItems[index] = {
      ...updatedItems[index],
      purchasedPrice: price,
      isPurchased: true,
    };
    setPlan({ ...plan!, items: updatedItems });
    saveItems(updatedItems);
  };

  // Handle budget update
  const handleBudgetUpdate = async () => {
    if (!plan?.id || newBudgetLimit === '') return;

    await updateDoc(doc(db, 'buyItems', plan.id), {
      budgetLimit: Number(newBudgetLimit),
      updatedAt: Timestamp.now(),
    });

    setPlan({ ...plan, budgetLimit: Number(newBudgetLimit) });
    setBudgetUpdateOpen(false);
    setNewBudgetLimit('');
  };

  // Force purchase despite budget warning
  const forcePurchase = () => {
    if (!pendingPurchase) return;

    const updatedItems = [...plan!.items];
    updatedItems[pendingPurchase.index] = {
      ...updatedItems[pendingPurchase.index],
      purchasedPrice: pendingPurchase.price,
      isPurchased: true,
    };
    setPlan({ ...plan!, items: updatedItems });
    saveItems(updatedItems);

    setBudgetWarningOpen(false);
    setPendingPurchase(null);
  };

  if (loading)
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100vh" gap={2}>
        <CircularProgress size={60} thickness={4} sx={{ color: '#667eea' }} />
        <Typography variant="h6" fontWeight="bold" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
          Loading your list...
        </Typography>
      </Box>
    );
    
  if (!plan) return (
    <Box textAlign="center" mt={10}>
       <EmptyIcon sx={{ fontSize: 80, color: 'error.light', opacity: 0.5, mb: 2 }} />
       <Typography variant="h5">Plan not found.</Typography>
       <Link href="/finance/things-to-buy" passHref>
          <Button sx={{ mt: 2 }}>Go Back</Button>
       </Link>
    </Box>
  );

  return (
    <Box
      maxWidth="800px"
      mx="auto"
      sx={{
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#0f172a',
        minHeight: '100vh',
        p: isMobile ? 1.5 : 4,
      }}
    >
      {/* Header Section */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Link href="/finance/things-to-buy" passHref style={{ textDecoration: 'none' }}>
          <Button
            startIcon={<ArrowBackIcon />}
            sx={{ 
              textTransform: 'none', 
              fontWeight: 800,
              borderRadius: 3,
              color: isDark ? '#94a3b8' : '#64748b',
              '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
            }}
          >
            All Plans
          </Button>
        </Link>
        <Chip 
          label={plan.archived ? 'Archived' : 'Active'} 
          color={plan.archived ? 'default' : 'success'} 
          sx={{ fontWeight: 800, borderRadius: 2 }}
        />
      </Box>

      {/* Hero Card */}
      <Fade in timeout={800}>
        <Paper
          elevation={0}
          sx={{
            p: isMobile ? 3 : 5,
            mb: 4,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(118, 75, 162, 0.3)'
          }}
        >
          {/* Decorative background icons */}
          <ShoppingCartIcon sx={{ position: 'absolute', top: -20, right: -20, fontSize: 180, opacity: 0.1, transform: 'rotate(15deg)' }} />
          
          <Stack spacing={1} position="relative" zIndex={1}>
             <Typography variant={isMobile ? 'h4' : 'h3'} fontWeight="900" sx={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
               {plan.title}
             </Typography>
             <Box display="flex" alignItems="center" gap={1}>
               <SummaryIcon sx={{ fontSize: 18, opacity: 0.8 }} />
               <Typography variant="subtitle2" sx={{ opacity: 0.8, fontWeight: 600 }}>
                 Created {moment(plan.createdAt instanceof Timestamp ? plan.createdAt.toDate() : plan.createdAt).fromNow()}
               </Typography>
             </Box>
          </Stack>
        </Paper>
      </Fade>

      <Grid container spacing={3}>
        {/* Left Column: Budget & Stats */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>
            {/* Budget Card */}
            <Fade in timeout={1000}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 5, 
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
                  boxShadow: isDark ? '0 10px 15px -3px rgba(0,0,0,0.3)' : '0 10px 15px -3px rgba(0,0,0,0.05)'
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle2" fontWeight="900" color="primary" sx={{ letterSpacing: '0.1em' }}>
                      BUDGET TRACKER
                    </Typography>
                    <IconButton size="small" onClick={() => {
                        setNewBudgetLimit(plan.budgetLimit || '');
                        setBudgetUpdateOpen(true);
                    }}>
                      <TrendingUpIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {plan.budgetLimit ? (
                    <Stack spacing={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-end">
                         <Box>
                           <Typography variant="h4" fontWeight="900">
                             ₨ {remainingBudget.toLocaleString()}
                           </Typography>
                           <Typography variant="caption" color="text.secondary" fontWeight="700">
                             REMAINING BALANCE
                           </Typography>
                         </Box>
                         <Box textAlign="right">
                            <Typography variant="h6" fontWeight="800" sx={{ color: isOverBudget ? 'error.main' : 'success.main' }}>
                              {budgetUsagePercentage.toFixed(0)}%
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight="700">
                              USED
                            </Typography>
                         </Box>
                      </Box>

                      <LinearProgress
                        variant="determinate"
                        value={Math.min(budgetUsagePercentage, 100)}
                        sx={{
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 6,
                            background: isOverBudget 
                              ? 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)' 
                              : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                          },
                        }}
                      />

                      <Box display="flex" justifyContent="space-between">
                         <Typography variant="caption" fontWeight="800" color="text.secondary">
                           SPENT: ₨{totalSpent.toLocaleString()}
                         </Typography>
                         <Typography variant="caption" fontWeight="800" color="text.secondary">
                           LIMIT: ₨{plan.budgetLimit.toLocaleString()}
                         </Typography>
                      </Box>
                    </Stack>
                  ) : (
                    <Box textAlign="center" py={2} bgcolor={isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc'} borderRadius={4}>
                       <PaymentsIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
                       <Typography variant="body2" color="text.secondary" fontWeight="700" mb={2}>
                         No budget limit set yet
                       </Typography>
                       <Button 
                         variant="contained" 
                         size="small"
                         onClick={() => setBudgetUpdateOpen(true)}
                         sx={{ borderRadius: 2, fontWeight: 800 }}
                       >
                         Set Limit
                       </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Fade>

            {/* Quick Stats Grid */}
            <Fade in timeout={1200}>
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                 <Paper sx={{ p: 2, borderRadius: 4, textAlign: 'center', bgcolor: isDark ? '#1e293b' : '#ffffff' }}>
                    <Typography variant="h5" fontWeight="900"><AnimatedCounter value={plan.items.length} /></Typography>
                    <Typography variant="caption" fontWeight="800" color="text.secondary">TOTAL ITEMS</Typography>
                 </Paper>
                 <Paper sx={{ p: 2, borderRadius: 4, textAlign: 'center', bgcolor: isDark ? '#1e293b' : '#ffffff' }}>
                    <Typography variant="h5" fontWeight="900" color="success.main"><AnimatedCounter value={plan.items.filter(i => i.isPurchased).length} /></Typography>
                    <Typography variant="caption" fontWeight="800" color="text.secondary">BOUGHT</Typography>
                 </Paper>
                 <Paper sx={{ p: 2, borderRadius: 4, textAlign: 'center', bgcolor: isDark ? '#1e293b' : '#ffffff' }}>
                    <Typography variant="h5" fontWeight="900" color="primary.main"><AnimatedCounter value={plan.items.filter(i => !i.isPurchased).length} /></Typography>
                    <Typography variant="caption" fontWeight="800" color="text.secondary">REMAINING</Typography>
                 </Paper>
                 <Paper sx={{ p: 2, borderRadius: 4, textAlign: 'center', bgcolor: isDark ? '#1e293b' : '#ffffff' }}>
                    <Typography variant="body1" fontWeight="900">₨{(totalEstimated/1000).toFixed(1)}k</Typography>
                    <Typography variant="caption" fontWeight="800" color="text.secondary">EST. TOTAL</Typography>
                 </Paper>
              </Box>
            </Fade>
          </Stack>
        </Grid>

        {/* Right Column: Items List */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
             <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} px={1}>
                <Typography variant="h6" fontWeight="900">Shopping List</Typography>
                <Tooltip title="Add New Item">
                  <IconButton 
                    onClick={() => setAddItemOpen(true)} 
                    sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
                  >
                    <AddIcon />
                  </IconButton>
                </Tooltip>
             </Box>

             {plan.items.length === 0 ? (
               <Fade in>
                 <Box 
                   textAlign="center" 
                   py={8} 
                   sx={{ 
                     borderRadius: 6, 
                     border: `2px dashed ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                     bgcolor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'
                   }}
                 >
                   <EmptyIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                   <Typography variant="h6" fontWeight="800" color="text.secondary">Your list is empty</Typography>
                   <Button variant="text" onClick={() => setAddItemOpen(true)} sx={{ mt: 1, fontWeight: 800 }}>
                     Add your first item
                   </Button>
                 </Box>
               </Fade>
             ) : (
               <Stack spacing={1.5}>
                 {sorted.map((it, idx) => {
                    const globalIndex = plan.items.findIndex(x => x === it);
                    const isBought = it.isPurchased;
                    
                    return (
                      <Zoom in timeout={300 + idx * 50} key={`${it.title}-${globalIndex}`}>
                        <Card
                          elevation={0}
                          sx={{
                            borderRadius: 4,
                            overflow: 'hidden',
                            position: 'relative',
                            transition: 'all 0.2s ease',
                            border: `1px solid ${isBought ? 'transparent' : isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
                            bgcolor: isBought 
                              ? isDark ? 'rgba(16, 185, 129, 0.08)' : '#f0fdf4'
                              : isDark ? '#1e293b' : '#ffffff',
                            '&:hover': {
                              transform: 'translateX(4px)',
                              boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.05)'
                            }
                          }}
                        >
                          {/* Priority Indicator Strip */}
                          <Box sx={{ 
                            position: 'absolute', 
                            left: 0, 
                            top: 0, 
                            bottom: 0, 
                            width: 6, 
                            bgcolor: isBought ? 'success.main' : getPriorityColor(it.priority)
                          }} />

                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box display="flex" alignItems="center" gap={1}>
                               <Checkbox
                                  checked={isBought}
                                  icon={<Box sx={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid', borderColor: 'divider' }} />}
                                  checkedIcon={<CheckCircleIcon color="success" sx={{ fontSize: 28 }} />}
                                  onChange={() => {
                                    if (!isBought) {
                                      const price = it.purchasedPrice ?? it.estimatedPrice;
                                      if (!validateBudgetBeforePurchase(price)) {
                                        setPendingPurchase({ index: globalIndex, price });
                                        setBudgetWarningOpen(true);
                                        return;
                                      }
                                    }
                                    const newItems = plan.items.map((x, i) =>
                                      i === globalIndex ? { ...x, isPurchased: !x.isPurchased } : x
                                    );
                                    saveItems(newItems);
                                  }}
                               />

                               <Box flexGrow={1} ml={1}>
                                  {editIndex === globalIndex ? (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <TextField
                                        size="small"
                                        defaultValue={it.title}
                                        onChange={(e) => (it.title = e.target.value)}
                                        sx={{ flexGrow: 1 }}
                                      />
                                      <IconButton onClick={() => { saveItems(plan.items); setEditIndex(null); }}>
                                        <SaveIcon color="primary" fontSize="small" />
                                      </IconButton>
                                    </Stack>
                                  ) : (
                                    <Box>
                                      <Typography variant="body1" fontWeight="800" sx={{ 
                                        textDecoration: isBought ? 'line-through' : 'none',
                                        opacity: isBought ? 0.6 : 1
                                      }}>
                                        {it.title}
                                      </Typography>
                                      <Stack direction="row" alignItems="center" spacing={1} mt={0.5}>
                                         <Typography variant="caption" fontWeight="900" color="primary">
                                           ₨{(it.purchasedPrice ?? it.estimatedPrice).toLocaleString()}
                                         </Typography>
                                         <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'divider' }} />
                                         <Typography variant="caption" fontWeight="700" sx={{ color: isBought ? 'success.main' : getPriorityColor(it.priority) }}>
                                           {it.priority?.toUpperCase()}
                                         </Typography>
                                      </Stack>
                                      {it.notes && (
                                        <Typography variant="caption" display="block" color="text.secondary" sx={{ fontStyle: 'italic', mt: 0.5 }}>
                                           &quot; {it.notes} &quot;
                                        </Typography>
                                      )}
                                    </Box>
                                  )}
                               </Box>

                               {!isBought && editIndex !== globalIndex && (
                                 <Stack direction="row">
                                    <IconButton size="small" onClick={() => {
                                      setNewPrice(String(it.estimatedPrice));
                                      setBuyModal({ index: globalIndex, open: true });
                                    }}>
                                      <ShoppingCartIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => setEditIndex(globalIndex)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" color="error" onClick={() => setConfirmDelete({ open: true, index: globalIndex })}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                 </Stack>
                               )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Zoom>
                    );
                 })}
               </Stack>
             )}
          </Stack>
        </Grid>
      </Grid>

      {/* Floating Add Button for Mobile */}
      {isMobile && (
        <Zoom in>
          <IconButton
            onClick={() => setAddItemOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 56,
              height: 56,
              bgcolor: 'primary.main',
              color: 'white',
              boxShadow: '0 8px 16px rgba(102, 126, 234, 0.4)',
              '&:hover': { bgcolor: 'primary.dark' }
            }}
          >
            <AddIcon />
          </IconButton>
        </Zoom>
      )}

      {/* Improved Add Item Dialog */}
      <Dialog
        open={addItemOpen}
        onClose={() => !itemSaving && setAddItemOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 6,
            overflow: 'hidden',
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
          }
        }}
      >
        <Box sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 3,
          color: 'white',
          position: 'relative'
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', width: 48, height: 48 }}>
              <AddItemIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>
                New Item
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
                Adding to {plan.title}
              </Typography>
            </Box>
          </Stack>
          <IconButton
            onClick={() => setAddItemOpen(false)}
            sx={{
              position: 'absolute',
              right: 12,
              top: 12,
              color: 'white',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent sx={{ px: 3, py: 3 }}>
          <Stack spacing={2.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" fontWeight="900" color="primary">DETAILS</Typography>
              <Button
                variant="contained"
                size="small"
                onClick={handleAddNewItem}
                disabled={itemSaving || !itemTitle || estimatedPrice === ''}
                startIcon={itemSaving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                sx={{ borderRadius: 2.5, fontWeight: 900, textTransform: 'none', px: 2 }}
              >
                {itemSaving ? 'Adding...' : 'Add Item'}
              </Button>
            </Box>

            <Collapse in={addSuccess}>
              <Alert 
                severity="success" 
                icon={<CheckCircleIcon fontSize="inherit" />}
                sx={{ borderRadius: 3, fontWeight: 800 }}
              >
                Added to list!
              </Alert>
            </Collapse>

            <Collapse in={!!addError}>
              <Alert 
                severity="error" 
                sx={{ borderRadius: 3, fontWeight: 800 }}
              >
                {addError}
              </Alert>
            </Collapse>

            <TextField
              fullWidth
              label="Item Title"
              placeholder="What do you need?"
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              disabled={itemSaving}
              InputProps={{
                sx: { borderRadius: 3 },
                startAdornment: (
                  <InputAdornment position="start">
                    <ShoppingCartIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Est. Price"
              type="number"
              placeholder="0.00"
              value={estimatedPrice}
              onChange={(e) => setEstimatedPrice(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={itemSaving}
              InputProps={{
                sx: { borderRadius: 3 },
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ fontWeight: 900, mr: 0.5, color: 'text.secondary' }}>₨</Typography>
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priority}
                  label="Priority"
                  onChange={(e) => setPriority(e.target.value as typeof priority)}
                  disabled={itemSaving}
                  sx={{ borderRadius: 3 }}
                >
                  {PRIORITIES.map((p) => (
                    <MenuItem key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={2}
              placeholder="Brand, size, color..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={itemSaving}
              InputProps={{
                sx: { borderRadius: 3 },
              }}
            />
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Other Modals (Budget Update, Confirm Delete, etc.) */}
      {/* ... keep existing modal logic ... */}
      
      {/* Budget Update Dialog */}
      <Dialog
        open={budgetUpdateOpen}
        onClose={() => setBudgetUpdateOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 5 } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Set Budget Limit</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={3} fontWeight="600">
            Keep your spending in check by setting a maximum limit for this list.
          </Typography>
          <TextField
            fullWidth
            label="Limit Amount"
            type="number"
            value={newBudgetLimit}
            onChange={(e) => setNewBudgetLimit(e.target.value === '' ? '' : Number(e.target.value))}
            autoFocus
            InputProps={{
              sx: { borderRadius: 3 },
              startAdornment: (
                <InputAdornment position="start">
                   <Typography sx={{ fontWeight: 900 }}>₨</Typography>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setBudgetUpdateOpen(false)} sx={{ fontWeight: 700 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBudgetUpdate}
            sx={{ borderRadius: 3, fontWeight: 900, px: 3 }}
          >
            Save Limit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bought Price Modal */}
      <Dialog
        open={buyModal.open}
        onClose={() => setBuyModal({ open: false, index: -1 })}
        PaperProps={{ sx: { borderRadius: 5 } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Confirm Purchase</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={3} fontWeight="600">
            Actual price paid for <strong>{plan.items[buyModal.index]?.title}</strong>:
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Actual Price"
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            InputProps={{
              sx: { borderRadius: 3 },
              startAdornment: (
                <InputAdornment position="start">
                  <Typography sx={{ fontWeight: 900 }}>₨</Typography>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setBuyModal({ open: false, index: -1 })} sx={{ fontWeight: 700 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const idx = buyModal.index;
              if (!plan || idx < 0 || idx >= plan.items.length) return;
              handleItemPurchase(idx, Number(newPrice));
              setBuyModal({ open: false, index: -1 });
              setNewPrice('');
            }}
            sx={{ borderRadius: 3, fontWeight: 900, px: 3 }}
          >
            Record Purchase
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Modal */}
      <Dialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, index: -1 })}
        PaperProps={{ sx: { borderRadius: 5 } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Remove Item?</DialogTitle>
        <DialogContent>
          <Typography fontWeight="600">Are you sure you want to delete this item from your list?</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setConfirmDelete({ open: false, index: -1 })} sx={{ fontWeight: 700 }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              const idx = confirmDelete.index;
              const filtered = plan.items.filter((_, i) => i !== idx);
              saveItems(filtered);
              setConfirmDelete({ open: false, index: -1 });
            }}
            sx={{ borderRadius: 3, fontWeight: 900, px: 3 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Budget Warning Dialog */}
      <Dialog
        open={budgetWarningOpen}
        onClose={() => { setBudgetWarningOpen(false); setPendingPurchase(null); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 6 } }}
      >
        <DialogContent sx={{ p: 4 }}>
          <Box textAlign="center" mb={3}>
             <Avatar sx={{ bgcolor: 'rgba(244, 67, 54, 0.1)', color: 'error.main', width: 64, height: 64, mx: 'auto', mb: 2 }}>
                <WarningIcon sx={{ fontSize: 32 }} />
             </Avatar>
             <Typography variant="h5" fontWeight="900">Budget Warning</Typography>
          </Box>
          <Alert severity="warning" variant="outlined" sx={{ mb: 3, borderRadius: 3, border: 'none', bgcolor: isDark ? 'rgba(255, 152, 0, 0.05)' : 'rgba(255, 152, 0, 0.05)' }}>
            <Typography variant="body2" fontWeight="700">
              This purchase will exceed your limit of ₨{plan.budgetLimit?.toLocaleString()}.
            </Typography>
          </Alert>
          <Typography variant="body2" textAlign="center" color="text.secondary" fontWeight="600">
            Current Spent: ₨{totalSpent.toLocaleString()}<br/>
            With this item: ₨{(totalSpent + (pendingPurchase?.price || 0)).toLocaleString()}
          </Typography>
          <Stack spacing={2} mt={4}>
             <Button
                fullWidth
                variant="contained"
                color="warning"
                onClick={forcePurchase}
                sx={{ borderRadius: 3, fontWeight: 900, py: 1.5 }}
              >
                Purchase Anyway
              </Button>
              <Button 
                fullWidth
                onClick={() => { setBudgetWarningOpen(false); setPendingPurchase(null); }}
                sx={{ fontWeight: 800 }}
              >
                Cancel
              </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
