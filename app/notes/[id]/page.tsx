'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Container,
  Button,
} from '@mui/material';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { QuickNote } from '@/app/lib/interface';
import { useParams, useRouter } from 'next/navigation';
import moment from 'moment-timezone';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NoteIcon from '@mui/icons-material/Note';

export default function NoteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { theme: customTheme } = useCustomTheme();
  const [note, setNote] = useState<QuickNote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNote = async () => {
      if (!id || !user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'notes', id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const fetchedNote: QuickNote = {
            id: docSnap.id,
            userId: data.userId,
            content: data.content,
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt.toDate()
                : new Date(data.createdAt),
            updatedAt: data.updatedAt
              ? data.updatedAt instanceof Timestamp
                ? data.updatedAt.toDate()
                : new Date(data.updatedAt)
              : undefined,
          };

          // Verify ownership
          if (fetchedNote.userId !== user.uid) {
            router.push('/notes');
            return;
          }

          setNote(fetchedNote);
        } else {
          router.push('/notes');
        }
      } catch (error) {
        console.error('Error fetching note:', error);
        router.push('/notes');
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [id, user?.uid, router]);

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight={400}
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!note) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Card
          sx={{
            backgroundColor:
              customTheme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            color: customTheme?.mode === 'dark' ? '#f1f5f9' : '#000000',
            textAlign: 'center',
            py: 6,
          }}
        >
          <CardContent>
            <NoteIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" mb={1}>
              Note not found
            </Typography>
            <Button
              variant="contained"
              onClick={() => router.push('/notes')}
              sx={{ mt: 2 }}
            >
              Back to Notes
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/notes')}
          sx={{ color: 'text.primary', mb: 2 }}
        >
          Back to Notes
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', fontSize: '0.875rem' }}
        >
          {moment(note.createdAt).format('MMMM D, YYYY [at] h:mm A')}
        </Typography>
      </Box>

      <Card
        sx={{
          backgroundColor:
            customTheme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          color: customTheme?.mode === 'dark' ? '#f1f5f9' : '#000000',
          minHeight: 400,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Typography
            variant="body1"
            sx={{
              fontSize: '1.125rem',
              fontWeight: 500,
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            {note.content}
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}


