import React from 'react';
import { 
  Typography, 
  Box, 
  Stack, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Slider, 
  ToggleButtonGroup, 
  ToggleButton 
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

const WORK_STYLES = ['Deep Work', 'Multi Tasking', 'Single Task at Time', 'Flexible'];
const SOCIAL_PREFERENCES = ['Daily', 'Weekly', 'Rare'];
const PEAK_HOUR_OPTIONS = ['Morning', 'After Noon', 'Evening', 'Night'];

import { OnboardingData, OnboardingFieldValue } from '@/app/lib/interface';

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

export default function ProductivityStep({ value, onChange }: Props) {
  const handleFieldChange = (
    field: keyof OnboardingData,
    fieldValue: OnboardingFieldValue,
  ) => {
    onChange({
      [field]: {
        filled: Array.isArray(fieldValue) ? fieldValue.length > 0 : !!fieldValue,
        value: fieldValue
      }
    });
  };

  const workStyle = value.workStyle?.value;
  const peakHours = value.peakHours?.value || [];
  const socialPreference = value.socialPreference?.value;
  const preferredSocialTime = value.preferredSocialTime?.value;
  const socialHourRange = value.socialHourRange?.value;

  const isSocialTimeNeeded = socialPreference && socialPreference !== '';

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
              Productivity Style
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Help us align the app with how you work best.
            </Typography>
          </Box>
        </motion.div>

        <Stack spacing={3}>
          <motion.div variants={item}>
            <FormControl fullWidth>
              <InputLabel>Work Style</InputLabel>
              <Select
                value={workStyle || ''}
                label="Work Style"
                onChange={(e) => handleFieldChange('workStyle', e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                {WORK_STYLES.map(style => (
                  <MenuItem key={style} value={style}>{style}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </motion.div>

          <motion.div variants={item}>
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="600">
                When are you most energetic? (Peak Hours)
              </Typography>
              <ToggleButtonGroup
                value={peakHours}
                onChange={(_, newValue) => handleFieldChange('peakHours', newValue)}
                fullWidth
                sx={{ flexWrap: 'wrap', gap: 1, '& .MuiToggleButton-root': { borderRadius: '12px !important', border: '1px solid #e0e0e0', mb: 1 } }}
              >
                {PEAK_HOUR_OPTIONS.map(opt => (
                  <ToggleButton key={opt} value={opt} sx={{ flex: 1 }}>{opt}</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </motion.div>

          <motion.div variants={item}>
            <FormControl fullWidth>
              <InputLabel>Social Time Preference</InputLabel>
              <Select
                value={socialPreference || ''}
                label="Social Time Preference"
                onChange={(e) => handleFieldChange('socialPreference', e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                {SOCIAL_PREFERENCES.map(opt => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </motion.div>

          <AnimatePresence>
            {isSocialTimeNeeded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Stack spacing={3} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, mt: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Preferred Time</InputLabel>
                    <Select
                      value={preferredSocialTime || ''}
                      label="Preferred Time"
                      onChange={(e) => handleFieldChange('preferredSocialTime', e.target.value)}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="Morning">Morning</MenuItem>
                      <MenuItem value="Evening">Evening</MenuItem>
                      <MenuItem value="Custom">Custom</MenuItem>
                    </Select>
                  </FormControl>

                  <AnimatePresence>
                    {(preferredSocialTime === 'Evening' || preferredSocialTime === 'Morning') && (
                      <motion.div
                        initial={{ opacity: 0, scaleY: 0.8 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0.8 }}
                      >
                        <Box px={2}>
                          <Typography variant="caption" color="text.secondary">
                            Choose your hours ({preferredSocialTime === 'Evening' ? '16:00 - 22:00' : '06:00 - 12:00'})
                          </Typography>
                          <Slider
                            value={socialHourRange || (preferredSocialTime === 'Evening' ? [16, 20] : [7, 10])}
                            onChange={(_, newValue) => handleFieldChange('socialHourRange', newValue as [number, number])}
                            valueLabelDisplay="auto"
                            min={preferredSocialTime === 'Evening' ? 16 : 6}
                            max={preferredSocialTime === 'Evening' ? 22 : 12}
                            marks
                          />
                        </Box>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Stack>
              </motion.div>
            )}
          </AnimatePresence>
        </Stack>
      </Stack>
    </motion.div>
  );
}
