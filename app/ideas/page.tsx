'use client';

import { Box, Button, Typography } from '@mui/material';
import { useState } from 'react';
import IdeaModal from '../components/ideas/IdeasModal';
export default function IdeasPage() {
  const [open, setOpen] = useState(false);

  return (
    <Box maxWidth="600px" mx="auto" p={4}>
      <Typography variant="h4" gutterBottom>
        💡 My Ideas
      </Typography>

      <Button variant="contained" onClick={() => setOpen(true)}>
        Add New Idea
      </Button>

      {/* TODO: render list of saved ideas here */}

      <IdeaModal open={open} onClose={() => setOpen(false)} />
    </Box>
  );
}
