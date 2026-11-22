'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  Minus,
  Plus,
  Check,
  Save,
  RotateCcw,
  Calendar,
  Sparkles,
  AlertTriangle,
  Wallet as WalletIcon,
  Receipt,
  X,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { PAKISTANI_EXPENSE_CATEGORIES } from '@/app/lib/constant';
import type {
  Bank,
  CustomPaymentHead,
  Expenditure,
  PlannedExpense,
  TotalCashSnapshot,
} from '@/app/lib/interface';
import { computeTotalAmount } from './TotalCashSnapshot';
import CreateWalletModal, {
  type CreateWalletPayload,
} from './TotalCashSnapshot/CreateWalletModal';

const num = (v: unknown) => Number(v) || 0;
const fmt = (n: number) => 'Rs ' + Math.round(num(n)).toLocaleString('en-PK');

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const LEVELS = [30000, 50000, 75000, 100000, 150000, 200000, 300000];

interface AllocatableExpense {
  id: string;
  docId: string;
  sourceCollection: 'plannedExpenses' | 'expenditures';
  title: string;
  category: string;
  expenseValue: number; // actual expense value (e.g. 1500 for internet)
  tag: 'Recurring' | 'This Month' | 'Event-Based' | 'Yearly' | 'Wish List';
  isEssential: boolean;
  isWant: boolean;
}

interface AllocatableWallet {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
  isSavingsLike: boolean;
}

interface SavedBudgetDoc {
  monthKey: string;
  budgetAmount: number;
  isManualBudget: boolean;
  selectedExpenseIds: string[];
  selectedWalletIds?: string[];
  allocations: Record<string, number>;
  followable: boolean;
}

function getDefaultTargetMonthKey(): { monthKey: string; isNextMonthSuggested: boolean } {
  const now = new Date();
  const day = now.getDate();
  if (day >= 23) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const key = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    return { monthKey: key, isNextMonthSuggested: true };
  }
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { monthKey: key, isNextMonthSuggested: false };
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return `${MONTH_NAMES[m - 1] ?? ''} ${y}`;
}

// Only allow current month (0) and next month (1)
function getSelectableMonths(): { key: string; label: string; isCurrent: boolean }[] {
  const now = new Date();
  return [0, 1].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: formatMonthLabel(key),
      isCurrent: offset === 0,
    };
  });
}

const BAR_TONES = {
  teal: 'bg-teal-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
};

