'use client';

import {
  Box,
  Typography,
  CircularProgress,
  Divider,
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
  Slide,
} from '@mui/material';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { BuyItem } from '@/app/lib/interface';
import moment from 'moment';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useTheme } from '@mui/material/styles';

const PRIORITY_ORDER = { urgent: 1, needed: 2, optional: 3 };
const PRIORITIES = ['optional', 'needed', 'urgent'] as const;

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
        fontWeight: 'bold',
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

  const handleAddNewItem = () => {
    if (!itemTitle || estimatedPrice === '') return;
    const newItem = {
      title: itemTitle,
      estimatedPrice: Number(estimatedPrice),
      isPurchased: false,
      priority,
      notes,
    };
    const newItems = [...plan!.items, newItem];
    setPlan({ ...plan!, items: newItems });
    saveItems(newItems);
    setItemTitle('');
    setEstimatedPrice('');
    setPriority('needed');
    setNotes('');
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
      <Box textAlign="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  if (!plan) return <Typography textAlign="center">Plan not found.</Typography>;

  return (
    <Box mt={4} p={isMobile ? 1 : 2} maxWidth="700px" mx="auto">
      <Fade in={true} timeout={800}>
        <Card
          elevation={3}
          sx={{
            mb: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          }}
        >
          <CardContent>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              {plan.title}
            </Typography>
            <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
              Created:{' '}
              {moment(
                plan.createdAt instanceof Timestamp
                  ? plan.createdAt.toDate()
                  : plan.createdAt
              ).format('dddd, MMM D, YYYY h:mm A')}
            </Typography>
          </CardContent>
        </Card>
      </Fade>

      {/* Budget Overview Card */}
      <Fade in={true} timeout={1000}>
        <Card elevation={2} sx={{ mb: 3 }}>
          <CardContent>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6" fontWeight="bold" color="primary">
                Budget Overview
              </Typography>
              {plan.budgetLimit && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<TrendingUpIcon />}
                  onClick={() => {
                    setNewBudgetLimit(plan.budgetLimit || '');
                    setBudgetUpdateOpen(true);
                  }}
                >
                  Update Budget
                </Button>
              )}
            </Box>

            {plan.budgetLimit ? (
              <>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={1}
                >
                  <Typography variant="body2" color="text.secondary">
                    Spent: Rs {totalSpent.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Budget: Rs {plan.budgetLimit.toLocaleString()}
                  </Typography>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={Math.min(budgetUsagePercentage, 100)}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: isOverBudget
                        ? '#f44336'
                        : budgetUsagePercentage > 80
                        ? '#ff9800'
                        : '#4caf50',
                    },
                  }}
                />

                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mt={1}
                >
                  <Typography
                    variant="body2"
                    color={isOverBudget ? 'error.main' : 'text.secondary'}
                  >
                    {isOverBudget
                      ? `Over budget by Rs ${Math.abs(
                          remainingBudget
                        ).toLocaleString()}`
                      : `Remaining: Rs ${remainingBudget.toLocaleString()}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {budgetUsagePercentage.toFixed(1)}% used
                  </Typography>
                </Box>

                {isOverBudget && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Box display="flex" alignItems="center">
                      You have exceeded your budget limit!
                    </Box>
                  </Alert>
                )}
              </>
            ) : (
              <Box textAlign="center" py={2}>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  No budget limit set
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AttachMoneyIcon />}
                  onClick={() => setBudgetUpdateOpen(true)}
                >
                  Set Budget Limit
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Fade>

      {/* Items Summary */}
      <Fade in={true} timeout={1200}>
        <Card elevation={1} sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" color="primary" mb={1}>
              Shopping List Summary
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={2}>
              <Chip
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <AnimatedCounter value={plan.items.length} />
                    <Typography variant="body2">Total Items</Typography>
                  </Box>
                }
                color="primary"
                variant="outlined"
              />
              <Chip
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <AnimatedCounter
                      value={plan.items.filter((i) => i.isPurchased).length}
                    />
                    <Typography variant="body2">Purchased</Typography>
                  </Box>
                }
                color="success"
                variant="outlined"
              />
              <Chip
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <AnimatedCounter
                      value={plan.items.filter((i) => !i.isPurchased).length}
                    />
                    <Typography variant="body2">Remaining</Typography>
                  </Box>
                }
                color="default"
                variant="outlined"
              />
              <Chip
                label={`Rs ${totalEstimated.toLocaleString()} Estimated Total`}
                color="info"
                variant="outlined"
              />
            </Box>
          </CardContent>
        </Card>
      </Fade>

      <Stack spacing={2}>
        {sorted.map((it, idx) => {
          const globalIndex = plan.items.findIndex((x) => x === it);
          const isBought = it.isPurchased;

          return (
            <Slide
              key={`${it.title}-${globalIndex}`}
              direction="up"
              in={true}
              timeout={300 + idx * 100}
            >
              <Box>
                <Card
                  elevation={isBought ? 1 : 2}
                  sx={{
                    transition: 'all 0.3s ease',
                    backgroundColor: isBought
                      ? theme.palette.mode === 'dark'
                        ? 'rgba(76, 175, 80, 0.1)'
                        : '#e8f5e8'
                      : theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.05)'
                      : '#ffffff',
                    border: isBought
                      ? `2px solid ${theme.palette.success.main}`
                      : `1px solid ${theme.palette.divider}`,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[4],
                    },
                  }}
                >
                  <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Checkbox
                        checked={isBought}
                        color="success"
                        onChange={() => {
                          if (!isBought) {
                            // If marking as purchased, validate budget first
                            const itemPrice =
                              it.purchasedPrice ?? it.estimatedPrice;
                            if (!validateBudgetBeforePurchase(itemPrice)) {
                              setPendingPurchase({
                                index: globalIndex,
                                price: itemPrice,
                              });
                              setBudgetWarningOpen(true);
                              return;
                            }
                          }

                          const newItems = plan.items.map((x, i) =>
                            i === globalIndex
                              ? { ...x, isPurchased: !x.isPurchased }
                              : x
                          );
                          setPlan({ ...plan, items: newItems });
                          saveItems(newItems);
                        }}
                      />

                      <Box flexGrow={1}>
                        {editIndex === globalIndex ? (
                          <>
                            <TextField
                              fullWidth
                              defaultValue={it.title}
                              onChange={(e) => (it.title = e.target.value)}
                              size="small"
                              sx={{ mb: 1 }}
                            />
                            <TextField
                              fullWidth
                              type="number"
                              defaultValue={
                                it.purchasedPrice ?? it.estimatedPrice
                              }
                              onChange={(e) =>
                                (it.purchasedPrice = Number(e.target.value))
                              }
                              size="small"
                              sx={{ mb: 1 }}
                            />
                            <IconButton
                              onClick={() => {
                                saveItems(plan.items);
                                setEditIndex(null);
                              }}
                            >
                              <SaveIcon color="primary" />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <Typography fontWeight="bold">
                              {it.title} – Rs{' '}
                              {(
                                it.purchasedPrice ?? it.estimatedPrice
                              ).toLocaleString()}
                            </Typography>
                            <Typography
                              fontSize="0.85rem"
                              color="text.secondary"
                            >
                              Priority: {it.priority}
                            </Typography>
                            {it.notes && (
                              <Typography variant="body2" mt={0.5}>
                                📝 {it.notes}
                              </Typography>
                            )}
                            <Stack direction="row" spacing={1} mt={1}>
                              {!isBought && (
                                <Chip
                                  icon={<ShoppingCartIcon />}
                                  label="Bought with price"
                                  color="primary"
                                  onClick={() =>
                                    setBuyModal({
                                      index: globalIndex,
                                      open: true,
                                    })
                                  }
                                  clickable
                                />
                              )}
                              {!isBought && (
                                <IconButton
                                  onClick={() => setEditIndex(globalIndex)}
                                >
                                  <EditIcon />
                                </IconButton>
                              )}
                              {!isBought && (
                                <IconButton
                                  onClick={() =>
                                    setConfirmDelete({
                                      open: true,
                                      index: globalIndex,
                                    })
                                  }
                                >
                                  <DeleteIcon color="error" />
                                </IconButton>
                              )}
                            </Stack>
                          </>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Slide>
          );
        })}
      </Stack>

      {/* Add New Item Section */}
      <Divider sx={{ my: 4 }} />
      <Box textAlign="right" mt={4} sx={{ display: 'flex' }}>
        <Button
          className="justify-center"
          variant="outlined"
          onClick={() => setAddItemOpen(true)}
        >
          ➕ Add New Item
        </Button>
      </Box>

      <Dialog
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add New Item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              size="small"
              label="Title"
              fullWidth
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              sx={{
                input: {
                  backgroundColor:
                    theme.palette.mode === 'dark' ? '#1e293b' : 'white',
                },
              }}
            />
            <TextField
              size="small"
              label="Estimated Price"
              type="number"
              fullWidth
              value={estimatedPrice}
              onChange={(e) =>
                setEstimatedPrice(
                  e.target.value === '' ? '' : Number(e.target.value)
                )
              }
              sx={{
                input: {
                  backgroundColor:
                    theme.palette.mode === 'dark' ? '#1e293b' : 'white',
                },
              }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                sx={{
                  backgroundColor:
                    theme.palette.mode === 'dark' ? '#1e293b' : 'white',
                }}
              >
                {PRIORITIES.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddItemOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!itemTitle || estimatedPrice === ''}
            onClick={() => {
              handleAddNewItem();
              setAddItemOpen(false);
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bought Price Modal */}
      <Dialog
        open={buyModal.open}
        onClose={() => setBuyModal({ open: false, index: -1 })}
      >
        <DialogTitle>Enter Purchase Price</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Bought Price"
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuyModal({ open: false, index: -1 })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const idx = buyModal.index;
              if (!plan || idx < 0 || idx >= plan.items.length) return;
              const price = Number(newPrice);

              handleItemPurchase(idx, price);
              setBuyModal({ open: false, index: -1 });
              setNewPrice('');
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Modal */}
      <Dialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, index: -1 })}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this item?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete({ open: false, index: -1 })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              const idx = confirmDelete.index;
              const filtered = plan.items.filter((_, i) => i !== idx);
              setPlan({ ...plan, items: filtered });
              saveItems(filtered);
              setConfirmDelete({ open: false, index: -1 });
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Budget Warning Dialog */}
      <Dialog
        open={budgetWarningOpen}
        onClose={() => {
          setBudgetWarningOpen(false);
          setPendingPurchase(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" />
            Budget Exceeded
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body1" gutterBottom>
              This purchase would exceed your budget limit of Rs{' '}
              {budgetLimit.toLocaleString()}.
            </Typography>
            <Typography variant="body2">
              Current spent: Rs {totalSpent.toLocaleString()}
              <br />
              Item price: Rs {pendingPurchase?.price.toLocaleString()}
              <br />
              New total would be: Rs{' '}
              {(totalSpent + (pendingPurchase?.price || 0)).toLocaleString()}
            </Typography>
          </Alert>
          <Typography variant="body2" color="text.secondary">
            You can either increase your budget or proceed anyway if this is an
            essential purchase.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setBudgetWarningOpen(false);
              setPendingPurchase(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            startIcon={<TrendingUpIcon />}
            onClick={() => {
              setBudgetUpdateOpen(true);
              setBudgetWarningOpen(false);
            }}
          >
            Increase Budget
          </Button>
          <Button variant="contained" color="warning" onClick={forcePurchase}>
            Proceed Anyway
          </Button>
        </DialogActions>
      </Dialog>

      {/* Budget Update Dialog */}
      <Dialog
        open={budgetUpdateOpen}
        onClose={() => {
          setBudgetUpdateOpen(false);
          setNewBudgetLimit('');
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Update Budget Limit</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              fullWidth
              label="New Budget Limit"
              type="number"
              value={newBudgetLimit}
              onChange={(e) =>
                setNewBudgetLimit(
                  e.target.value === '' ? '' : Number(e.target.value)
                )
              }
              placeholder="Enter amount in Rs"
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>Rs</Typography>,
              }}
              sx={{
                input: {
                  backgroundColor:
                    theme.palette.mode === 'dark' ? '#1e293b' : 'white',
                },
              }}
            />
            {newBudgetLimit !== '' && (
              <Alert severity="info">
                <Typography variant="body2">
                  Current spent: Rs {totalSpent.toLocaleString()}
                  <br />
                  New budget: Rs {Number(newBudgetLimit).toLocaleString()}
                  <br />
                  Remaining: Rs{' '}
                  {(Number(newBudgetLimit) - totalSpent).toLocaleString()}
                </Typography>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setBudgetUpdateOpen(false);
              setNewBudgetLimit('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={newBudgetLimit === '' || Number(newBudgetLimit) <= 0}
            onClick={handleBudgetUpdate}
          >
            Update Budget
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
