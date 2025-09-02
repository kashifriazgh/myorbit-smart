'use client';
import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import moment from 'moment-timezone';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { JournalEntry } from '@/app/lib/interface';
import {
  Box,
  Typography,
  Divider,
  Button,
  Collapse,
  Skeleton,
  MobileStepper,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { useOnboarding } from '@/app/lib/context/onBoardingContext';
import Dexie from 'dexie';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';

interface MemoryData {
  journalText: string;
  aiReflection: string;
  date: string;
}

interface MemoryCache {
  id: string; // "week" | "month"
  data: MemoryData | null;
  expiresAt: number;
}

// ------------------ Dexie DB Setup ------------------
class MemoryDB extends Dexie {
  memories!: Dexie.Table<MemoryCache, string>;
  constructor() {
    super('MemoryJournalDB');
    this.version(1).stores({
      memories: 'id',
    });
  }
}
const dbDexie = new MemoryDB();
// -----------------------------------------------------

export default function JournalMemory() {
  const { user } = useAuth();
  const { onboarding } = useOnboarding();

  const [loading, setLoading] = useState(true);
  const [weekMemory, setWeekMemory] = useState<MemoryData | null>(null);
  const [monthMemory, setMonthMemory] = useState<MemoryData | null>(null);
  const [showWeekText, setShowWeekText] = useState(false);
  const [showMonthText, setShowMonthText] = useState(false);

  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const fetchMemories = async () => {
      if (!user) return;
      setLoading(true);

      const now = moment().tz('Asia/Karachi');
      const sameDayLastWeek = now.clone().subtract(1, 'week');
      const sameDayLastMonth = now.clone().subtract(1, 'month');
      const expiry = now.clone().endOf('day').valueOf();

      try {
        const userScopedWeekKey = `week:${user.uid}`;
        const userScopedMonthKey = `month:${user.uid}`;

        const cachedWeek = await dbDexie.memories.get(userScopedWeekKey);
        const cachedMonth = await dbDexie.memories.get(userScopedMonthKey);

        if (
          cachedWeek?.data &&
          cachedMonth?.data &&
          cachedWeek.expiresAt > Date.now() &&
          cachedMonth.expiresAt > Date.now()
        ) {
          setWeekMemory(cachedWeek.data);
          setMonthMemory(cachedMonth.data);
          setLoading(false);
          return;
        }

        const snap = await getDocs(
          query(collection(db, 'journals'), where('authorId', '==', user.uid))
        );
        const allJournals = snap.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id } as JournalEntry)
        );

        const matchJournal = (targetDate: moment.Moment) =>
          allJournals
            .filter((j) => {
              const date =
                j.createdAt instanceof Timestamp
                  ? j.createdAt.toDate()
                  : j.createdAt;
              return moment.tz(date, 'Asia/Karachi').isSame(targetDate, 'day');
            })
            .sort((a, b) => {
              const da =
                a.createdAt instanceof Timestamp
                  ? a.createdAt.toDate()
                  : a.createdAt;
              const dbb =
                b.createdAt instanceof Timestamp
                  ? b.createdAt.toDate()
                  : b.createdAt;
              return dbb.getTime() - da.getTime();
            })[0];

        const getAIReflection = async (text: string, dateLabel: string) => {
          let toneInstructions = '';
          if (dateLabel === 'last week') {
            toneInstructions = `
For last week memories:
- You may ask about emotional states, struggles, or pains mentioned.
- Be empathetic and supportive.
- If challenges are mentioned, encourage gentle reflection.
- Still give 1 small actionable tip.
`.trim();
          } else if (dateLabel === 'last month') {
            toneInstructions = `
For last month memories:
- Do NOT ask about past pains or struggles.
- Focus on actions, productivity, planning, and lessons learned.
- Give 1 small, forward-looking actionable tip.
- Keep tone encouraging and growth-oriented.
`.trim();
          }

          const res = await fetch('/api/ideas/improve-idea', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              value: text,
              instructions: `
You are a journaling assistant for ${user?.firstName || ''} ${
                user?.lastName || ''
              }.
User onboarding info: ${JSON.stringify(onboarding || {}, null, 2)}.

Keep your reply:
- Max 2 short sentences.
- Warm, encouraging, and practical.
- Reference the time frame: ${dateLabel}.
${toneInstructions}
`.trim(),
            }),
          });

          const data = await res.json();
          return data.result || '';
        };

        let weekData: MemoryData | null = null;
        let monthData: MemoryData | null = null;

        const weekJournal = matchJournal(sameDayLastWeek);
        if (weekJournal) {
          const dateObj =
            weekJournal.createdAt instanceof Timestamp
              ? weekJournal.createdAt.toDate()
              : weekJournal.createdAt;
          const text = `${weekJournal.title}\n${weekJournal.content}`;
          const aiText = await getAIReflection(text, 'last week');
          weekData = {
            journalText: text,
            aiReflection: aiText,
            date: moment.tz(dateObj, 'Asia/Karachi').format('D MMM YYYY'),
          };
          setWeekMemory(weekData);
          await dbDexie.memories.put({
            id: userScopedWeekKey,
            data: weekData,
            expiresAt: expiry,
          });
        }

        const monthJournal = matchJournal(sameDayLastMonth);
        if (monthJournal) {
          const dateObj =
            monthJournal.createdAt instanceof Timestamp
              ? monthJournal.createdAt.toDate()
              : monthJournal.createdAt;
          const text = `${monthJournal.title}\n${monthJournal.content}`;
          const aiText = await getAIReflection(text, 'last month');
          monthData = {
            journalText: text,
            aiReflection: aiText,
            date: moment.tz(dateObj, 'Asia/Karachi').format('D MMM YYYY'),
          };
          setMonthMemory(monthData);
          await dbDexie.memories.put({
            id: userScopedMonthKey,
            data: monthData,
            expiresAt: expiry,
          });
        }
      } catch (err) {
        console.error('❌ Error fetching memories:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMemories();
  }, [user, onboarding]);

  const renderMemoryBox = (memory: MemoryData, isWeek: boolean) => (
    <Box
      p={3}
      mb={3}
      borderRadius={2}
      bgcolor={isWeek ? '#fefce8' : '#ecfdf5'}
      border={isWeek ? '1px solid #fde68a' : '1px solid #6ee7b7'}
    >
      <Typography
        fontSize={16}
        color={isWeek ? '#92400e' : '#065f46'}
        fontWeight={600}
        mb={1}
      >
        {isWeek
          ? `From Last Week - ${memory.date}`
          : `From Last Month - ${memory.date}`}
      </Typography>

      <Collapse
        in={isWeek ? showWeekText : showMonthText}
        timeout="auto"
        unmountOnExit
      >
        <Typography fontSize={16} mt={1} whiteSpace="pre-line">
          {memory.journalText}
        </Typography>
        <Divider sx={{ my: 1 }} />
      </Collapse>

      <Typography fontSize={16} color="text.secondary">
        {memory.aiReflection}
      </Typography>

      <Button
        size="small"
        onClick={() =>
          isWeek
            ? setShowWeekText(!showWeekText)
            : setShowMonthText(!showMonthText)
        }
        sx={{ mt: 1, textTransform: 'none' }}
        startIcon={
          isWeek ? (
            showWeekText ? (
              <ExpandLess />
            ) : (
              <ExpandMore />
            )
          ) : showMonthText ? (
            <ExpandLess />
          ) : (
            <ExpandMore />
          )
        }
      >
        {isWeek
          ? showWeekText
            ? 'Hide Original Journal'
            : 'View Original Journal'
          : showMonthText
          ? 'Hide Original Journal'
          : 'View Original Journal'}
      </Button>
    </Box>
  );

  if (loading) {
    return (
      <Box mt={3}>
        <Skeleton variant="text" width={180} height={28} sx={{ mb: 2 }} />
        {[...Array(2)].map((_, i) => (
          <Box key={i} p={3} mb={3} borderRadius={2} border="1px solid #e5e7eb">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="rectangular" height={60} sx={{ mt: 1 }} />
            <Skeleton variant="text" width="80%" sx={{ mt: 1 }} />
          </Box>
        ))}
      </Box>
    );
  }

  if (!weekMemory && !monthMemory) return null;

  const bothMemories = weekMemory && monthMemory;

  return (
    <Box mt={3}>
      <Typography fontSize={18} fontWeight={700} mb={3}>
        🧠 Memory Reflections
      </Typography>

      {bothMemories ? (
        <>
          {activeStep === 0 && renderMemoryBox(weekMemory!, true)}
          {activeStep === 1 && renderMemoryBox(monthMemory!, false)}

          <MobileStepper
            variant="dots"
            steps={2}
            position="static"
            activeStep={activeStep}
            nextButton={
              <Button
                size="small"
                onClick={() => setActiveStep(1)}
                disabled={activeStep === 1}
              >
                Last Month
                <KeyboardArrowRight />
              </Button>
            }
            backButton={
              <Button
                size="small"
                onClick={() => setActiveStep(0)}
                disabled={activeStep === 0}
              >
                <KeyboardArrowLeft />
                Last Week
              </Button>
            }
            sx={{ mt: 2 }}
          />
        </>
      ) : weekMemory ? (
        renderMemoryBox(weekMemory, true)
      ) : (
        renderMemoryBox(monthMemory!, false)
      )}
    </Box>
  );
}
