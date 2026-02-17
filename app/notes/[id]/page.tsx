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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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

// Lucide icon
import Trash2Icon from '@mui/icons-material/Delete';
export default function NoteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { theme: customTheme } = useCustomTheme();

  const [note, setNote] = useState<QuickNote | null>(null);
  const [loading, setLoading] = useState(true);

  // delete states
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // edit states
  const [editOpen, setEditOpen] = useState(false);
  const [editContent, setEditContent] = useState('');

  // importance/archive states
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
          };

          // ownership check
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

  /* ---------------- LOADING ---------------- */
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

  /* ---------------- NOT FOUND ---------------- */
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

  /* ---------------- MAIN ---------------- */
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Box
        mb={3}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/notes')}
            sx={{ color: 'text.primary', mb: 1 }}
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

        {/* Actions */}
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            onClick={() => {
              setEditContent(note.content);
              setEditOpen(true);
            }}
          >
            Edit
          </Button>
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
          <Button
            color="error"
            variant="outlined"
            startIcon={<Trash2Icon fontSize="small" />}
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </Box>
      </Box>

      {/* Content */}
      <Card
        sx={{
          backgroundColor: customTheme?.mode === 'dark' ? '#1e293b' : '#ffffff',
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

      {/* DELETE CONFIRMATION DIALOG */}
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
