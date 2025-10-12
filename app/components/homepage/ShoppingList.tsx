'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Stack,
  Avatar,
} from '@mui/material';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useOnboarding } from '@/app/lib/context/onBoardingContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { ShoppingListItem } from '@/app/lib/interface';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import AddIcon from '@mui/icons-material/Add';

import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import moment from 'moment-timezone';

// Shopping emoji categories
const shoppingEmojis = {
  'Fruits & Vegetables': [
    '🍎',
    '🍌',
    '🍊',
    '🍇',
    '🍓',
    '🥕',
    '🥬',
    '🥒',
    '🍅',
    '🥔',
    '🧅',
    '🌶️',
    '🥑',
    '🍋',
    '🍑',
    '🍒',
  ],
  'Dairy & Eggs': ['🥛', '🧀', '🥚', '🍯', '🧈', '🥜', '🌰'],
  'Meat & Seafood': ['🍗', '🥩', '🐟', '🦐', '🦀', '🐙', '🥓', '🍖'],
  Bakery: ['🍞', '🥖', '🥨', '🥯', '🧁', '🍰', '🥧', '🍪', '🧀'],
  Beverages: ['☕', '🥤', '🍷', '🍺', '🥛', '🧃', '🍵', '🥃', '🍸'],
  'Snacks & Sweets': ['🍫', '🍬', '🍭', '🍪', '🧁', '🍰', '🍩', '🍯', '🍇'],
  Household: ['🧴', '🧼', '🧻', '🧽', '🪥', '🧴', '🧹', '🪣', '🛁'],
  Electronics: ['📱', '💻', '🎧', '🔋', '💡', '📺', '📷', '🎮', '⌚'],
  Clothing: ['👕', '👖', '👟', '🧦', '🧥', '👗', '👔', '👓', '👜'],
  'Health & Beauty': ['💊', '🧴', '🪒', '🧴', '💄', '🧴', '🩹', '🌡️'],
  'General Shopping': ['🛒', '🛍️', '💳', '🏪', '🛒', '📦', '🎁', '💝'],
};

