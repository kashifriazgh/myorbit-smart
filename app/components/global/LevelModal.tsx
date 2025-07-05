// components/ideas/LevelModal.tsx

import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Stack,
  Divider,
  Button,
} from '@mui/material';
import { IDEA_LEVELS } from '@/app/lib/constant';
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface Props {
  open: boolean;
  onClose: () => void;
  currentLevel: string;
  docId: string;
}

export default function LevelModal({
  open,
  onClose,
  currentLevel,
  docId,
}: Props) {
  const [selected, setSelected] = useState(currentLevel);
  const [saving, setSaving] = useState(false);
  const { theme } = useCustomTheme();

  if (!theme) return null;

  const handleSave = async () => {
    if (selected === currentLevel) return onClose(); // no change

    setSaving(true);
    try {
      const ref = doc(db, 'ideas', docId);
      await updateDoc(ref, { level: selected });
      onClose();
    } catch (error) {
      console.error('Error updating level:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableEnforceFocus
      onClick={(e) => e.stopPropagation()} // ⚠️ prevent collapse
    >
      <DialogTitle
        sx={
          theme.mode === 'dark' ? { bgcolor: '#334155', color: '#f8fafc' } : {}
        }
      >
        Select Idea Level
      </DialogTitle>
      <DialogContent
        sx={
          theme.mode === 'dark' ? { bgcolor: '#334155', color: '#f8fafc' } : {}
        }
      >
        <Stack spacing={1} my={2}>
          {IDEA_LEVELS.map((level) => {
            const isCurrent = level.key === currentLevel;
            const isSelected = level.key === selected;

            return (
              <Box
                key={level.key}
                onClick={() => setSelected(level.key)}
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  cursor: 'pointer',
                  backgroundColor: isSelected
                    ? theme.mode === 'dark'
                      ? '#475569'
                      : '#e0f7fa'
                    : isCurrent
                    ? theme.mode === 'dark'
                      ? '#334155'
                      : '#f5f5f5'
                    : theme.mode === 'dark'
                    ? '#1e293b'
                    : '#fafafa',
                  color: theme.mode === 'dark' ? '#f1f5f9' : 'inherit',
                  '&:hover': {
                    backgroundColor: isSelected
                      ? theme.mode === 'dark'
                        ? '#64748b'
                        : '#b2ebf2'
                      : isCurrent
                      ? theme.mode === 'dark'
                        ? '#475569'
                        : '#eeeeee'
                      : theme.mode === 'dark'
                      ? '#334155'
                      : '#f0f0f0',
                  },
                  border: isCurrent
                    ? theme.mode === 'dark'
                      ? '1px solid #64748b'
                      : '1px solid #888'
                    : 'none',
                }}
              >
                <Typography fontWeight={isCurrent ? 600 : 500}>
                  {level.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {level.description}
                </Typography>
              </Box>
            );
          })}
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || selected === currentLevel}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
