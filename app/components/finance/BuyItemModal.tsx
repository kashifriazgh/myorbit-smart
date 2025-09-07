'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  useTheme,
  Stack,
  Alert,
  useMediaQuery,
  Divider,
  Chip,
  IconButton,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { BuyItem } from '@/app/lib/interface';
import { useAuth } from '@/app/lib/context/userContext';

const PRIORITIES = ['optional', 'needed', 'urgent'] as const;

type BuyItemEntry = {
  userId: string;
  title: string;
  estimatedPrice: number;
  purchasedPrice?: number;
  isPurchased: boolean;
  priority?: 'optional' | 'needed' | 'urgent';
  notes?: string;
};

export default function BuyItemModal({
  open,
  onClose,
  onItemCreated,
}: {
  open: boolean;
  onClose: () => void;
  onItemCreated?: (item: BuyItem) => void;
}) {
  const theme = useTheme();
  const { user } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [planTitle, setPlanTitle] = useState('');
  const [budgetLimit, setBudgetLimit] = useState<number | ''>('');

  const [items, setItems] = useState<BuyItemEntry[]>([]);

  // Fields for new item
  const [itemTitle, setItemTitle] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState<number | ''>('');
  const [priority, setPriority] = useState<BuyItemEntry['priority']>('needed');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const totalEstimate = items.reduce((sum, i) => sum + i.estimatedPrice, 0);

  const handleAddItem = () => {
    setError('');
    if (!itemTitle || estimatedPrice === '') {
      setError('Please enter both title and estimated price');
      return;
    }

    if (
      typeof budgetLimit === 'number' &&
      totalEstimate + Number(estimatedPrice) > budgetLimit
    ) {
      setError(
        `Cannot add this item. Total exceeds your budget of Rs ${(
          budgetLimit || 0
        ).toLocaleString()}`
      );

      return;
    }

    const newItem: BuyItemEntry = {
      userId: user.uid,
      title: itemTitle,
      estimatedPrice: Number(estimatedPrice),
      isPurchased: false,
      priority,
      notes,
    };

    setItems((prev) => [...prev, newItem]);

    // Reset item fields
    setItemTitle('');
    setEstimatedPrice('');
    setPriority('needed');
    setNotes('');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSavePlan = async () => {
    if (!planTitle || items.length === 0 || !user) return;

    const now = new Date();
    const newPlan: BuyItem = {
      userId: user.uid,
      title: planTitle,
      items,
      archived: false,
      pinned: false,
      sharedWith: [],
      createdAt: now,
      updatedAt: now,
      budgetLimit: budgetLimit === '' ? undefined : Number(budgetLimit), // ✅ Add here
    };

    const docRef = await addDoc(collection(db, 'buyItems'), {
      ...newPlan,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (onItemCreated) {
      onItemCreated({ ...newPlan, id: docRef.id });
    }

    // Reset
    setPlanTitle('');
    setBudgetLimit('');
    setItems([]);
    setItemTitle('');
    setEstimatedPrice('');
    setPriority('needed');
    setNotes('');
    setError('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={isMobile ? 'sm' : 'md'}
      fullScreen={isMobile}
      sx={{
        '& .MuiDialog-paper': {
          margin: isMobile ? 0 : 'auto',
          maxHeight: isMobile ? '100vh' : '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 1,
          fontSize: isMobile ? '1.25rem' : '1.5rem',
          fontWeight: 'bold',
        }}
      >
        Create Shopping Plan
      </DialogTitle>

      <DialogContent
        sx={{
          px: isMobile ? 2 : 3,
          py: isMobile ? 1 : 2,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme.palette.mode === 'dark' ? '#555' : '#ccc',
            borderRadius: '3px',
          },
        }}
      >
        {/* Plan Title & Budget */}
        <Stack spacing={2}>
          <TextField
            label="Plan Title"
            fullWidth
            value={planTitle}
            onChange={(e) => setPlanTitle(e.target.value)}
            size={isMobile ? 'medium' : 'medium'}
            sx={{
              '& .MuiInputBase-input': {
                fontSize: isMobile ? '16px' : '14px', // Prevents zoom on iOS
              },
            }}
          />

          <TextField
            label="Budget Limit (Rs)"
            fullWidth
            type="number"
            value={budgetLimit}
            onChange={(e) =>
              setBudgetLimit(
                e.target.value === '' ? '' : Number(e.target.value)
              )
            }
            size={isMobile ? 'medium' : 'medium'}
            sx={{
              '& .MuiInputBase-input': {
                fontSize: isMobile ? '16px' : '14px',
              },
            }}
          />
        </Stack>

        <Divider sx={{ my: 3 }} />

        {/* New Item Section */}
        <Box>
          <Typography
            variant="h6"
            fontWeight="bold"
            mb={2}
            sx={{
              fontSize: isMobile ? '1.1rem' : '1.25rem',
            }}
          >
            Add Item
          </Typography>

          <Stack spacing={2}>
            <TextField
              label="Item Title"
              fullWidth
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              size={isMobile ? 'medium' : 'medium'}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: isMobile ? '16px' : '14px',
                },
              }}
            />

            <TextField
              label="Estimated Price (Rs)"
              fullWidth
              type="number"
              value={estimatedPrice}
              onChange={(e) =>
                setEstimatedPrice(
                  e.target.value === '' ? '' : Number(e.target.value)
                )
              }
              size={isMobile ? 'medium' : 'medium'}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: isMobile ? '16px' : '14px',
                },
              }}
            />

            <FormControl fullWidth size={isMobile ? 'medium' : 'medium'}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={(e) =>
                  setPriority(e.target.value as BuyItemEntry['priority'])
                }
                sx={{
                  '& .MuiSelect-select': {
                    fontSize: isMobile ? '16px' : '14px',
                  },
                }}
              >
                {PRIORITIES.map((p) => (
                  <MenuItem
                    key={p}
                    value={p}
                    sx={{ fontSize: isMobile ? '16px' : '14px' }}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Notes (optional)"
              fullWidth
              multiline
              rows={isMobile ? 3 : 2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              size={isMobile ? 'medium' : 'medium'}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: isMobile ? '16px' : '14px',
                },
              }}
            />

            <Button
              variant="contained"
              color="primary"
              onClick={handleAddItem}
              disabled={estimatedPrice === '' || itemTitle === ''}
              startIcon={<Add />}
              size={isMobile ? 'large' : 'medium'}
              sx={{
                py: isMobile ? 1.5 : 1,
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: 'bold',
              }}
            >
              Add Item
            </Button>
          </Stack>
        </Box>

        {/* Error */}
        {error && (
          <Box mt={2}>
            <Alert
              severity="error"
              sx={{ fontSize: isMobile ? '14px' : '13px' }}
            >
              {error}
            </Alert>
          </Box>
        )}

        {/* Items List */}
        {items.length > 0 && (
          <Box mt={4}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                sx={{
                  fontSize: isMobile ? '1rem' : '0.875rem',
                }}
              >
                Items ({items.length})
              </Typography>
              <Chip
                label={`Rs ${Number(totalEstimate || 0).toLocaleString()}`}
                color="primary"
                size={isMobile ? 'medium' : 'small'}
                sx={{ fontWeight: 'bold' }}
              />
            </Box>

            <Stack spacing={1.5}>
              {items.map((item, idx) => (
                <Box
                  key={idx}
                  sx={{
                    p: 2,
                    bgcolor:
                      theme.palette.mode === 'dark' ? '#1f2937' : '#f8fafc',
                    borderRadius: 2,
                    border: `1px solid ${
                      theme.palette.mode === 'dark' ? '#374151' : '#e2e8f0'
                    }`,
                    position: 'relative',
                  }}
                >
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Box flex={1} pr={1}>
                      <Typography
                        fontWeight="bold"
                        sx={{
                          fontSize: isMobile ? '16px' : '14px',
                          mb: 0.5,
                        }}
                      >
                        {item.title ?? 'Untitled'}
                      </Typography>

                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography
                          variant="body2"
                          color="primary"
                          fontWeight="bold"
                          sx={{ fontSize: isMobile ? '15px' : '13px' }}
                        >
                          Rs {(item.estimatedPrice || 0).toLocaleString()}
                        </Typography>
                        <Chip
                          label={item.priority}
                          size="small"
                          color={
                            item.priority === 'urgent'
                              ? 'error'
                              : item.priority === 'needed'
                              ? 'warning'
                              : 'default'
                          }
                          sx={{ fontSize: isMobile ? '12px' : '10px' }}
                        />
                      </Box>

                      {item.notes && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontSize: isMobile ? '14px' : '12px' }}
                        >
                          📝 {item.notes}
                        </Typography>
                      )}
                    </Box>

                    <IconButton
                      onClick={() => handleRemoveItem(idx)}
                      size={isMobile ? 'medium' : 'small'}
                      sx={{
                        color: 'error.main',
                        '&:hover': {
                          bgcolor: 'error.light',
                          color: 'white',
                        },
                      }}
                    >
                      <Delete fontSize={isMobile ? 'medium' : 'small'} />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: isMobile ? 2 : 3,
          py: isMobile ? 2 : 1,
          gap: 1,
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        <Button
          onClick={onClose}
          size={isMobile ? 'large' : 'medium'}
          sx={{
            width: isMobile ? '100%' : 'auto',
            py: isMobile ? 1.5 : 1,
            fontSize: isMobile ? '16px' : '14px',
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSavePlan}
          variant="contained"
          color="success"
          disabled={!planTitle || items.length === 0}
          size={isMobile ? 'large' : 'medium'}
          sx={{
            width: isMobile ? '100%' : 'auto',
            py: isMobile ? 1.5 : 1,
            fontSize: isMobile ? '16px' : '14px',
            fontWeight: 'bold',
          }}
        >
          Save Plan
        </Button>
      </DialogActions>
    </Dialog>
  );
}
