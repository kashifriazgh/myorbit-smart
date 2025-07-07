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
import { useTheme } from '@mui/material/styles';

const PRIORITY_ORDER = { urgent: 1, needed: 2, optional: 3 };
const PRIORITIES = ['optional', 'needed', 'urgent'] as const;

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
  const [addItemOpen, setAddItemOpen] = useState(false);

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

  if (loading)
    return (
      <Box textAlign="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  if (!plan) return <Typography textAlign="center">Plan not found.</Typography>;

  return (
    <Box mt={4} p={2} maxWidth="700px" mx="auto">
      <Typography variant="h5" fontWeight="bold">
        {plan.title}
      </Typography>
      <Typography variant="subtitle2" color="text.secondary">
        Created:{' '}
        {moment(
          plan.createdAt instanceof Timestamp
            ? plan.createdAt.toDate()
            : plan.createdAt
        ).format('dddd, MMM D, YYYY h:mm A')}
      </Typography>

      {plan.budgetLimit && (
        <Typography variant="h5" fontWeight="bold" color="primary" mb={2}>
          🎯 Budget Limit: Rs {plan.budgetLimit.toLocaleString()}
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="h6" fontWeight="bold" color="primary" mb={1}>
        Total Items: {plan.items.length} | Spent: Rs{' '}
        {totalSpent.toLocaleString()}
      </Typography>

      <Stack spacing={2}>
        {sorted.map((it, idx) => {
          const globalIndex = plan.items.findIndex((x) => x === it);
          const isBought = it.isPurchased;

          return (
            <Box
              key={idx}
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: isBought ? '#e0f7fa' : '#f9f9f9',
                border: '1px solid #ddd',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Checkbox
                checked={isBought}
                onChange={() => {
                  const newItems = plan.items.map((x, i) =>
                    i === globalIndex
                      ? { ...x, isPurchased: !x.isPurchased }
                      : x
                  );
                  setPlan({ ...plan, items: newItems });
                  saveItems(newItems);
                }}
              />

              <Box flexGrow={1} ml={1}>
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
                      defaultValue={it.purchasedPrice ?? it.estimatedPrice}
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
                    <Typography fontSize="0.85rem" color="text.secondary">
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
                            setBuyModal({ index: globalIndex, open: true })
                          }
                          clickable
                        />
                      )}
                      {!isBought && (
                        <IconButton onClick={() => setEditIndex(globalIndex)}>
                          <EditIcon />
                        </IconButton>
                      )}
                      {!isBought && (
                        <IconButton
                          onClick={() =>
                            setConfirmDelete({ open: true, index: globalIndex })
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
              const updatedItems = [...plan.items];
              updatedItems[idx] = {
                ...updatedItems[idx],
                purchasedPrice: Number(newPrice),
                isPurchased: true,
              };
              setPlan({ ...plan, items: updatedItems });
              saveItems(updatedItems);
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
    </Box>
  );
}
