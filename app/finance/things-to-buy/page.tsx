'use client';

import {
  Box,
  Button,
  CircularProgress,
  Typography,
  useTheme,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  collection,
  getDocs,
  Timestamp,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { BuyItem } from '@/app/lib/interface';
import BuyItemModal from '@/app/components/finance/BuyItemModal';
import { useAuth } from '@/app/lib/context/userContext';
import Link from 'next/link';
import DeleteIcon from '@mui/icons-material/Delete';

export default function ThingsToBuyPage() {
  const { user } = useAuth();
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === 'dark';

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<BuyItem[]>([]);
  const [openModal, setOpenModal] = useState(false);

  // Delete confirmation dialog state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      if (!user?.uid) return;

      const snapshot = await getDocs(collection(db, 'buyItems'));
      const docs = snapshot.docs.map((doc) => {
        const data = doc.data() as BuyItem;
        return {
          ...data,
          id: doc.id,
          createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
        };
      });

      setPlans(docs.filter((plan) => plan.userId === user.uid));
      setLoading(false);
    };

    fetchPlans();
  }, [user]);

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'buyItems', deleteTargetId));
      setPlans((prev) => prev.filter((plan) => plan.id !== deleteTargetId));
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleting(false);
      setDeleteTargetId(null);
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" mt={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', my: 4, px: 2 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" fontWeight="bold">
          Things To Buy
        </Typography>
        <Button
          onClick={() => setOpenModal(true)}
          variant="contained"
          color="success"
        >
          + Add Plan
        </Button>
      </Box>

      {/* Summary */}
      <Typography variant="body2" color="text.secondary" mt={1} mb={3}>
        Total Plans: {plans.length}
      </Typography>

      {/* Render Plans */}
      {plans.map((plan) => {
        const totalBudget = plan.items.reduce(
          (sum, item) => sum + (item.estimatedPrice ?? 0),
          0
        );

        return (
          <Box
            key={plan.id}
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 2,
              backgroundColor: isDark ? '#1f2937' : '#f5f5f5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              '&:hover': {
                backgroundColor: isDark ? '#374151' : '#e0f7fa',
              },
            }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Link href={`/finance/things-to-buy/${plan.id}`} passHref>
                <Box
                  component="a"
                  sx={{
                    textDecoration: 'none',
                    display: 'block',
                    color: 'inherit',
                  }}
                >
                  <Typography fontWeight="medium" variant="subtitle1">
                    {plan.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ({plan.items.length} items) — Total Budget:{' '}
                    <strong>Rs {totalBudget.toLocaleString()}</strong>
                  </Typography>
                </Box>
              </Link>
            </Box>
            <IconButton
              color="error"
              onClick={() => setDeleteTargetId(plan.id!)}
              sx={{ ml: 1 }}
              disabled={deleting}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        );
      })}

      {/* Add Plan Modal */}
      <BuyItemModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onItemCreated={(item) => setPlans((prev) => [...prev, item])}
      />

      {/* Confirm Delete Dialog */}
      <Dialog open={!!deleteTargetId} onClose={() => setDeleteTargetId(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this plan? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTargetId(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete}
            disabled={deleting}
            startIcon={deleting && <CircularProgress size={18} />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
