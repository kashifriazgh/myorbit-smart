'use client';

import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import type {
  Expenditure,
  Liability,
  LoanRecord,
  PlannedExpense,
  TotalCashSnapshot,
} from '@/app/lib/interface';

export interface AffordabilityRawData {
  snapshot: TotalCashSnapshot | null;
  plannedExpenses: PlannedExpense[];
  expenditures: Expenditure[];
  loans: LoanRecord[];
  liabilities: Liability[];
}

export interface UseAffordabilityDataReturn {
  data: AffordabilityRawData;
  loading: boolean;
  error: string | null;
  lastFetchedAt: Date | null;
  refresh: () => Promise<void>;
}

const EMPTY_DATA: AffordabilityRawData = {
  snapshot: null,
  plannedExpenses: [],
  expenditures: [],
  loans: [],
  liabilities: [],
};

function normalizeSnapshot(raw: TotalCashSnapshot): TotalCashSnapshot {
  const sources = raw.sources || {
    in_hand: 0,
    easypaisa: 0,
    jazzcash: 0,
    other: 0,
    bank: {},
    custom: {},
  };

  return {
    ...raw,
    sources: {
      in_hand: Number(sources.in_hand) || 0,
      easypaisa: Number(sources.easypaisa) || 0,
      jazzcash: Number(sources.jazzcash) || 0,
      other: Number(sources.other) || 0,
      bank:
        typeof sources.bank === 'number'
          ? { Default: sources.bank }
          : sources.bank && typeof sources.bank === 'object'
          ? sources.bank
          : {},
      custom:
        sources.custom && typeof sources.custom === 'object' ? sources.custom : {},
    },
  };
}

/**
 * Read-only hook that loads all financial inputs required by the Affordability Analyzer
 * in a single parallel batch without mutating any Firestore documents.
 */
export function useAffordabilityData(userId?: string | null): UseAffordabilityDataReturn {
  const [data, setData] = useState<AffordabilityRawData>(EMPTY_DATA);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setData(EMPTY_DATA);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        directSnapshotSnap,
        plannedSnap,
        expendituresSnap,
        loansSnap,
        liabilitiesSnap,
      ] = await Promise.all([
        getDoc(doc(db, 'totalCashSnapshots', userId)),
        getDocs(query(collection(db, 'plannedExpenses'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'expenditures'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'loans'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'liabilities'), where('userId', '==', userId))),
      ]);

      let snapshot: TotalCashSnapshot | null = null;
      if (directSnapshotSnap.exists()) {
        snapshot = normalizeSnapshot({
          id: directSnapshotSnap.id,
          ...(directSnapshotSnap.data() as Omit<TotalCashSnapshot, 'id'>),
        });
      } else {
        // Fallback query if user's snapshot doc was stored with an auto-generated ID
        const fallbackSnap = await getDocs(
          query(collection(db, 'totalCashSnapshots'), where('userId', '==', userId))
        );
        if (!fallbackSnap.empty) {
          const first = fallbackSnap.docs[0];
          snapshot = normalizeSnapshot({
            id: first.id,
            ...(first.data() as Omit<TotalCashSnapshot, 'id'>),
          });
        }
      }

      const plannedExpenses: PlannedExpense[] = plannedSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PlannedExpense, 'id'>),
      }));

      const expenditures: Expenditure[] = expendituresSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Expenditure, 'id'>),
      }));

      const loans: LoanRecord[] = loansSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LoanRecord, 'id'>),
      }));

      const liabilities: Liability[] = liabilitiesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Liability, 'id'>),
      }));

      setData({
        snapshot,
        plannedExpenses,
        expenditures,
        loans,
        liabilities,
      });
      setLastFetchedAt(new Date());
    } catch (err) {
      console.error('Error loading Affordability Analyzer data:', err);
      setError('Unable to load your financial records right now. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    data,
    loading,
    error,
    lastFetchedAt,
    refresh: fetchAll,
  };
}
