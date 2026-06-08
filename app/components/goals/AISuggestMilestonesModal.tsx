'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Chip,
  TextField,
  Divider,
  Collapse,
} from '@mui/material';
import {
  AutoAwesome,
  Check,
  Close,
  Edit,
  ExpandMore,
  ExpandLess,
  CalendarToday,
  Lightbulb,
} from '@mui/icons-material';

interface SuggestedMilestone {
  title: string;
  description: string;
  suggestedEndDate: string; // YYYY-MM-DD
  /** UI state */
  _status: 'pending' | 'accepted' | 'rejected';
  _editMode: boolean;
  _editedTitle: string;
  _editedDate: string;
}

interface AISuggestMilestonesModalProps {
  open: boolean;
  onClose: () => void;
  goal: {
    title: string;
    description?: string;
    type?: string;
    priority?: string;
    dueDate?: unknown;
    overallTargetValue?: number;
    overallTargetUnit?: string;
    notes?: string;
    steps?: { title: string; endDate?: unknown }[];
  };
  typeColor: string;
  isDark: boolean;
  onAcceptMilestone: (milestone: {
    title: string;
    description?: string;
    endDate: Date;
  }) => Promise<void>;
}

function formatDate(raw: string): string {
  const d = new Date(raw + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateSafe(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'string') return val.split('T')[0];
  if (typeof val === 'object' && val !== null) {
    // Firestore Timestamp
    if ('toDate' in val && typeof (val as { toDate: unknown }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate().toISOString().split('T')[0];
    }
    if ('seconds' in val) {
      return new Date(
        (val as { seconds: number }).seconds * 1000
      ).toISOString().split('T')[0];
    }
  }
  return '';
}

export default function AISuggestMilestonesModal({
  open,
  onClose,
  goal,
  typeColor,
  isDark,
  onAcceptMilestone,
}: AISuggestMilestonesModalProps) {
  const [milestones, setMilestones] = useState<SuggestedMilestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [expandedDesc, setExpandedDesc] = useState<Set<number>>(new Set());

  const bg = isDark ? '#1e293b' : '#ffffff';
  const surfaceBg = isDark ? '#0f172a' : '#f8f7f4';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1a1a1a';
  const textMuted = isDark ? '#64748b' : '#94a3b8';

  const handleFetchSuggestions = async () => {
    setLoading(true);
    setError('');
    setMilestones([]);
    try {
      const res = await fetch('/api/goals/suggest-milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goal.title,
          description: goal.description,
          type: goal.type,
          priority: goal.priority,
          dueDate: toDateSafe(goal.dueDate),
          overallTargetValue: goal.overallTargetValue,
          overallTargetUnit: goal.overallTargetUnit,
          notes: goal.notes,
          existingSteps: (goal.steps ?? []).map((s) => ({
            title: s.title,
            endDate: toDateSafe(s.endDate),
          })),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      const raw: { title: string; description: string; suggestedEndDate: string }[] =
        data.milestones ?? [];
      setMilestones(
        raw.map((m) => ({
          ...m,
          _status: 'pending',
          _editMode: false,
          _editedTitle: m.title,
          _editedDate: m.suggestedEndDate,
        }))
      );
    } catch {
      setError('Failed to fetch suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateMilestone = (idx: number, patch: Partial<SuggestedMilestone>) => {
    setMilestones((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const handleAccept = async (idx: number) => {
    const m = milestones[idx];
    const title = m._editMode ? m._editedTitle.trim() : m.title;
    const dateStr = m._editMode ? m._editedDate : m.suggestedEndDate;
    if (!title || !dateStr) return;

    setSavingIds((prev) => new Set(prev).add(idx));
    try {
      await onAcceptMilestone({
        title,
        description: m.description,
        endDate: new Date(dateStr + 'T00:00:00'),
      });
      updateMilestone(idx, { _status: 'accepted', _editMode: false });
    } catch {
      setError('Failed to save milestone. Try again.');
    } finally {
      setSavingIds((prev) => {
        const s = new Set(prev);
        s.delete(idx);
        return s;
      });
    }
  };

  const handleReject = (idx: number) => {
    updateMilestone(idx, { _status: 'rejected', _editMode: false });
  };

  const toggleDesc = (idx: number) => {
    setExpandedDesc((prev) => {
      const s = new Set(prev);
      if (s.has(idx)) {
        s.delete(idx);
      } else {
        s.add(idx);
      }
      return s;
    });
  };

  const acceptedCount = milestones.filter((m) => m._status === 'accepted').length;
  const pendingCount = milestones.filter((m) => m._status === 'pending').length;

  const handleClose = () => {
    setMilestones([]);
    setError('');
    setLoading(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: bg,
          borderRadius: '20px',
          border: `1px solid ${borderColor}`,
          boxShadow: isDark
            ? '0 25px 60px rgba(0,0,0,0.5)'
            : '0 25px 60px rgba(0,0,0,0.12)',
        },
      }}
    >
      {/* ── Header ── */}
      <DialogTitle sx={{ pb: 0 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: `linear-gradient(135deg, ${typeColor}, ${typeColor}cc)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AutoAwesome sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Box flex={1}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>
              AI Milestone Suggestions
            </Typography>
            <Typography sx={{ fontSize: 11, color: textMuted }}>
              ⚡ Powered by Groq · llama-3.1-8b-instant
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClose} sx={{ color: textMuted }}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Goal context pill */}
        <Box
          sx={{
            background: `${typeColor}14`,
            border: `1px solid ${typeColor}30`,
            borderRadius: '10px',
            px: 1.5,
            py: 1,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Lightbulb sx={{ fontSize: 14, color: typeColor }} />
          <Typography sx={{ fontSize: 12, color: typeColor, fontWeight: 600 }} noWrap>
            {goal.title}
          </Typography>
        </Box>

        {/* Generate button */}
        {milestones.length === 0 && !loading && (
          <Box textAlign="center" py={3}>
            <Typography sx={{ fontSize: 13, color: textMuted, mb: 2 }}>
              Let AI analyze your goal and suggest a set of smart, sequenced milestones
              tailored to your timeline.
            </Typography>
            <Button
              variant="contained"
              onClick={handleFetchSuggestions}
              disabled={loading}
              startIcon={<AutoAwesome />}
              sx={{
                background: `linear-gradient(135deg, ${typeColor}, ${typeColor}cc)`,
                color: '#fff',
                fontWeight: 700,
                borderRadius: '12px',
                textTransform: 'none',
                px: 3,
                py: 1.25,
                fontSize: 14,
                boxShadow: `0 4px 14px ${typeColor}44`,
                '&:hover': { opacity: 0.88, boxShadow: `0 6px 18px ${typeColor}55` },
              }}
            >
              Generate Milestones
            </Button>
          </Box>
        )}

        {/* Loading */}
        {loading && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            py={4}
          >
            <CircularProgress size={36} sx={{ color: typeColor }} />
            <Typography sx={{ fontSize: 13, color: textMuted }}>
              Groq is analyzing your goal…
            </Typography>
          </Box>
        )}

        {/* Error */}
        {error && (
          <Box
            sx={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '10px',
              p: 1.5,
              mb: 2,
            }}
          >
            <Typography sx={{ fontSize: 12, color: '#dc2626' }}>{error}</Typography>
          </Box>
        )}

        {/* Results header */}
        {milestones.length > 0 && !loading && (
          <>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {milestones.length} Suggestions
              </Typography>
              <Box display="flex" gap={1}>
                {acceptedCount > 0 && (
                  <Chip
                    label={`${acceptedCount} added`}
                    size="small"
                    sx={{ background: '#dcfce7', color: '#16a34a', fontWeight: 600, fontSize: 10 }}
                  />
                )}
                {pendingCount > 0 && (
                  <Chip
                    label={`${pendingCount} pending`}
                    size="small"
                    sx={{ background: `${typeColor}18`, color: typeColor, fontWeight: 600, fontSize: 10 }}
                  />
                )}
              </Box>
            </Box>

            <Box display="flex" flexDirection="column" gap={1.5}>
              {milestones.map((m, idx) => {
                const isAccepted = m._status === 'accepted';
                const isRejected = m._status === 'rejected';
                const isSaving = savingIds.has(idx);
                const isDescExpanded = expandedDesc.has(idx);

                return (
                  <Box
                    key={idx}
                    sx={{
                      borderRadius: '14px',
                      border: `1.5px solid ${
                        isAccepted
                          ? '#86efac'
                          : isRejected
                          ? borderColor
                          : `${typeColor}40`
                      }`,
                      background: isAccepted
                        ? isDark ? '#052e16' : '#f0fdf4'
                        : isRejected
                        ? surfaceBg
                        : isDark
                        ? `${typeColor}0d`
                        : `${typeColor}06`,
                      opacity: isRejected ? 0.45 : 1,
                      transition: 'all 0.2s ease',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Card header */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.25,
                        p: '12px 14px 10px',
                      }}
                    >
                      {/* Step number */}
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: isAccepted ? '#22c55e' : isRejected ? '#94a3b8' : typeColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          mt: '1px',
                        }}
                      >
                        {isAccepted ? (
                          <Check sx={{ fontSize: 13, color: '#fff' }} />
                        ) : (
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
                            {idx + 1}
                          </Typography>
                        )}
                      </Box>

                      {/* Content */}
                      <Box flex={1} minWidth={0}>
                        {m._editMode ? (
                          <TextField
                            value={m._editedTitle}
                            onChange={(e) => updateMilestone(idx, { _editedTitle: e.target.value })}
                            size="small"
                            fullWidth
                            autoFocus
                            sx={{ mb: 0.75 }}
                            InputProps={{
                              sx: {
                                fontSize: 13,
                                fontWeight: 600,
                                borderRadius: '8px',
                                background: isDark ? '#1e293b' : '#fff',
                              },
                            }}
                          />
                        ) : (
                          <Typography
                            sx={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: isAccepted ? '#16a34a' : textPrimary,
                              lineHeight: 1.35,
                              textDecoration: isRejected ? 'line-through' : 'none',
                              mb: '3px',
                            }}
                          >
                            {m._editMode ? m._editedTitle : m.title}
                          </Typography>
                        )}

                        {/* Date row */}
                        <Box display="flex" alignItems="center" gap={0.75}>
                          <CalendarToday sx={{ fontSize: 11, color: textMuted }} />
                          {m._editMode ? (
                            <TextField
                              type="date"
                              value={m._editedDate}
                              onChange={(e) => updateMilestone(idx, { _editedDate: e.target.value })}
                              size="small"
                              sx={{ width: 140 }}
                              InputProps={{ sx: { fontSize: 11, borderRadius: '6px' } }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: 11, color: textMuted }}>
                              {formatDate(m._editMode ? m._editedDate : m.suggestedEndDate)}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      {/* Status badge */}
                      {isAccepted && (
                        <Chip
                          label="Added ✓"
                          size="small"
                          sx={{
                            background: '#22c55e',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 10,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {isRejected && (
                        <Chip
                          label="Skipped"
                          size="small"
                          sx={{
                            background: '#e2e8f0',
                            color: '#64748b',
                            fontWeight: 600,
                            fontSize: 10,
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </Box>

                    {/* Description toggle */}
                    {m.description && !isRejected && (
                      <>
                        <Box
                          sx={{
                            px: '14px',
                            pb: isDescExpanded ? 0 : '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                          onClick={() => toggleDesc(idx)}
                        >
                          <Typography sx={{ fontSize: 11, color: textMuted }}>
                            {isDescExpanded ? 'Hide detail' : 'Show detail'}
                          </Typography>
                          {isDescExpanded ? (
                            <ExpandLess sx={{ fontSize: 14, color: textMuted }} />
                          ) : (
                            <ExpandMore sx={{ fontSize: 14, color: textMuted }} />
                          )}
                        </Box>
                        <Collapse in={isDescExpanded}>
                          <Box
                            sx={{
                              mx: '14px',
                              mb: '10px',
                              p: '8px 10px',
                              borderRadius: '8px',
                              background: isDark ? '#0f172a' : '#f1f5f9',
                            }}
                          >
                            <Typography sx={{ fontSize: 12, color: textMuted, lineHeight: 1.55 }}>
                              {m.description}
                            </Typography>
                          </Box>
                        </Collapse>
                      </>
                    )}

                    {/* Action row */}
                    {!isAccepted && !isRejected && (
                      <>
                        <Divider sx={{ borderColor: borderColor }} />
                        <Box
                          display="flex"
                          gap={1}
                          px="12px"
                          py="8px"
                          justifyContent="flex-end"
                        >
                          {m._editMode ? (
                            <>
                              <Button
                                size="small"
                                onClick={() => updateMilestone(idx, { _editMode: false })}
                                sx={{
                                  textTransform: 'none',
                                  fontSize: 11,
                                  color: textMuted,
                                  borderRadius: '8px',
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                disabled={isSaving}
                                onClick={() => handleAccept(idx)}
                                startIcon={isSaving ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <Check />}
                                sx={{
                                  textTransform: 'none',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: '8px',
                                  background: typeColor,
                                  color: '#fff',
                                  '&:hover': { background: typeColor, opacity: 0.88 },
                                }}
                              >
                                {isSaving ? 'Saving…' : 'Save & Add'}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="small"
                                startIcon={<Close sx={{ fontSize: 12 }} />}
                                onClick={() => handleReject(idx)}
                                sx={{
                                  textTransform: 'none',
                                  fontSize: 11,
                                  color: '#ef4444',
                                  borderRadius: '8px',
                                  '&:hover': { background: '#fef2f2' },
                                }}
                              >
                                Skip
                              </Button>
                              <Button
                                size="small"
                                startIcon={<Edit sx={{ fontSize: 12 }} />}
                                onClick={() =>
                                  updateMilestone(idx, {
                                    _editMode: true,
                                    _editedTitle: m.title,
                                    _editedDate: m.suggestedEndDate,
                                  })
                                }
                                sx={{
                                  textTransform: 'none',
                                  fontSize: 11,
                                  color: textMuted,
                                  borderRadius: '8px',
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                disabled={isSaving}
                                onClick={() => handleAccept(idx)}
                                startIcon={
                                  isSaving ? (
                                    <CircularProgress size={12} sx={{ color: '#fff' }} />
                                  ) : (
                                    <Check sx={{ fontSize: 12 }} />
                                  )
                                }
                                sx={{
                                  textTransform: 'none',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: '8px',
                                  background: typeColor,
                                  color: '#fff',
                                  boxShadow: `0 2px 8px ${typeColor}44`,
                                  '&:hover': { background: typeColor, opacity: 0.88 },
                                }}
                              >
                                {isSaving ? 'Adding…' : 'Add'}
                              </Button>
                            </>
                          )}
                        </Box>
                      </>
                    )}

                    {/* Rejected — undo button */}
                    {isRejected && (
                      <>
                        <Divider sx={{ borderColor: borderColor }} />
                        <Box px="12px" py="6px" display="flex" justifyContent="flex-end">
                          <Button
                            size="small"
                            onClick={() => updateMilestone(idx, { _status: 'pending' })}
                            sx={{ textTransform: 'none', fontSize: 11, color: textMuted }}
                          >
                            Undo
                          </Button>
                        </Box>
                      </>
                    )}
                  </Box>
                );
              })}
            </Box>

            {/* Regenerate link */}
            <Box textAlign="center" mt={2}>
              <Button
                size="small"
                onClick={handleFetchSuggestions}
                startIcon={<AutoAwesome sx={{ fontSize: 13 }} />}
                sx={{
                  textTransform: 'none',
                  fontSize: 11,
                  color: typeColor,
                  borderRadius: '8px',
                }}
              >
                Regenerate suggestions
              </Button>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0 }}>
        <Button
          onClick={handleClose}
          sx={{
            textTransform: 'none',
            borderRadius: '10px',
            color: textMuted,
            fontWeight: 600,
          }}
        >
          {acceptedCount > 0 ? `Done · ${acceptedCount} added` : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
