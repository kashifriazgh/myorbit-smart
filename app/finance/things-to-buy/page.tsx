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
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Fade,
  Slide,
  Stack,
  useMediaQuery,
  Avatar,
  Tooltip,
  Divider,
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
import { useCustomTheme } from '@/app/lib/context/themeContext';
import Link from 'next/link';
import DeleteIcon from '@mui/icons-material/Delete';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import moment from 'moment-timezone';

export default function ThingsToBuyPage() {
  const { user } = useAuth();
  const theme = useTheme();
  const { theme: customTheme } = useCustomTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size={48} />
        <Typography variant="body2" color="text.secondary">
          Loading your shopping plans...
        </Typography>
      </Box>
    );
  }

  // Calculate summary statistics
  const totalPlans = plans.length;
  const totalItems = plans.reduce((sum, plan) => sum + plan.items.length, 0);
  const totalBudget = plans.reduce(
    (sum, plan) =>
      sum +
      plan.items.reduce(
        (itemSum, item) => itemSum + (item.estimatedPrice ?? 0),
        0
      ),
    0
  );
  const totalPurchased = plans.reduce(
    (sum, plan) => sum + plan.items.filter((item) => item.isPurchased).length,
    0
  );

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: 'auto',
        my: 4,
        px: isMobile ? 1 : 3,
        backgroundColor: customTheme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: customTheme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: customTheme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      {/* Hero Header */}
      <Fade in={true} timeout={800}>
        <Card
          elevation={3}
          sx={{
            mb: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <CardContent sx={{ p: isMobile ? 3 : 4 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={2}
            >
              <Box>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                  Shopping Plans
                </Typography>
                <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                  Organize and track your shopping lists
                </Typography>
              </Box>
              <Button
                onClick={() => setOpenModal(true)}
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Create New Plan
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Fade>

      {/* Summary Statistics */}
      {totalPlans > 0 && (
        <Fade in={true} timeout={1000}>
          <Box mb={3}>
            <Card
              elevation={0}
              sx={{
                p: 2,
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'rgba(0, 0, 0, 0.02)',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
              }}
            >
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                mb={2}
                color="primary"
              >
                Quick Overview
              </Typography>
              <Stack
                direction={isMobile ? 'column' : 'row'}
                spacing={1.5}
                divider={
                  !isMobile ? <Divider orientation="vertical" flexItem /> : null
                }
              >
                <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                  <Avatar
                    sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}
                  >
                    <ShoppingCartIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      sx={{ lineHeight: 1.2 }}
                    >
                      {totalPlans}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Plans
                    </Typography>
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                  <Avatar
                    sx={{ bgcolor: 'success.main', width: 32, height: 32 }}
                  >
                    <CheckCircleIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      sx={{ lineHeight: 1.2 }}
                    >
                      {totalPurchased}/{totalItems}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Purchased
                    </Typography>
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                  <Avatar
                    sx={{ bgcolor: 'warning.main', width: 32, height: 32 }}
                  >
                    <AttachMoneyIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      sx={{ lineHeight: 1.2 }}
                    >
                      Rs {totalBudget.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Budget
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </Card>
          </Box>
        </Fade>
      )}

      {/* Visual Separator */}
      {totalPlans > 0 && (
        <Box mb={3}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" fontWeight="bold" color="primary">
            Your Shopping Plans
          </Typography>
        </Box>
      )}

      {/* Plans Grid */}
      {totalPlans === 0 ? (
        <Fade in={true} timeout={1200}>
          <Card
            elevation={2}
            sx={{
              textAlign: 'center',
              p: 6,
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              border: '2px dashed',
              borderColor: 'primary.main',
              opacity: 0.7,
            }}
          >
            <Avatar
              sx={{
                width: 80,
                height: 80,
                mx: 'auto',
                mb: 3,
                bgcolor: 'primary.main',
                opacity: 0.8,
              }}
            >
              <ShoppingCartIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography
              variant="h5"
              fontWeight="bold"
              gutterBottom
              color="primary"
            >
              No Shopping Plans Yet
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={3}>
              Start organizing your shopping by creating your first plan
            </Typography>
            <Button
              onClick={() => setOpenModal(true)}
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              sx={{ px: 4 }}
            >
              Create Your First Plan
            </Button>
          </Card>
        </Fade>
      ) : (
        <Box>
          <Stack spacing={3}>
            {plans.map((plan, index) => {
              const totalBudget = plan.items.reduce(
                (sum, item) => sum + (item.estimatedPrice ?? 0),
                0
              );
              const purchasedItems = plan.items.filter(
                (item) => item.isPurchased
              ).length;
              const totalItems = plan.items.length;
              const progressPercentage =
                totalItems > 0 ? (purchasedItems / totalItems) * 100 : 0;
              const totalSpent = plan.items.reduce(
                (sum, item) =>
                  sum +
                  (item.isPurchased
                    ? item.purchasedPrice ?? item.estimatedPrice
                    : 0),
                0
              );

              return (
                <Slide
                  key={plan.id}
                  direction="up"
                  in={true}
                  timeout={800 + index * 100}
                >
                  <Card
                    elevation={2}
                    sx={{
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: theme.shadows[8],
                      },
                    }}
                  >
                    <CardContent sx={{ p: isMobile ? 2 : 3 }}>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        mb={2}
                      >
                        <Box flexGrow={1}>
                          <Link
                            href={`/finance/things-to-buy/${plan.id}`}
                            style={{
                              textDecoration: 'none',
                              color: 'inherit',
                              display: 'block',
                            }}
                          >
                            <Typography
                              variant="h6"
                              fontWeight="bold"
                              gutterBottom
                            >
                              {plan.title}
                            </Typography>
                          </Link>

                          <Stack
                            direction="row"
                            spacing={1}
                            flexWrap="wrap"
                            gap={1}
                            mb={2}
                          >
                            <Chip
                              icon={<ShoppingCartIcon />}
                              label={`${totalItems} items`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              icon={<CheckCircleIcon />}
                              label={`${purchasedItems} purchased`}
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                            <Chip
                              icon={<AttachMoneyIcon />}
                              label={`Rs ${totalBudget.toLocaleString()}`}
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          </Stack>

                          {/* Progress Bar */}
                          <Box mb={2}>
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                              mb={1}
                            >
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Progress
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {Math.round(progressPercentage)}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={progressPercentage}
                              sx={{
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: theme.palette.grey[200],
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 4,
                                  backgroundColor:
                                    progressPercentage === 100
                                      ? '#4caf50'
                                      : '#2196f3',
                                },
                              }}
                            />
                          </Box>

                          {/* Budget Info */}
                          {plan.budgetLimit && (
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Budget: Rs {plan.budgetLimit.toLocaleString()}
                              </Typography>
                              <Typography
                                variant="body2"
                                color={
                                  totalSpent > plan.budgetLimit
                                    ? 'error.main'
                                    : 'text.secondary'
                                }
                                fontWeight="bold"
                              >
                                Spent: Rs {totalSpent.toLocaleString()}
                              </Typography>
                            </Box>
                          )}

                          {/* Created Date */}
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            mt={1}
                            display="block"
                          >
                            Created:{' '}
                            {moment(
                              plan.createdAt instanceof Timestamp
                                ? plan.createdAt.toDate()
                                : plan.createdAt
                            ).format('MMM D, YYYY')}
                          </Typography>
                        </Box>

                        <Box
                          display="flex"
                          flexDirection="column"
                          alignItems="center"
                          gap={1}
                        >
                          <Tooltip title="Delete Plan">
                            <IconButton
                              color="error"
                              onClick={() => setDeleteTargetId(plan.id!)}
                              disabled={deleting}
                              sx={{
                                '&:hover': {
                                  backgroundColor: 'error.light',
                                  color: 'white',
                                },
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Slide>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Add Plan Modal */}
      <BuyItemModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onItemCreated={(item) => setPlans((prev) => [...prev, item])}
      />

      {/* Confirm Delete Dialog */}
      <Dialog
        open={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <DeleteIcon color="error" />
            Confirm Delete
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1">
            Are you sure you want to delete this shopping plan? This action
            cannot be undone.
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            All items and progress in this plan will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => setDeleteTargetId(null)}
            disabled={deleting}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete}
            disabled={deleting}
            startIcon={deleting && <CircularProgress size={18} />}
          >
            {deleting ? 'Deleting...' : 'Delete Plan'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