export default function BudgetPlanner() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const defaultMonthInfo = useMemo(() => getDefaultTargetMonthKey(), []);
  const monthOptions = useMemo(() => getSelectableMonths(), []);

  const [targetMonth, setTargetMonth] = useState<string>(defaultMonthInfo.monthKey);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Income & Budget Restriction Mode
  const [fetchedIncome, setFetchedIncome] = useState<number>(0);
  const [budgetInput, setBudgetInput] = useState<string>('');
  const [isBudgetLocked, setIsBudgetLocked] = useState<boolean>(true);
  const [isManualBudget, setIsManualBudget] = useState<boolean>(false);

  // Real Expenses & Wallets fetched from Firestore
  const [snapshot, setSnapshot] = useState<TotalCashSnapshot | null>(null);
  const [availableExpenses, setAvailableExpenses] = useState<AllocatableExpense[]>([]);
  const [availableWallets, setAvailableWallets] = useState<AllocatableWallet[]>([]);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [selectedWalletIds, setSelectedWalletIds] = useState<string[]>([]);

  // Collapsible pickers (collapsed by default)
  const [showExpensePicker, setShowExpensePicker] = useState<boolean>(false);
  const [showWalletPicker, setShowWalletPicker] = useState<boolean>(false);

  // Inline Quick-Create Expense modal/drawer
  const [showCreateExpense, setShowCreateExpense] = useState<boolean>(false);
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const [newExpCategory, setNewExpCategory] = useState<string>(
    PAKISTANI_EXPENSE_CATEGORIES?.[0] || 'House rent'
  );
  const [creatingExp, setCreatingExp] = useState(false);

  // Create Wallet modal
  const [openCreateWallet, setOpenCreateWallet] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState(false);

  // Allocations map: itemId -> allocated Rs amount
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [followable, setFollowable] = useState<boolean>(false);

  // Fetch income, real expenses, real wallets, and saved budget for targetMonth
  const loadBudgetData = useCallback(async () => {
    if (authLoading) return;
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSaveMessage(null);

    try {
      const [targetYear, targetMonthNum] = targetMonth.split('-').map(Number);
      const targetMonthIdx = targetMonthNum - 1;

      const [snapIncome, snapPlanned, snapExp, snapDoc, snapBanks, snapHeads, savedSnap] =
        await Promise.all([
          getDocs(query(collection(db, 'incomeSources'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'plannedExpenses'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'expenditures'), where('userId', '==', user.uid))),
          getDoc(doc(db, 'totalCashSnapshots', user.uid)),
          getDocs(query(collection(db, 'banks'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'customPaymentHeads'), where('userId', '==', user.uid))),
          getDoc(doc(db, 'monthlyBudgets', `${user.uid}_${targetMonth}`)),
        ]);

      // 1. Monthly Income
      let monthlyIncomeSum = 0;
      snapIncome.forEach((d) => {
        const inc = d.data();
        const amt = Number(inc.currentAmount || inc.amount || inc.initialAmount || 0);
        const freq = inc.frequency || 'monthly';
        const type = inc.type;

        if (freq === 'monthly') monthlyIncomeSum += amt;
        else if (freq === 'weekly') monthlyIncomeSum += amt * 4.33;
        else if (freq === 'daily') monthlyIncomeSum += amt * 30;
        else if (freq === 'yearly') monthlyIncomeSum += amt / 12;
        else if (freq === 'one_time' || type === 'one-time') {
          if (inc.expectedDate) {
            const dObj =
              inc.expectedDate instanceof Timestamp
                ? inc.expectedDate.toDate()
                : new Date(inc.expectedDate as string | number | Date);
            if (
              !isNaN(dObj.getTime()) &&
              dObj.getFullYear() === targetYear &&
              dObj.getMonth() === targetMonthIdx
            ) {
              monthlyIncomeSum += amt;
            }
          } else {
            monthlyIncomeSum += amt;
          }
        } else {
          monthlyIncomeSum += amt;
        }
      });
      const roundedIncome = Math.round(monthlyIncomeSum);
      setFetchedIncome(roundedIncome);

      // 2. Real Expenses (recurring, target month, annual/event-based, wish list)
      const collectedExpenses: AllocatableExpense[] = [];

      snapPlanned.forEach((d) => {
        const p = d.data() as PlannedExpense;
        const amt = Math.round(Number(p.expectedAmount) || 0);
        if (amt <= 0) return;

        const isEventBased = p.expenseType === 'event_based';
        const isYearly = p.recurrence === 'yearly' || p.frequency === 'yearly';
        const isGlobalWish =
          p.expenseType === 'wish_list' || p.priority === 'wish_list' || p.isGlobal;
        const isRecurring =
          p.expenseType === 'recurring' ||
          (p.recurrence && p.recurrence !== 'one_time' && !isYearly);

        let matchesMonth = false;
        if (p.dueDate) {
          const dt = p.dueDate instanceof Timestamp ? p.dueDate.toDate() : new Date(p.dueDate);
          if (
            !isNaN(dt.getTime()) &&
            dt.getFullYear() === targetYear &&
            dt.getMonth() === targetMonthIdx
          ) {
            matchesMonth = true;
          }
        }

        if (isRecurring || matchesMonth || isEventBased || isYearly || isGlobalWish) {
          const expenseVal = isYearly
            ? Math.round(amt / 12)
            : p.recurrence === 'weekly' || p.frequency === 'weekly'
            ? Math.round(amt * 4.33)
            : p.recurrence === 'daily' || p.frequency === 'daily'
            ? Math.round(amt * 30)
            : amt;

          const tag: AllocatableExpense['tag'] = isEventBased
            ? 'Event-Based'
            : isYearly
            ? 'Yearly'
            : isGlobalWish
            ? 'Wish List'
            : isRecurring
            ? 'Recurring'
            : 'This Month';

          const catLower = (p.category || '').toLowerCase();
          collectedExpenses.push({
            id: `plan_${d.id}`,
            docId: d.id,
            sourceCollection: 'plannedExpenses',
            title: p.title,
            category: p.category || 'Other expenses',
            expenseValue: expenseVal,
            tag,
            isEssential:
              p.priority === 'essential' ||
              /rent|grocer|food|electric|utilit|health|transport|education/.test(catLower),
            isWant:
              p.priority === 'lifestyle' ||
              p.priority === 'wish_list' ||
              /entertain|shopping|clothing/.test(catLower),
          });
        }
      });

      snapExp.forEach((d) => {
        const e = d.data() as Expenditure;
        const amt = Math.round(Number(e.amount) || 0);
        if (amt <= 0) return;

        const isRecurring = e.type === 'recurring';
        let matchesMonth = false;
        if (e.dueDate) {
          const dt = e.dueDate instanceof Timestamp ? e.dueDate.toDate() : new Date(e.dueDate);
          if (
            !isNaN(dt.getTime()) &&
            dt.getFullYear() === targetYear &&
            dt.getMonth() === targetMonthIdx
          ) {
            matchesMonth = true;
          }
        }

        if (isRecurring || matchesMonth) {
          const expenseVal =
            e.frequency === 'weekly'
              ? Math.round(amt * 4.33)
              : e.frequency === 'daily'
              ? Math.round(amt * 30)
              : amt;

          collectedExpenses.push({
            id: `exp_${d.id}`,
            docId: d.id,
            sourceCollection: 'expenditures',
            title: e.title,
            category: e.category || 'Expense',
            expenseValue: expenseVal,
            tag: isRecurring ? 'Recurring' : 'This Month',
            isEssential: /rent|food|utilit|health|transport/.test((e.category || '').toLowerCase()),
            isWant: /entertain|shopping|clothing/.test((e.category || '').toLowerCase()),
          });
        }
      });

      setAvailableExpenses(collectedExpenses);

      // 3. Real Wallets from totalCashSnapshots + banks + customPaymentHeads
      const snapData = snapDoc.exists() ? (snapDoc.data() as TotalCashSnapshot) : null;
      setSnapshot(snapData);

      const collectedWallets: AllocatableWallet[] = [
        {
          id: 'wallet_in_hand',
          name: 'Cash in Hand',
          type: 'cash',
          currentBalance: snapData?.sources?.in_hand ?? 0,
          isSavingsLike: false,
        },
        {
          id: 'wallet_easypaisa',
          name: 'Easypaisa',
          type: 'mobile_wallet',
          currentBalance: snapData?.sources?.easypaisa ?? 0,
          isSavingsLike: false,
        },
        {
          id: 'wallet_jazzcash',
          name: 'JazzCash',
          type: 'mobile_wallet',
          currentBalance: snapData?.sources?.jazzcash ?? 0,
          isSavingsLike: false,
        },
        {
          id: 'wallet_other',
          name: 'Personal Spending',
          type: 'cash',
          currentBalance: snapData?.sources?.other ?? 0,
          isSavingsLike: false,
        },
      ];

      const bankNames = new Set<string>(Object.keys(snapData?.sources?.bank || {}));
      snapBanks.docs.forEach((d) => {
        const b = d.data() as Bank;
        if (b.name) bankNames.add(b.name);
      });
      Array.from(bankNames)
        .sort()
        .forEach((bName) => {
          collectedWallets.push({
            id: `wallet_bank:${bName}`,
            name: bName,
            type: 'bank',
            currentBalance: snapData?.sources?.bank?.[bName] ?? 0,
            isSavingsLike: /saving|emergency|fund/i.test(bName),
          });
        });

      const customNames = new Set<string>(Object.keys(snapData?.sources?.custom || {}));
      snapHeads.docs.forEach((d) => {
        const c = d.data() as CustomPaymentHead;
        if (c.name) customNames.add(c.name);
      });
      Array.from(customNames)
        .sort()
        .forEach((cName) => {
          const own = snapData?.sourceOwnership?.[`custom:${cName}`];
          collectedWallets.push({
            id: `wallet_custom:${cName}`,
            name: cName,
            type: own?.isVirtual ? 'virtual' : 'custom',
            currentBalance: snapData?.sources?.custom?.[cName] ?? 0,
            isSavingsLike:
              Boolean(own?.isVirtual) ||
              /saving|emergency|qurbani|wedding|fund|goal/i.test(`${cName} ${own?.purpose || ''}`),
          });
        });

      setAvailableWallets(collectedWallets);

      // 4. Load saved budget if exists; otherwise default to fetchedIncome + existing expenses
      if (savedSnap.exists()) {
        const saved = savedSnap.data() as SavedBudgetDoc;
        const useManual = Boolean(saved.isManualBudget);
        setIsManualBudget(useManual);
        setBudgetInput(
          String(useManual ? saved.budgetAmount : roundedIncome || saved.budgetAmount || 0)
        );
        setSelectedExpenseIds(
          Array.isArray(saved.selectedExpenseIds)
            ? saved.selectedExpenseIds
            : collectedExpenses.map((c) => c.id)
        );
        setSelectedWalletIds(
          Array.isArray(saved.selectedWalletIds) ? saved.selectedWalletIds : []
        );
        setAllocations(saved.allocations || {});
        setFollowable(Boolean(saved.followable));
      } else {
        setIsManualBudget(false);
        setBudgetInput(String(roundedIncome));
        setSelectedExpenseIds(collectedExpenses.map((c) => c.id));
        setSelectedWalletIds([]);
        const initialAlloc: Record<string, number> = {};
        collectedExpenses.forEach((c) => {
          initialAlloc[c.id] = c.expenseValue;
        });
        setAllocations(initialAlloc);
        setFollowable(false);
      }
      setIsBudgetLocked(true);
    } catch (err) {
      console.error('Error loading budget data:', err);
      setErrorMsg('Unable to load your budget data right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [authLoading, user?.uid, targetMonth]);

  useEffect(() => {
    loadBudgetData();
  }, [loadBudgetData]);

  // Derived totals
  const budgetTotal = Math.max(0, num(budgetInput));
  const selectedExpenses = useMemo(
    () => availableExpenses.filter((e) => selectedExpenseIds.includes(e.id)),
    [availableExpenses, selectedExpenseIds]
  );
  const selectedWallets = useMemo(
    () => availableWallets.filter((w) => selectedWalletIds.includes(w.id)),
    [availableWallets, selectedWalletIds]
  );

  const expensesAllocated = selectedExpenses.reduce((s, e) => s + num(allocations[e.id]), 0);
  const walletsAllocated = selectedWallets.reduce((s, w) => s + num(allocations[w.id]), 0);
  const totalAllocated = expensesAllocated + walletsAllocated;
  const unallocated = budgetTotal - totalAllocated;
  const isOverBudget = budgetTotal > 0 && unallocated < 0;
  const walletsPct = budgetTotal > 0 ? Math.round((walletsAllocated / budgetTotal) * 100) : 0;

  const wantsAllocated = selectedExpenses
    .filter((e) => e.isWant)
    .reduce((s, e) => s + num(allocations[e.id]), 0);

  const checks: [string, boolean][] = [
    [
      'Essential expenses are included in allocation',
      selectedExpenses.some((e) => e.isEssential && num(allocations[e.id]) > 0),
    ],
    [
      'Wallet / savings allocations are included',
      selectedWallets.some((w) => num(allocations[w.id]) > 0),
    ],
    [
      'Wallet / savings share is realistic (5 to 30% of budget)',
      budgetTotal > 0 && walletsAllocated / budgetTotal >= 0.05 && walletsAllocated / budgetTotal <= 0.3,
    ],
    [
      'Wants stay under 15% of budget',
      budgetTotal > 0 && wantsAllocated / budgetTotal <= 0.15,
    ],
  ];

  const toggleExpenseSelection = (id: string) => {
    setSelectedExpenseIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      const exp = availableExpenses.find((e) => e.id === id);
      if (exp && allocations[id] === undefined) {
        setAllocations((cur) => ({ ...cur, [id]: exp.expenseValue }));
      }
      return [...prev, id];
    });
  };

  const toggleWalletSelection = (id: string) => {
    setSelectedWalletIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const setItemAllocation = (id: string, nextValue: number) => {
    const safe = Math.max(0, Math.round(nextValue));
    setAllocations((prev) => ({ ...prev, [id]: safe }));
    if (saveMessage) setSaveMessage(null);
  };

  const stepItemAllocation = (id: string, delta: number) => {
    setItemAllocation(id, num(allocations[id]) + delta);
  };

  const applyBudgetPreset = (level: number) => {
    if (isBudgetLocked) return;
    setBudgetInput(String(level));
    setIsManualBudget(true);
    setSaveMessage(null);
  };

  const resetBudgetToIncome = () => {
    setBudgetInput(String(fetchedIncome));
    setIsManualBudget(false);
    setIsBudgetLocked(true);
    setSaveMessage(null);
  };

  // Create a new real expense in Firestore `plannedExpenses` first, then select it for allocation
  const handleQuickCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !newExpTitle.trim() || !num(newExpAmount)) return;
    setCreatingExp(true);
    setErrorMsg(null);
    try {
      const amt = Math.round(num(newExpAmount));
      const dueStr = `${targetMonth}-01`;
      const docRef = await addDoc(collection(db, 'plannedExpenses'), {
        userId: user.uid,
        title: newExpTitle.trim(),
        category: newExpCategory,
        expectedAmount: amt,
        allocatedBudget: amt,
        allocatedBudgetMonth: targetMonth,
        actualPaidAmount: 0,
        dueDate: dueStr,
        paymentStatus: 'pending',
        recurrence: 'monthly',
        expenseType: 'recurring',
        priority: 'essential',
        frequency: 'monthly',
        isGlobal: false,
        createdAt: serverTimestamp(),
      });

      const created: AllocatableExpense = {
        id: `plan_${docRef.id}`,
        docId: docRef.id,
        sourceCollection: 'plannedExpenses',
        title: newExpTitle.trim(),
        category: newExpCategory,
        expenseValue: amt,
        tag: 'Recurring',
        isEssential: true,
        isWant: false,
      };

      setAvailableExpenses((prev) => [created, ...prev]);
      setSelectedExpenseIds((prev) => [...prev, created.id]);
      setAllocations((prev) => ({ ...prev, [created.id]: amt }));
      setNewExpTitle('');
      setNewExpAmount('');
      setShowCreateExpense(false);
      setSaveMessage(`Expense "${created.title}" created in Monthly Expenses and added to budget.`);
    } catch (err) {
      console.error('Error creating expense from budget planner:', err);
      setErrorMsg('Failed to create expense. Please try again.');
    } finally {
      setCreatingExp(false);
    }
  };

  // Create a new real wallet in Firestore `banks`/`customPaymentHeads` + `totalCashSnapshots` first, then select it
  const handleQuickCreateWallet = async (wData: CreateWalletPayload) => {
    if (!user?.uid) return;
    setCreatingWallet(true);
    setErrorMsg(null);
    try {
      const isBank = wData.walletType === 'bank';
      const cleanName = wData.name.trim();
      const initAmt = wData.openingBalance || 0;

      const collectionName = isBank ? 'banks' : 'customPaymentHeads';
      await addDoc(collection(db, collectionName), {
        userId: user.uid,
        name: cleanName,
        createdAt: serverTimestamp(),
      });

      const baseSnapshot: TotalCashSnapshot = snapshot ?? {
        userId: user.uid,
        sources: { in_hand: 0, bank: {}, easypaisa: 0, jazzcash: 0, other: 0, custom: {} },
        heldBy: {},
        sourceOwnership: {},
        totalAmount: 0,
        freezeAmount: 0,
        createdAt: new Date(),
      };

      const updatedSources: TotalCashSnapshot['sources'] = {
        in_hand: baseSnapshot.sources?.in_hand ?? 0,
        easypaisa: baseSnapshot.sources?.easypaisa ?? 0,
        jazzcash: baseSnapshot.sources?.jazzcash ?? 0,
        other: baseSnapshot.sources?.other ?? 0,
        bank: { ...(baseSnapshot.sources?.bank || {}) },
        custom: { ...(baseSnapshot.sources?.custom || {}) },
      };

      if (isBank) updatedSources.bank[cleanName] = initAmt;
      else updatedSources.custom[cleanName] = initAmt;

      const key = isBank ? `bank:${cleanName}` : `custom:${cleanName}`;
      const hasOwnThisMoney = wData.initialOwner.toLowerCase() === 'you';

      const ownershipEntry: NonNullable<TotalCashSnapshot['sourceOwnership']>[string] = {
        hasOwnThisMoney,
        ownerName: hasOwnThisMoney ? '' : wData.initialOwner,
        isLocked: wData.isLocked,
        isVirtual: wData.isVirtual,
        reservedAmount: wData.isReserved
          ? initAmt
          : wData.allocations?.reduce((acc, a) => acc + (a.reservedAmount || 0), 0) || 0,
        color: wData.color,
        ...(wData.parentWalletKey ? { parentWalletKey: wData.parentWalletKey } : {}),
        ...(wData.purpose ? { purpose: wData.purpose } : {}),
        ...(wData.notes ? { notes: wData.notes } : {}),
        ...(wData.allocations && wData.allocations.length > 0
          ? { allocations: wData.allocations }
          : {}),
      };

      const updatedOwnership = {
        ...(baseSnapshot.sourceOwnership || {}),
        [key]: ownershipEntry,
      };

      const updatedSnapshot: TotalCashSnapshot = {
        ...baseSnapshot,
        sources: updatedSources,
        sourceOwnership: updatedOwnership,
        totalAmount: computeTotalAmount({
          ...baseSnapshot,
          sources: updatedSources,
          sourceOwnership: updatedOwnership,
        }),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'totalCashSnapshots', user.uid), {
        ...updatedSnapshot,
        updatedAt: serverTimestamp(),
      });
      setSnapshot(updatedSnapshot);

      const newWalletId = `wallet_${key}`;
      const newWalletEntry: AllocatableWallet = {
        id: newWalletId,
        name: cleanName,
        type: wData.walletType,
        currentBalance: initAmt,
        isSavingsLike: wData.isVirtual || /saving|emergency|qurbani|wedding/i.test(cleanName),
      };

      setAvailableWallets((prev) => [...prev, newWalletEntry]);
      setSelectedWalletIds((prev) => [...prev, newWalletId]);
      setOpenCreateWallet(false);
      setSaveMessage(`Wallet "${cleanName}" created in Wallets and added to budget.`);
    } catch (err) {
      console.error('Error creating wallet from budget planner:', err);
      setErrorMsg('Failed to create wallet. Please try again.');
    } finally {
      setCreatingWallet(false);
    }
  };

  // Save monthly budget + persist `allocatedBudget` onto each selected `plannedExpenses` doc
  const handleSaveBudget = async () => {
    if (!user?.uid) return;
    setSaving(true);
    setErrorMsg(null);
    setSaveMessage(null);
    try {
      const cleanAllocations: Record<string, number> = {};
      selectedExpenseIds.forEach((id) => {
        cleanAllocations[id] = num(allocations[id]);
      });
      selectedWalletIds.forEach((id) => {
        cleanAllocations[id] = num(allocations[id]);
      });

      await setDoc(doc(db, 'monthlyBudgets', `${user.uid}_${targetMonth}`), {
        userId: user.uid,
        monthKey: targetMonth,
        budgetAmount: budgetTotal,
        isManualBudget,
        selectedExpenseIds,
        selectedWalletIds,
        allocations: cleanAllocations,
        followable,
        updatedAt: serverTimestamp(),
      });

      // Also sync allocatedBudget onto each selected plannedExpenses document
      const expenseUpdates = selectedExpenses
        .filter((e) => e.sourceCollection === 'plannedExpenses')
        .map((e) =>
          updateDoc(doc(db, 'plannedExpenses', e.docId), {
            allocatedBudget: num(allocations[e.id]),
            allocatedBudgetMonth: targetMonth,
          })
        );
      await Promise.all(expenseUpdates);

      setSaveMessage(`Budget saved for ${formatMonthLabel(targetMonth)}.`);
    } catch (err) {
      console.error('Error saving budget:', err);
      setErrorMsg('Failed to save budget. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const cardCls = `rounded-3xl border p-4 sm:p-5 transition-colors ${
    isDark
      ? 'border-white/10 bg-[#1f2430] text-white shadow-xl'
      : 'border-slate-200 bg-white text-slate-900 shadow-sm'
  }`;

  const mutedCls = isDark ? 'text-slate-400' : 'text-slate-500';

  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 ${
    isDark
      ? 'border-white/15 bg-[#282e3d] text-white placeholder-slate-400 focus:border-teal-500 focus:ring-teal-500/30'
      : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-teal-500/30'
  }`;

  const renderAllocationRow = ({
    id,
    label,
    sublabel,
    tone,
    referenceAmount,
    referenceLabel,
  }: {
    id: string;
    label: string;
    sublabel: string;
    tone: keyof typeof BAR_TONES;
    referenceAmount?: number;
    referenceLabel?: string;
  }) => {
    const val = num(allocations[id]);
    const pct = budgetTotal > 0 ? Math.round((val / budgetTotal) * 100) : 0;
    const sliderMax = Math.max(budgetTotal || 50000, val, referenceAmount || 0, 1000);
    const fillPct = Math.min(100, (val / sliderMax) * 100);
    const stepSize = sliderMax >= 50000 ? 500 : 100;
    const isMatched = typeof referenceAmount === 'number' && val === referenceAmount && val > 0;

    return (
      <div
        key={id}
        className={`rounded-2xl border p-3.5 sm:p-4 transition-all ${
          isDark
            ? 'border-white/10 bg-[#282e3d]/85 hover:border-white/20'
            : 'border-slate-200/80 bg-slate-50/90 hover:border-slate-300'
        }`}
      >
        {/* Tier 1: Full untruncated title + % pill + metadata */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${BAR_TONES[tone]}`}
              />
              <p className="text-sm sm:text-base font-bold leading-snug break-words">
                {label}
              </p>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-4.5 text-[11px]">
              <span className={mutedCls}>{sublabel}</span>
              {typeof referenceAmount === 'number' && referenceLabel && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold tabular-nums ${
                    isDark
                      ? 'bg-white/10 text-slate-200'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {referenceLabel}: {fmt(referenceAmount)}
                </span>
              )}
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${
              pct > 0
                ? isDark
                  ? 'bg-teal-500/15 text-teal-300'
                  : 'bg-teal-50 text-teal-700 border border-teal-200'
                : isDark
                ? 'bg-white/5 text-slate-400'
                : 'bg-slate-200/70 text-slate-500'
            }`}
          >
            {pct}%
          </span>
        </div>

        {/* Tier 2: Full-width Interactive Tappable / Draggable Slider Bar */}
        <div className="relative mt-3.5 flex items-center py-1">
          <div
            className={`h-2.5 w-full overflow-hidden rounded-full ${
              isDark ? 'bg-white/10' : 'bg-slate-200'
            }`}
          >
            <div
              className={`h-full rounded-full transition-all duration-150 ${BAR_TONES[tone]}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          {/* Visual thumb indicator */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 shadow-sm transition-all duration-150 ${BAR_TONES[tone]} ${
              isDark ? 'border-[#1f2430]' : 'border-white'
            }`}
            style={{ left: `clamp(8px, ${fillPct}%, calc(100% - 8px))` }}
          />
          <input
            type="range"
            min={0}
            max={sliderMax}
            step={stepSize}
            value={Math.min(val, sliderMax)}
            onChange={(e) => setItemAllocation(id, num(e.target.value))}
            aria-label={`Adjust allocated budget for ${label}`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        {/* Tier 3: Clean Responsive Controls Row (Match pill + Unified Stepper) */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span className={`text-[11px] font-medium ${mutedCls}`}>
              Allocated budget
            </span>

            {typeof referenceAmount === 'number' && referenceAmount > 0 && (
              isMatched ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    isDark
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <Check size={10} /> Matched
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setItemAllocation(id, referenceAmount)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 cursor-pointer ${
                    isDark
                      ? 'bg-teal-500/15 text-teal-300 hover:bg-teal-500/25'
                      : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
                  }`}
                  title="Match reference value"
                >
                  Match {fmt(referenceAmount)}
                </button>
              )
            )}
          </div>

          {/* Unified Stepper Control (Full-width on mobile, compact on desktop) */}
          <div
            className={`flex items-center rounded-xl border p-1 ${
              isDark
                ? 'border-white/15 bg-[#1f2430]'
                : 'border-slate-200 bg-white'
            }`}
          >
            <button
              type="button"
              onClick={() => stepItemAllocation(id, -stepSize)}
              aria-label={`Decrease ${label}`}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-white/10 text-slate-200 hover:bg-white/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Minus size={15} />
            </button>

            <div className="relative flex flex-1 sm:w-28 items-center px-2">
              <span className={`text-xs font-semibold mr-1 ${mutedCls}`}>Rs</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={val === 0 ? '' : String(val)}
                placeholder="0"
                onChange={(e) => setItemAllocation(id, num(e.target.value))}
                className={`w-full bg-transparent py-1 text-right text-sm font-bold tabular-nums focus:outline-none ${
                  isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={() => stepItemAllocation(id, stepSize)}
              aria-label={`Increase ${label}`}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-white/10 text-slate-200 hover:bg-white/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen antialiased font-sans pb-16 transition-colors ${
        isDark ? 'bg-[#181c24] text-white' : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-5 px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/finance"
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-[#1f2430] border-white/10 text-slate-300 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 shadow-2xs'
              }`}
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Budget Allocation</h1>
              <p className={`text-xs ${mutedCls}`}>
                Allocate your monthly budget to existing expenses &amp; wallets
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={saving || loading || !user?.uid}
            onClick={handleSaveBudget}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            <Save size={15} />
            <span>{saving ? 'Saving…' : 'Save Budget'}</span>
          </button>
        </header>

        {/* Feedback banners */}
        {errorMsg && (
          <div
            role="alert"
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-medium ${
              isDark
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <AlertTriangle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {saveMessage && (
          <div
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-medium ${
              isDark
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <Check size={15} />
            <span>{saveMessage}</span>
          </div>
        )}

        {/* 1. Target Month (Current & Next Only) + Monthly Income / Budget with Restriction Mode */}
        <section className={`${cardCls} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-teal-500" />
              <span className="text-sm font-semibold">Budget for month</span>
              {defaultMonthInfo.isNextMonthSuggested && targetMonth === defaultMonthInfo.monthKey && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    isDark ? 'bg-teal-500/15 text-teal-300' : 'bg-teal-50 text-teal-700'
                  }`}
                >
                  Next month (near month-end)
                </span>
              )}
            </div>

            {/* Only Current Month & Next Month allowed */}
            <div className="flex flex-wrap gap-1.5">
              {monthOptions.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setTargetMonth(m.key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    targetMonth === m.key
                      ? 'bg-teal-600 text-white'
                      : isDark
                      ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {m.label} {m.isCurrent ? '(Current)' : '(Next)'}
                </button>
              ))}
            </div>
          </div>

          <div className={`h-px w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div>
                <label className="text-sm font-semibold block">Monthly Budget (Rs)</label>
                <p className={`text-xs ${mutedCls}`}>
                  Synced from your Monthly Income ({fmt(fetchedIncome)})
                  {isManualBudget ? ' · Custom override active' : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isManualBudget && (
                  <button
                    type="button"
                    onClick={resetBudgetToIncome}
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      isDark
                        ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <RotateCcw size={13} />
                    <span>Match Income</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsBudgetLocked((l) => !l)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    isBudgetLocked
                      ? isDark
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                        : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'border-teal-500/40 bg-teal-500/15 text-teal-400'
                  }`}
                >
                  {isBudgetLocked ? <Lock size={13} /> : <Unlock size={13} />}
                  <span>{isBudgetLocked ? 'Locked · Unlock to edit' : 'Unlocked · Lock'}</span>
                </button>
              </div>
            </div>

            <input
              type="number"
              inputMode="numeric"
              min="0"
              disabled={isBudgetLocked}
              value={budgetInput}
              onChange={(e) => {
                setBudgetInput(e.target.value);
                setIsManualBudget(true);
              }}
              placeholder="0"
              className={`${inputCls} !text-xl !font-bold tabular-nums ${
                isBudgetLocked ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            />

            {!isBudgetLocked && (
              <div className="mt-3">
                <p className={`text-xs ${mutedCls}`}>Or test with an income level:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {LEVELS.map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => applyBudgetPreset(lv)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                        budgetTotal === lv
                          ? 'bg-teal-600 text-white'
                          : isDark
                          ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {(lv / 1000).toLocaleString()}k
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className={`${cardCls} text-center !p-2.5 sm:!p-3.5`}>
            <p className={`text-[10px] sm:text-[11px] font-medium ${mutedCls}`}>Allocated</p>
            <p className="mt-1 text-xs sm:text-lg font-bold tabular-nums break-words">
              {fmt(totalAllocated)}
            </p>
          </div>
          <div className={`${cardCls} text-center !p-2.5 sm:!p-3.5`}>
            <p className={`text-[10px] sm:text-[11px] font-medium ${mutedCls}`}>To Wallets</p>
            <p
              className={`mt-1 text-xs sm:text-lg font-bold tabular-nums ${
                isDark ? 'text-teal-300' : 'text-teal-600'
              }`}
            >
              {budgetTotal > 0 ? `${walletsPct}%` : '-'}
            </p>
          </div>
          <div className={`${cardCls} text-center !p-2.5 sm:!p-3.5`}>
            <p className={`text-[10px] sm:text-[11px] font-medium ${mutedCls}`}>
              {isOverBudget ? 'Over Budget' : 'Unallocated'}
            </p>
            <p
              className={`mt-1 text-xs sm:text-lg font-bold tabular-nums break-words ${
                isOverBudget
                  ? isDark
                    ? 'text-rose-400'
                    : 'text-rose-600'
                  : isDark
                  ? 'text-emerald-400'
                  : 'text-emerald-600'
              }`}
            >
              {isOverBudget ? `-${fmt(-unallocated)}` : fmt(unallocated)}
            </p>
          </div>
        </div>

        {/* Budget Exceeded Warning (Warns clearly, still allows allocating & saving) */}
        {budgetTotal > 0 && totalAllocated > 0 && (
          <div
            role={isOverBudget ? 'alert' : 'status'}
            className={`flex items-start gap-2.5 rounded-2xl p-3.5 text-sm font-medium ${
              isOverBudget
                ? isDark
                  ? 'bg-rose-500/15 text-rose-200 border border-rose-500/35'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
                : unallocated > 0
                ? isDark
                  ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : isDark
                ? 'bg-sky-500/10 text-sky-200 border border-sky-500/20'
                : 'bg-sky-50 text-sky-900 border border-sky-200'
            }`}
          >
            {isOverBudget && <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-400" />}
            <span>
              {isOverBudget
                ? `Warning: You allocated ${fmt(-unallocated)} more than your ${fmt(budgetTotal)} budget. You can still continue allocating or save as-is.`
                : unallocated > 0
                ? `${fmt(unallocated)} is unassigned. Tap or drag any bar below to allocate every rupee.`
                : 'Every rupee is assigned! Review your expenses and wallet allocations below.'}
            </span>
          </div>
        )}

        {/* 2. Collapsible Pickers: Existing Expenses & Existing Wallets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Existing Expenses Picker (Collapsed by default) */}
          <section className={cardCls}>
            <button
              type="button"
              onClick={() => setShowExpensePicker((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Receipt size={17} className="text-teal-500 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold truncate">Choose Expenses</h2>
                  <p className={`text-xs ${mutedCls}`}>
                    {selectedExpenseIds.length} of {availableExpenses.length} selected
                  </p>
                </div>
              </div>
              {showExpensePicker ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showExpensePicker && (
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setShowCreateExpense((v) => !v)}
                    className="inline-flex items-center gap-1 font-bold text-teal-500 hover:underline cursor-pointer"
                  >
                    <Plus size={13} /> New Expense
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedExpenseIds(availableExpenses.map((e) => e.id))}
                      className="font-semibold text-teal-500 hover:underline cursor-pointer"
                    >
                      All
                    </button>
                    <span className={mutedCls}>·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedExpenseIds([])}
                      className={`font-semibold hover:underline cursor-pointer ${mutedCls}`}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Inline New Expense creator (saves to plannedExpenses first) */}
                {showCreateExpense && (
                  <form
                    onSubmit={handleQuickCreateExpense}
                    className={`rounded-2xl border p-3 space-y-2 ${
                      isDark
                        ? 'border-teal-500/30 bg-[#282e3d]'
                        : 'border-teal-200 bg-teal-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Add to Monthly Expenses</span>
                      <button
                        type="button"
                        onClick={() => setShowCreateExpense(false)}
                        className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={newExpTitle}
                      onChange={(e) => setNewExpTitle(e.target.value)}
                      placeholder="Expense title (e.g. Internet package)"
                      className={inputCls}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        required
                        min="1"
                        value={newExpAmount}
                        onChange={(e) => setNewExpAmount(e.target.value)}
                        placeholder="Amount (Rs)"
                        className={inputCls}
                      />
                      <select
                        value={newExpCategory}
                        onChange={(e) => setNewExpCategory(e.target.value)}
                        className={inputCls}
                      >
                        {(PAKISTANI_EXPENSE_CATEGORIES || []).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={creatingExp || !newExpTitle.trim() || !newExpAmount}
                      className="w-full rounded-xl bg-teal-600 hover:bg-teal-500 py-2 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                    >
                      {creatingExp ? 'Creating…' : 'Create Expense & Add to Budget'}
                    </button>
                  </form>
                )}

                {availableExpenses.length === 0 ? (
                  <p className={`text-xs py-2 ${mutedCls}`}>
                    No expenses yet. Create one above first.
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {availableExpenses.map((exp) => {
                      const checked = selectedExpenseIds.includes(exp.id);
                      return (
                        <button
                          key={exp.id}
                          type="button"
                          onClick={() => toggleExpenseSelection(exp.id)}
                          className={`flex w-full items-start justify-between gap-2.5 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                            checked
                              ? isDark
                                ? 'border-teal-500/50 bg-teal-500/10'
                                : 'border-teal-400 bg-teal-50'
                              : isDark
                              ? 'border-white/10 bg-[#282e3d]/60'
                              : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold leading-snug break-words">{exp.title}</p>
                            <p className={`mt-0.5 text-[10px] ${mutedCls}`}>
                              {exp.category} · {exp.tag}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 pt-0.5">
                            <span className="text-xs font-bold tabular-nums">
                              {fmt(exp.expenseValue)}
                            </span>
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded border ${
                                checked
                                  ? 'border-teal-500 bg-teal-500 text-white'
                                  : isDark
                                  ? 'border-white/25'
                                  : 'border-slate-300'
                              }`}
                            >
                              {checked && <Check size={11} />}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Existing Wallets Picker (Collapsed by default) */}
          <section className={cardCls}>
            <button
              type="button"
              onClick={() => setShowWalletPicker((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <WalletIcon size={17} className="text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold truncate">Choose Wallets</h2>
                  <p className={`text-xs ${mutedCls}`}>
                    {selectedWalletIds.length} of {availableWallets.length} selected
                  </p>
                </div>
              </div>
              {showWalletPicker ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showWalletPicker && (
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setOpenCreateWallet(true)}
                    className="inline-flex items-center gap-1 font-bold text-emerald-500 hover:underline cursor-pointer"
                  >
                    <Plus size={13} /> New Wallet
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedWalletIds(availableWallets.map((w) => w.id))}
                      className="font-semibold text-emerald-500 hover:underline cursor-pointer"
                    >
                      All
                    </button>
                    <span className={mutedCls}>·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedWalletIds([])}
                      className={`font-semibold hover:underline cursor-pointer ${mutedCls}`}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {availableWallets.map((w) => {
                    const checked = selectedWalletIds.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleWalletSelection(w.id)}
                        className={`flex w-full items-start justify-between gap-2.5 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                          checked
                            ? isDark
                              ? 'border-emerald-500/50 bg-emerald-500/10'
                              : 'border-emerald-400 bg-emerald-50'
                            : isDark
                            ? 'border-white/10 bg-[#282e3d]/60'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold leading-snug break-words">{w.name}</p>
                          <p className={`mt-0.5 text-[10px] capitalize ${mutedCls}`}>
                            {w.type.replace('_', ' ')} · Bal: {fmt(w.currentBalance)}
                          </p>
                        </div>
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : isDark
                              ? 'border-white/25'
                              : 'border-slate-300'
                          }`}
                        >
                          {checked && <Check size={11} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* 3. Dynamic Interactive Allocation Sliders (Only Real Expenses & Real Wallets) */}
        {loading ? (
          <section className={`${cardCls} space-y-3`}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-20 rounded-2xl animate-pulse ${
                  isDark ? 'bg-[#282e3d]' : 'bg-slate-100'
                }`}
              />
            ))}
          </section>
        ) : (
          <section className={`${cardCls} space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-teal-500" />
                <div>
                  <h3 className="text-base font-bold">Planned allocations</h3>
                  <p className={`text-xs ${mutedCls}`}>
                    Tap or drag any progress bar, or use − / + to adjust
                  </p>
                </div>
              </div>
            </div>

            {/* Expenses Allocations (shows BOTH Expense value & Allocated budget value) */}
            <div className="space-y-2.5">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${mutedCls}`}>
                Expenses ({selectedExpenses.length})
              </h4>
              {selectedExpenses.length === 0 ? (
                <p className={`text-xs py-2 ${mutedCls}`}>
                  No expenses selected. Expand &quot;Choose Expenses&quot; above to pick or create an
                  expense.
                </p>
              ) : (
                selectedExpenses.map((exp) =>
                  renderAllocationRow({
                    id: exp.id,
                    label: exp.title,
                    sublabel: `${exp.category} · ${exp.tag}`,
                    tone: exp.isWant ? 'rose' : 'teal',
                    referenceAmount: exp.expenseValue,
                    referenceLabel: 'Expense',
                  })
                )
              )}
            </div>

            {/* Wallets Allocations */}
            {selectedWallets.length > 0 && (
              <>
                <div className={`h-px w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                <div className="space-y-2.5">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${mutedCls}`}>
                    Wallets ({selectedWallets.length})
                  </h4>
                  {selectedWallets.map((w) =>
                    renderAllocationRow({
                      id: w.id,
                      label: w.name,
                      sublabel: w.type.replace('_', ' '),
                      tone: 'emerald',
                      referenceAmount: w.currentBalance,
                      referenceLabel: 'Current bal',
                    })
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {/* 4. Budget Check */}
        <section className={`${cardCls} space-y-2.5`}>
          <h3 className="text-base font-bold">Budget check</h3>
          {checks.map(([text, ok]) => (
            <p key={text} className="flex items-start gap-2 text-sm">
              <span className={ok ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                {ok ? '✓' : '!'}
              </span>
              <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{text}</span>
            </p>
          ))}
          <label className="flex items-center gap-2 pt-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={followable}
              onChange={(e) => setFollowable(e.target.checked)}
              className="h-4 w-4 accent-teal-600 rounded cursor-pointer"
            />
            <span>I can follow this budget for the whole month</span>
          </label>
        </section>
      </div>

      {/* Create Wallet Modal (creates real wallet in Firestore first) */}
      <CreateWalletModal
        open={openCreateWallet}
        onClose={() => setOpenCreateWallet(false)}
        onSave={handleQuickCreateWallet}
        saving={creatingWallet}
        existingWallets={availableWallets.map((w) => ({
          id: w.id.replace('wallet_', ''),
          name: w.name,
          type: w.type,
        }))}
      />
    </div>
  );
}
