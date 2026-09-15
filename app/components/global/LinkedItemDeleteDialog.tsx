'use client';

import React from 'react';
import { Dialog, DialogContent, Button, Box, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

interface LinkedItemDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmDelete: () => void | Promise<void>;
  itemType: 'Schedule' | 'Task';
  goalTitle?: string;
  isDeleting?: boolean;
}

export const LinkedItemDeleteDialog: React.FC<LinkedItemDeleteDialogProps> = ({
  open,
  onClose,
  onConfirmDelete,
  itemType,
  goalTitle,
  isDeleting = false,
}) => {
  const displayGoalTitle = goalTitle ? `"${goalTitle}"` : 'a Goal';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        style: {
          borderRadius: 24,
          padding: 0,
          overflow: 'hidden',
        },
      }}
    >
      <DialogContent sx={{ p: 3 }}>
        <Box className="flex flex-col items-center text-center space-y-4">
          {/* Warning Icon Badge */}
          <Box className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-500 mb-1">
            <WarningAmberRoundedIcon sx={{ fontSize: 32 }} />
          </Box>

          {/* Heading */}
          <Typography variant="h6" className="font-extrabold text-slate-800 dark:text-slate-100">
            Delete Linked {itemType}?
          </Typography>

          {/* Recrafted User Message */}
          <Typography variant="body2" className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed px-1 font-medium">
            This {itemType === 'Schedule' ? 'Schedule' : 'task'} is associated with Goal <strong>{displayGoalTitle}</strong>. By deleting it, it may affect the goal.
          </Typography>

          {/* Action Buttons */}
          <Box className="w-full flex flex-col gap-2.5 pt-2">
            {/* Danger Red Button */}
            <Button
              onClick={onConfirmDelete}
              disabled={isDeleting}
              variant="contained"
              fullWidth
              sx={{
                borderRadius: '14px',
                py: 1.4,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.88rem',
                bgcolor: '#ef4444',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
                '&:hover': {
                  bgcolor: '#dc2626',
                },
                '&:disabled': {
                  bgcolor: '#fca5a5',
                  color: '#ffffff',
                },
              }}
            >
              {isDeleting ? 'Deleting...' : 'Do you still want to delete it'}
            </Button>

            {/* Cancel Button */}
            <Button
              onClick={onClose}
              disabled={isDeleting}
              variant="outlined"
              fullWidth
              sx={{
                borderRadius: '14px',
                py: 1.2,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                borderColor: '#e2e8f0',
                color: '#64748b',
                '&:hover': {
                  borderColor: '#cbd5e1',
                  bgcolor: '#f8fafc',
                },
              }}
            >
              Keep it
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default LinkedItemDeleteDialog;
