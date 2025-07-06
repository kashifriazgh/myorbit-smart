'use client';

import {
  Box,
  Typography,
  CircularProgress,
  Stack,
  Divider,
  Chip,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { JournalEntry } from '@/app/lib/interface';
import moment from 'moment';
import AIEnhanceModal from '@/app/components/global/AIModal';

const moodPhrases: Record<string, string[]> = {
  happy: ["You're radiating joy!", 'A bright and cheerful day!'],
  sad: ["It's okay to have down days", 'A reflective and emotional moment.'],
  angry: ['Strong emotions today', 'A tough and frustrating moment'],
  'heart-broken': ['Healing takes time', 'Deep emotional reflection'],
  loving: ['Overflowing with love!', 'Warm and fuzzy feelings.'],
};

export default function JournalDetailPage() {
  const { id } = useParams();
  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiModalOpen, setAIModalOpen] = useState(false);

  useEffect(() => {
    const fetchJournal = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'journals', id as string));
        if (snap.exists()) {
          const data = snap.data() as JournalEntry;
          setJournal({ ...data, id: snap.id });
        }
      } catch (err) {
        console.error('Error fetching journal:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchJournal();
  }, [id]);

  if (loading) {
    return (
      <Box textAlign="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  if (!journal) return <Typography>Journal entry not found.</Typography>;

  const moodPhrase =
    journal.mood &&
    moodPhrases[journal.mood.type]?.[
      Math.min(1, Math.floor(journal.mood.level / 5))
    ];

  return (
    <Box mt={4} p={2} maxWidth="700px" mx="auto">
      {/* Title */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        {journal.title}
      </Typography>

      {/* Date */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {moment(
          journal.createdAt instanceof Timestamp
            ? journal.createdAt.toDate()
            : journal.createdAt
        ).format('dddd, MMM D, YYYY h:mm A')}
      </Typography>

      <Divider sx={{ my: 2 }} />

      {/* Mood + Level */}
      {journal.mood && (
        <Stack spacing={1} mb={2}>
          <Chip label={`Mood: ${journal.mood.type}`} color="primary" />
          <Typography variant="body2">
            Mood Level: {journal.mood.level} – <strong>{moodPhrase}</strong>
          </Typography>
        </Stack>
      )}

      {/* AI Mood Analysis */}
      {journal.aiMoodAnalysis && (
        <Typography variant="body1" sx={{ my: 1 }}>
          🧠 AI Analysis: This day seems{' '}
          <strong>{journal.aiMoodAnalysis}</strong>
        </Typography>
      )}

      {/* Main Content */}
      <Box my={3}>
        <Typography variant="subtitle1" fontWeight="bold">
          📓 Reflection:
        </Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>
          {journal.content}
        </Typography>
      </Box>
      <Box display="flex" justifyContent="flex-end" mt={2}>
        <Chip
          label="AI Improve ✨"
          onClick={() => setAIModalOpen(true)}
          sx={{
            bgcolor: '#2563eb',
            color: '#fff',
            fontWeight: 500,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: '#1e40af',
            },
          }}
        />
      </Box>

      {/* AI Suggestion */}
      {journal.aiSummary && (
        <Box my={3}>
          <Typography variant="subtitle1" fontWeight="bold">
            🔍 Summary:
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {journal.aiSummary}
          </Typography>
        </Box>
      )}

      {/* Tags */}
      {journal.tags?.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" mt={2}>
          {journal.tags.map((tag, idx) => (
            <Chip key={idx} label={`#${tag}`} variant="outlined" />
          ))}
        </Stack>
      )}
      <br />
      {journal && (
        <AIEnhanceModal
          open={aiModalOpen}
          onClose={() => setAIModalOpen(false)}
          docId={journal.id!}
          originalText={journal.content}
          suggestionPrompt={`
You're an emotional well-being assistant. Read the following journal entry and provide:
1. A summary of emotional tone or dominant feeling
2. Any signs of stress, positivity, or insight
3. Advice to help reflect, grow, or feel better
4. A relevant affirmation or mindful practice

Be empathetic, warm, and concise.
  `.trim()}
          onApply={async (enhancedText) => {
            await updateDoc(doc(db, 'journals', journal.id!), {
              content: enhancedText,
            });
            setJournal((prev) =>
              prev ? { ...prev, content: enhancedText } : prev
            );
            setAIModalOpen(false);
          }}
        />
      )}
    </Box>
  );
}