interface EmojiPickerProps {
  selectedEmoji: string;
  onEmojiSelect: (emoji: string) => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  selectedEmoji,
  onEmojiSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('General Shopping');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const filteredEmojis = Object.entries(shoppingEmojis).reduce(
    (acc, [category, emojis]) => {
      if (
        category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emojis.some((emoji) => emoji.includes(searchTerm))
      ) {
        acc[category] = emojis.filter(
          (emoji) =>
            emoji.includes(searchTerm) ||
            category.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      return acc;
    },
    {} as typeof shoppingEmojis
  );

  const displayEmojis = searchTerm
    ? filteredEmojis
    : {
        [selectedCategory]:
          shoppingEmojis[selectedCategory as keyof typeof shoppingEmojis],
      };

  if (isMobile) {
    return (
      <Box>
        <TextField
          label="Search emojis"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          placeholder="Search by emoji or category..."
        />

        {!searchTerm && (
          <Box sx={{ display: 'flex', height: 300, gap: 1 }}>
            {/* Categories Column - 40% */}
            <Box
              sx={{
                width: '40%',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1, fontWeight: 'bold' }}
              >
                Categories:
              </Typography>
              <Box sx={{ overflowY: 'auto', height: 'calc(100% - 30px)' }}>
                {Object.keys(shoppingEmojis).map((category) => (
                  <Box
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    sx={{
                      p: 1,
                      mb: 0.5,
                      borderRadius: 1,
                      cursor: 'pointer',
                      backgroundColor:
                        selectedCategory === category
                          ? 'primary.light'
                          : 'transparent',
                      '&:hover': { backgroundColor: 'action.hover' },
                      fontSize: '0.8rem',
                      fontWeight:
                        selectedCategory === category ? 'bold' : 'normal',
                    }}
                  >
                    {category}
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Emojis Column - 60% */}
            <Box
              sx={{
                width: '60%',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1, fontWeight: 'bold' }}
              >
                Icons:
              </Typography>
              <Box sx={{ overflowY: 'auto', height: 'calc(100% - 30px)' }}>
                {Object.entries(displayEmojis).map(([category, emojis]) => (
                  <Box key={category}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.5,
                        mb: 1,
                      }}
                    >
                      {emojis.map((emoji, index) => (
                        <Box
                          key={`${category}-${emoji}-${index}`}
                          onClick={() => onEmojiSelect(emoji)}
                          sx={{
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            p: 0.5,
                            borderRadius: 1,
                            backgroundColor:
                              selectedEmoji === emoji
                                ? 'primary.light'
                                : 'transparent',
                            '&:hover': { backgroundColor: 'action.hover' },
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 32,
                            minHeight: 32,
                          }}
                        >
                          {emoji}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}

        {searchTerm && (
          <Box
            sx={{
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1,
            }}
          >
            {Object.entries(displayEmojis).map(([category, emojis]) => (
              <Box key={category}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}
                >
                  {category}
                </Typography>
                <Box
                  sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}
                >
                  {emojis.map((emoji, index) => (
                    <Box
                      key={`${category}-${emoji}-${index}`}
                      onClick={() => onEmojiSelect(emoji)}
                      sx={{
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        p: 0.5,
                        borderRadius: 1,
                        backgroundColor:
                          selectedEmoji === emoji
                            ? 'primary.light'
                            : 'transparent',
                        '&:hover': { backgroundColor: 'action.hover' },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 32,
                        minHeight: 32,
                      }}
                    >
                      {emoji}
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // Desktop layout
  return (
    <Box>
      <TextField
        label="Search emojis"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        placeholder="Search by emoji or category..."
      />

      {!searchTerm && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Categories:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Object.keys(shoppingEmojis).map((category) => (
              <Chip
                key={category}
                label={category}
                size="small"
                variant={selectedCategory === category ? 'filled' : 'outlined'}
                onClick={() => setSelectedCategory(category)}
                sx={{ fontSize: '0.75rem' }}
              />
            ))}
          </Box>
        </Box>
      )}

      <Box
        sx={{
          maxHeight: 200,
          overflowY: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 1,
        }}
      >
        {Object.entries(displayEmojis).map(([category, emojis]) => (
          <Box key={category}>
            {searchTerm && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}
              >
                {category}
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {emojis.map((emoji, index) => (
                <Box
                  key={`${category}-${emoji}-${index}`}
                  onClick={() => onEmojiSelect(emoji)}
                  sx={{
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    p: 0.5,
                    borderRadius: 1,
                    backgroundColor:
                      selectedEmoji === emoji ? 'primary.light' : 'transparent',
                    '&:hover': { backgroundColor: 'action.hover' },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 32,
                    minHeight: 32,
                  }}
                >
                  {emoji}
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

interface ShoppingListModalProps {
  open: boolean;
  onClose: () => void;
  onItemAdded: (item: ShoppingListItem) => void;
}

const ShoppingListModal: React.FC<ShoppingListModalProps> = ({
  open,
  onClose,
  onItemAdded,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [qty, setQty] = useState('');
  const [proposedPrice, setProposedPrice] = useState(0);
  const [icon, setIcon] = useState('🛒');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user?.uid || !title.trim()) return;

    setLoading(true);
    try {
      const currentMonth = moment().format('YYYY-MM');
      const newItem: Omit<ShoppingListItem, 'id'> = {
        userId: user.uid,
        title: title.trim(),
        qty: qty.trim() || '1',
        proposedPrice,
        icon: icon.trim() || '🛒',
        purchased: false,
        purchasedPrice: 0,
        month: currentMonth,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await addDoc(
        collection(db, 'shoppingListOfMonth'),
        newItem
      );
      const createdItem: ShoppingListItem = {
        ...newItem,
        id: docRef.id,
      };

      onItemAdded(createdItem);

      // Reset form
      setTitle('');
      setQty('');
      setProposedPrice(0);
      setIcon('🛒');
      onClose();
    } catch (error) {
      console.error('Error adding shopping item:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Shopping Item</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Item Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            placeholder="e.g. Wooden Bars"
          />
          <TextField
            label="Quantity"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            fullWidth
            placeholder="e.g. 6 x bars"
          />
          <TextField
            label="Proposed Price"
            type="number"
            value={proposedPrice || ''}
            onChange={(e) => setProposedPrice(Number(e.target.value) || 0)}
            fullWidth
            placeholder="0"
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>Rs</Typography>,
            }}
          />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Select Icon:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box
                sx={{
                  fontSize: '2rem',
                  p: 1,
                  border: '2px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  backgroundColor: 'background.paper',
                  minWidth: 60,
                  textAlign: 'center',
                }}
              >
                {icon}
              </Box>
              {/* <Typography variant="body2" color="text.secondary">
                Click an emoji below to select
              </Typography> */}
            </Box>
            <EmojiPicker selectedEmoji={icon} onEmojiSelect={setIcon} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !title.trim()}
          startIcon={loading && <CircularProgress size={18} />}
        >
          {loading ? 'Adding...' : 'Add Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface PurchasePriceModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (price: number) => void;
  itemTitle: string;
  proposedPrice: number;
}

const PurchasePriceModal: React.FC<PurchasePriceModalProps> = ({
  open,
  onClose,
  onConfirm,
  itemTitle,
  proposedPrice,
}) => {
  const [purchasedPrice, setPurchasedPrice] = useState(proposedPrice);

  // Reset to proposed price when modal opens
  React.useEffect(() => {
    if (open) {
      setPurchasedPrice(proposedPrice);
    }
  }, [open, proposedPrice]);

  const handleConfirm = () => {
    onConfirm(purchasedPrice);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Mark as Purchased</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body1">
            How much did you pay for <strong>{itemTitle}</strong>?
          </Typography>
          <TextField
            label="Actual Price Paid"
            type="number"
            value={purchasedPrice}
            onChange={(e) => setPurchasedPrice(Number(e.target.value))}
            fullWidth
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>Rs</Typography>,
            }}
            helperText={`Proposed price was Rs ${proposedPrice}`}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained">
          Mark as Purchased
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ShoppingList: React.FC = () => {
  const { user } = useAuth();
  const { onboarding } = useOnboarding();
  const { theme: customTheme } = useCustomTheme();

  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [purchaseModal, setPurchaseModal] = useState<{
    open: boolean;
    item: ShoppingListItem | null;
  }>({ open: false, item: null });
  const [lastFetchedMonth, setLastFetchedMonth] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  // Calculate current month based on user's start of month preference
  const getCurrentMonth = useCallback(() => {
    const now = moment();
    const startOfMonth = onboarding?.startOfMonth?.value || 1;

    console.log(
      '📅 Calculating month - Current date:',
      now.format('YYYY-MM-DD'),
      'Start of month:',
      startOfMonth
    );

    // If current day is before start of month, we're still in the current month
    // The "start of month" is when the new month begins, not when the previous month ends
    if (now.date() < startOfMonth) {
      const result = now.format('YYYY-MM');
      console.log('📅 Using current month (before start date):', result);
      return result;
    }
    const result = now.format('YYYY-MM');
    console.log('📅 Using current month (after start date):', result);
    return result;
  }, [onboarding?.startOfMonth?.value]);

  const fetchItems = useCallback(async () => {
    if (!user?.uid) {
      console.log('No user UID available');
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) {
      console.log('Already fetching, skipping...');
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);

    try {
      const currentMonth = getCurrentMonth();
      console.log('🔄 FETCH START - Month:', currentMonth, 'User:', user.uid);
      console.log('🔄 Last fetched month:', lastFetchedMonth);
      console.log('🔄 Current items count:', items.length);

      const q = query(
        collection(db, 'shoppingListOfMonth'),
        where('month', '==', currentMonth)
      );

      const snapshot = await getDocs(q);
      console.log('📊 Firebase snapshot size:', snapshot.docs.length);

      const docs = snapshot.docs.map((doc) => {
        const data = doc.data() as ShoppingListItem;
        console.log('📄 Raw doc data:', data);
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
        };
      });

      console.log('📋 All docs:', docs);

      // Filter by current user and sort by createdAt on client side
      const userItems = docs
        .filter((item) => item.userId === user.uid)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      console.log('✅ Filtered user items:', userItems);
      console.log('✅ Setting items to state...');

      // Only update items if we have results or if we're clearing them intentionally
      if (userItems.length > 0 || currentMonth !== lastFetchedMonth) {
        setItems(userItems);
        setLastFetchedMonth(currentMonth);
        console.log('✅ Items set successfully');
      } else {
        console.log(
          '⚠️ Skipping empty items update to prevent clearing existing data'
        );
      }
    } catch (error) {
      console.error('❌ Error fetching shopping items:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      console.log('🏁 Fetch completed');
    }
  }, [user?.uid, getCurrentMonth]);

  useEffect(() => {
    console.log('🚀 useEffect triggered');
    console.log('🚀 user?.uid:', user?.uid);
    console.log(
      '🚀 onboarding?.startOfMonth?.value:',
      onboarding?.startOfMonth?.value
    );
    console.log('🚀 onboarding object:', onboarding);

    if (user?.uid) {
      console.log('🚀 Calling fetchItems...');
      fetchItems();
    } else {
      console.log('🚀 No user UID, setting loading to false');
      setLoading(false);
      setItems([]);
    }
  }, [user?.uid, onboarding?.startOfMonth?.value, fetchItems]);

  const handleTogglePurchase = (item: ShoppingListItem) => {
    if (item.purchased) {
      // If already purchased, just toggle back
      handleUpdatePurchase(item, false, 0);
    } else {
      // If not purchased, show price input modal
      setPurchaseModal({ open: true, item });
    }
  };

  const handleUpdatePurchase = async (
    item: ShoppingListItem,
    purchased: boolean,
    purchasedPrice: number
  ) => {
    if (!item.id) return;

    try {
      await updateDoc(doc(db, 'shoppingListOfMonth', item.id), {
        purchased,
        purchasedPrice,
        updatedAt: new Date(),
      });

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, purchased, purchasedPrice, updatedAt: new Date() }
            : i
        )
      );
    } catch (error) {
      console.error('Error updating purchase status:', error);
    }
  };

  const handlePurchaseConfirm = (price: number) => {
    if (purchaseModal.item) {
      handleUpdatePurchase(purchaseModal.item, true, price);
    }
  };

  const handleItemAdded = (newItem: ShoppingListItem) => {
    setItems((prev) => [newItem, ...prev]);
  };

  // Calculate budget totals
  const purchasedTotal = items
    .filter((item) => item.purchased)
    .reduce((sum, item) => sum + item.purchasedPrice, 0);

  if (loading) {
    return (
      <Card
        sx={{
          backgroundColor: customTheme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          color: customTheme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        }}
      >
        <CardContent>
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight={200}
          >
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        sx={{
          backgroundColor: customTheme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          color: customTheme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        }}
      >
        <CardContent>
          {/* Header */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={3}
          >
            <Typography variant="h6" fontWeight="bold">
              Shopping List
            </Typography>
            <Button
              onClick={() => setOpenModal(true)}
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              sx={{
                backgroundColor: '#FACC15',
                color: '#000',
                fontWeight: 600,
                '&:hover': { backgroundColor: '#EAB308' },
              }}
            >
              Add Item
            </Button>
          </Box>

          {/* Budget Summary */}
          {items.length > 0 && (
            <Box mb={3}>
              <Box
                display="flex"
                alignItems="center"
                gap={1}
                justifyContent="center"
              >
                <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                  <CheckCircleIcon sx={{ fontSize: 18 }} />
                </Avatar>
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    sx={{ lineHeight: 1.2 }}
                  >
                    Rs {purchasedTotal.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Spent
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* Items List */}
          {items.length === 0 ? (
            <Box textAlign="center" py={4}>
              <ShoppingCartIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="body1" color="text.secondary" mb={2}>
                No items in your shopping list yet
              </Typography>
              <Button
                onClick={() => setOpenModal(true)}
                variant="outlined"
                startIcon={<AddIcon />}
              >
                Add Your First Item
              </Button>
            </Box>
          ) : (
            <Box>
              {items.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    mb: 1,
                    backgroundColor:
                      customTheme?.mode === 'dark' ? '#334155' : '#f8fafc',
                    borderRadius: 2,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor:
                        customTheme?.mode === 'dark' ? '#475569' : '#e2e8f0',
                    },
                  }}
                >
                  <Box display="flex" alignItems="center" gap={2} flex={1}>
                    <Checkbox
                      icon={<CircleOutlinedIcon />}
                      checkedIcon={
                        <CheckCircleIcon className="text-green-500" />
                      }
                      checked={item.purchased}
                      onChange={() => handleTogglePurchase(item)}
                      size="small"
                    />
                    <Typography sx={{ fontSize: '1.5rem' }}>
                      {item.icon || '🛒'}
                    </Typography>
                    <Box flex={1}>
                      <Typography
                        variant="body1"
                        fontWeight="medium"
                        sx={{
                          textDecoration: item.purchased
                            ? 'line-through'
                            : 'none',
                          color: item.purchased
                            ? 'text.secondary'
                            : 'text.primary',
                        }}
                      >
                        {item.title}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {item.qty}
                        </Typography>
                        {item.proposedPrice > 0 && (
                          <>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              •
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Rs {item.proposedPrice.toLocaleString()}
                            </Typography>
                          </>
                        )}
                        {item.purchased && item.purchasedPrice > 0 && (
                          <>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              •
                            </Typography>
                            <Typography
                              variant="caption"
                              color="success.main"
                              fontWeight="bold"
                            >
                              Paid: Rs {item.purchasedPrice.toLocaleString()}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Footer */}
          {items.length > 0 && (
            <Box mt={3}>
              <Button
                variant="contained"
                fullWidth
                sx={{
                  backgroundColor: '#FACC15',
                  color: '#000',
                  fontWeight: 600,
                  borderRadius: '9999px',
                  '&:hover': { backgroundColor: '#EAB308' },
                }}
              >
                🛒 Shop Now
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add Item Modal */}
      <ShoppingListModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onItemAdded={handleItemAdded}
      />

      {/* Purchase Price Modal */}
      <PurchasePriceModal
        open={purchaseModal.open}
        onClose={() => setPurchaseModal({ open: false, item: null })}
        onConfirm={handlePurchaseConfirm}
        itemTitle={purchaseModal.item?.title || ''}
        proposedPrice={purchaseModal.item?.proposedPrice || 0}
      />
    </>
  );
};

export default ShoppingList;
