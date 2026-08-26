import React from 'react';
import { TextField, Typography, Box, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/lib/context/userContext';

interface NameStepValue {
  firstName?: string; 
  lastName?: string; 
  mobile?: { filled: boolean; value: string };
}

interface Props {
  value: NameStepValue;
  onChange: (val: Partial<NameStepValue>) => void;
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
  const { user } = useAuth();

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
              Tell us about yourself
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Let&apos;s set up your profile identity and contact details.
            </Typography>
          </Box>
        </motion.div>
        
        <motion.div variants={item}>
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="First Name"
                fullWidth
                variant="outlined"
                value={value.firstName || ''}
                onChange={(e) => onChange({ firstName: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                label="Last Name"
                fullWidth
                variant="outlined"
                value={value.lastName || ''}
                onChange={(e) => onChange({ lastName: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Stack>

            <TextField
              label="Email Address"
              fullWidth
              variant="outlined"
              disabled
              value={user?.email || ''}
              helperText="Associated with your account authentication"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            <TextField
              label="Mobile Number"
              fullWidth
              variant="outlined"
              placeholder="+92 300 1234567"
              value={value.mobile?.value || ''}
              onChange={(e) => onChange({
                mobile: {
                  filled: !!e.target.value.trim(),
                  value: e.target.value
                }
              })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Stack>
        </motion.div>
      </Stack>
    </motion.div>
  );
}
