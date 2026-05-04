import React from 'react';
import { TextField, Typography, Box, Stack } from '@mui/material';
import { motion } from 'framer-motion';

interface Props {
  value: { firstName?: string; lastName?: string };
  onChange: (val: { firstName?: string; lastName?: string }) => void;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export default function NameStep({ value, onChange }: Props) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
    >
      <Stack spacing={3}>
        <motion.div variants={item}>
          <Box>
            <Typography variant="h5" fontWeight="700" gutterBottom>
              First, what should we call you?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              We&apos;ll use this to personalize your experience.
            </Typography>
          </Box>
        </motion.div>
        
        <motion.div variants={item}>
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
        </motion.div>
      </Stack>
    </motion.div>
  );
}
