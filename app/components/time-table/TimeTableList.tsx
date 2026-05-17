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
  Chip,
  useMediaQuery,
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
import { useCustomTheme } from '@/app/lib/context/themeContext';
import Link from 'next/link';
import DeleteIcon from '@mui/icons-material/Delete';
import { getTimetableTypeInfo } from './TimeTableModal';

const TimeTableList = () => {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [tables, setTables] = useState<TimeTableProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isDesktop = useMediaQuery('(min-width:768px)');

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
    // Show premium skeleton loader
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} sx={{ borderRadius: 4, border: '1px solid #e2e8f0', p: 1 }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                <Skeleton variant="circular" width={48} height={48} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" height={24} />
                  <Skeleton variant="text" width="30%" height={16} />
                </Box>
              </Stack>
              <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2, mb: 2 }} />
              <Skeleton variant="text" width="40%" />
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  if (tables.length === 0) {
    return (
      <Box 
        sx={{ 
          p: 6, 
          textAlign: 'center', 
          borderRadius: 4, 
          border: '2px dashed',
          borderColor: theme?.mode === 'dark' ? '#334155' : '#cbd5e1',
          bgcolor: theme?.mode === 'dark' ? '#1e293b' : '#f8fafc',
          color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
          mt: 4 
        }}
      >
        <Typography variant="h6" fontWeight="700" mb={1}>No Time Tables Found</Typography>
        <Typography variant="body2">Create a new timetable to organize your daily activities beautifully.</Typography>
      </Box>
    );
  }

  return (
    <>
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
          gap: 3 
        }}
      >
        {tables.map((table) => {
          const typeInfo = getTimetableTypeInfo(table.type);
          const IconComponent = typeInfo.icon;
          const stepsCount = table.steps?.length || 0;

          return (
            <Card
              key={table.id}
              onMouseEnter={() => setHoveredId(table.id!)}
              onMouseLeave={() => setHoveredId(null)}
              sx={{
                position: 'relative',
                borderRadius: 4,
                border: '1px solid',
                borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0',
                backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: hoveredId === table.id 
                  ? `0 12px 24px -10px ${typeInfo.color}35, 0 8px 16px -8px ${typeInfo.color}25`
                  : '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
                transform: hoveredId === table.id ? 'translateY(-4px)' : 'none',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '6px',
                  height: '100%',
                  background: typeInfo.gradient,
                }
              }}
            >
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        p: 1.25,
                        borderRadius: 3,
                        background: typeInfo.gradient,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 4px 10px ${typeInfo.color}40`,
                      }}
                    >
                      <IconComponent sx={{ fontSize: 24 }} />
                    </Box>
                    <Box>
                      <Typography 
                        variant="h6" 
                        fontWeight="800" 
                        sx={{ 
                          lineHeight: 1.2,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        <Link
                          href={`/time-table/${table.id}`}
                          style={{ 
                            color: 'inherit',
                            textDecoration: 'none',
                          }}
                        >
                          <span className="hover:underline">{table.title}</span>
                        </Link>
                      </Typography>
                      <Chip
                        label={typeInfo.label}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: typeInfo.color,
                          backgroundColor: theme?.mode === 'dark' ? `${typeInfo.color}20` : `${typeInfo.color}10`,
                          borderColor: 'transparent',
                          mt: 0.5
                        }}
                      />
                    </Box>
                  </Stack>

                  {/* Delete button wrapper */}
                  <Box sx={{ minHeight: 32 }}>
                    {(hoveredId === table.id || !isDesktop) && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteId(table.id!)}
                        sx={{
                          backgroundColor: theme?.mode === 'dark' ? '#33415550' : '#fee2e250',
                          '&:hover': {
                            backgroundColor: '#fee2e2',
                            color: '#ef4444',
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Stack>

                {table.description && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      mt: 2, 
                      mb: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {table.description}
                  </Typography>
                )}

                {/* Steps Preview */}
                <Box 
                  sx={{ 
                    mt: 2.5,
                    pt: 2, 
                    borderTop: '1px solid',
                    borderColor: theme?.mode === 'dark' ? '#33415580' : '#e2e8f080',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                    <Typography variant="caption" fontWeight="700" sx={{ color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b', letterSpacing: '0.05em' }}>
                      SCHEDULE PREVIEW
                    </Typography>
                    <Chip 
                      label={`${stepsCount} ${stepsCount === 1 ? 'Step' : 'Steps'}`} 
                      size="small"
                      sx={{ 
                        fontWeight: 700, 
                        fontSize: '0.75rem',
                        backgroundColor: theme?.mode === 'dark' ? '#334155' : '#f1f5f9',
                        color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
                        borderRadius: 1.5
                      }}
                    />
                  </Stack>

                  {table.steps && table.steps.length > 0 ? (
                    <Stack spacing={1}>
                      {table.steps.slice(0, 2).map((step, sidx) => (
                        <Stack 
                          key={sidx} 
                          direction="row" 
                          justifyContent="space-between" 
                          alignItems="center"
                          sx={{
                            p: 1,
                            borderRadius: 2,
                            backgroundColor: theme?.mode === 'dark' ? '#10172630' : '#f8fafc',
                            border: '1px solid',
                            borderColor: theme?.mode === 'dark' ? '#33415540' : '#f1f5f9',
                          }}
                        >
                          <Typography variant="body2" fontWeight="600" noWrap sx={{ maxWidth: '65%', fontSize: '0.8rem' }}>
                            {step.field1}
                          </Typography>
                          <Typography variant="caption" fontWeight="700" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                            {step.startTime}{step.endTime ? ` - ${step.endTime}` : ''}
                          </Typography>
                        </Stack>
                      ))}
                      {stepsCount > 2 && (
                        <Typography 
                          variant="caption" 
                          align="center" 
                          sx={{ 
                            display: 'block', 
                            mt: 0.5, 
                            color: typeInfo.color,
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          <Link href={`/time-table/${table.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            <span className="hover:underline">+ {stepsCount - 2} more steps</span>
                          </Link>
                        </Typography>
                      )}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      No steps added yet.
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {/* Delete confirmation dialog */}
      <Dialog
        open={Boolean(deleteId)}
        onClose={() => !deleting && setDeleteId(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Do you want to delete this timetable? This action cannot be undone and will permanently remove all schedule steps.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button 
            onClick={() => setDeleteId(null)} 
            disabled={deleting}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569'
            }}
          >
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
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 700,
              px: 3,
              backgroundColor: '#ef4444',
              '&:hover': {
                backgroundColor: '#dc2626'
              }
            }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TimeTableList;
