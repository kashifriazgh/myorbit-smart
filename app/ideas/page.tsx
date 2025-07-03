'use client';

import { Box, Button, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import IdeaModal from '../components/ideas/IdeasModal';
import IdeasList from '../components/ideas/IdeasList';

export default function IdeasPage() {
  const [open, setOpen] = useState(false);

  return (
    <Box maxWidth="600px" mx="auto" p={1.5}>
      <Typography variant="h4" gutterBottom>
        💡 My Ideas
      </Typography>

      {/* Interactive TextField to open modal */}
      <TextField
        variant="outlined"
        placeholder="💡 What's your next great idea?"
        fullWidth
        onClick={() => setOpen(true)}
        InputProps={{
          readOnly: true,
          sx: {
            cursor: 'pointer',
            borderRadius: 1.2,
            backgroundColor: '#ffffff',
            border: '1px solid #d0d7ff',
            boxShadow: '0 1px 4px rgba(0, 102, 255, 0.1)', // 🔵 subtle blue shadow
            transition: 'all 0.25s ease',

            '&:hover': {
              boxShadow: '0 2px 8px rgba(0, 102, 255, 0.2)', // 🔵 stronger blue on hover
              borderColor: '#a0bfff',
            },

            '&:focus-within': {
              borderColor: '#3366ff',
              boxShadow: '0 0 0 2px rgba(51, 102, 255, 0.25)', // 🔵 blue ring
            },
          },
        }}
        sx={{ mb: 3 }}
      />

      <IdeasList />

      <IdeaModal open={open} onClose={() => setOpen(false)} />
      <br />
      <Button color="secondary">Button</Button>
      <br />
      <br />
      <br />
      <br />
    </Box>
  );
}
