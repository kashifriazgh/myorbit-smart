'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  Timestamp,
  serverTimestamp,
  addDoc,
  setDoc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from './userContext';
import {
  IncomeSource,
  TransactionSource,
  Bank,
  TotalCashSnapshot,
} from '@/app/lib/interface';
import { shouldResetReceived } from '@/app/lib/functions/incomeSources';

interface IncomeSourcesContextType {
  incomeSources: IncomeSource[];
  banks: Bank[];
  loading: boolean;
  markAsReceived: (
    income: IncomeSource,
    updateMainFund: boolean,
    fundSource?: TransactionSource,
    bankId?: string,
    customPaymentHeadId?: string,
    holderName?: string
  ) => Promise<void>;
  rescheduleIncome: (incomeId: string, newDate: Date) => Promise<void>;
  updateIncomeAmount: (incomeId: string, amount: number) => Promise<void>;
  deleteIncomeSource: (incomeId: string) => Promise<void>;
  addNewBank: (bankName: string) => Promise<Bank>;
  refreshData: () => void;
}

const IncomeSourcesContext = createContext<IncomeSourcesContextType | null>(
  null
);

export const useIncomeSources = () => {
  const ctx = useContext(IncomeSourcesContext);
  if (!ctx)
    throw new Error(
      'useIncomeSources must be used inside IncomeSourcesProvider'
    );
  return ctx;
};

