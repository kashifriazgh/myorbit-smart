'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { getTodosCacheDebugInfo } from '@/app/lib/utils/todosCache';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { getSchedulesCacheDebugInfo } from '@/app/lib/utils/schedulesCache';
import { Box, Typography, IconButton, Tooltip, Stack, Chip, Divider } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import StorageIcon from '@mui/icons-material/Storage';

export default function TodoCacheDebugOverlay() {
  const { dataSource: todoSource, todos, refreshTodos } = useTodoContext();
  const { dataSource: schedSource, allSchedules, refreshSchedules } = useSchedules();

  const [todoInfo, setTodoInfo] = useState(getTodosCacheDebugInfo());
  const [schedInfo, setSchedInfo] = useState(getSchedulesCacheDebugInfo());
  const [visible, setVisible] = useState(false);
  const [minimised, setMinimised] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const show = localStorage.getItem('showCacheViewer') === 'true';
      setVisible(show);
    }
  }, []);

  const tick = useCallback(() => {
    setTodoInfo(getTodosCacheDebugInfo());
    setSchedInfo(getSchedulesCacheDebugInfo());
  }, []);

  useEffect(() => {
    if (!visible) return;
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick, visible]);

  if (!visible) return null;

  // Determine global visual indicator color based on statuses
  const isStale = todoSource === 'firebase' || schedSource === 'firebase';
  const isLoading = todoSource === 'loading' || schedSource === 'loading';
  const statusColor = isStale ? '#f59e0b' : isLoading ? '#6366f1' : '#22c55e';
  const statusLabel = isStale ? '🔥 Firebase' : isLoading ? '⏳ Loading' : '📦 Cached';

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 99999,
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        minWidth: minimised ? 'auto' : 280,
        transition: 'all 0.25s ease',
        border: `1px solid ${statusColor}44`,
        backdropFilter: 'blur(16px)',
        bgcolor: '#0b1329f0',
        color: '#fff',
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.2,
        background: `linear-gradient(135deg, ${statusColor}22, ${statusColor}05)`,
        borderBottom: minimised ? 'none' : `1px solid ${statusColor}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
      }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <StorageIcon sx={{ fontSize: 16, color: statusColor }} />
          <Typography sx={{ fontFamily: 'system-ui', fontSize: '0.75rem', fontWeight: 800, color: '#f1f5f9' }}>
            Cache Control
          </Typography>
          <Chip
            label={statusLabel}
            size="small"
            sx={{
              height: 18, fontSize: '0.58rem', fontWeight: 900,
              bgcolor: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}33`,
            }}
          />
        </Stack>
        <Stack direction="row" spacing={0.25}>
          <Tooltip title={minimised ? 'Expand Control Panel' : 'Minimise Control Panel'}>
            <IconButton size="small" onClick={() => setMinimised(!minimised)}
              sx={{ color: '#64748b', '&:hover': { color: '#fff' }, p: 0.3 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800 }}>{minimised ? '▲' : '▼'}</Typography>
            </IconButton>
          </Tooltip>
          <Tooltip title="Force sync all caches from Firebase">
            <IconButton size="small" onClick={() => { refreshTodos(); refreshSchedules(); }}
              sx={{ color: '#64748b', '&:hover': { color: '#f59e0b' }, p: 0.3 }}>
              <RefreshIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close dev overlay">
            <IconButton size="small" onClick={() => {
              setVisible(false);
              localStorage.setItem('showCacheViewer', 'false');
            }}
              sx={{ color: '#64748b', '&:hover': { color: '#ef4444' }, p: 0.3 }}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Body */}
      {!minimised && (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack spacing={1.5}>
            {/* Todos Section */}
            <Box>
              <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                🚀 TODOS CACHE
              </Typography>
              <Stack spacing={0.4} sx={{ mt: 0.5 }}>
                <Row label="Source" value={todoSource === 'firebase' ? 'Firebase ☁️' : todoSource === 'cache' ? 'Cache 📦' : 'Loading ⏳'} color={todoSource === 'cache' ? '#22c55e' : '#f59e0b'} />
                <Row label="State items" value={String(todos.length)} />
                <Row label="Needs refresh" value={todoInfo.needsRefresh ? '⚠️ Stale' : '✅ Clean'} color={todoInfo.needsRefresh ? '#f59e0b' : '#22c55e'} />
                <Row label="Cached items" value={todoInfo.hasCache ? String(todoInfo.count) : '—'} />
                <Row label="Cache age" value={todoInfo.ageSeconds != null ? `${todoInfo.ageSeconds}s` : '—'} />
              </Stack>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

            {/* Schedules Section */}
            <Box>
              <Typography variant="caption" sx={{ color: '#fbbf24', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                📅 SCHEDULES CACHE
              </Typography>
              <Stack spacing={0.4} sx={{ mt: 0.5 }}>
                <Row label="Source" value={schedSource === 'firebase' ? 'Firebase ☁️' : schedSource === 'cache' ? 'Cache 📦' : 'Loading ⏳'} color={schedSource === 'cache' ? '#22c55e' : '#f59e0b'} />
                <Row label="State items" value={String(allSchedules.length)} />
                <Row label="Needs refresh" value={schedInfo.needsRefresh ? '⚠️ Stale' : '✅ Clean'} color={schedInfo.needsRefresh ? '#f59e0b' : '#22c55e'} />
                <Row label="Cached items" value={schedInfo.hasCache ? String(schedInfo.count) : '—'} />
                <Row label="Cache age" value={schedInfo.ageSeconds != null ? `${schedInfo.ageSeconds}s` : '—'} />
              </Stack>
            </Box>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

function Row({ label, value, color = '#94a3b8' }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#475569' }}>
        {label}
      </Typography>
      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6rem', fontWeight: 700, color }}>
        {value}
      </Typography>
    </Box>
  );
}

