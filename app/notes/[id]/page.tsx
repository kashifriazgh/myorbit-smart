'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Container,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Skeleton,
} from '@mui/material';
import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { QuickNote } from '@/app/lib/interface';
import { useParams, useRouter } from 'next/navigation';
import moment from 'moment-timezone';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NoteIcon from '@mui/icons-material/Note';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Stack, Tooltip } from '@mui/material';

// Import our rich editor, markdown parser, and help dialog
import NoteInput, { renderMarkdown, MarkdownHelpDialog } from '@/app/components/global/NoteInput';

export default function NoteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { theme: customTheme } = useCustomTheme();

  const [note, setNote] = useState<QuickNote | null>(null);
  const [loading, setLoading] = useState(true);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);

  // Markdown Formatting Guide state
  const [helpOpen, setHelpOpen] = useState(false);

  const [savingMeta, setSavingMeta] = useState(false);

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
            importance: data.importance ?? 'normal',
            isArchived: Boolean(data.isArchived),
            isImportant: Boolean(data.isImportant),
            isFav: Boolean(data.isFav),
          };

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

  const handleDelete = async () => {
    if (!id) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'notes', id as string));
      router.push('/notes');
    } catch (error) {
      console.error('Error deleting note:', error);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleToggleFav = async () => {
    if (!id || !note) return;
    setSavingMeta(true);
    try {
      const newValue = !note.isFav;
      await updateDoc(doc(db, 'notes', id as string), {
        isFav: newValue,
        updatedAt: serverTimestamp(),
      });
      setNote((prev) => (prev ? { ...prev, isFav: newValue } : prev));
    } finally {
      setSavingMeta(false);
    }
  };

  const handleToggleImportant = async () => {
    if (!id || !note) return;
    setSavingMeta(true);
    try {
      const newValue = !note.isImportant;
      await updateDoc(doc(db, 'notes', id as string), {
        isImportant: newValue,
        updatedAt: serverTimestamp(),
      });
      setNote((prev) => (prev ? { ...prev, isImportant: newValue } : prev));
    } finally {
      setSavingMeta(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box mb={3}>
          <Skeleton variant="rectangular" width={120} height={32} sx={{ mb: 2, borderRadius: '8px' }} />
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Skeleton variant="text" width={200} height={24} />
            <Stack direction="row" spacing={1}>
              <Skeleton variant="circular" width={40} height={40} />
              <Skeleton variant="circular" width={40} height={40} />
            </Stack>
          </Box>
        </Box>
        <Card sx={{ minHeight: 400, borderRadius: '1.25rem', p: 2 }}>
          <CardContent>
            <Skeleton variant="rectangular" width="100%" height={24} sx={{ mb: 1.5 }} />
            <Skeleton variant="rectangular" width="100%" height={24} sx={{ mb: 1.5 }} />
            <Skeleton variant="rectangular" width="100%" height={24} sx={{ mb: 1.5 }} />
            <Skeleton variant="rectangular" width="80%" height={24} sx={{ mb: 1.5 }} />
            <Skeleton variant="rectangular" width="40%" height={24} />
          </CardContent>
        </Card>
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
    <Container
      maxWidth="md"
      sx={{ py: 4 }}
      className={
        customTheme?.mode === 'dark'
          ? 'bg-slate-950 text-slate-50'
          : 'bg-slate-50 text-slate-900'
      }
    >
      {/* Header */}
      <Box mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/notes')}
          sx={{ color: 'text.primary', mb: 1 }}
        >
          Back to Notes
        </Button>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', fontSize: '0.875rem' }}
          >
            {moment(note.createdAt).format('MMMM D, YYYY [at] h:mm A')}
          </Typography>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Markdown Formatting Guide">
              <IconButton onClick={() => setHelpOpen(true)} color="primary">
                <HelpOutlineIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={note.isFav ? 'Remove from Favorites' : 'Add to Favorites'}>
              <IconButton
                onClick={handleToggleFav}
                color={note.isFav ? 'warning' : 'default'}
                disabled={savingMeta}
              >
                {note.isFav ? <StarIcon /> : <StarBorderIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title={note.isImportant ? 'Unmark as Important' : 'Mark as Important'}>
              <IconButton
                onClick={handleToggleImportant}
                color={note.isImportant ? 'error' : 'default'}
                disabled={savingMeta}
              >
                <PriorityHighIcon sx={{ opacity: note.isImportant ? 1 : 0.3 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Box>

      {/* Markdown Info & Education Banner */}
      <Box 
        onClick={() => setHelpOpen(true)}
        sx={{
          mb: 2,
          p: 1.5,
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          cursor: 'pointer',
          border: '1px dashed',
          borderColor: customTheme?.mode === 'dark' ? '#3b82f660' : '#2563eb40',
          backgroundColor: customTheme?.mode === 'dark' ? '#1d4ed810' : '#eff6ff',
          color: customTheme?.mode === 'dark' ? '#93c5fd' : '#1e40af',
          transition: 'all 0.2s',
          '&:hover': {
            transform: 'translateY(-1px)',
            backgroundColor: customTheme?.mode === 'dark' ? '#1d4ed820' : '#dbeafe',
          }
        }}
      >
        <HelpOutlineIcon fontSize="small" sx={{ color: customTheme?.mode === 'dark' ? '#60a5fa' : '#2563eb' }} />
        <Typography variant="caption" fontWeight="700" sx={{ letterSpacing: '0.01em', cursor: 'pointer' }}>
          Formatted using Markdown. Click here to open the Formatting Guide & Shortcuts!
        </Typography>
      </Box>

      {/* Content Card with Markdown rendering support */}
      <Card
        className={
          customTheme?.mode === 'dark'
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }
        sx={{
          minHeight: 400,
          borderRadius: '1.25rem',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box
            sx={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            {renderMarkdown(note.content, customTheme?.mode)}
          </Box>
        </CardContent>
      </Card>

      {/* ACTION BUTTONS */}
      <Box
        mt={3}
        display="flex"
        flexWrap="wrap"
        gap={1}
        justifyContent="space-between"
      >
        <Box display="flex" gap={1}>
          <IconButton
            color="primary"
            onClick={() => {
              setEditOpen(true);
            }}
          >
            <EditIcon />
          </IconButton>

          <IconButton color="error" onClick={() => setDeleteOpen(true)}>
            <DeleteIcon />
          </IconButton>
        </Box>

        <Box display="flex" gap={1} flexWrap="wrap">
          <Button
            variant="outlined"
            color={note.importance === 'most_important' ? 'error' : 'warning'}
            onClick={async () => {
              if (!id) return;
              setSavingMeta(true);
              try {
                const toggled =
                  note.importance === 'normal'
                    ? 'important'
                    : note.importance === 'important'
                      ? 'most_important'
                      : 'normal';
                await updateDoc(doc(db, 'notes', id as string), {
                  importance: toggled,
                  updatedAt: serverTimestamp(),
                });
                setNote((prev) =>
                  prev ? { ...prev, importance: toggled } : prev,
                );
              } finally {
                setSavingMeta(false);
              }
            }}
            disabled={savingMeta}
          >
            {note.importance === 'most_important'
              ? 'Set Normal'
              : note.importance === 'important'
                ? 'Set Most Important'
                : 'Mark Important'}
          </Button>

          <Button
            variant="outlined"
            color={note.isArchived ? 'inherit' : 'primary'}
            onClick={async () => {
              if (!id) return;
              setSavingMeta(true);
              try {
                const newArchived = !note.isArchived;
                await updateDoc(doc(db, 'notes', id as string), {
                  isArchived: newArchived,
                  updatedAt: serverTimestamp(),
                });
                setNote((prev) =>
                  prev ? { ...prev, isArchived: newArchived } : prev,
                );
              } finally {
                setSavingMeta(false);
              }
            }}
            disabled={savingMeta}
          >
            {note.isArchived ? 'Unarchive' : 'Archive'}
          </Button>
        </Box>
      </Box>

      {/* NEW INTEGRATED RICH EDIT DIALOG */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '1rem',
            background: customTheme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            p: 2,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Note</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <NoteInput
            variant="compact"
            noteId={note.id}
            initialContent={note.content}
            initialIsImportant={note.isImportant}
            initialIsFav={note.isFav}
            onSaveSuccess={(updatedText) => {
              setNote((prev) =>
                prev
                  ? { ...prev, content: updatedText, updatedAt: new Date() }
                  : prev
              );
              setEditOpen(false);
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Note?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This action cannot be undone. Are you sure you want to delete this
            note?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global Formatting Education Dialog */}
      <MarkdownHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Container>
  );
}