export const IncomeSourcesProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time listener for income sources
  useEffect(() => {
    if (!userId) return;

    const incomeQuery = collection(db, 'incomeSources');
    const unsubIncome = onSnapshot(incomeQuery, (snap) => {
      const allIncome = snap.docs.map((d) => {
        const data = d.data() as IncomeSource;
        const expected = data.expectedDate as Timestamp | Date | undefined;
        const effectiveFrom = data.effectiveFromDate as
          | Timestamp
          | Date
          | undefined;
        const lastReceived = data.lastReceivedDate as
          | Timestamp
          | Date
          | undefined;

        return {
          ...data,
          id: d.id,
          createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
          expectedDate: expected
            ? expected instanceof Timestamp
              ? expected.toDate()
              : expected
            : undefined,
          effectiveFromDate: effectiveFrom
            ? effectiveFrom instanceof Timestamp
              ? effectiveFrom.toDate()
              : effectiveFrom
            : undefined,
          lastReceivedDate: lastReceived
            ? lastReceived instanceof Timestamp
              ? lastReceived.toDate()
              : lastReceived
            : undefined,
        } as IncomeSource & { id: string; lastReceivedDate?: Date };
      });

      // Filter for current user and reset recurring incomes if needed
      const userIncome = allIncome
        .filter((src) => src.userId === userId)
        .map((src) => {
          if (shouldResetReceived(src)) {
            return { ...src, isReceived: false };
          }
          return src;
        });

      setIncomeSources(userIncome);
      setLoading(false);
    });

    // Real-time listener for banks
    const banksQuery = collection(db, 'banks');
    const unsubBanks = onSnapshot(banksQuery, (snap) => {
      const allBanks = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Bank, 'id'>),
      }));

      const userBanks = allBanks.filter((bank) => bank.userId === userId);
      setBanks(userBanks);
    });

    return () => {
      unsubIncome();
      unsubBanks();
    };
  }, [userId]);

  const getSourceKey = (
    source: string,
    bankName?: string | null,
    customPaymentHeadName?: string | null
  ): string => {
    if (source === 'bank' && bankName) return `bank:${bankName}`;
    if (source === 'custom' && customPaymentHeadName) return `custom:${customPaymentHeadName}`;
    return source;
  };

  const markAsReceived = async (
    income: IncomeSource,
    updateMainFund: boolean,
    fundSource: TransactionSource = 'in_hand',
    bankId?: string,
    customPaymentHeadId?: string,
    holderName?: string
  ) => {
    if (!income.id) return;

    try {
      // Create payment record for history
      const currentPayment = {
        date: new Date(),
        amount: income.amount,
      };

      // Get current payment history or initialize empty array
      const existingHistory = income.paymentHistory || [];

      await updateDoc(doc(db, 'incomeSources', income.id), {
        isReceived: true,
        lastReceivedDate: serverTimestamp(),
        paymentHistory: [...existingHistory, currentPayment],
        updatedAt: serverTimestamp(),
      });

      if (updateMainFund) {
        let bankName: string | undefined;
        let customPaymentHeadName: string | undefined;

        if (fundSource === 'bank' && bankId) {
          const bank = banks.find((b) => b.id === bankId);
          bankName = bank?.name;
        }

        if (fundSource === 'custom' && customPaymentHeadId) {
          const customDoc = await getDoc(
            doc(db, 'customPaymentHeads', customPaymentHeadId)
          );
          customPaymentHeadName = customDoc.exists()
            ? (customDoc.data() as { name?: string }).name
            : undefined;
        }

        // Add to cash transactions
        await addDoc(collection(db, 'cashTransactions'), {
          userId,
          amount: income.amount,
          type: 'add',
          source: fundSource,
          category: 'income',
          note: `Income received: ${income.title}`,
          bankId: bankId || null,
          BankName: bankName || null,
          customPaymentHeadId: customPaymentHeadId || null,
          customPaymentHeadName: customPaymentHeadName || null,
          holderName: holderName || null,
          createdAt: serverTimestamp(),
        });

        // Update total cash snapshot
        const docRef = doc(db, 'totalCashSnapshots', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as TotalCashSnapshot;
          const updatedSources = {
            ...data.sources,
            custom: data.sources.custom ?? {},
          };
          const updatedHeldBy = data.heldBy ? { ...data.heldBy } : {};

          if (fundSource === 'bank' && bankName) {
            updatedSources.bank[bankName] =
              (updatedSources.bank[bankName] || 0) + income.amount;
          } else if (fundSource === 'custom' && customPaymentHeadName) {
            updatedSources.custom[customPaymentHeadName] =
              (updatedSources.custom[customPaymentHeadName] || 0) +
              income.amount;
          } else if (fundSource !== 'bank' && fundSource !== 'custom') {
            updatedSources[fundSource] =
              (updatedSources[fundSource] as number) + income.amount;
          }

          if (holderName && holderName !== 'Unassigned' && holderName !== 'Self') {
            const key = getSourceKey(fundSource, bankName, customPaymentHeadName);
            const holders = [...(updatedHeldBy[key] || [])];
            const idx = holders.findIndex((h) => h.holderName === holderName);
            if (idx > -1) {
              holders[idx] = {
                ...holders[idx],
                amount: holders[idx].amount + income.amount,
              };
            } else {
              holders.push({ holderName, amount: income.amount });
            }
            updatedHeldBy[key] = holders;
          }

          await setDoc(docRef, {
            ...data,
            sources: updatedSources,
            heldBy: updatedHeldBy,
            totalAmount: data.totalAmount + income.amount,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.error('Error marking income as received:', error);
      throw error;
    }
  };

  const rescheduleIncome = async (incomeId: string, newDate: Date) => {
    try {
      await updateDoc(doc(db, 'incomeSources', incomeId), {
        expectedDate: Timestamp.fromDate(newDate),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error rescheduling income:', error);
      throw error;
    }
  };

  const updateIncomeAmount = async (incomeId: string, amount: number) => {
    try {
      await updateDoc(doc(db, 'incomeSources', incomeId), {
        amount,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating income amount:', error);
      throw error;
    }
  };

  const deleteIncomeSource = async (incomeId: string) => {
    try {
      await deleteDoc(doc(db, 'incomeSources', incomeId));
    } catch (error) {
      console.error('Error deleting income source:', error);
      throw error;
    }
  };

  const addNewBank = async (bankName: string) => {
    try {
      const docRef = await addDoc(collection(db, 'banks'), {
        userId,
        name: bankName.trim(),
        createdAt: Timestamp.now(),
      });

      const newBank = {
        id: docRef.id,
        userId,
        name: bankName.trim(),
        createdAt: Timestamp.now(),
      } as Bank;

      return newBank;
    } catch (error) {
      console.error('Error adding new bank:', error);
      throw error;
    }
  };

  const refreshData = () => {
    // The real-time listeners will automatically update the data
    // This function is here for compatibility but not needed with onSnapshot
  };

  return (
    <IncomeSourcesContext.Provider
      value={{
        incomeSources,
        banks,
        loading,
        markAsReceived,
        rescheduleIncome,
        updateIncomeAmount,
        deleteIncomeSource,
        addNewBank,
        refreshData,
      }}
    >
      {children}
    </IncomeSourcesContext.Provider>
  );
};
