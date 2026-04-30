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
import MenuItem from '@mui/material/MenuItem';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useOnboarding } from '@/app/lib/context/onBoardingContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { BuyItem, ShoppingListItem } from '@/app/lib/interface';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import AddIcon from '@mui/icons-material/Add';

import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import DeleteIcon from '@mui/icons-material/Delete';
import Link from 'next/link';
import moment from 'moment-timezone';
import nlp from 'compromise';

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

type ShoppingInference = {
  qty?: string;
  proposedPrice?: number;
  icon?: string;
};

const keywordIconMap: { icon: string; keywords: string[] }[] = [
  {
    icon: '🍎',
    keywords: [
      'apple',
      'fruit',
      'banana',
      'orange',
      'vegetable',
      'veggie',
      'carrot',
      'spinach',
      'potato',
      'onion',
      'tomato',
    ],
  },
  {
    icon: '🥛',
    keywords: ['milk', 'dairy', 'cheese', 'butter', 'yogurt', 'egg', 'eggs'],
  },
  {
    icon: '🍗',
    keywords: ['meat', 'chicken', 'beef', 'mutton', 'fish', 'seafood'],
  },
  {
    icon: '🍞',
    keywords: ['bread', 'bun', 'bakery', 'cake', 'pastry', 'cookie'],
  },
  {
    icon: '🥤',
    keywords: [
      'drink',
      'juice',
      'cola',
      'soda',
      'beverage',
      'tea',
      'coffee',
      'water',
    ],
  },
  { icon: '🍫', keywords: ['snack', 'chips', 'chocolate', 'sweet', 'candy'] },
  {
    icon: '🧴',
    keywords: [
      'soap',
      'shampoo',
      'toothpaste',
      'lotion',
      'cleaner',
      'detergent',
    ],
  },
  {
    icon: '📱',
    keywords: ['phone', 'mobile', 'laptop', 'charger', 'gadget', 'earbuds'],
  },
  {
    icon: '👕',
    keywords: ['shirt', 'clothes', 'dress', 'jeans', 'shoes', 'jacket'],
  },
  {
    icon: '💊',
    keywords: ['medicine', 'vitamin', 'health', 'mask', 'sanitizer'],
  },
  { icon: '🎁', keywords: ['gift', 'present', 'toy'] },
];

const normalizeUnit = (unit?: string) => {
  if (!unit) return '';
  const normalized = unit.toLowerCase();
  if (['pcs', 'pc', 'piece', 'pieces'].includes(normalized)) return 'pcs';
  if (['kg', 'kilogram', 'kilograms'].includes(normalized)) return 'kg';
  if (['g', 'gram', 'grams'].includes(normalized)) return 'g';
  if (['pack', 'packs', 'packet', 'packets'].includes(normalized))
    return 'pack';
  if (['bottle', 'bottles'].includes(normalized)) return 'bottle';
  if (['bag', 'bags'].includes(normalized)) return 'bag';
  if (['item', 'items'].includes(normalized)) return 'items';
  return normalized;
};

