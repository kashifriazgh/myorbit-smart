'use client';

import {
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HistoryIcon from '@mui/icons-material/History';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import SyncIcon from '@mui/icons-material/Sync';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useEffect, useRef, useState, useMemo } from 'react';
import { db } from '@/app/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import {
  TotalCashSnapshot,
  TransactionSource,
  Bank,
  CustomPaymentHead,
  CashTransaction,
  LoanRecord,
  Liability,
} from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { formatCurrency } from '@/app/lib/utilts';
import AddMoney from './TotalCashSnapshot/AddMoney';
import DeductMoney from './TotalCashSnapshot/DeductMoney';
import LoanDialog from './TotalCashSnapshot/LoanRecord';
import TransactionHistory from './TotalCashSnapshot/TransactionHistory';
import TransferFunds from './TotalCashSnapshot/TransferFunds';
import LiabilityDialog from './TotalCashSnapshot/LiabilityDialog';

export const getSourceKey = (
  source: TransactionSource,
  bankName?: string | null,
  customPaymentHeadName?: string | null
): string => {
  if (source === 'bank' && bankName) return `bank:${bankName}`;
  if (source === 'custom' && customPaymentHeadName) return `custom:${customPaymentHeadName}`;
  return source;
};

/** Compute the overall total amount across all wallets */
export function computeTotalAmount(snapshot: TotalCashSnapshot): number {
  let total = 0;
  const { sources } = snapshot;
  if (!sources) return 0;

  for (const val of Object.values(sources)) {
    if (typeof val === 'number') {
      total += val;
    } else if (val && typeof val === 'object' && val !== null) {
      for (const subVal of Object.values(val as Record<string, number>)) {
        if (typeof subVal === 'number') {
          total += subVal;
        }
      }
    }
  }
  return total;
}

/** Compute the amount available to spend (excludes locked wallets and wallets owned by others) */
export function computeAvailableToSpend(snapshot: TotalCashSnapshot): number {
  let available = 0;
  const { sources, sourceOwnership } = snapshot;
  if (!sources) return 0;

  const isSpendable = (key: string, isCustom = false) => {
    const o = sourceOwnership?.[key];
    if (o?.isLocked) return false;
    if (o && typeof o.hasOwnThisMoney === 'boolean') {
      return o.hasOwnThisMoney;
    }
    return !isCustom;
  };

  for (const [key, val] of Object.entries(sources)) {
    if (key === 'bank' && typeof val === 'object' && val !== null) {
      for (const [bankName, bankAmt] of Object.entries(val as Record<string, number>)) {
        if (isSpendable(`bank:${bankName}`, false)) available += bankAmt;
      }
    } else if (key === 'custom' && typeof val === 'object' && val !== null) {
      for (const [customName, customAmt] of Object.entries(val as Record<string, number>)) {
        if (isSpendable(`custom:${customName}`, true)) available += customAmt;
      }
    } else if (typeof val === 'number') {
      if (isSpendable(key, false)) available += val;
    }
  }

  return available;
}

export interface WalletItem {
  id: string; // 'other' | 'easypaisa' | 'jazzcash' | 'in_hand' | 'bank:Name' | 'custom:Name'
  sourceType: TransactionSource;
  name: string;
  bankName?: string;
  customName?: string;
  category: 'built-in' | 'bank' | 'custom';
  owner: string;
  hasOwnThisMoney: boolean;
  isLocked: boolean;
  amount: number;
  initial: string;
  color: string;
  subtitle: string;
}

