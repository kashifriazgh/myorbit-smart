'use client';
import { Box, Typography } from '@mui/material';

interface Props {
  notes: string;
}

export default function TodoNotes({ notes }: Props) {
  if (!notes?.trim()) return null;

  return (
    <Box mt={2}>
      <Typography variant="h6">Notes</Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {notes}
      </Typography>
    </Box>
  );
}
