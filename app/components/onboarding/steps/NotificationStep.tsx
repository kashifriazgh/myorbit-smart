import React from 'react';
import { 
  Typography, 
  Box, 
  Stack, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Slider 
} from '@mui/material';
import { motion } from 'framer-motion';

import { OnboardingData, OnboardingFieldValue } from '../InitialOnboarding';

interface Props {
  value: OnboardingData;
  onChange: (val: Partial<OnboardingData>) => void;
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

export default function NotificationStep({ value, onChange }: Props) {
  const handleFieldChange = (
    field: keyof OnboardingData,
    fieldValue: OnboardingFieldValue,
  ) => {
    onChange({
      [field]: {
        filled: !!fieldValue,
        value: fieldValue
      }
    });
  };

  const reminderBefore = value.reminderBefore?.value;
  const maxNotifications = value.maxNotifications?.value;
  const quitHours = value.quitHours?.value;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
    >
      <Stack spacing={4}>
        <motion.div variants={item}>
          <Box>
            <Typography variant="h5" fontWeight="700" gutterBottom>
              Notifications & Focus
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Stay on track without being overwhelmed.
            </Typography>
          </Box>
        </motion.div>

        <Stack spacing={4}>
          <motion.div variants={item}>
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="600">
                Reminder before deadline (minutes)
              </Typography>
              <Box px={2}>
                <Slider
                  value={reminderBefore || 15}
                  onChange={(_, newValue) => handleFieldChange('reminderBefore', newValue)}
                  valueLabelDisplay="auto"
                  min={5}
                  max={120}
                  step={5}
                  marks={[
                    { value: 15, label: '15m' },
                    { value: 30, label: '30m' },
                    { value: 60, label: '1h' },
                    { value: 120, label: '2h' }
                  ]}
                />
              </Box>
            </Box>
          </motion.div>

          <motion.div variants={item}>
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="600">
                Maximum push notifications per day
              </Typography>
              <Box px={2}>
                <Slider
                  value={maxNotifications || 10}
                  onChange={(_, newValue) => handleFieldChange('maxNotifications', newValue)}
                  valueLabelDisplay="on"
                  min={1}
                  max={50}
                />
              </Box>
            </Box>
          </motion.div>

          <motion.div variants={item}>
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="600">
                Quit Hours (Sleep / Other Work / Job)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                App notifications will be silenced during this period.
              </Typography>
              
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControl fullWidth>
                  <InputLabel>From</InputLabel>
                  <Select
                    value={quitHours?.[0] ?? 22}
                    label="From"
                    onChange={(e) => handleFieldChange('quitHours', [e.target.value, quitHours?.[1] ?? 6])}
                    sx={{ borderRadius: 2 }}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <MenuItem key={i} value={i}>
                        {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography>to</Typography>
                <FormControl fullWidth>
                  <InputLabel>To</InputLabel>
                  <Select
                    value={quitHours?.[1] ?? 6}
                    label="To"
                    onChange={(e) => handleFieldChange('quitHours', [quitHours?.[0] ?? 22, e.target.value])}
                    sx={{ borderRadius: 2 }}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <MenuItem key={i} value={i}>
                        {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Box>
          </motion.div>
        </Stack>
      </Stack>
    </motion.div>
  );
}
