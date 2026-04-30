import React from 'react';
import { TextField, Typography, Box, Stack } from '@mui/material';

interface Props {
  value: { firstName?: string; lastName?: string };
  onChange: (val: { firstName?: string; lastName?: string }) => void;
}

export default function NameStep({ value, onChange }: Props) {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight="700" gutterBottom>
          First, what should we call you?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          We&apos;ll use this to personalize your experience.
        </Typography>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="First Name"
          fullWidth
          variant="outlined"
          value={value.firstName || ''}
          onChange={(e) => onChange({ ...value, firstName: e.target.value })}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <TextField
          label="Last Name"
          fullWidth
          variant="outlined"
          value={value.lastName || ''}
          onChange={(e) => onChange({ ...value, lastName: e.target.value })}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
      </Stack>
    </Stack>
  );
}
