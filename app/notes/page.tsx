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
  Chip,
} from '@mui/material';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { QuickNote } from '@/app/lib/interface';
import moment from 'moment-timezone';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NoteIcon from '@mui/icons-material/Note';

export default function NotesPage() {
  const { user } = useAuth();
  const { theme: customTheme } = useCustomTheme();
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotes = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const thirtyDaysAgo = moment().subtract(30, 'days').startOf('day').toDate();
        
        // Query: filter by userId only (single field - no composite index needed)
        const q = query(
          collection(db, 'notes'),
          where('userId', '==', user.uid)
        );

        const snapshot = await getDocs(q);
        const fetchedNotes = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const createdAt = data.createdAt instanceof Timestamp
              ? data.createdAt.toDate()
              : new Date(data.createdAt);
            
            return {
              ...data,
              id: doc.id,
              createdAt,
            } as QuickNote;
          })
          // Filter client-side for last 30 days and normalize dates
          .map((note) => {
            const createdAtDate = note.createdAt instanceof Date 
              ? note.createdAt 
              : note.createdAt instanceof Timestamp 
              ? note.createdAt.toDate() 
              : new Date(note.createdAt);
            return { ...note, createdAt: createdAtDate };
          })
          .filter((note) => note.createdAt >= thirtyDaysAgo)
          // Sort client-side by createdAt desc
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        setNotes(fetchedNotes);
      } catch (error) {
        console.error('Error fetching notes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [user?.uid]);

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

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={3}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Button startIcon={<ArrowBackIcon />} sx={{ color: 'text.primary' }}>
              Back
            </Button>
          </Link>
          <Typography variant="h4" fontWeight="bold">
            Quick Notes
          </Typography>
        </Box>
        <Chip
          label={`${notes.length} notes`}
          color="primary"
          variant="outlined"
        />
      </Box>

      {notes.length === 0 ? (
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
              No notes found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start creating notes from the homepage Quick Notes section
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {notes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              style={{ textDecoration: 'none' }}
            >
              <Card
                sx={{
                  backgroundColor:
                    customTheme?.mode === 'dark' ? '#1e293b' : '#ffffff',
                  color: customTheme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent>
                  <Typography
                    variant="body1"
                    sx={{
                      fontSize: '1rem',
                      fontWeight: 500,
                      lineHeight: 1.7,
                      mb: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    }}
                  >
                    {note.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: '0.75rem' }}
                  >
                    {moment(note.createdAt).format('MMM D, YYYY h:mm A')}
                  </Typography>
                </CardContent>
              </Card>
            </Link>
          ))}
        </Box>
      )}
    </Container>
  );
}


