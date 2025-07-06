'use client';

import { Box, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import JournalModal from '../components/journal/journalModal';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import JournalList from '../components/journal/journalList';

export default function JournalsPage() {
  const [open, setOpen] = useState(false);
  const { theme } = useCustomTheme();

  if (!theme) return null;

  return (
    <Box maxWidth="600px" mx="auto" p={1.5}>
      <Typography variant="h4" gutterBottom>
        📔 My Journal
      </Typography>

      {/* Styled input to trigger modal */}
      <TextField
        variant="outlined"
        placeholder="🖊️ Write about your day..."
        fullWidth
        onClick={() => setOpen(true)}
        InputProps={{
          readOnly: true,
          sx: {
            backgroundColor: theme.mode === 'dark' ? '#334155' : '#ffffff',
            color: theme.mode === 'dark' ? '#f1f5f9' : '#000000',
            borderRadius: 1.2,
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0, 102, 255, 0.1)',
            transition: 'all 0.25s ease',

            '&:hover': {
              boxShadow: '0 2px 8px rgba(0, 102, 255, 0.2)',
            },

            '&:focus-within': {
              borderColor: '#3366ff',
              boxShadow: '0 0 0 2px rgba(51, 102, 255, 0.25)',
            },

            '& fieldset': {
              borderColor: theme.mode === 'dark' ? '#f8fafc' : '#d0d7ff',
            },

            '&:hover fieldset': {
              borderColor: theme.mode === 'dark' ? '#e2e8f0' : '#a0bfff',
            },
          },
        }}
        sx={{ mb: 3 }}
      />

      {/* Journal List will come here later */}
      {/* <JournalsList /> */}

      <JournalModal open={open} onClose={() => setOpen(false)} />
      <br />
      <JournalList />
    </Box>
  );
}
