'use client';

import { Box, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import IdeaModal from '../components/ideas/IdeasModal';
import IdeasList from '../components/ideas/IdeasList';

export default function IdeasPage() {
  const [open, setOpen] = useState(false);

  return (
    <Box maxWidth="600px" mx="auto" p={4}>
      <Typography variant="h4" gutterBottom>
        💡 My Ideas
      </Typography>

      {/* Interactive TextField to open modal */}
      <TextField
        variant="outlined"
        placeholder="What's your new idea?"
        fullWidth
        onClick={() => setOpen(true)}
        InputProps={{
          readOnly: true,
          sx: {
            cursor: 'pointer',
            backgroundColor: '#f9f9f9',
            borderRadius: 2,
            '&:hover': {
              backgroundColor: '#f1f1f1',
            },
          },
        }}
        sx={{ mb: 3 }}
      />

      <IdeasList />

      <IdeaModal open={open} onClose={() => setOpen(false)} />
    </Box>
  );
}
