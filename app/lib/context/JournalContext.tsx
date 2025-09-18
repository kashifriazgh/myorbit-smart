'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from './userContext';
import moment from 'moment';

interface JournalDoc {
  id: string;
  title: string;
  content?: string;
  mood?: {
    type: 'happy' | 'loving' | 'sad' | 'heart-broken' | 'angry';
    level: number;
  };
  productivityOfTheDay?: string;
  createdAt: Timestamp | Date;
  userId: string;
}

interface JournalInsights {
  totalEntries: number;
  last30Days: number;
  currentStreak: number;
  longestStreak: number;
}

interface JournalContextType {
  journals: JournalDoc[];
  recentJournals: JournalDoc[]; // Last 30 days
  insights: JournalInsights;
  loading: boolean;
  error: string | null;
}

const JournalContext = createContext<JournalContextType | undefined>(undefined);

// Helper function to convert Timestamp or Date to Date
const toDate = (timestamp: Timestamp | Date): Date => {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return timestamp.toDate();
};

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [journals, setJournals] = useState<JournalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setJournals([]);
      setLoading(false);
      return;
    }

    // Single subscription for all user journals
    const q = query(
      collection(db, 'journals'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allJournals: JournalDoc[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.title && data.createdAt) {
            allJournals.push({
              id: doc.id,
              title: data.title,
              content: data.content,
              mood: data.mood,
              productivityOfTheDay: data.productivityOfTheDay,
              createdAt: data.createdAt,
              userId: data.userId,
            });
          }
        });

        // Sort by createdAt descending (newest first)
        const sortedJournals = allJournals.sort((a, b) => {
          const dateA = toDate(a.createdAt);
          const dateB = toDate(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

        setJournals(sortedJournals);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching journals:', err);
        setError('Failed to load journals');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Calculate recent journals (last 30 days)
  const recentJournals = React.useMemo(() => {
    const thirtyDaysAgo = moment().subtract(30, 'days');
    return journals.filter((journal) =>
      moment(toDate(journal.createdAt)).isAfter(thirtyDaysAgo)
    );
  }, [journals]);

  // Calculate insights
  const insights = React.useMemo(() => {
    const now = moment();

    const totalEntries = journals.length;
    const last30Days = recentJournals.length;

    // Calculate current streak
    let currentStreak = 0;
    const checkDate = now.clone().startOf('day');

    for (let i = 0; i < 365; i++) {
      const hasEntry = journals.some((journal) =>
        moment(toDate(journal.createdAt)).isSame(checkDate, 'day')
      );

      if (hasEntry) {
        currentStreak++;
        checkDate.subtract(1, 'day');
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    const sortedJournals = journals
      .sort((a, b) =>
        moment(toDate(b.createdAt)).diff(moment(toDate(a.createdAt)))
      )
      .map((j) => moment(toDate(j.createdAt)).startOf('day'));

    if (sortedJournals.length > 0) {
      const currentDate = sortedJournals[0].clone();
      let lastDate = currentDate.clone();

      for (let i = 1; i < sortedJournals.length; i++) {
        const journalDate = sortedJournals[i];
        const daysDiff = lastDate.diff(journalDate, 'days');

        if (daysDiff === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak + 1);
          tempStreak = 0;
        }
        lastDate = journalDate.clone();
      }
      longestStreak = Math.max(longestStreak, tempStreak + 1);
    }

    return {
      totalEntries,
      last30Days,
      currentStreak,
      longestStreak,
    };
  }, [journals, recentJournals]);

  const value: JournalContextType = {
    journals,
    recentJournals,
    insights,
    loading,
    error,
  };

  return (
    <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
  );
}

export function useJournalContext() {
  const context = useContext(JournalContext);
  if (context === undefined) {
    throw new Error('useJournalContext must be used within a JournalProvider');
  }
  return context;
}
