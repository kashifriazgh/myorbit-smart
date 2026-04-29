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
import { Stack, Tooltip } from '@mui/material';

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
  const [editContent, setEditContent] = useState('');

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

      {/* Content */}
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
          <Typography
            variant="body1"
            className={
              customTheme?.mode === 'dark' ? 'text-slate-200' : 'text-slate-800'
            }
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

      {/* ACTION BUTTONS MOVED TO BOTTOM */}
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
              setEditContent(note.content);
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

      {/* EDIT DIALOG */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Note</DialogTitle>
        <DialogContent>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: 200,
              padding: 12,
              fontFamily: 'inherit',
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!id) return;
              try {
                await updateDoc(doc(db, 'notes', id as string), {
                  content: editContent,
                  updatedAt: serverTimestamp(),
                });
                setNote((prev) =>
                  prev
                    ? { ...prev, content: editContent, updatedAt: new Date() }
                    : prev,
                );
                setEditOpen(false);
              } catch (e) {
                console.error('Failed to update note', e);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
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
        <DialogActions>
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
    </Container>
  );
}