const PALETTE = ['#5B3FA8', '#9A4410', '#0F766E', '#0369A1', '#C2410C', '#4338CA', '#BE185D', '#047857'];
function getWalletColor(name: string, category: 'built-in' | 'bank' | 'custom'): string {
  if (name.toLowerCase().includes('easypaisa')) return '#167A42';
  if (name.toLowerCase().includes('jazzcash')) return '#B3202A';
  if (name.toLowerCase().includes('in hand')) return '#7A5200';
  if (name.toLowerCase().includes('personal spending')) return '#0F3D33';
  if (category === 'bank') return '#1E4FA3';
  if (name.toLowerCase().includes('saving') || name.toLowerCase().includes('save')) return '#5B3FA8';
  if (name.toLowerCase().includes('abu') || name.toLowerCase().includes('abbu') || name.toLowerCase().includes('ammi')) return '#9A4410';
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function TotalCashSnapshotComponent({
  userId,
}: {
  userId: string;
  banks?: Bank[];
}) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [snapshot, setSnapshot] = useState<TotalCashSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTotal, setShowTotal] = useState(true);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [showLoanInfoModal, setShowLoanInfoModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // Dialog open states
  const [openAdd, setOpenAdd] = useState(false);
  const [moneyDialogMode, setMoneyDialogMode] = useState<'add' | 'deduct'>('add');
  const [openDeduct, setOpenDeduct] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openLoan, setOpenLoan] = useState(false);
  const [openLiability, setOpenLiability] = useState(false);

  // Pre-selected transfer wallet
  const [transferInitialFrom, setTransferInitialFrom] = useState<{
    source: TransactionSource;
    bankName?: string;
    customName?: string;
  } | undefined>(undefined);

  // Wallet details / actions modal
  const [activeWalletModal, setActiveWalletModal] = useState<WalletItem | null>(null);

  // Add new wallet modal
  const [openAddWalletModal, setOpenAddWalletModal] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState<'custom' | 'bank'>('custom');
  const [newWalletBalance, setNewWalletBalance] = useState('');
  const [newWalletIsLocked, setNewWalletIsLocked] = useState(false);
  const [newWalletIsOwn, setNewWalletIsOwn] = useState(true);
  const [newWalletOwnerName, setNewWalletOwnerName] = useState('');

  // Ownership edit modal within wallet detail
  const [editingOwnership, setEditingOwnership] = useState(false);
  const [editOwnerIsSelf, setEditOwnerIsSelf] = useState(true);
  const [editOwnerName, setEditOwnerName] = useState('');

  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [banksList, setBanksList] = useState<Bank[]>([]);
  const [customHeadsList, setCustomHeadsList] = useState<CustomPaymentHead[]>([]);

  const fabRef = useRef<HTMLDivElement>(null);

  const [isCached, setIsCached] = useState(false);
  const [needsFetch, setNeedsFetch] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const triggerRefresh = () => {
    try {
      localStorage.removeItem(`finance_cache_${userId}`);
    } catch {}
    setIsCached(false);
    setRefreshing(true);
    setNeedsFetch(true);
    setRefreshKey((k) => k + 1);
  };

  const ensureLive = () => {
    try {
      localStorage.removeItem(`finance_cache_${userId}`);
    } catch {}
    setIsCached(false);
    setNeedsFetch(true);
  };

  useEffect(() => {
    if (!refreshing) return;
    const t = setTimeout(() => setRefreshing(false), 8000);
    return () => clearTimeout(t);
  }, [refreshing]);

  // Bootstrap from cache on mount
  useEffect(() => {
    if (!userId) return;
    try {
      const cachedRaw = localStorage.getItem(`finance_cache_${userId}`);
      if (cachedRaw) {
        const cache = JSON.parse(cachedRaw);
        const age = Date.now() - new Date(cache.timestamp).getTime();
        if (age < 10 * 60 * 1000 && cache.snapshot) {
          setSnapshot(cache.snapshot);
          setLoans(cache.loans || []);
          setLiabilities(cache.liabilities || []);
          setIsCached(true);
          setNeedsFetch(false);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load finance cache:', e);
    }
    setNeedsFetch(true);
  }, [userId]);

  // Set up Firebase subscriptions
  useEffect(() => {
    if (!userId || !needsFetch) return;

    const qLoans = query(collection(db, 'loans'), where('userId', '==', userId));
    const unsubLoans = onSnapshot(qLoans, (snap) => {
      const list: LoanRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LoanRecord, 'id'>),
      }));
      setLoans(list);
    });

    const qLiabilities = query(collection(db, 'liabilities'), where('userId', '==', userId));
    const unsubLiabilities = onSnapshot(qLiabilities, (snap) => {
      const list: Liability[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Liability, 'id'>),
      }));
      setLiabilities(list);
    });

    const qBanks = query(collection(db, 'banks'), where('userId', '==', userId));
    const unsubBanks = onSnapshot(qBanks, (snap) => {
      setBanksList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bank, 'id'>) })));
    });

    const qHeads = query(collection(db, 'customPaymentHeads'), where('userId', '==', userId));
    const unsubHeads = onSnapshot(qHeads, (snap) => {
      setCustomHeadsList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomPaymentHead, 'id'>) })));
    });

    const docRef = doc(db, 'totalCashSnapshots', userId);
    const unsubSnap = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as TotalCashSnapshot;

        let normalizedBank: Record<string, number> = {};
        if (typeof data.sources.bank === 'number') {
          normalizedBank = { Default: data.sources.bank };
        } else {
          normalizedBank = data.sources.bank || {};
        }

        let normalizedCustom: Record<string, number> = {};
        if (typeof data.sources.custom === 'number') {
          normalizedCustom = { Default: data.sources.custom };
        } else {
          normalizedCustom = data.sources.custom || {};
        }

        const normSnapshot: TotalCashSnapshot = {
          ...data,
          sources: {
            ...data.sources,
            bank: normalizedBank,
            custom: normalizedCustom,
          },
          heldBy: data.heldBy || {},
          sourceOwnership: data.sourceOwnership || {},
        };
        setSnapshot(normSnapshot);
      } else {
        const initial: TotalCashSnapshot = {
          userId,
          sources: {
            in_hand: 0,
            bank: {},
            easypaisa: 0,
            jazzcash: 0,
            other: 0,
            custom: {},
          },
          heldBy: {},
          sourceOwnership: {},
          totalAmount: 0,
          freezeAmount: 0,
          updatedAt: new Date(),
          createdAt: new Date(),
        };
        await setDoc(docRef, initial);
        setSnapshot(initial);
      }
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error("Error listening to totalCashSnapshots:", error);
      setLoading(false);
      setRefreshing(false);
    });

    return () => {
      unsubLoans();
      unsubLiabilities();
      unsubBanks();
      unsubHeads();
      unsubSnap();
    };
  }, [userId, needsFetch, refreshKey]);

  // Atomically save to cache when snapshot changes
  useEffect(() => {
    if (!userId || loading || !snapshot) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `finance_cache_${userId}`,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            snapshot,
            loans,
            liabilities,
          })
        );
        setIsCached(true);
      } catch (e) {
        console.warn('Failed to save finance cache:', e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [userId, loading, snapshot, loans, liabilities]);

  useEffect(() => {
    if (openAdd || openDeduct || openTransfer || openLoan || openLiability || showTransactionHistory || openAddWalletModal) {
      setNeedsFetch(true);
    }
  }, [openAdd, openDeduct, openTransfer, openLoan, openLiability, showTransactionHistory, openAddWalletModal]);

  const totalsData = useMemo(() => {
    let borrowLoansSum = 0;
    let borrowLoansCount = 0;
    let lendLoansSum = 0;
    let lendLoansCount = 0;

    loans.forEach((l) => {
      if (!l.isSettled) {
        const remaining = (l.amount ?? 0) - (l.paidAmount ?? 0);
        if (l.type === 'borrow') {
          borrowLoansSum += remaining;
          borrowLoansCount++;
        } else if (l.type === 'lend') {
          lendLoansSum += remaining;
          lendLoansCount++;
        }
      }
    });

    let borrowLiabilitiesSum = 0;
    let borrowLiabilitiesCount = 0;
    let lendLiabilitiesSum = 0;
    let lendLiabilitiesCount = 0;

    liabilities.forEach((l) => {
      if (l.status !== 'settled') {
        if (l.type === 'borrowed') {
          borrowLiabilitiesSum += l.amount;
          borrowLiabilitiesCount++;
        } else if (l.type === 'lend') {
          lendLiabilitiesSum += l.amount;
          lendLiabilitiesCount++;
        }
      }
    });

    return {
      toPay: borrowLoansSum + borrowLiabilitiesSum,
      toPayLoansCount: borrowLoansCount,
      toPayLiabilitiesCount: borrowLiabilitiesCount,
      toReceive: lendLoansSum + lendLiabilitiesSum,
      toReceiveLoansCount: lendLoansCount,
      toReceiveLiabilitiesCount: lendLiabilitiesCount,
    };
  }, [loans, liabilities]);

  const currency = 'PKR';

  // Construct Wallets list with strict priority order
  const walletsList: WalletItem[] = useMemo(() => {
    if (!snapshot || !snapshot.sources) return [];
    const list: WalletItem[] = [];

    const getOwnerInfo = (key: string, isCustom = false) => {
      const o = snapshot.sourceOwnership?.[key];
      const isLocked = o?.isLocked ?? false;
      const hasOwn = o && typeof o.hasOwnThisMoney === 'boolean' ? o.hasOwnThisMoney : !isCustom;
      const ownerName = hasOwn ? 'You' : (o?.ownerName || o?.ownserName || 'Someone else');
      return { owner: ownerName, hasOwnThisMoney: hasOwn, isLocked };
    };

    // 1. Priority Built-in Wallets:
    // i. Personal Spending ('other')
    const psInfo = getOwnerInfo('other', false);
    list.push({
      id: 'other',
      sourceType: 'other',
      name: 'Personal Spending',
      category: 'built-in',
      owner: psInfo.owner,
      hasOwnThisMoney: psInfo.hasOwnThisMoney,
      isLocked: psInfo.isLocked,
      amount: snapshot.sources.other ?? 0,
      initial: 'P',
      color: '#0F3D33',
      subtitle: psInfo.isLocked ? 'Built-in · Locked 🔒' : 'Built-in',
    });

    // ii. EasyPaisa
    const epInfo = getOwnerInfo('easypaisa', false);
    list.push({
      id: 'easypaisa',
      sourceType: 'easypaisa',
      name: 'Easypaisa',
      category: 'built-in',
      owner: epInfo.owner,
      hasOwnThisMoney: epInfo.hasOwnThisMoney,
      isLocked: epInfo.isLocked,
      amount: snapshot.sources.easypaisa ?? 0,
      initial: 'E',
      color: '#167A42',
      subtitle: epInfo.isLocked ? 'Built-in · Locked 🔒' : 'Built-in',
    });

    // iii. Jazz Cash
    const jcInfo = getOwnerInfo('jazzcash', false);
    list.push({
      id: 'jazzcash',
      sourceType: 'jazzcash',
      name: 'JazzCash',
      category: 'built-in',
      owner: jcInfo.owner,
      hasOwnThisMoney: jcInfo.hasOwnThisMoney,
      isLocked: jcInfo.isLocked,
      amount: snapshot.sources.jazzcash ?? 0,
      initial: 'J',
      color: '#B3202A',
      subtitle: jcInfo.isLocked ? 'Built-in · Locked 🔒' : 'Built-in',
    });

    // iv. In Hand
    const ihInfo = getOwnerInfo('in_hand', false);
    list.push({
      id: 'in_hand',
      sourceType: 'in_hand',
      name: 'In Hand',
      category: 'built-in',
      owner: ihInfo.owner,
      hasOwnThisMoney: ihInfo.hasOwnThisMoney,
      isLocked: ihInfo.isLocked,
      amount: snapshot.sources.in_hand ?? 0,
      initial: 'H',
      color: '#7A5200',
      subtitle: ihInfo.isLocked ? 'Built-in · Locked 🔒' : 'Built-in',
    });

    // 2. Bank Wallets (Merged from snapshot & banks collection)
    const bankNames = new Set<string>();
    if (snapshot.sources.bank && typeof snapshot.sources.bank === 'object') {
      Object.keys(snapshot.sources.bank).forEach((b) => bankNames.add(b));
    }
    banksList.forEach((b) => bankNames.add(b.name));

    Array.from(bankNames).sort().forEach((bName) => {
      const key = `bank:${bName}`;
      const bInfo = getOwnerInfo(key, false);
      const amt = snapshot.sources.bank?.[bName] ?? 0;
      list.push({
        id: key,
        sourceType: 'bank',
        name: bName,
        bankName: bName,
        category: 'bank',
        owner: bInfo.owner,
        hasOwnThisMoney: bInfo.hasOwnThisMoney,
        isLocked: bInfo.isLocked,
        amount: amt,
        initial: bName.trim().charAt(0).toUpperCase() || 'B',
        color: '#1E4FA3',
        subtitle: bInfo.isLocked ? 'Custom · Bank · Locked 🔒' : 'Custom · Bank',
      });
    });

    // 3. Custom Wallets (Merged from snapshot & customPaymentHeads collection)
    const customNames = new Set<string>();
    if (snapshot.sources.custom && typeof snapshot.sources.custom === 'object') {
      Object.keys(snapshot.sources.custom).forEach((c) => customNames.add(c));
    }
    customHeadsList.forEach((c) => customNames.add(c.name));

    Array.from(customNames).sort().forEach((cName) => {
      const key = `custom:${cName}`;
      const cInfo = getOwnerInfo(key, true);
      const amt = snapshot.sources.custom?.[cName] ?? 0;
      let sub = 'Custom';
      if (cInfo.isLocked) {
        sub = 'Custom · Locked 🔒';
      } else if (!cInfo.hasOwnThisMoney && cInfo.owner && cInfo.owner !== 'You') {
        sub = `Custom · ${cInfo.owner}`;
      } else {
        sub = 'Custom · Wallet';
      }

      list.push({
        id: key,
        sourceType: 'custom',
        name: cName,
        customName: cName,
        category: 'custom',
        owner: cInfo.owner,
        hasOwnThisMoney: cInfo.hasOwnThisMoney,
        isLocked: cInfo.isLocked,
        amount: amt,
        initial: cName.trim().charAt(0).toUpperCase() || 'W',
        color: getWalletColor(cName, 'custom'),
        subtitle: sub,
      });
    });

    return list;
  }, [snapshot, banksList, customHeadsList]);

  // Totals calculations
  const totalAllWallets = snapshot ? computeTotalAmount(snapshot) : 0;
  const availableToSpend = snapshot ? computeAvailableToSpend(snapshot) : 0;

  // Close FAB on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Creation of a New Wallet
  const handleCreateWallet = async () => {
    if (!newWalletName.trim() || !userId || !snapshot) return;
    setSaving(true);
    try {
      const cleanName = newWalletName.trim();
      const initAmt = Number(newWalletBalance) || 0;
      const collectionName = newWalletType === 'bank' ? 'banks' : 'customPaymentHeads';

      await addDoc(collection(db, collectionName), {
        userId,
        name: cleanName,
        createdAt: serverTimestamp(),
      });

      const updatedSources = { ...snapshot.sources };
      if (newWalletType === 'bank') {
        updatedSources.bank = { ...(updatedSources.bank || {}), [cleanName]: initAmt };
      } else {
        updatedSources.custom = { ...(updatedSources.custom || {}), [cleanName]: initAmt };
      }

      const key = newWalletType === 'bank' ? `bank:${cleanName}` : `custom:${cleanName}`;
      const updatedOwnership = {
        ...(snapshot.sourceOwnership || {}),
        [key]: {
          hasOwnThisMoney: newWalletIsOwn,
          ownerName: newWalletIsOwn ? '' : (newWalletOwnerName.trim() || 'Someone else'),
          ownserName: newWalletIsOwn ? '' : (newWalletOwnerName.trim() || 'Someone else'),
          isLocked: newWalletIsLocked,
        },
      };

      let newTotal = snapshot.totalAmount || 0;
      if (initAmt > 0) {
        newTotal += initAmt;
        await addDoc(collection(db, 'cashTransactions'), {
          userId,
          amount: initAmt,
          type: 'add',
          source: newWalletType === 'bank' ? 'bank' : 'custom',
          category: 'manual',
          note: `Initial deposit for ${cleanName} wallet`,
          BankName: newWalletType === 'bank' ? cleanName : null,
          customPaymentHeadName: newWalletType === 'custom' ? cleanName : null,
          createdAt: serverTimestamp(),
        });
      }

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sources: updatedSources,
        sourceOwnership: updatedOwnership,
        totalAmount: newTotal,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', userId);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);

      // Reset form
      setNewWalletName('');
      setNewWalletBalance('');
      setNewWalletIsLocked(false);
      setNewWalletIsOwn(true);
      setNewWalletOwnerName('');
      setOpenAddWalletModal(false);
    } catch (err) {
      console.error('Error creating wallet:', err);
    } finally {
      setSaving(false);
    }
  };

  // Toggle Lock status on a wallet
  const handleToggleLockWallet = async (wallet: WalletItem) => {
    if (!userId || !snapshot) return;
    setSaving(true);
    try {
      const newLocked = !wallet.isLocked;
      const key = wallet.id;
      const currentO = snapshot.sourceOwnership?.[key] || {
        hasOwnThisMoney: wallet.hasOwnThisMoney,
        ownerName: wallet.owner === 'You' ? '' : wallet.owner,
      };

      const updatedOwnership = {
        ...(snapshot.sourceOwnership || {}),
        [key]: {
          ...currentO,
          isLocked: newLocked,
        },
      };

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sourceOwnership: updatedOwnership,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', userId);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);

      if (activeWalletModal && activeWalletModal.id === wallet.id) {
        setActiveWalletModal({
          ...activeWalletModal,
          isLocked: newLocked,
          subtitle: newLocked
            ? (wallet.category === 'built-in' ? 'Built-in · Locked 🔒' : wallet.category === 'bank' ? 'Custom · Bank · Locked 🔒' : 'Custom · Locked 🔒')
            : (wallet.category === 'built-in' ? 'Built-in' : wallet.category === 'bank' ? 'Custom · Bank' : 'Custom · Wallet'),
        });
      }
    } catch (err) {
      console.error('Failed to toggle wallet lock:', err);
    } finally {
      setSaving(false);
    }
  };

  // Save ownership edits
  const handleSaveOwnership = async () => {
    if (!activeWalletModal || !userId || !snapshot) return;
    setSaving(true);
    try {
      const key = activeWalletModal.id;
      const currentO = snapshot.sourceOwnership?.[key] || {};
      const ownerVal = editOwnerIsSelf ? '' : (editOwnerName.trim() || 'Someone else');

      const updatedOwnership = {
        ...(snapshot.sourceOwnership || {}),
        [key]: {
          ...currentO,
          hasOwnThisMoney: editOwnerIsSelf,
          ownerName: ownerVal,
          ownserName: ownerVal,
        },
      };

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sourceOwnership: updatedOwnership,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', userId);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);

      setActiveWalletModal({
        ...activeWalletModal,
        owner: editOwnerIsSelf ? 'You' : ownerVal,
        hasOwnThisMoney: editOwnerIsSelf,
      });
      setEditingOwnership(false);
    } catch (err) {
      console.error('Failed to update wallet ownership:', err);
    } finally {
      setSaving(false);
    }
  };

  // Delete custom or bank wallet
  const handleDeleteWallet = async (wallet: WalletItem) => {
    if (!userId || !snapshot || wallet.category === 'built-in') return;
    if (!confirm(`Are you sure you want to delete the "${wallet.name}" wallet?`)) return;
    setSaving(true);
    try {
      const updatedSources = { ...snapshot.sources };
      let deducted = 0;

      if (wallet.category === 'bank' && wallet.bankName) {
        deducted = updatedSources.bank?.[wallet.bankName] || 0;
        delete updatedSources.bank[wallet.bankName];
        const q = query(collection(db, 'banks'), where('userId', '==', userId), where('name', '==', wallet.bankName));
        const snap = await getDocs(q);
        snap.docs.forEach((d) => deleteDoc(d.ref));
      } else if (wallet.category === 'custom' && wallet.customName) {
        deducted = updatedSources.custom?.[wallet.customName] || 0;
        delete updatedSources.custom[wallet.customName];
        const q = query(collection(db, 'customPaymentHeads'), where('userId', '==', userId), where('name', '==', wallet.customName));
        const snap = await getDocs(q);
        snap.docs.forEach((d) => deleteDoc(d.ref));
      }

      const updatedOwnership = { ...(snapshot.sourceOwnership || {}) };
      delete updatedOwnership[wallet.id];

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sources: updatedSources,
        sourceOwnership: updatedOwnership,
        totalAmount: Math.max(0, (snapshot.totalAmount || 0) - deducted),
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', userId);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);
      setActiveWalletModal(null);
    } catch (err) {
      console.error('Failed to delete wallet:', err);
    } finally {
      setSaving(false);
    }
  };

  // Add Money handler
  const handleAddMoney = async (
    amount: number,
    source: TransactionSource,
    isFreezed: boolean,
    bankId?: string,
    bankName?: string,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string,
    note?: string,
    holderName?: string
  ) => {
    ensureLive();
    setSaving(true);

    const txn: Omit<CashTransaction, 'id'> = {
      userId,
      amount,
      type: isFreezed ? 'freeze_transfer' : 'add',
      source: isFreezed ? 'other' : source,
      category: 'manual',
      note: note || (isFreezed ? 'Freezed addition' : 'Manual addition'),
      createdAt: serverTimestamp() as Timestamp,
      holderName: holderName || null,
    };

    if (bankId && !isFreezed) txn.bankId = bankId;
    if (bankName && !isFreezed) txn.BankName = bankName;
    if (customPaymentHeadId && !isFreezed) txn.customPaymentHeadId = customPaymentHeadId;
    if (customPaymentHeadName && !isFreezed) txn.customPaymentHeadName = customPaymentHeadName;

    await addDoc(collection(db, 'cashTransactions'), txn);

    const docRef = doc(db, 'totalCashSnapshots', userId);

    const updatedSources: TotalCashSnapshot['sources'] = {
      in_hand: snapshot?.sources.in_hand ?? 0,
      bank: snapshot?.sources.bank ?? {},
      easypaisa: snapshot?.sources.easypaisa ?? 0,
      jazzcash: snapshot?.sources.jazzcash ?? 0,
      other: snapshot?.sources.other ?? 0,
      custom: snapshot?.sources.custom ?? {},
    };

    const updatedHeldBy = snapshot?.heldBy ? { ...snapshot.heldBy } : {};

    if (!isFreezed) {
      if (source === 'bank' && bankName) {
        updatedSources.bank[bankName] =
          (updatedSources.bank[bankName] ?? 0) + amount;
      } else if (source === 'custom' && customPaymentHeadName) {
        updatedSources.custom[customPaymentHeadName] =
          (updatedSources.custom[customPaymentHeadName] ?? 0) + amount;
      } else if (source !== 'bank' && source !== 'custom') {
        updatedSources[source] = (updatedSources[source] ?? 0) + amount;
      }

      if (holderName && holderName !== 'Unassigned' && holderName !== 'Self') {
        const key = getSourceKey(source, bankName, customPaymentHeadName);
        const holders = [...(updatedHeldBy[key] || [])];
        const idx = holders.findIndex((h) => h.holderName === holderName);
        if (idx > -1) {
          holders[idx] = { ...holders[idx], amount: holders[idx].amount + amount };
        } else {
          holders.push({ holderName, amount });
        }
        updatedHeldBy[key] = holders;
      }
    }

    const updatedSnapshot: TotalCashSnapshot = {
      ...snapshot!,
      sources: updatedSources,
      heldBy: updatedHeldBy,
      freezeAmount: isFreezed
        ? (snapshot?.freezeAmount || 0) + amount
        : snapshot?.freezeAmount || 0,
      totalAmount: (snapshot?.totalAmount || 0) + amount,
      updatedAt: new Date(),
    };

    await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
    setSnapshot(updatedSnapshot);
    setSaving(false);
  };

  // Deduct Money handler
  const handleDeductMoney = async (
    amount: number,
    source: TransactionSource,
    bankId?: string,
    bankName?: string,
    fromFreeze: boolean = false,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string,
    note?: string,
    holderName?: string
  ) => {
    ensureLive();
    setSaving(true);

    const docRef = doc(db, 'totalCashSnapshots', userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      setSaving(false);
      return;
    }

    const data = docSnap.data() as TotalCashSnapshot;

    const updatedSources: TotalCashSnapshot['sources'] = {
      in_hand: data.sources.in_hand ?? 0,
      bank: data.sources.bank ? { ...data.sources.bank } : {},
      easypaisa: data.sources.easypaisa ?? 0,
      jazzcash: data.sources.jazzcash ?? 0,
      other: data.sources.other ?? 0,
      custom: data.sources.custom ? { ...data.sources.custom } : {},
    };

    const updatedHeldBy = data.heldBy ? { ...data.heldBy } : {};

    let newFreeze = data.freezeAmount ?? 0;
    let newTotal = data.totalAmount ?? 0;

    if (fromFreeze) {
      if (amount > newFreeze) {
        alert('Not enough balance in Freezed funds');
        setSaving(false);
        return;
      }
      newFreeze -= amount;
    }

    const key = getSourceKey(source, bankName, customPaymentHeadName);
    const isLocked = data.sourceOwnership?.[key]?.isLocked;
    if (isLocked) {
      alert('This wallet is locked. Please unlock it from the wallet options before deducting funds.');
      setSaving(false);
      return;
    }

    let current = 0;
    if (source === 'bank' && bankName) {
      current = updatedSources.bank[bankName] ?? 0;
    } else if (source === 'custom' && customPaymentHeadName) {
      current = updatedSources.custom[customPaymentHeadName] ?? 0;
    } else if (source !== 'bank' && source !== 'custom') {
      current = (updatedSources[source] as number) ?? 0;
    }

    if (amount > current) {
      alert(`Not enough balance in ${bankName || customPaymentHeadName || source}`);
      setSaving(false);
      return;
    }

    if (source === 'bank' && bankName) {
      updatedSources.bank[bankName] = current - amount;
    } else if (source === 'custom' && customPaymentHeadName) {
      updatedSources.custom[customPaymentHeadName] = current - amount;
    } else if (source !== 'bank' && source !== 'custom') {
      updatedSources[source] = current - amount;
    }
    newTotal -= amount;

    const updatedSnapshot: TotalCashSnapshot = {
      ...data,
      sources: updatedSources,
      heldBy: updatedHeldBy,
      freezeAmount: newFreeze,
      totalAmount: newTotal,
      updatedAt: new Date(),
    };

    await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });

    await addDoc(collection(db, 'cashTransactions'), {
      userId,
      amount,
      type: 'deduct',
      source,
      fromFreeze,
      category: fromFreeze ? 'freeze' : 'manual',
      note: note || (fromFreeze ? 'Deducted from Freezed' : 'Manual deduction'),
      bankId: bankId || null,
      BankName: bankName || null,
      customPaymentHeadId: customPaymentHeadId || null,
      customPaymentHeadName: customPaymentHeadName || null,
      holderName: holderName || null,
      createdAt: serverTimestamp(),
    });

    setSnapshot(updatedSnapshot);
    setSaving(false);
  };

  // Transfer funds handler
  const handleTransferHolders = async (
    amount: number,
    fromSource: TransactionSource,
    fromBankName?: string,
    fromCustomName?: string,
    fromHolder?: string,
    toSource?: TransactionSource,
    toBankName?: string,
    toCustomName?: string,
    toHolder?: string,
    note?: string
  ) => {
    ensureLive();
    setSaving(true);
    try {
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        setSaving(false);
        return;
      }
      const data = docSnap.data() as TotalCashSnapshot;

      const updatedSources: TotalCashSnapshot['sources'] = {
        in_hand: data.sources.in_hand ?? 0,
        bank: data.sources.bank ?? {},
        easypaisa: data.sources.easypaisa ?? 0,
        jazzcash: data.sources.jazzcash ?? 0,
        other: data.sources.other ?? 0,
        custom: data.sources.custom ?? {},
      };
      const updatedHeldBy = data.heldBy ? { ...data.heldBy } : {};

      const fromKey = getSourceKey(fromSource, fromBankName, fromCustomName);
      const isFromLocked = data.sourceOwnership?.[fromKey]?.isLocked;
      if (isFromLocked) {
        alert('Source wallet is locked. Please unlock it before transferring funds out.');
        setSaving(false);
        return;
      }

      const targetSource = toSource || fromSource;
      const targetBankName = toBankName || fromBankName;
      const targetCustomName = toCustomName || fromCustomName;
      const toKey = getSourceKey(targetSource, targetBankName, targetCustomName);

      let fromSourceBalance = 0;
      if (fromSource === 'bank' && fromBankName) {
        fromSourceBalance = updatedSources.bank[fromBankName] ?? 0;
      } else if (fromSource === 'custom' && fromCustomName) {
        fromSourceBalance = updatedSources.custom[fromCustomName] ?? 0;
      } else {
        fromSourceBalance = (updatedSources[fromSource] as number) ?? 0;
      }

      if (amount > fromSourceBalance) {
        alert('Not enough balance in source wallet');
        setSaving(false);
        return;
      }

      if (fromSource === 'bank' && fromBankName) {
        updatedSources.bank[fromBankName] -= amount;
      } else if (fromSource === 'custom' && fromCustomName) {
        updatedSources.custom[fromCustomName] -= amount;
      } else {
        (updatedSources[fromSource] as number) -= amount;
      }

      if (targetSource === 'bank' && targetBankName) {
        updatedSources.bank[targetBankName] = (updatedSources.bank[targetBankName] ?? 0) + amount;
      } else if (targetSource === 'custom' && targetCustomName) {
        updatedSources.custom[targetCustomName] = (updatedSources.custom[targetCustomName] ?? 0) + amount;
      } else {
        (updatedSources[targetSource] as number) = ((updatedSources[targetSource] as number) ?? 0) + amount;
      }

      if (toHolder && toHolder !== 'Unassigned' && toHolder !== 'Self') {
        const toHolders = [...(updatedHeldBy[toKey] || [])];
        const idx = toHolders.findIndex((h) => h.holderName === toHolder);
        if (idx > -1) {
          toHolders[idx] = { ...toHolders[idx], amount: toHolders[idx].amount + amount };
        } else {
          toHolders.push({ holderName: toHolder, amount });
        }
        updatedHeldBy[toKey] = toHolders;
      }

      let newTotalAmount = 0;
      Object.entries(updatedSources).forEach(([name, val]) => {
        if (name === 'bank' || name === 'custom') {
          Object.values(val as Record<string, number>).forEach((v) => {
            newTotalAmount += v;
          });
        } else {
          newTotalAmount += val as number;
        }
      });

      const updatedSnapshot: TotalCashSnapshot = {
        ...data,
        sources: updatedSources,
        heldBy: updatedHeldBy,
        totalAmount: newTotalAmount,
        updatedAt: new Date(),
      };

      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);

      await addDoc(collection(db, 'cashTransactions'), {
        userId,
        amount,
        type: 'transfer',
        source: fromSource,
        category: 'transfer',
        note: note || `Transferred ${amount} from ${fromBankName || fromCustomName || fromSource} to ${targetBankName || targetCustomName || targetSource}`,
        fromHolderName: fromHolder || null,
        toHolderName: toHolder || null,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const currentMonthYear = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, []);

  if (loading || !theme || !snapshot) {
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  const fabActions = [
    {
      icon: <AddCircleOutlineIcon />,
      label: 'Add Money',
      color: '#22c55e',
      onClick: () => {
        setFabOpen(false);
        setMoneyDialogMode('add');
        setOpenAdd(true);
      },
    },
    {
      icon: <RemoveCircleOutlineIcon />,
      label: 'Deduct',
      color: '#ef4444',
      onClick: () => {
        setFabOpen(false);
        setMoneyDialogMode('deduct');
        setOpenAdd(true);
      },
    },
    {
      icon: <SwapHorizIcon />,
      label: 'Transfer',
      color: '#3b82f6',
      onClick: () => {
        setFabOpen(false);
        setTransferInitialFrom(undefined);
        setOpenTransfer(true);
      },
    },
    {
      icon: <ReceiptLongIcon />,
      label: 'Loan Record',
      color: '#a855f7',
      onClick: () => {
        setFabOpen(false);
        setOpenLoan(true);
      },
    },
    {
      icon: <AssignmentOutlinedIcon />,
      label: 'Add Liability',
      color: '#ec4899',
      onClick: () => {
        setFabOpen(false);
        setOpenLiability(true);
      },
    },
    {
      icon: <HistoryIcon />,
      label: 'History',
      color: '#f59e0b',
      onClick: () => {
        setFabOpen(false);
        setShowTransactionHistory(true);
      },
    },
  ];

  return (
    <div className="w-full max-w-[480px] sm:max-w-[560px] mx-auto py-2 px-1 sm:px-2 flex flex-col gap-4 font-sans select-none">
      {/* ── Top Header Row ────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-extrabold text-[#14211E] dark:text-slate-100 tracking-tight">
            Finance
          </h1>
          {(isCached || refreshing) && (
            <Tooltip title={refreshing ? 'Syncing with server…' : 'Data loaded from local cache. Click to sync.'}>
              <span>
                <IconButton size="small" onClick={triggerRefresh} disabled={refreshing} sx={{ color: 'primary.main', p: 0.5 }}>
                  {refreshing ? <CircularProgress size={16} /> : <SyncIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-[#5A6B66] dark:text-slate-400">
            {currentMonthYear}
          </span>

          {/* Action Trigger FAB */}
          <div ref={fabRef} className="relative flex items-center">
            {/* Fan out actions */}
            <div
              className={`absolute right-0 top-[110%] pt-1 z-[1200] flex flex-col items-end gap-2 ${
                fabOpen ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
            >
              {fabActions.map((action, i) => (
                <div
                  key={action.label}
                  className={`flex items-center gap-2 transition-all duration-200 ${
                    fabOpen ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-4 scale-90'
                  }`}
                  style={{ transitionDelay: fabOpen ? `${i * 40}ms` : '0ms' }}
                >
                  <span
                    onClick={action.onClick}
                    style={{ backgroundColor: action.color }}
                    className="px-2.5 py-1 rounded-full text-white text-[11px] font-bold shadow-md cursor-pointer whitespace-nowrap"
                  >
                    {action.label}
                  </span>
                  <Fab
                    size="small"
                    onClick={action.onClick}
                    sx={{
                      bgcolor: action.color,
                      color: '#fff',
                      width: 36,
                      height: 36,
                      minHeight: 'unset',
                      '&:hover': { bgcolor: action.color, filter: 'brightness(1.1)' },
                    }}
                  >
                    {action.icon}
                  </Fab>
                </div>
              ))}
            </div>

            <Tooltip title={fabOpen ? 'Close actions' : 'Quick Actions'}>
              <Fab
                size="small"
                color="primary"
                onClick={() => setFabOpen((p) => !p)}
                sx={{
                  width: 36,
                  height: 36,
                  minHeight: 'unset',
                  boxShadow: '0 4px 12px rgba(15, 61, 51, 0.25)',
                  transition: 'transform 0.2s',
                  transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                  bgcolor: '#0F3D33',
                  '&:hover': { bgcolor: '#0B2D26' },
                }}
              >
                {fabOpen ? <CloseIcon fontSize="small" /> : <AddIcon fontSize="small" />}
              </Fab>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ── Top Hero Card (Available to spend & Total across wallets) ── */}
      <div className="bg-[#0F3D33] dark:bg-[#072922] dark:border dark:border-emerald-800/40 rounded-[24px] p-[22px] flex flex-col gap-1.5 text-white shadow-md relative overflow-hidden">
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-white/80 font-medium">Available to spend</span>
          <IconButton
            size="small"
            onClick={() => setShowTotal((p) => !p)}
            sx={{ color: 'rgba(255, 255, 255, 0.75)', p: 0.2 }}
            title={showTotal ? 'Hide balances' : 'Show balances'}
          >
            {showTotal ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
          </IconButton>
        </div>

        <span className="text-[34px] font-extrabold tracking-tight text-white leading-tight">
          {showTotal ? formatCurrency(availableToSpend, currency) : '•••••••'}
        </span>

        <span className="text-[13px] text-white/80 font-medium">
          Total across all wallets: {showTotal ? formatCurrency(totalAllWallets, currency) : '•••••••'}
        </span>
      </div>

      {/* ── Loans (Borrowed and Lent) Cards ───────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* To pay back */}
        <div
          onClick={() => setShowLoanInfoModal(true)}
          className="bg-white dark:bg-white/5 border border-[#E1E8E5] dark:border-white/10 rounded-[16px] p-3.5 flex flex-col gap-1 cursor-pointer hover:border-rose-400/50 hover:shadow-sm transition-all"
        >
          <span className="text-xs text-[#5A6B66] dark:text-slate-400 font-medium">To pay back</span>
          <span className="text-lg font-bold text-[#9A3412] dark:text-rose-400 tabular-nums">
            {formatCurrency(totalsData.toPay, currency)}
          </span>
          <span className="text-[10px] text-[#5A6B66] dark:text-slate-500 font-medium">
            {`(${totalsData.toPayLoansCount} loan${totalsData.toPayLoansCount !== 1 ? 's' : ''} + ${totalsData.toPayLiabilitiesCount} debt${totalsData.toPayLiabilitiesCount !== 1 ? 's' : ''})`}
          </span>
        </div>

        {/* To get back */}
        <div
          onClick={() => setShowLoanInfoModal(true)}
          className="bg-white dark:bg-white/5 border border-[#E1E8E5] dark:border-white/10 rounded-[16px] p-3.5 flex flex-col gap-1 cursor-pointer hover:border-emerald-500/50 hover:shadow-sm transition-all"
        >
          <span className="text-xs text-[#5A6B66] dark:text-slate-400 font-medium">To get back</span>
          <span className="text-lg font-bold text-[#0B5A44] dark:text-emerald-400 tabular-nums">
            {formatCurrency(totalsData.toReceive, currency)}
          </span>
          <span className="text-[10px] text-[#5A6B66] dark:text-slate-500 font-medium">
            {`(${totalsData.toReceiveLoansCount} loan${totalsData.toReceiveLoansCount !== 1 ? 's' : ''} + ${totalsData.toReceiveLiabilitiesCount} credit${totalsData.toReceiveLiabilitiesCount !== 1 ? 's' : ''})`}
          </span>
        </div>
      </div>

      {/* ── Wallets Section ───────────────────────────────────── */}
      <div className="flex justify-between items-center mt-1">
        <h2 className="m-0 text-[17px] font-bold text-[#14211E] dark:text-slate-100">Wallets</h2>
        <span className="text-[13px] text-[#5A6B66] dark:text-slate-400 font-medium">
          {walletsList.length} wallet{walletsList.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Wallets List Container */}
      <div className="flex flex-col gap-2.5">
        {walletsList.map((wallet) => (
          <button
            key={wallet.id}
            type="button"
            onClick={() => {
              setActiveWalletModal(wallet);
              setEditingOwnership(false);
            }}
            className="w-full box-border flex items-center gap-3.5 px-3.5 py-3 min-h-[64px] bg-white dark:bg-white/5 rounded-2xl border border-[#E1E8E5] dark:border-white/10 hover:border-emerald-500/40 hover:shadow-sm transition-all cursor-pointer text-left focus:outline-none"
          >
            {/* Wallet Avatar */}
            <span
              style={{ backgroundColor: wallet.color }}
              className="w-11 h-11 rounded-[14px] flex items-center justify-center font-bold text-lg text-white shrink-0 shadow-xs"
            >
              {wallet.initial}
            </span>

            {/* Wallet Info */}
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-[#14211E] dark:text-slate-100 truncate flex items-center gap-1.5">
                {wallet.name}
                {wallet.isLocked && <LockIcon sx={{ fontSize: 13, color: '#f43f5e' }} />}
              </span>
              <span className="text-xs text-[#5A6B66] dark:text-slate-400 truncate">
                {wallet.subtitle}
              </span>
            </span>

            {/* Amount */}
            <span className="text-[15px] font-bold text-[#14211E] dark:text-slate-100 tabular-nums shrink-0">
              {showTotal ? formatCurrency(wallet.amount, currency) : '••••••'}
            </span>
          </button>
        ))}
      </div>

      {/* ── Add Wallet Dashed Button ─────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setNewWalletName('');
          setNewWalletBalance('');
          setNewWalletType('custom');
          setNewWalletIsLocked(false);
          setNewWalletIsOwn(true);
          setNewWalletOwnerName('');
          setOpenAddWalletModal(true);
        }}
        className="w-full box-border flex items-center justify-center gap-2 min-h-[48px] rounded-2xl border-[1.5px] border-dashed border-[#0F3D33] dark:border-emerald-400 text-[#0F3D33] dark:text-emerald-400 font-bold text-[15px] hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer mt-1"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>Add wallet</span>
      </button>

      {/* ── See Transaction History Link ─────────────────────── */}
      <div className="mt-3 mb-1 flex justify-center">
        <button
          type="button"
          onClick={() => setShowTransactionHistory(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 font-semibold text-xs transition-all shadow-xs cursor-pointer"
        >
          <HistoryIcon sx={{ fontSize: 16 }} />
          <span>See Transaction History</span>
        </button>
      </div>

      {/* ════════════════════ MODALS ════════════════════ */}

      {/* ── Wallet Detail / Quick Action Modal ────────────────── */}
      {activeWalletModal && (
        <Dialog
          open={Boolean(activeWalletModal)}
          onClose={() => setActiveWalletModal(null)}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            sx: {
              borderRadius: 4,
              p: 1.5,
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
            },
          }}
        >
          <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="flex items-center gap-3">
              <span
                style={{ backgroundColor: activeWalletModal.color }}
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base text-white shrink-0"
              >
                {activeWalletModal.initial}
              </span>
              <div>
                <Typography variant="subtitle1" fontWeight="800" sx={{ lineHeight: 1.2 }}>
                  {activeWalletModal.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {activeWalletModal.subtitle}
                </Typography>
              </div>
            </div>
            <IconButton size="small" onClick={() => setActiveWalletModal(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ py: 2 }}>
            <div className="flex flex-col gap-4">
              {/* Balance card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Balance</span>
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatCurrency(activeWalletModal.amount, currency)}
                  </span>
                </div>
                <div>
                  {activeWalletModal.isLocked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                      <LockIcon sx={{ fontSize: 13 }} /> Locked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                      <LockOpenIcon sx={{ fontSize: 13 }} /> Unlocked
                    </span>
                  )}
                </div>
              </div>

              {/* Ownership details */}
              <div className="text-xs text-slate-600 dark:text-slate-300 px-1 flex justify-between items-center">
                <span>
                  Owner: <b>{activeWalletModal.owner}</b>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditOwnerIsSelf(activeWalletModal.hasOwnThisMoney);
                    setEditOwnerName(activeWalletModal.hasOwnThisMoney ? '' : activeWalletModal.owner);
                    setEditingOwnership((p) => !p);
                  }}
                  className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                >
                  {editingOwnership ? 'Cancel' : 'Change owner'}
                </button>
              </div>

              {/* Ownership edit form */}
              {editingOwnership && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/10 flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-white dark:bg-slate-900 p-1">
                    <button
                      type="button"
                      onClick={() => setEditOwnerIsSelf(true)}
                      className={`py-1 text-xs font-semibold rounded ${
                        editOwnerIsSelf ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Mine
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditOwnerIsSelf(false)}
                      className={`py-1 text-xs font-semibold rounded ${
                        !editOwnerIsSelf ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Someone else
                    </button>
                  </div>
                  {!editOwnerIsSelf && (
                    <TextField
                      size="small"
                      placeholder="e.g. Ammi, Abu, Friend"
                      value={editOwnerName}
                      onChange={(e) => setEditOwnerName(e.target.value)}
                    />
                  )}
                  <Button
                    size="small"
                    variant="contained"
                    disabled={saving}
                    onClick={handleSaveOwnership}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Save Owner
                  </Button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                {/* Transfer button */}
                <Button
                  variant="outlined"
                  onClick={() => {
                    const sel = activeWalletModal;
                    setActiveWalletModal(null);
                    setTransferInitialFrom({
                      source: sel.sourceType,
                      bankName: sel.bankName,
                      customName: sel.customName,
                    });
                    setOpenTransfer(true);
                  }}
                  startIcon={<SwapHorizIcon />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 2.5,
                    py: 1,
                  }}
                >
                  Transfer Funds
                </Button>

                {/* Lock / Unlock Toggle button */}
                <Button
                  variant="outlined"
                  color={activeWalletModal.isLocked ? 'success' : 'warning'}
                  onClick={() => handleToggleLockWallet(activeWalletModal)}
                  disabled={saving}
                  startIcon={activeWalletModal.isLocked ? <LockOpenIcon /> : <LockIcon />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 2.5,
                    py: 1,
                  }}
                >
                  {activeWalletModal.isLocked ? 'Unlock Wallet' : 'Lock Wallet'}
                </Button>
              </div>

              {/* Quick Add / Deduct Row */}
              <div className="flex gap-2">
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  onClick={() => {
                    setActiveWalletModal(null);
                    setMoneyDialogMode('add');
                    setOpenAdd(true);
                  }}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                >
                  + Add Money
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  color="error"
                  disabled={activeWalletModal.isLocked}
                  onClick={() => {
                    setActiveWalletModal(null);
                    setMoneyDialogMode('deduct');
                    setOpenAdd(true);
                  }}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                >
                  - Deduct Money
                </Button>
              </div>

              {/* Delete custom/bank wallet */}
              {activeWalletModal.category !== 'built-in' && (
                <div className="pt-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleDeleteWallet(activeWalletModal)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    <span>Delete this wallet</span>
                  </button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Add New Wallet Modal ─────────────────────────────── */}
      <Dialog
        open={openAddWalletModal}
        onClose={() => !saving && setOpenAddWalletModal(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1.5,
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight="900">
            Create New Wallet
          </Typography>
          <IconButton size="small" onClick={() => !saving && setOpenAddWalletModal(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ py: 2 }}>
          <Stack spacing={2.5}>
            {/* Wallet Type Tabs */}
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                WALLET TYPE
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setNewWalletType('custom')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    newWalletType === 'custom'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Custom / Saving
                </button>
                <button
                  type="button"
                  onClick={() => setNewWalletType('bank')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    newWalletType === 'bank'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Bank Account
                </button>
              </div>
            </div>

            {/* Wallet Name */}
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                WALLET NAME
              </span>
              <TextField
                fullWidth
                size="small"
                autoFocus
                placeholder={newWalletType === 'bank' ? 'e.g. Meezan Bank, HBL' : 'e.g. Ammi ke paisay, Personal saving'}
                value={newWalletName}
                onChange={(e) => setNewWalletName(e.target.value)}
              />
            </div>

            {/* Initial Balance */}
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                INITIAL BALANCE (RS)
              </span>
              <TextField
                fullWidth
                size="small"
                type="number"
                placeholder="0"
                value={newWalletBalance}
                onChange={(e) => setNewWalletBalance(e.target.value)}
              />
            </div>

            {/* Ownership */}
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                WHO OWNS THIS MONEY?
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-white/10 p-1 mb-2">
                <button
                  type="button"
                  onClick={() => setNewWalletIsOwn(true)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    newWalletIsOwn
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Mine
                </button>
                <button
                  type="button"
                  onClick={() => setNewWalletIsOwn(false)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    !newWalletIsOwn
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Someone else
                </button>
              </div>

              {!newWalletIsOwn && (
                <TextField
                  fullWidth
                  size="small"
                  placeholder="e.g. Ammi, Abu, Friend"
                  value={newWalletOwnerName}
                  onChange={(e) => setNewWalletOwnerName(e.target.value)}
                />
              )}
            </div>

            {/* Lock toggle */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newWalletIsLocked}
                    onChange={(e) => setNewWalletIsLocked(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <div>
                    <span className="text-sm font-bold flex items-center gap-1 text-slate-900 dark:text-slate-100">
                      🔒 Lock this wallet
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">
                      Protects money from being spent and excludes it from &quot;Available to spend&quot;.
                    </span>
                  </div>
                }
              />
            </div>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAddWalletModal(false)} disabled={saving} sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!newWalletName.trim() || saving}
            onClick={handleCreateWallet}
            sx={{
              fontWeight: 800,
              bgcolor: '#0F3D33',
              '&:hover': { bgcolor: '#0B2D26' },
            }}
          >
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Create Wallet'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── All Other Dialogs ─────────────────────────────────── */}
      <AddMoney
        onSave={handleAddMoney}
        onDeduct={handleDeductMoney}
        saving={saving}
        snapshot={snapshot}
        externalOpen={openAdd}
        onExternalClose={() => setOpenAdd(false)}
        defaultMode={moneyDialogMode}
      />

      <DeductMoney
        snapshot={snapshot}
        onDeduct={handleDeductMoney}
        saving={saving}
        externalOpen={openDeduct}
        onExternalClose={() => setOpenDeduct(false)}
      />

      <TransferFunds
        onTransfer={handleTransferHolders}
        saving={saving}
        snapshot={snapshot}
        externalOpen={openTransfer}
        onExternalClose={() => setOpenTransfer(false)}
        initialFromSource={transferInitialFrom?.source}
        initialFromBankName={transferInitialFrom?.bankName}
        initialFromCustomName={transferInitialFrom?.customName}
      />

      <LoanDialog
        onAddMoney={handleAddMoney}
        snapshot={snapshot}
        externalOpen={openLoan}
        onExternalClose={() => setOpenLoan(false)}
      />

      <LiabilityDialog
        open={openLiability}
        onClose={() => setOpenLiability(false)}
      />

      {/* Modal for Loan & Liability Info */}
      <Dialog
        open={showLoanInfoModal}
        onClose={() => setShowLoanInfoModal(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1,
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <InfoOutlinedIcon color="error" />
            <Typography variant="h6" fontWeight="900">
              Loan & Liability Info
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setShowLoanInfoModal(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <Stack spacing={2}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: isDark ? 'rgba(16,185,129,0.08)' : '#ecfdf5', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Typography variant="caption" fontWeight="800" color="#059669" display="block">
                AMOUNT YOU WILL RECEIVE (TO GET BACK)
              </Typography>
              <Typography variant="h6" fontWeight="900" color="#059669">
                + {formatCurrency(totalsData.toReceive, currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                {`${totalsData.toReceiveLoansCount} lent loan${totalsData.toReceiveLoansCount !== 1 ? 's' : ''} + ${totalsData.toReceiveLiabilitiesCount} credit liability.`}
              </Typography>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, bgcolor: isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Typography variant="caption" fontWeight="800" color="#e11d48" display="block">
                AMOUNT YOU WILL PAY BACK (TO PAY BACK)
              </Typography>
              <Typography variant="h6" fontWeight="900" color="#e11d48">
                - {formatCurrency(totalsData.toPay, currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                {`${totalsData.toPayLoansCount} borrowed loan${totalsData.toPayLoansCount !== 1 ? 's' : ''} + ${totalsData.toPayLiabilitiesCount} debt liability.`}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowLoanInfoModal(false)} variant="contained" sx={{ borderRadius: 2, fontWeight: 800 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <TransactionHistory
        open={showTransactionHistory}
        onClose={() => setShowTransactionHistory(false)}
        userId={userId}
      />
    </div>
  );
}
