'use client';

import {
  Dialog,
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
  Collapse,
  Avatar,
  InputAdornment,
  Fade,
  CircularProgress,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PriorityIcon from '@mui/icons-material/PriorityHigh';
import NoteIcon from '@mui/icons-material/Description';
import PlanIcon from '@mui/icons-material/PlaylistAdd';
import SuccessIcon from '@mui/icons-material/CheckCircle';
import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { BuyItem } from '@/app/lib/interface';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

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
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';
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
  const [success, setSuccess] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  const totalEstimate = items.reduce((sum, i) => sum + i.estimatedPrice, 0);

  const handleAddItem = () => {
    setError('');
    setSuccess(false);
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
    setSuccess(true);

    // Reset item fields
    setItemTitle('');
    setEstimatedPrice('');
    setPriority('needed');
    setNotes('');

    setTimeout(() => setSuccess(false), 2000);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setPlanTitle('');
    setBudgetLimit('');
    setItems([]);
    setItemTitle('');
    setEstimatedPrice('');
    setPriority('needed');
    setNotes('');
    setError('');
    setSuccess(false);
    setAddItemOpen(true);
    setSaving(false);
  };

  const handleSavePlan = async () => {
    if (!planTitle || budgetLimit === '' || !user) return;

    setSaving(true);
    try {
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
        budgetLimit: typeof budgetLimit === 'number' ? budgetLimit : Number(budgetLimit),
      };

      const docRef = await addDoc(collection(db, 'buyItems'), {
        ...newPlan,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (onItemCreated) {
        onItemCreated({ ...newPlan, id: docRef.id });
      }

      resetForm();
      onClose();
    } catch (err) {
      console.error('Error saving shopping plan:', err);
      setError('Failed to save plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      fullWidth
      maxWidth="md"
      fullScreen={isMobile}
      TransitionComponent={Fade}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 4,
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
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
            <PlanIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>
              Create Shopping Plan
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
              Group items into a single budget-tracked list
            </Typography>
          </Box>
        </Stack>
        <IconButton
          onClick={handleCancel}
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

      <DialogContent sx={{ px: isMobile ? 2 : 4, py: 4 }}>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3}>
              <Typography variant="subtitle2" fontWeight="800" color="primary">
                PLAN DETAILS
              </Typography>
              
              <TextField
                fullWidth
                label="Plan Title"
                placeholder="e.g. Home Renovation"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
              />

              <TextField
                fullWidth
                label="Budget Limit"
                type="number"
                placeholder="0.00"
                value={budgetLimit}
                onChange={(e) =>
                  setBudgetLimit(e.target.value === '' ? '' : Number(e.target.value))
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'text.secondary' }}>PKR</Typography>
                    </InputAdornment>
                  ),
                }}
              />

              <Divider sx={{ my: 1 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" fontWeight="800" color="primary">
                  ADD ITEMS
                </Typography>
                <Stack direction="row" spacing={1}>
                  {addItemOpen && (
                    <Button 
                      size="small"
                      variant="contained"
                      onClick={handleAddItem}
                      disabled={!itemTitle || estimatedPrice === ''}
                      startIcon={<AddIcon />}
                      sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                    >
                      Add to List
                    </Button>
                  )}
                  <Button 
                    size="small" 
                    onClick={() => setAddItemOpen(!addItemOpen)}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    {addItemOpen ? 'Collapse' : 'Expand'}
                  </Button>
                </Stack>
              </Box>

              <Collapse in={addItemOpen}>
                <Stack spacing={2.5} sx={{ p: 2, borderRadius: 3, bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}` }}>
                  <Collapse in={success}>
                    <Alert severity="success" sx={{ borderRadius: 2, mb: 1 }}>Item added to local list!</Alert>
                  </Collapse>
                  
                  <TextField
                    fullWidth
                    size="small"
                    label="Item Name"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <ShoppingCartIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    fullWidth
                    size="small"
                    label="Est. Price"
                    type="number"
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'text.secondary' }}>PKR</Typography>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <FormControl fullWidth size="small">
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={priority}
                      label="Priority"
                      onChange={(e) => setPriority(e.target.value as BuyItemEntry['priority'])}
                      startAdornment={<PriorityIcon sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />}
                    >
                      {PRIORITIES.map((p) => (
                        <MenuItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    size="small"
                    label="Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <NoteIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Stack>
              </Collapse>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3} sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" fontWeight="800" color="primary">
                  ITEMS PREVIEW ({items.length})
                </Typography>
                <Chip 
                  label={`Total: ₨${totalEstimate.toLocaleString()}`} 
                  color="primary" 
                  sx={{ fontWeight: 800 }} 
                />
              </Box>

              <Box sx={{ 
                flexGrow: 1, 
                overflowY: 'auto', 
                maxHeight: isMobile ? '300px' : '450px',
                p: 1,
                bgcolor: isDark ? 'rgba(0,0,0,0.1)' : '#fdfdfd',
                borderRadius: 4,
                border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5
              }}>
                {items.length === 0 ? (
                  <Box sx={{ m: 'auto', textAlign: 'center', opacity: 0.5 }}>
                    <ShoppingCartIcon sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="body2" fontWeight="600">No items added yet</Typography>
                  </Box>
                ) : (
                  items.map((item, idx) => (
                    <Card key={idx} variant="outlined" sx={{ borderRadius: 3, border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}` }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography variant="body2" fontWeight="800">{item.title}</Typography>
                            <Typography variant="caption" color="primary" fontWeight="700">₨{item.estimatedPrice.toLocaleString()}</Typography>
                            {item.notes && (
                              <Typography variant="caption" display="block" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                {item.notes}
                              </Typography>
                            )}
                          </Box>
                          <IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Box>
            </Stack>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>{error}</Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 4, py: 3, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fcfcfc', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <Button onClick={handleCancel} disabled={saving} sx={{ fontWeight: 700, color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          onClick={handleSavePlan}
          variant="contained"
          color="success"
          disabled={saving || !planTitle || !budgetLimit || items.length === 0}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SuccessIcon />}
          sx={{
            borderRadius: 3,
            px: 4,
            fontWeight: 800,
            textTransform: 'none',
            boxShadow: '0 4px 14px 0 rgba(76, 175, 80, 0.39)',
            bgcolor: '#10b981',
            '&:hover': { bgcolor: '#059669' }
          }}
        >
          {saving ? 'Saving Plan...' : 'Create Shopping Plan'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
