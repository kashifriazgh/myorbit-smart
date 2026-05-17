'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Container,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Stack,
  Tooltip,
  Skeleton,
  TextField,
} from '@mui/material';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { QuickNote } from '@/app/lib/interface';
import moment from 'moment-timezone';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NoteIcon from '@mui/icons-material/Note';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import AddIcon from '@mui/icons-material/Add';
import NoteInput from '@/app/components/global/NoteInput';

export default function NotesPage() {
  const { user } = useAuth();
  const { theme: customTheme } = useCustomTheme();
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'general' | 'fav' | 'important'>(
    'all',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Helpers to format title and preview (stripping markdown syntax for clean presentation)
  const stripMarkdown = (mdText: string) => {
    if (!mdText) return '';
    return mdText
      .replace(/\*\*|__|\*|_|~~/g, '') // Strip bold, italic, strikethrough
      .replace(/^\s*([-*•]|\d+\.)\s+/gm, '') // Strip bullet & numbered list markers
      .replace(/^\s*#+\s+/gm, '') // Strip headers
      .replace(/---|\*\*\*/g, ''); // Strip horizontal rules
  };

  const getNoteTitle = (content: string) => {
    const cleanContent = stripMarkdown(content);
    const firstLine = cleanContent.split('\n')[0].trim();
    if (!firstLine) return 'Untitled';
    return firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
  };

  const getNotePreview = (content: string) => {
    const cleanContent = stripMarkdown(content);
    const text = cleanContent.replace(/\s+/g, ' ').trim();
    return text.length > 140 ? text.slice(0, 140) + '…' : text;
  };

  const fetchNotes = useCallback(async () => {
    if (!user?.uid) {
      // Don't set loading to false yet if we're still initializing
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'notes'), where('userId', '==', user.uid));

      const snapshot = await getDocs(q);
      const fetchedNotes = snapshot.docs.map((doc) => {
        const data = doc.data();
        const createdAt =
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : new Date(data.createdAt);

        return {
          ...data,
          id: doc.id,
          createdAt,
        } as QuickNote;
      });

      // Sort client-side by createdAt desc
      fetchedNotes.sort(
        (a, b) =>
          (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
      );

      setNotes(fetchedNotes);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes, isEditorOpen]);

  const handleToggleFav = async (
    e: React.MouseEvent,
    id: string,
    current: boolean,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'notes', id), {
        isFav: !current,
        updatedAt: new Date(),
      });
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isFav: !current } : n)),
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleToggleImportant = async (
    e: React.MouseEvent,
    id: string,
    current: boolean,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'notes', id), {
        isImportant: !current,
        updatedAt: new Date(),
      });
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isImportant: !current } : n)),
      );
    } catch (error) {
      console.error('Error toggling important:', error);
    }
  };

  const filteredNotes = notes.filter((note) => {
    const matchesSearch = note.content.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    if (filter === 'general') return !note.isImportant && !note.isFav;
    if (filter === 'fav') return note.isFav;
    if (filter === 'important') return note.isImportant;
    return true;
  });

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Header Skeleton */}
        <Box display="flex" justifyContent="space-between" mb={4}>
          <Skeleton variant="rectangular" width={150} height={40} sx={{ borderRadius: '12px' }} />
          <Skeleton variant="circular" width={40} height={40} />
        </Box>

        {/* Filter Skeleton */}
        <Stack direction="row" spacing={1} mb={4}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" width={80} height={32} sx={{ borderRadius: '12px' }} />
          ))}
        </Stack>

        {/* Notes List Skeleton */}
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Card key={i} sx={{ borderRadius: '1rem', p: 1 }}>
              <CardContent>
                <Skeleton variant="text" width="60%" height={30} sx={{ mb: 1 }} />
                <Box display="flex" gap={1} mb={2}>
                  <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: '4px' }} />
                  <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: '4px' }} />
                </Box>
                <Skeleton variant="rectangular" width="100%" height={60} sx={{ borderRadius: '8px', mb: 2 }} />
                <Skeleton variant="text" width="30%" height={20} />
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="md"
      sx={{ py: 4 }}
      className={
        customTheme?.mode === 'dark'
          ? 'bg-slate-950 text-slate-50'
          : 'bg-slate-50 text-slate-900'
      }
    >
      {/* Header Section */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={3}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Button
              startIcon={<ArrowBackIcon />}
              sx={{ color: 'text.primary' }}
            >
              Back
            </Button>
          </Link>
          <Typography variant="h4" fontWeight="bold">
            Quick Notes
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={`${filteredNotes.length} notes`}
            color="primary"
            variant="outlined"
          />
          <Tooltip title="Create New Note">
            <IconButton
              color="primary"
              onClick={() => setIsEditorOpen(true)}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Search Bar */}
      <Box mb={3}>
        <TextField
          fullWidth
          placeholder="Search notes..."
          variant="outlined"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            sx: { 
              borderRadius: '12px',
              bgcolor: customTheme?.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'white'
            }
          }}
        />
      </Box>

      {/* Filter Section */}
      <Box mb={3}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {[
            { label: 'All', value: 'all' },
            { label: 'General', value: 'general' },
            { label: 'Favorites', value: 'fav', icon: <StarIcon fontSize="small" /> },
            {
              label: 'Important',
              value: 'important',
              icon: <PriorityHighIcon fontSize="small" />,
            },
          ].map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              icon={opt.icon}
              clickable
              color={filter === opt.value ? 'primary' : 'default'}
              variant={filter === opt.value ? 'filled' : 'outlined'}
              onClick={() => setFilter(opt.value as 'all' | 'general' | 'fav' | 'important')}
              sx={{ borderRadius: '12px', fontWeight: 600 }}
            />
          ))}
        </Stack>
      </Box>

      {filteredNotes.length === 0 ? (
        <Card
          className={
            customTheme?.mode === 'dark'
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-slate-200'
          }
          sx={{
            textAlign: 'center',
            py: 6,
            borderRadius: '1rem',
          }}
        >
          <CardContent>
            <NoteIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography
              variant="h6"
              className={
                customTheme?.mode === 'dark'
                  ? 'text-slate-400'
                  : 'text-slate-600'
              }
              mb={1}
            >
              No notes found
            </Typography>
            <Typography
              variant="body2"
              className={
                customTheme?.mode === 'dark'
                  ? 'text-slate-500'
                  : 'text-slate-500'
              }
            >
              Try changing the filter or create a new note
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredNotes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              style={{ textDecoration: 'none' }}
            >
              <Card
                className={
                  customTheme?.mode === 'dark'
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  borderRadius: '1rem',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Typography
                      variant="subtitle1"
                      className={
                        customTheme?.mode === 'dark'
                          ? 'text-slate-100'
                          : 'text-slate-900'
                      }
                      sx={{ fontWeight: 700, mb: 0.5, flex: 1 }}
                    >
                      {getNoteTitle(note.content)}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="small"
                        onClick={(e) =>
                          handleToggleFav(e, note.id!, !!note.isFav)
                        }
                        color={note.isFav ? 'warning' : 'default'}
                      >
                        {note.isFav ? (
                          <StarIcon fontSize="small" />
                        ) : (
                          <StarBorderIcon fontSize="small" />
                        )}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) =>
                          handleToggleImportant(e, note.id!, !!note.isImportant)
                        }
                        color={note.isImportant ? 'error' : 'default'}
                      >
                        {note.isImportant ? (
                          <PriorityHighIcon fontSize="small" />
                        ) : (
                          <PriorityHighIcon
                            fontSize="small"
                            sx={{ opacity: 0.3 }}
                          />
                        )}
                      </IconButton>
                    </Stack>
                  </Box>

                  <Box display="flex" gap={1} alignItems="center" mb={1}>
                    {note.isImportant && (
                      <Chip
                        size="small"
                        label="Important"
                        color="error"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    )}
                    {note.isFav && (
                      <Chip
                        size="small"
                        label="Favorite"
                        color="warning"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    )}
                    {!note.isImportant && !note.isFav && (
                      <Chip
                        size="small"
                        label="General"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem', opacity: 0.6 }}
                      />
                    )}
                    {note.isArchived && (
                      <Chip size="small" label="Archived" variant="outlined" />
                    )}
                  </Box>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    {getNotePreview(note.content)}
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

      {/* New Note Dialog */}
      <Dialog
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '1rem',
            background: customTheme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Create New Note</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <NoteInput variant="compact" />
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => setIsEditorOpen(false)}
              sx={{ borderRadius: '12px', textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => setIsEditorOpen(false)}
              sx={{ borderRadius: '12px', textTransform: 'none' }}
            >
              Done
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
