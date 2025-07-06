// components/global/OptionModal.tsx
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
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface OptionItem {
  key: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface Props {
  open: boolean;
  onClose: () => void;
  docId: string;
  collectionName: string;
  field: string;
  currentValue: string;
  options: OptionItem[];
  onChange?: (newValue: string) => void;
}

export default function OptionModal({
  open,
  onClose,
  docId,
  collectionName,
  field,
  currentValue,
  options,
  onChange,
}: Props) {
  const [selected, setSelected] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const { theme } = useCustomTheme();

  if (!theme) return null;

  const handleSave = async () => {
    if (selected === currentValue) return onClose();
    setSaving(true);
    try {
      const ref = doc(db, collectionName, docId);
      await updateDoc(ref, { [field]: selected });
      onChange?.(selected);
      onClose();
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        Select {field[0].toUpperCase() + field.slice(1)}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1} my={2}>
          {options.map((opt) => {
            const isCurrent = opt.key === currentValue;
            const isSelected = opt.key === selected;
            return (
              <Box
                key={opt.key}
                onClick={() => setSelected(opt.key)}
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  cursor: 'pointer',
                  backgroundColor:
                    theme.mode === 'dark'
                      ? isSelected
                        ? '#334155' // dark mode + selected
                        : '#475569' // dark mode default
                      : isSelected
                      ? '#e0f7fa'
                      : isCurrent
                      ? '#f5f5f5'
                      : '#fafafa',

                  '&:hover': {
                    backgroundColor:
                      theme.mode === 'dark' ? '#334155' : '#e0f2f1', // hover color
                  },

                  border: isCurrent ? '1px solid #888' : 'none',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  {opt.icon}
                  <Typography fontWeight={isCurrent ? 600 : 500}>
                    {opt.label}
                  </Typography>
                </Stack>
                {opt.description && (
                  <Typography variant="body2" color="text.secondary">
                    {opt.description}
                  </Typography>
                )}
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
            disabled={saving || selected === currentValue}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
