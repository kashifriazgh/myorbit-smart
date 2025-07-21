'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import moment from 'moment-timezone';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { JournalEntry } from '@/app/lib/interface';
import { Box, Typography, CircularProgress } from '@mui/material';

export default function JournalMemory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [memory, setMemory] = useState<string | null>(null);

  useEffect(() => {
    const fetchMemory = async () => {
      if (!user) return;

      setLoading(true);
      const now = moment().tz('Asia/Karachi');
      const lastWeek = now.clone().subtract(1, 'week');
      const lastMonth = now.clone().subtract(1, 'month');
      const lastYear = now.clone().subtract(1, 'year');

      try {
        const snap = await getDocs(collection(db, 'journals'));
        const allJournals = snap.docs
          .map((doc) => ({ ...doc.data(), id: doc.id } as JournalEntry))
          .filter((j) => j.authorId === user.uid);

        const groupedJournals = {
          lastWeek: allJournals.filter((j) => {
            const date =
              j.createdAt instanceof Timestamp
                ? j.createdAt.toDate()
                : j.createdAt;
            return moment(date).isSame(lastWeek, 'day');
          }),
          lastMonth: allJournals.filter((j) => {
            const date =
              j.createdAt instanceof Timestamp
                ? j.createdAt.toDate()
                : j.createdAt;
            return moment(date).isSame(lastMonth, 'day');
          }),
          lastYear: allJournals.filter((j) => {
            const date =
              j.createdAt instanceof Timestamp
                ? j.createdAt.toDate()
                : j.createdAt;
            return moment(date).isSame(lastYear, 'day');
          }),
        };

        // Flatten all journals and send each to Gemini
        const summaries = await Promise.all(
          Object.entries(groupedJournals).flatMap(([key, journals]) =>
            journals.map(async (journal) => {
              const createdAtDate =
                journal.createdAt instanceof Timestamp
                  ? journal.createdAt.toDate()
                  : journal.createdAt;

              const res = await fetch('/api/ideas/improve-idea', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  value: `${journal.title}\n${journal.content}`,
                  instructions: `
Summarize the key emotional or meaningful memory in this journal entry. Return a short reflection in this format:

"Last ${moment(createdAtDate).format(
                    'dddd'
                  )}, you experienced something meaningful..."

Use a kind tone and inspire present action.
              `.trim(),
                }),
              });

              const data = await res.json();
              return {
                key,
                summary: data.result || '',
              };
            })
          )
        );

        // Ask Gemini which one is best to display
        const combinedSummaries = summaries
          .map((s) => `(${s.key}) ${s.summary}`)
          .join('\n\n');

        const bestRes = await fetch('/api/ideas/improve-idea', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            value: combinedSummaries,
            instructions: `
You're a personal reflection assistant. Out of the following past memories, decide which one should be shown to the user today. Return only the best single summary.
        `.trim(),
          }),
        });

        const best = await bestRes.json();
        setMemory(best.result || null);
      } catch (err) {
        console.error('❌ Error fetching journal memory:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMemory();
  }, [user]);

  if (loading) {
    return (
      <Box mt={3} textAlign="center">
        <CircularProgress />
      </Box>
    );
  }

  if (!memory) return null;

  return (
    <Box
      mt={3}
      p={2}
      borderRadius={2}
      bgcolor="#fefce8"
      border="1px solid #fde68a"
    >
      <Typography fontSize={14} color="#92400e" fontWeight={600}>
        🧠 Memory from the Past
      </Typography>
      <Typography fontSize={15} mt={1}>
        {memory}
      </Typography>
    </Box>
  );
}
