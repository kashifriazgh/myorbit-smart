'use client';

import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  IconButton,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { TimeTableProps } from '@/app/lib/interface';
import { useAuth } from '@/app/lib/context/userContext';
import Link from 'next/link';
import DeleteIcon from '@mui/icons-material/Delete';

const TimeTableList = () => {
  const { user } = useAuth();
  const [tables, setTables] = useState<TimeTableProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // For delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setTables([]);
      setLoading(false);
      return;
    }

    // ✅ Optimized: Only fetch time tables for the current user
    const q = query(
      collection(db, 'timeTables'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const userTables = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as TimeTableProps),
      }));
      setTables(userTables);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'timeTables', deleteId));
      setDeleteId(null); // Close dialog
    } catch (err) {
      console.error('Error deleting timetable:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    // Show skeleton loader
    return (
      <Stack spacing={2}>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-lg shadow-sm">
            <CardContent>
              <Skeleton variant="text" width="60%" height={30} />
              <Skeleton variant="text" width="40%" height={20} />
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }

  if (tables.length === 0) {
    return <Typography>No time tables found.</Typography>;
  }

  return (
    <>
      <Stack spacing={2}>
        {tables.map((table) => (
          <Card
            key={table.id}
            className="rounded-lg shadow-sm relative"
            onMouseEnter={() => setHoveredId(table.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    <Link
                      href={`/time-table/${table.id}`}
                      className="hover:underline"
                    >
                      {table.title}
                    </Link>
                  </Typography>
                </Box>
                {hoveredId === table.id && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setDeleteId(table.id!)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>

              {table.description && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {table.description}
                </Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Delete confirmation dialog */}
      <Dialog
        open={Boolean(deleteId)}
        onClose={() => !deleting && setDeleteId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Do you want to delete this timetable? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={
              deleting ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TimeTableList;
