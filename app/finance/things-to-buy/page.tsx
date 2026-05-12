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
  LinearProgress,
  Fade,
  Stack,
  useMediaQuery,
  Avatar,
  Paper,
  Zoom,
  Grid,
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
import HistoryIcon from '@mui/icons-material/History';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import moment from 'moment-timezone';

export default function ThingsToBuyPage() {
  const { user } = useAuth();
  const theme = useTheme();
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';
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
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100vh" gap={2}>
        <CircularProgress size={60} thickness={4} sx={{ color: '#667eea' }} />
        <Typography variant="h6" fontWeight="bold" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
          Organizing your plans...
        </Typography>
      </Box>
    );
  }

  const totalItems = plans.reduce((sum, plan) => sum + plan.items.length, 0);
  const totalPurchased = plans.reduce(
    (sum, plan) => sum + plan.items.filter((item) => item.isPurchased).length,
    0
  );
  const totalBudget = plans.reduce(
    (sum, plan) => sum + (plan.budgetLimit || 0),
    0
  );
  const totalPlans = plans.length;

  return (
    <Box
      maxWidth="1000px"
      mx="auto"
      sx={{
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#0f172a',
        minHeight: '100vh',
        p: isMobile ? 1.5 : 4,
      }}
    >
      {/* Hero Header */}
      <Fade in timeout={800}>
        <Paper
          elevation={0}
          sx={{
            p: isMobile ? 4 : 6,
            mb: 4,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(118, 75, 162, 0.3)'
          }}
        >
          <ShoppingCartIcon sx={{ position: 'absolute', top: -30, right: -30, fontSize: 240, opacity: 0.1, transform: 'rotate(-15deg)' }} />
          
          <Stack spacing={2} position="relative" zIndex={1}>
             <Typography variant={isMobile ? 'h3' : 'h2'} fontWeight="900" sx={{ letterSpacing: '-0.03em', lineHeight: 1 }}>
               Shopping Plans
             </Typography>
             <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 500, maxWidth: '500px' }}>
               Create, manage, and track your purchase goals with intelligent budgeting.
             </Typography>
             <Box pt={2}>
               <Button
                onClick={() => setOpenModal(true)}
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                sx={{
                  bgcolor: 'white',
                  color: '#764ba2',
                  fontWeight: 900,
                  px: 4,
                  py: 1.5,
                  borderRadius: 4,
                  textTransform: 'none',
                  fontSize: '1.1rem',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.9)', transform: 'translateY(-2px)' },
                  transition: 'all 0.3s ease',
                }}
              >
                Create New Plan
              </Button>
             </Box>
          </Stack>
        </Paper>
      </Fade>

      {/* Stats Overview */}
      {totalPlans > 0 && (
        <Fade in timeout={1000}>
          <Grid container spacing={3} mb={6}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2.5, borderRadius: 5, bgcolor: isDark ? '#1e293b' : '#ffffff', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}` }}>
                <Avatar sx={{ bgcolor: 'rgba(102, 126, 234, 0.1)', color: '#667eea', mx: 'auto', mb: 1 }}><ShoppingCartIcon /></Avatar>
                <Typography variant="h5" fontWeight="900">{totalPlans}</Typography>
                <Typography variant="caption" fontWeight="800" color="text.secondary">TOTAL PLANS</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2.5, borderRadius: 5, bgcolor: isDark ? '#1e293b' : '#ffffff', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}` }}>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', mx: 'auto', mb: 1 }}><CheckCircleIcon /></Avatar>
                <Typography variant="h5" fontWeight="900">{totalPurchased}</Typography>
                <Typography variant="caption" fontWeight="800" color="text.secondary">ITEMS BOUGHT</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2.5, borderRadius: 5, bgcolor: isDark ? '#1e293b' : '#ffffff', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}` }}>
                <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', mx: 'auto', mb: 1 }}><AttachMoneyIcon /></Avatar>
                <Typography variant="h5" fontWeight="900">₨{(totalBudget/1000).toFixed(1)}k</Typography>
                <Typography variant="caption" fontWeight="800" color="text.secondary">EST. BUDGET</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2.5, borderRadius: 5, bgcolor: isDark ? '#1e293b' : '#ffffff', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}` }}>
                <Avatar sx={{ bgcolor: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', mx: 'auto', mb: 1 }}><HistoryIcon /></Avatar>
                <Typography variant="h5" fontWeight="900">{totalItems}</Typography>
                <Typography variant="caption" fontWeight="800" color="text.secondary">TOTAL ITEMS</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Fade>
      )}

      {/* Plans List */}
      {totalPlans === 0 ? (
        <Zoom in timeout={1200}>
          <Box 
            textAlign="center" 
            py={10} 
            sx={{ 
              borderRadius: 8, 
              border: `3px dashed ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
              bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#ffffff'
            }}
          >
            <Avatar sx={{ width: 100, height: 100, mx: 'auto', mb: 3, bgcolor: 'primary.main', opacity: 0.8 }}>
              <ShoppingCartIcon sx={{ fontSize: 50 }} />
            </Avatar>
            <Typography variant="h5" fontWeight="900" gutterBottom>No Plans Yet</Typography>
            <Typography variant="body1" color="text.secondary" mb={4}>Every big purchase starts with a simple list.</Typography>
            <Button variant="contained" size="large" onClick={() => setOpenModal(true)} sx={{ borderRadius: 4, fontWeight: 900, px: 6 }}>
              Get Started
            </Button>
          </Box>
        </Zoom>
      ) : (
        <Grid container spacing={4}>
          {plans.map((plan, index) => {
            const planBudget = plan.budgetLimit || 0;
            const purchasedCount = plan.items.filter(i => i.isPurchased).length;
            const totalCount = plan.items.length;
            const progress = totalCount > 0 ? (purchasedCount / totalCount) * 100 : 0;
            const spentAmount = plan.items.reduce((s, i) => s + (i.isPurchased ? (i.purchasedPrice ?? i.estimatedPrice) : 0), 0);
            
            return (
              <Grid size={{ xs: 12, md: 6 }} key={plan.id}>
                <Fade in timeout={500 + index * 100}>
                  <Card 
                    elevation={0}
                    sx={{ 
                      borderRadius: 6, 
                      overflow: 'hidden',
                      height: '100%',
                      bgcolor: isDark ? '#1e293b' : '#ffffff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                        borderColor: 'primary.main'
                      }
                    }}
                  >
                    <Box sx={{ height: 8, bgcolor: 'primary.main', opacity: progress === 100 ? 1 : 0.3 }} />
                    <CardContent sx={{ p: 4 }}>
                       <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
                          <Box>
                             <Typography variant="h5" fontWeight="900" gutterBottom>{plan.title}</Typography>
                             <Typography variant="caption" fontWeight="700" color="text.secondary">
                               LAST UPDATED {moment(plan.updatedAt).fromNow().toUpperCase()}
                             </Typography>
                          </Box>
                          <IconButton color="error" size="small" onClick={() => setDeleteTargetId(plan.id!)}>
                             <DeleteIcon />
                          </IconButton>
                       </Box>

                       <Grid container spacing={2} mb={3}>
                          <Grid size={{ xs: 6 }}>
                             <Typography variant="caption" fontWeight="900" color="text.secondary">BUDGET</Typography>
                             <Typography variant="h6" fontWeight="900">₨ {planBudget.toLocaleString()}</Typography>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                             <Typography variant="caption" fontWeight="900" color="text.secondary">SPENT</Typography>
                             <Typography variant="h6" fontWeight="900" color="primary">₨ {spentAmount.toLocaleString()}</Typography>
                          </Grid>
                       </Grid>

                       <Box mb={3}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                             <Typography variant="caption" fontWeight="900" color="text.secondary">PROGRESS</Typography>
                             <Typography variant="caption" fontWeight="900" color="primary">{purchasedCount}/{totalCount} ITEMS</Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={progress} 
                            sx={{ height: 8, borderRadius: 4, bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}
                          />
                       </Box>

                       <Link href={`/finance/things-to-buy/${plan.id}`} passHref style={{ textDecoration: 'none' }}>
                          <Button 
                            fullWidth 
                            variant="outlined" 
                            endIcon={<ArrowForwardIcon />}
                            sx={{ 
                              borderRadius: 3, 
                              fontWeight: 900, 
                              py: 1.2, 
                              textTransform: 'none',
                              borderWidth: 2,
                              '&:hover': { borderWidth: 2 }
                            }}
                          >
                            View Details
                          </Button>
                       </Link>
                    </CardContent>
                  </Card>
                </Fade>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Delete Confirmation */}
      <Dialog
        open={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        PaperProps={{ sx: { borderRadius: 5 } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Delete Plan?</DialogTitle>
        <DialogContent>
          <Typography fontWeight="600">This will permanently remove the shopping plan and all its items. This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteTargetId(null)} sx={{ fontWeight: 700 }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete}
            disabled={deleting}
            sx={{ borderRadius: 3, fontWeight: 900, px: 3 }}
          >
            {deleting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      <BuyItemModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onItemCreated={(item) => setPlans((prev) => [...prev, item])}
      />
    </Box>
  );
}