const parseNumberFromMatch = (value?: string) => {
  if (!value) return undefined;
  const cleaned = value.replace(/[^0-9.]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
};

const inferShoppingDetails = (title: string): ShoppingInference => {
  const result: ShoppingInference = {};
  const lower = title.toLowerCase();
  const doc = nlp(title);

  const currencyRegexes = [
    /(rs|pkr|₨|rupees)\s*([0-9][\d,\.]*)/i,
    /([0-9][\d,\.]*)\s*(rs|pkr|₨|rupees)/i,
  ];

  for (const regex of currencyRegexes) {
    const match = lower.match(regex);
    if (match) {
      const price = parseNumberFromMatch(match[2] || match[1]);
      if (price) {
        result.proposedPrice = Math.round(price);
        break;
      }
    }
  }

  const qtyRegexes = [
    /(\d+)\s*[xX]\s*(\w+)?/,
    /(\d+)\s*(pcs?|pieces?|packs?|kg|g|bags?|bottles?|items?)/i,
  ];

  for (const regex of qtyRegexes) {
    const match = title.match(regex);
    if (match) {
      const qtyVal = parseNumberFromMatch(match[1]);
      if (qtyVal) {
        const unit = normalizeUnit(match[2]);
        result.qty = unit ? `${qtyVal} ${unit}` : `${qtyVal}`;
        break;
      }
    }
  }

  if (!result.qty) {
    const numbers = doc.numbers().out('array') as (string | number)[];
    if (numbers && numbers.length > 0) {
      const candidate = Number(String(numbers[0]).replace(/,/g, ''));
      if (Number.isFinite(candidate) && candidate > 0) {
        result.qty = `${candidate}`;
      }
    }
  }

  const words = new Set([
    ...lower.split(/\s+/),
    ...doc
      .nouns()
      .out('array')
      .map((word: string) => word.toLowerCase()),
  ]);
  const iconMatch = keywordIconMap.find((entry) =>
    entry.keywords.some((keyword) => words.has(keyword))
  );
  if (iconMatch) {
    result.icon = iconMatch.icon;
  }

  return result;
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
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  
  const [touchedFields, setTouchedFields] = useState({
    qty: false,
    price: false,
    icon: false,
  });

  const handleQtyChange = (value: string) => {
    setTouchedFields((prev) => ({ ...prev, qty: true }));
    setQty(value);
  };

  const handlePriceChange = (value: number) => {
    setTouchedFields((prev) => ({ ...prev, price: true }));
    setProposedPrice(value);
  };

  const handleIconSelect = (emoji: string) => {
    setTouchedFields((prev) => ({ ...prev, icon: true }));
    setIcon(emoji);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!value.trim()) return;
    const suggestions = inferShoppingDetails(value);
    if (suggestions.qty && !touchedFields.qty) {
      setQty(suggestions.qty);
    }
    if (
      typeof suggestions.proposedPrice === 'number' &&
      suggestions.proposedPrice > 0 &&
      !touchedFields.price
    ) {
      setProposedPrice(suggestions.proposedPrice);
    }
    if (suggestions.icon && !touchedFields.icon) {
      setIcon(suggestions.icon);
    }
  };

  useEffect(() => {
    if (!open) {
      setTitle('');
      setQty('');
      setProposedPrice(0);
      setIcon('🛒');
      setTouchedFields({ qty: false, price: false, icon: false });
    }
  }, [open]);

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
        archived: false,
        movedToPlanId: null,
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
      setTouchedFields({ qty: false, price: false, icon: false });
      onClose();
    } catch (error) {
      console.error('Error adding shopping item:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>Add Shopping Item</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Item Title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            fullWidth
            required
            placeholder="e.g. Wooden Bars"
          />
          <TextField
            label="Quantity"
            value={qty}
            onChange={(e) => handleQtyChange(e.target.value)}
            fullWidth
            placeholder="e.g. 6 x bars"
          />
          <TextField
            label="Proposed Price"
            type="number"
            value={proposedPrice || ''}
            onChange={(e) => handlePriceChange(Number(e.target.value) || 0)}
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
            <EmojiPicker
              selectedEmoji={icon}
              onEmojiSelect={handleIconSelect}
            />
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
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<ShoppingListItem | null>(null);
  const [purchaseModal, setPurchaseModal] = useState<{
    open: boolean;
    item: ShoppingListItem | null;
  }>({ open: false, item: null });
  const [lastFetchedMonth, setLastFetchedMonth] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const [visibleCount, setVisibleCount] = useState(4);

  const [moveDialog, setMoveDialog] = useState<{
    open: boolean;
    items: ShoppingListItem[];
  }>({ open: false, items: [] });
  const [plans, setPlans] = useState<BuyItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newPlanBudget, setNewPlanBudget] = useState<number | ''>('');
  const [moveLoading, setMoveLoading] = useState(false);

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
  }, [user?.uid, getCurrentMonth, items.length, lastFetchedMonth]);

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
  }, [user?.uid, onboarding, fetchItems]);

  const handleTogglePurchase = (item: ShoppingListItem) => {
    if (item.purchased) {
      // Optimistic unmark: update UI first, then sync to Firestore
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, purchased: false, purchasedPrice: 0, updatedAt: new Date() }
            : i
        )
      );
      if (item.id) {
        updateDoc(doc(db, 'shoppingListOfMonth', item.id), {
          purchased: false,
          purchasedPrice: 0,
          updatedAt: new Date(),
        }).catch((error) => {
          console.error('Error updating purchase status:', error);
          // Revert on error
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, purchased: true, purchasedPrice: item.purchasedPrice }
                : i
            )
          );
        });
      }
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

  const handleDeleteItem = async (itemId: string) => {
    if (!itemId) return;
  
    // Step 1: trigger animation
    setDeletingItemId(itemId);
  
    // Step 2: wait for animation to finish
    setTimeout(async () => {
      try {
        await deleteDoc(doc(db, 'shoppingListOfMonth', itemId));
  
        // Step 3: remove from UI
        setItems((prev) => prev.filter((item) => item.id !== itemId));
      } catch (error) {
        console.error('Error deleting shopping item:', error);
      } finally {
        setDeletingItemId(null);
      }
    }, 300); // must match CSS transition duration
  };

  const handleArchiveItem = async (item: ShoppingListItem) => {
    if (!item.id || !item.purchased) return;
    try {
      await updateDoc(doc(db, 'shoppingListOfMonth', item.id), {
        archived: true,
        updatedAt: new Date(),
      });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, archived: true, updatedAt: new Date() } : i))
      );
    } catch (error) {
      console.error('Error archiving shopping item:', error);
    }
  };

  const ensurePlansLoaded = useCallback(async () => {
    if (!user?.uid) return;
    if (plans.length > 0) return;
    try {
      const snapshot = await getDocs(collection(db, 'buyItems'));
      const docs = snapshot.docs.map((d) => {
        const data = d.data() as BuyItem;
        return {
          ...data,
          id: d.id,
        };
      });
      setPlans(docs.filter((p) => p.userId === user.uid && !p.archived));
    } catch (error) {
      console.error('Error loading shopping plans:', error);
    }
  }, [plans.length, user?.uid]);

  const openMoveDialogForItems = async (itemsToMove: ShoppingListItem[]) => {
    await ensurePlansLoaded();
    setMoveDialog({ open: true, items: itemsToMove });
    setSelectedPlanId('');
    setNewPlanTitle('');
    setNewPlanBudget('');
  };

  const handleConfirmMoveToPlan = async () => {
    if (!user?.uid || moveDialog.items.length === 0) return;
    if (!selectedPlanId && !newPlanTitle.trim()) return;

    setMoveLoading(true);
    try {
      let targetPlanId = selectedPlanId;

      const itemsForPlan = moveDialog.items.map((item) => ({
        estimatedPrice: item.proposedPrice || 0,
        purchasedPrice: item.purchased ? item.purchasedPrice : undefined,
        title: item.title,
        isPurchased: item.purchased,
      }));

      if (!targetPlanId) {
        const now = new Date();
        const budget =
          typeof newPlanBudget === 'number'
            ? newPlanBudget
            : itemsForPlan.reduce((sum, i) => sum + (i.estimatedPrice || 0), 0);

        const newPlan: Omit<BuyItem, 'id'> = {
          userId: user.uid,
          title: newPlanTitle.trim(),
          items: itemsForPlan,
          archived: false,
          pinned: false,
          sharedWith: [],
          createdAt: now,
          updatedAt: now,
          budgetLimit: budget,
        };

        const docRef = await addDoc(collection(db, 'buyItems'), newPlan);
        targetPlanId = docRef.id;
        setPlans((prev) => [...prev, { ...newPlan, id: docRef.id }]);
      } else {
        const planRef = doc(db, 'buyItems', targetPlanId);
        const snap = await getDoc(planRef);
        if (snap.exists()) {
          const data = snap.data() as BuyItem;
          const updatedItems = [...(data.items || []), ...itemsForPlan];
          await updateDoc(planRef, {
            items: updatedItems,
            updatedAt: new Date(),
          });
        }
      }

      await Promise.all(
        moveDialog.items
          .filter((item) => item.id)
          .map((item) =>
            updateDoc(doc(db, 'shoppingListOfMonth', item.id as string), {
              movedToPlanId: targetPlanId,
              updatedAt: new Date(),
            })
          )
      );

      setItems((prev) =>
        prev.map((i) =>
          moveDialog.items.some((m) => m.id === i.id)
            ? { ...i, movedToPlanId: targetPlanId, updatedAt: new Date() }
            : i
        )
      );

      setMoveDialog({ open: false, items: [] });
    } catch (error) {
      console.error('Error moving items to shopping plan:', error);
    } finally {
      setMoveLoading(false);
    }
  };

  // Calculate budget totals (include archived/moved items)
  const purchasedTotal = items
    .filter((item) => item.purchased)
    .reduce((sum, item) => sum + item.purchasedPrice, 0);

  const visibleItems = items.filter(
    (item) => !item.archived && !item.movedToPlanId
  );

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
          {visibleItems.length === 0 ? (
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
              {visibleItems.slice(0, Math.min(visibleCount, visibleItems.length)).map((item) => (
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
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    overflow: 'hidden',
                    ...(deletingItemId === item.id && {
                      opacity: 0,
                      transform: 'scale(0.95)',
                      maxHeight: 0,
                      paddingTop: 0,
                      paddingBottom: 0,
                      marginBottom: 0,
                    }),
                    '&:hover': {
                      backgroundColor:
                        customTheme?.mode === 'dark' ? '#475569' : '#e2e8f0',
                      '& .delete-button': {
                        opacity: 1,
                      },
                    },
                  }}
                >
                  <Box flex={1} display="flex" flexDirection="column" gap={0.5}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Checkbox
                        icon={<CircleOutlinedIcon />}
                        checkedIcon={
                          <CheckCircleIcon className="text-green-500" />
                        }
                        checked={item.purchased}
                        onChange={() => handleTogglePurchase(item)}
                        size="small"
                      />
                      <Typography sx={{ fontSize: '1.4rem' }}>
                        {item.icon || '🛒'}
                      </Typography>
                      <Box flex={1}>
                        <Typography
                          variant="body2"
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
                        <Box
                          display="flex"
                          alignItems="center"
                          gap={1}
                          mt={0.25}
                        >
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
                    <Box
                      mt={0.25}
                      display="flex"
                      justifyContent="flex-end"
                      alignItems="center"
                      gap={0.5}
                      flexWrap="wrap"
                    >
                      {item.purchased && !item.archived && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleArchiveItem(item)}
                          sx={{ fontSize: '0.65rem', px: 1, py: 0.25 }}
                        >
                          Archive
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => openMoveDialogForItems([item])}
                        sx={{ fontSize: '0.65rem', px: 1, py: 0.25 }}
                      >
                        Move to Plan
                      </Button>
                      <Box
                        className="delete-button"
                        sx={{
                          opacity: 0,
                          transition: 'opacity 0.2s ease',
                          ml: 0.5,
                        }}
                      >
                        <Button
                          onClick={() => setConfirmDeleteItem(item)}
                          size="small"
                          color="error"
                          disabled={deletingItemId === item.id}
                          sx={{
                            minWidth: 'auto',
                            p: 0.5,
                            '&:hover': {
                              backgroundColor: 'error.light',
                            },
                          }}
                        >
                          {deletingItemId === item.id ? (
                            <CircularProgress size={16} color="error" />
                          ) : (
                            <DeleteIcon fontSize="small" />
                          )}
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              ))}
              {visibleItems.length > visibleCount && (
                <Box mt={2} textAlign="center">
                  <Button
                    variant="text"
                    onClick={() =>
                      setVisibleCount((prev) =>
                        Math.min(prev + 4, visibleItems.length)
                      )
                    }
                  >
                    View more items
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Footer */}
          {items.length > 0 && (
            <Box mt={3}>
              <Link href="/1/monthly-shopping" style={{ textDecoration: 'none' }}>
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
                  🛒 View More
                </Button>
              </Link>
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
      {/* Confirm Delete Dialog */}
      <Dialog
        open={!!confirmDeleteItem}
        onClose={() => setConfirmDeleteItem(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete item?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete{' '}
            <strong>{confirmDeleteItem?.title}</strong> from this month&apos;s
            shopping list? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteItem(null)}>Cancel</Button>
          <Button
            onClick={() => {
              if (confirmDeleteItem?.id) {
                handleDeleteItem(confirmDeleteItem.id);
              }
              setConfirmDeleteItem(null);
            }}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move to Plan Dialog */}
      <Dialog
        open={moveDialog.open}
        onClose={() => setMoveDialog({ open: false, items: [] })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Move to Shopping Plan</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Select an existing plan or create a new one to move the selected
              item(s).
            </Typography>

            {plans.length > 0 && (
              <TextField
                select
                label="Existing Plans"
                value={selectedPlanId}
                onChange={(e) => {
                  setSelectedPlanId(e.target.value);
                  // If user picked an existing plan, we hide new-plan fields
                }}
                fullWidth
                SelectProps={{ native: false }}
              >
                <MenuItem value="">
                  <em>Select a plan</em>
                </MenuItem>
                {plans.map((plan) => (
                  <MenuItem key={plan.id} value={plan.id}>
                    {plan.title}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {/* New plan section - collapsible when existing plan selected */}
            {plans.length === 0 || !selectedPlanId ? (
              <>
                {plans.length > 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    Or create new plan:
                  </Typography>
                )}
                <TextField
                  label="New Plan Title"
                  value={newPlanTitle}
                  onChange={(e) => setNewPlanTitle(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="New Plan Budget (optional)"
                  type="number"
                  value={newPlanBudget}
                  onChange={(e) =>
                    setNewPlanBudget(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  fullWidth
                />
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setMoveDialog({ open: false, items: [] })}
            disabled={moveLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmMoveToPlan}
            variant="contained"
            disabled={
              moveLoading ||
              (!selectedPlanId && !newPlanTitle.trim()) ||
              moveDialog.items.length === 0
            }
            startIcon={moveLoading ? <CircularProgress size={16} /> : undefined}
          >
            {moveLoading ? 'Moving...' : 'Move'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ShoppingList;
