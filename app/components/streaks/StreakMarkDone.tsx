import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import { useState } from 'react';

interface ProgressModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (progress: string) => void;
  streakTitle: string;
}

export default function ProgressModal({
  open,
  onClose,
  onSave,
  streakTitle,
}: ProgressModalProps) {
  const [progress, setProgress] = useState('');

  const handleSave = () => {
    onSave(progress.trim());
    setProgress('');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1.2rem' }}>
        Update Progress
      </DialogTitle>

      <DialogContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {streakTitle}
        </Typography>

        <TextField
          label="Today's Progress (Optional)"
          placeholder="e.g. Surah Baqarah, Verse 25 (leave empty to just mark as done)"
          fullWidth
          multiline
          minRows={2}
          value={progress}
          onChange={(e) => setProgress(e.target.value)}
          sx={{ mt: 1 }}
        />

        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Write what you completed today (optional). This helps you continue from the
            exact point tomorrow. You can also just mark as done without progress.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Mark as Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
