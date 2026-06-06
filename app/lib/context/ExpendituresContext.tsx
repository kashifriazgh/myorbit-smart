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
import {
  Expenditure,
  TransactionSource,
  Bank,
  TotalCashSnapshot,
} from '@/app/lib/interface';

interface ExpendituresContextType {
  expenditures: Expenditure[];
  banks: Bank[];
  loading: boolean;
  markAsPaid: (
    expenditure: Expenditure,
    updateMainFund: boolean,
    fundSource?: TransactionSource,
    bankId?: string,
    holderName?: string
  ) => Promise<void>;
  rescheduleExpenditure: (
    expenditureId: string,
    newDate: Date
  ) => Promise<void>;
  updateExpenditureAmount: (
    expenditureId: string,
    amount: number
  ) => Promise<void>;
  deleteExpenditure: (expenditureId: string) => Promise<void>;
  addNewBank: (bankName: string) => Promise<Bank>;
  refreshData: () => void;
}

const ExpendituresContext = createContext<ExpendituresContextType | null>(null);

export const useExpenditures = () => {
  const ctx = useContext(ExpendituresContext);
  if (!ctx)
    throw new Error('useExpenditures must be used inside ExpendituresProvider');
  return ctx;
};

// Helper function to check if recurring expense should be reset
const shouldResetPaidStatus = (exp: Expenditure): boolean => {
  if (exp.type !== 'recurring' || !exp.isPaid || !exp.lastPaidDate) {
    return false;
  }

  const lastPaid =
    exp.lastPaidDate instanceof Date
      ? exp.lastPaidDate
      : exp.lastPaidDate.toDate();
  const today = new Date();
  const daysDiff = Math.floor(
    (today.getTime() - lastPaid.getTime()) / (1000 * 60 * 60 * 24)
  );

  switch (exp.frequency) {
    case 'daily':
      return daysDiff >= 1;
    case 'weekly':
      return daysDiff >= 7;
    case 'monthly':
      return daysDiff >= 30; // Approximate month
    default:
      return false;
  }
};

