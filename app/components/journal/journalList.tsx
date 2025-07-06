'use client';

import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
  Skeleton,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import moment from 'moment';

interface JournalDoc {
  id: string;
  title: string;
  createdAt: Timestamp;
}

export default function JournalList() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();

  const [journals, setJournals] = useState<JournalDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchJournals = async () => {
      try {
        const now = moment();
        const past30 = now.clone().subtract(30, 'days').toDate();

        const q = query(
          collection(db, 'journals'),
          where('authorId', '==', user.uid),
          where('createdAt', '>=', past30),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const entries: JournalDoc[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.title && data.createdAt) {
            entries.push({
              id: doc.id,
              title: data.title,
              createdAt: data.createdAt,
            });
          }
        });

        setJournals(entries);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching journals:', err);
        setLoading(false);
      }
    };

    fetchJournals();
  }, [user]);

  if (loading) {
    return (
      <Stack spacing={2}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={80} />
        ))}
      </Stack>
    );
  }

  if (journals.length === 0) {
    return (
      <Typography textAlign="center" mt={4} color="text.secondary">
        No entries in the last 30 days.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {journals.map((entry) => (
        <Link key={entry.id} href={`/journals/${entry.id}`} passHref>
          <Card
            sx={{
              backgroundColor: theme.mode === 'dark' ? '#1e293b' : '#f8fafc',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              },
            }}
          >
            <CardActionArea>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {entry.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {moment(entry.createdAt.toDate()).format(
                    'D MMMM YYYY, h:mm A'
                  )}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Link>
      ))}
    </Stack>
  );
}
