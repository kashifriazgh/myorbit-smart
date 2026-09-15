'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WorkIcon from '@mui/icons-material/Work';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface IncomeSourceDoc {
  id: string;
  userId: string;
  name: string;
  type: 'existing' | 'new_proposed';
  currentAmount: number;
  targetAmount: number;
  initialAmount: number;
  frequency: 'monthly' | 'weekly';
  createdAt?: unknown;
}

function formatMoney(value: number, currency: string = 'PKR') {
  return `${currency} ${Math.round(value).toLocaleString()}`;
}

export default function IncomeSourcesPage() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const isDark = theme?.mode === 'dark';

  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<IncomeSourceDoc[]>([]);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<IncomeSourceDoc | null>(null);
  const [formType, setFormType] = useState<'existing' | 'new_proposed'>('existing');
  const [formName, setFormName] = useState('');
  const [formInitialVal, setFormInitialVal] = useState<number | ''>('');
  const [formCurrentVal, setFormCurrentVal] = useState<number | ''>('');
  const [formTargetVal, setFormTargetVal] = useState<number | ''>('');
  const [formFrequency, setFormFrequency] = useState<'monthly' | 'weekly'>('monthly');
  const [saving, setSaving] = useState(false);

  const fetchIncomeSources = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'incomeSources'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const list: IncomeSourceDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId || user.uid,
          name: data.name || 'Unnamed Source',
          type: data.type === 'new_proposed' ? 'new_proposed' : 'existing',
          currentAmount: Number(data.currentAmount || 0),
          targetAmount: Number(data.targetAmount || 0),
          initialAmount: Number(data.initialAmount ?? data.currentAmount ?? 0),
          frequency: data.frequency || 'monthly',
          createdAt: data.createdAt,
        };
      });
      setSources(list);
    } catch (err) {
      console.error('Failed to fetch income sources:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchIncomeSources();
  }, [fetchIncomeSources]);

  const handleOpenModal = (docToEdit?: IncomeSourceDoc) => {
    if (docToEdit) {
      setEditingDoc(docToEdit);
      setFormType(docToEdit.type);
      setFormName(docToEdit.name);
      setFormInitialVal(docToEdit.initialAmount);
      setFormCurrentVal(docToEdit.currentAmount);
      setFormTargetVal(docToEdit.targetAmount);
      setFormFrequency(docToEdit.frequency);
    } else {
      setEditingDoc(null);
      setFormType('existing');
      setFormName('');
      setFormInitialVal('');
      setFormCurrentVal('');
      setFormTargetVal('');
      setFormFrequency('monthly');
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !user?.uid || typeof formTargetVal !== 'number' || formTargetVal <= 0) return;
    setSaving(true);
    try {
      const initAmt = typeof formInitialVal === 'number' ? formInitialVal : (typeof formCurrentVal === 'number' ? formCurrentVal : 0);
      const currAmt = typeof formCurrentVal === 'number' ? formCurrentVal : 0;
      const targAmt = formTargetVal;

      if (editingDoc) {
        await updateDoc(doc(db, 'incomeSources', editingDoc.id), {
          name: formName.trim(),
          type: formType,
          initialAmount: initAmt,
          currentAmount: currAmt,
          targetAmount: targAmt,
          frequency: formFrequency,
        });
      } else {
        await addDoc(collection(db, 'incomeSources'), {
          userId: user.uid,
          name: formName.trim(),
          type: formType,
          initialAmount: initAmt,
          currentAmount: currAmt,
          targetAmount: targAmt,
          frequency: formFrequency,
          createdAt: serverTimestamp(),
        });
      }
      setDialogOpen(false);
      await fetchIncomeSources();
    } catch (err) {
      console.error('Error saving income source:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'incomeSources', id));
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Error deleting income source:', err);
    }
  };

  const existingSources = sources.filter((s) => s.type === 'existing');
  const proposedSources = sources.filter((s) => s.type === 'new_proposed');

  const totalInitial = sources.reduce((sum, s) => sum + (s.initialAmount || 0), 0);
  const totalCurrent = sources.reduce((sum, s) => sum + (s.currentAmount || 0), 0);
  const totalTarget = sources.reduce((sum, s) => sum + (s.targetAmount || 0), 0);
  const totalGrowth = totalCurrent - totalInitial;

  const bgPage = isDark ? '#0f172a' : '#f8fafc';
  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <div style={{ backgroundColor: bgPage, minHeight: '100vh', color: textPrimary, paddingBottom: '3rem' }}>
      <Container maxWidth="md" sx={{ pt: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Link href="/finance">
              <IconButton sx={{ color: textPrimary, bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}>
                <ArrowBackIcon />
              </IconButton>
            </Link>
            <Box>
              <Typography sx={{ fontSize: 24, fontWeight: 900 }}>Income Sources</Typography>
              <Typography sx={{ fontSize: 13, color: textMuted }}>
                Track and compare your active & proposed income streams
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenModal()}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: '#10b981',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            Add Source
          </Button>
        </Box>

        {/* Overview Stats Banner */}
        <Card
          sx={{
            borderRadius: '24px',
            bgcolor: surfaceBg,
            border: `1.5px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#a7f3d0'}`,
            boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 8px 30px rgba(16,185,129,0.06)',
            p: 3,
            mb: 4,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em', mb: 1 }}>
            Income Portfolio Summary
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 2.5 }}>
            <Box>
              <Typography sx={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>Total Initial Income</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: textPrimary }}>
                {formatMoney(totalInitial)}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>Current Active Income</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: '#10b981' }}>
                {formatMoney(totalCurrent)}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>Target Income</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: '#3b82f6' }}>
                {formatMoney(totalTarget)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px dashed ${cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textMuted }}>Income Growth (Initial vs Current)</Typography>
            <Chip
              label={`${totalGrowth >= 0 ? '+' : ''}${formatMoney(totalGrowth)} (${totalInitial > 0 ? Math.round((totalGrowth / totalInitial) * 100) : 0}%)`}
              size="small"
              sx={{
                bgcolor: totalGrowth >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: totalGrowth >= 0 ? '#10b981' : '#ef4444',
                fontWeight: 800,
                fontSize: 12,
              }}
            />
          </Box>
        </Card>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress color="success" />
          </Box>
        ) : (
          <Stack spacing={4}>
            {/* Existing Sources Section */}
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em', mb: 2 }}>
                Existing Income Sources ({existingSources.length})
              </Typography>
              {existingSources.length === 0 ? (
                <Card sx={{ p: 3, borderRadius: '18px', border: `1.5px dashed ${cardBorder}`, bgcolor: surfaceBg, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 13, color: textMuted }}>
                    No active income sources found. Click <strong>+ Add Source</strong> to log your primary earnings!
                  </Typography>
                </Card>
              ) : (
                <Stack spacing={2}>
                  {existingSources.map((src) => {
                    const growth = src.currentAmount - src.initialAmount;
                    const pct = src.targetAmount > 0 ? Math.min(100, Math.round((src.currentAmount / src.targetAmount) * 100)) : 0;
                    return (
                      <Card key={src.id} sx={{ borderRadius: '20px', border: `1.5px solid ${cardBorder}`, bgcolor: surfaceBg, p: 2.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                            <Box sx={{ width: 42, height: 42, borderRadius: '12px', bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <WorkIcon />
                            </Box>
                            <Box>
                              <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{src.name}</Typography>
                              <Typography sx={{ fontSize: 11.5, color: textMuted }}>Existing · {src.frequency}</Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip label={`${pct}% of Target`} size="small" sx={{ fontWeight: 800, bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981' }} />
                            <IconButton size="small" onClick={() => handleOpenModal(src)}><EditIcon sx={{ fontSize: 18 }} /></IconButton>
                            <IconButton size="small" onClick={() => handleDelete(src.id)} sx={{ color: '#ef4444' }}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
                          </Box>
                        </Box>
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <Box>
                            <Typography sx={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace' }}>{formatMoney(src.currentAmount)}</Typography>
                            <Typography sx={{ fontSize: 11.5, color: textMuted }}>Initial: {formatMoney(src.initialAmount)} | Target: {formatMoney(src.targetAmount)}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: growth >= 0 ? '#10b981' : '#ef4444' }}>
                            {growth >= 0 ? '+' : ''}{formatMoney(growth)} Growth
                          </Typography>
                        </Box>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </Box>

            {/* Proposed New Sources Section */}
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em', mb: 2 }}>
                New Proposed Channels ({proposedSources.length})
              </Typography>
              {proposedSources.length === 0 ? (
                <Card sx={{ p: 3, borderRadius: '18px', border: `1.5px dashed ${cardBorder}`, bgcolor: surfaceBg, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 13, color: textMuted }}>
                    No proposed income channels added. Click <strong>+ Add Source</strong> and select &quot;New Proposed Source&quot;!
                  </Typography>
                </Card>
              ) : (
                <Stack spacing={2}>
                  {proposedSources.map((src) => {
                    const pct = src.targetAmount > 0 ? Math.min(100, Math.round((src.currentAmount / src.targetAmount) * 100)) : 0;
                    return (
                      <Card key={src.id} sx={{ borderRadius: '20px', border: `1.5px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe'}`, bgcolor: surfaceBg, p: 2.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                            <Box sx={{ width: 42, height: 42, borderRadius: '12px', bgcolor: 'rgba(59,130,246,0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <TrendingUpIcon />
                            </Box>
                            <Box>
                              <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{src.name}</Typography>
                              <Typography sx={{ fontSize: 11.5, color: textMuted }}>Proposed · {src.frequency}</Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip label="Proposed" size="small" sx={{ fontWeight: 800, bgcolor: 'rgba(59,130,246,0.15)', color: '#3b82f6' }} />
                            <IconButton size="small" onClick={() => handleOpenModal(src)}><EditIcon sx={{ fontSize: 18 }} /></IconButton>
                            <IconButton size="small" onClick={() => handleDelete(src.id)} sx={{ color: '#ef4444' }}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
                          </Box>
                        </Box>
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <Box>
                            <Typography sx={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace' }}>{formatMoney(src.currentAmount)}</Typography>
                            <Typography sx={{ fontSize: 11.5, color: textMuted }}>Target: {formatMoney(src.targetAmount)} ({pct}% achieved)</Typography>
                          </Box>
                        </Box>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Stack>
        )}

        {/* Add / Edit Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
          <DialogTitle sx={{ fontWeight: 800 }}>{editingDoc ? 'Edit Income Source' : 'Add Income Source'}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <FormControl component="fieldset">
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, mb: 0.5 }}>Source Type</Typography>
                <RadioGroup row value={formType} onChange={(e) => setFormType(e.target.value as 'existing' | 'new_proposed')}>
                  <FormControlLabel value="existing" control={<Radio size="small" />} label="Existing Source" />
                  <FormControlLabel value="new_proposed" control={<Radio size="small" />} label="New Proposed Source" />
                </RadioGroup>
              </FormControl>

              <TextField label="Source Name" placeholder="e.g. Primary Job, Freelancing" fullWidth size="small" value={formName} onChange={(e) => setFormName(e.target.value)} />
              
              {formType === 'existing' && (
                <TextField label="Initial Amount (Starting Point)" type="number" fullWidth size="small" value={formInitialVal} onChange={(e) => setFormInitialVal(e.target.value ? Number(e.target.value) : '')} />
              )}

              <TextField label="Current Monthly Income" type="number" fullWidth size="small" value={formCurrentVal} onChange={(e) => setFormCurrentVal(e.target.value ? Number(e.target.value) : '')} />
              <TextField label="Desired Target Monthly Income" type="number" fullWidth size="small" value={formTargetVal} onChange={(e) => setFormTargetVal(e.target.value ? Number(e.target.value) : '')} />

              <FormControl fullWidth size="small">
                <InputLabel>Frequency</InputLabel>
                <Select value={formFrequency} label="Frequency" onChange={(e) => setFormFrequency(e.target.value as 'monthly' | 'weekly')}>
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={saving || !formName.trim() || typeof formTargetVal !== 'number' || formTargetVal <= 0} onClick={handleSave} sx={{ fontWeight: 800, bgcolor: '#10b981' }}>
              Save Source
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  );
}