export const ExpendituresProvider = ({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) => {
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time listener for expenditures
  useEffect(() => {
    if (!userId) return;

    const expendituresQuery = collection(db, 'expenditures');
    const unsubExpenditures = onSnapshot(expendituresQuery, (snap) => {
      const allExpenditures = snap.docs.map((d) => {
        const data = d.data() as Expenditure;
        const dueDate = data.dueDate as Timestamp | Date | undefined;
        const lastPaid = data.lastPaidDate as Timestamp | Date | undefined;

        return {
          ...data,
          id: d.id,
          createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
          dueDate: dueDate
            ? dueDate instanceof Timestamp
              ? dueDate.toDate()
              : dueDate
            : undefined,
          lastPaidDate: lastPaid
            ? lastPaid instanceof Timestamp
              ? lastPaid.toDate()
              : lastPaid
            : undefined,
        } as Expenditure & { id: string; lastPaidDate?: Date };
      });

      // Filter for current user and reset recurring expenses if needed
      const userExpenditures = allExpenditures
        .filter((exp) => exp.userId === userId)
        .filter((exp) => {
          if (exp.type === 'recurring') return true;
          if (exp.type === 'one-time' && !exp.isPaid) return true;
          return false;
        })
        .map((exp) => {
          if (shouldResetPaidStatus(exp)) {
            return { ...exp, isPaid: false };
          }
          return exp;
        })
        .sort((a, b) => {
          const dateA =
            a.dueDate instanceof Date
              ? a.dueDate.getTime()
              : (a.dueDate as Timestamp)?.toDate().getTime() ?? 0;
          const dateB =
            b.dueDate instanceof Date
              ? b.dueDate.getTime()
              : (b.dueDate as Timestamp)?.toDate().getTime() ?? 0;
          return dateA - dateB;
        });

      setExpenditures(userExpenditures);
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
      unsubExpenditures();
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

  const markAsPaid = async (
    expenditure: Expenditure,
    updateMainFund: boolean,
    fundSource: TransactionSource = 'in_hand',
    bankId?: string,
    holderName?: string
  ) => {
    if (!expenditure.id) return;

    try {
      // Create payment record for history
      const currentPayment = {
        date: new Date(),
        amount: expenditure.amount,
      };

      // Get current payment history or initialize empty array
      const existingHistory = expenditure.paymentHistory || [];

      await updateDoc(doc(db, 'expenditures', expenditure.id), {
        isPaid: true,
        lastPaidDate: serverTimestamp(),
        paymentHistory: [...existingHistory, currentPayment],
        updatedAt: serverTimestamp(),
      });

      if (updateMainFund) {
        let bankName: string | undefined;

        if (fundSource === 'bank' && bankId) {
          const bank = banks.find((b) => b.id === bankId);
          bankName = bank?.name;
        }

        // Add to cash transactions
        await addDoc(collection(db, 'cashTransactions'), {
          userId,
          amount: expenditure.amount,
          type: 'deduct',
          source: fundSource,
          category: 'expenditure',
          note: `Expense paid: ${expenditure.title}`,
          bankId: bankId || null,
          BankName: bankName || null,
          holderName: holderName || null,
          createdAt: serverTimestamp(),
        });

        // Update total cash snapshot
        const docRef = doc(db, 'totalCashSnapshots', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as TotalCashSnapshot;
          const updatedSources = { ...data.sources };
          const updatedHeldBy = data.heldBy ? { ...data.heldBy } : {};

          if (fundSource === 'bank' && bankName) {
            updatedSources.bank = updatedSources.bank || {};
            updatedSources.bank[bankName] =
              (updatedSources.bank[bankName] || 0) - expenditure.amount;
          } else if (fundSource !== 'bank') {
            if (fundSource === 'in_hand') {
              updatedSources.in_hand =
                updatedSources.in_hand - expenditure.amount;
            } else if (fundSource === 'easypaisa') {
              updatedSources.easypaisa =
                updatedSources.easypaisa - expenditure.amount;
            } else if (fundSource === 'jazzcash') {
              updatedSources.jazzcash =
                updatedSources.jazzcash - expenditure.amount;
            } else if (fundSource === 'other') {
              updatedSources.other = updatedSources.other - expenditure.amount;
            }
          }

          // Deduct from holder
          if (holderName && holderName !== 'Unassigned' && holderName !== 'Self') {
            const key = getSourceKey(fundSource, bankName);
            const holders = [...(updatedHeldBy[key] || [])];
            const idx = holders.findIndex((h) => h.holderName === holderName);
            if (idx > -1) {
              holders[idx] = {
                ...holders[idx],
                amount: Math.max(0, holders[idx].amount - expenditure.amount),
              };
              updatedHeldBy[key] = holders;
            }
          }

          await setDoc(docRef, {
            ...data,
            sources: updatedSources,
            heldBy: updatedHeldBy,
            totalAmount: (data.totalAmount || 0) - expenditure.amount,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.error('Error marking expenditure as paid:', error);
      throw error;
    }
  };

  const rescheduleExpenditure = async (
    expenditureId: string,
    newDate: Date
  ) => {
    try {
      await updateDoc(doc(db, 'expenditures', expenditureId), {
        dueDate: Timestamp.fromDate(newDate),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error rescheduling expenditure:', error);
      throw error;
    }
  };

  const updateExpenditureAmount = async (
    expenditureId: string,
    amount: number
  ) => {
    try {
      await updateDoc(doc(db, 'expenditures', expenditureId), {
        amount,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating expenditure amount:', error);
      throw error;
    }
  };

  const deleteExpenditure = async (expenditureId: string) => {
    try {
      await deleteDoc(doc(db, 'expenditures', expenditureId));
    } catch (error) {
      console.error('Error deleting expenditure:', error);
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
    <ExpendituresContext.Provider
      value={{
        expenditures,
        banks,
        loading,
        markAsPaid,
        rescheduleExpenditure,
        updateExpenditureAmount,
        deleteExpenditure,
        addNewBank,
        refreshData,
      }}
    >
      {children}
    </ExpendituresContext.Provider>
  );
};
