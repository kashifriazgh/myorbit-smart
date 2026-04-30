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

const WORK_STYLES = ['Deep Work', 'Multi Tasking', 'Single Task at Time', 'Flexible'];
const SOCIAL_PREFERENCES = ['Daily', 'Weekly', 'Rare'];
const PEAK_HOUR_OPTIONS = ['Morning', 'After Noon', 'Evening', 'Night'];

import { OnboardingData, OnboardingFieldValue } from '../InitialOnboarding';

interface Props {
  value: OnboardingData;
  onChange: (val: Partial<OnboardingData>) => void;
}

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
    <Stack spacing={4}>
      <Box>
        <Typography variant="h5" fontWeight="700" gutterBottom>
          Productivity Style
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Help us align the app with how you work best.
        </Typography>
      </Box>

      <Stack spacing={3}>
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

        {isSocialTimeNeeded && (
          <Stack spacing={3} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
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

            {(preferredSocialTime === 'Evening' || preferredSocialTime === 'Morning') && (
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
            )}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
