import React from 'react';
import { 
  Typography, 
  Box, 
  Stack, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormControlLabel, 
  Switch 
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { OnboardingData, OnboardingFieldValue } from '../InitialOnboarding';

interface Props {
  value: OnboardingData;
  onChange: (val: Partial<OnboardingData>) => void;
}

export default function AIBehaviorStep({ value, onChange }: Props) {
  const handleFieldChange = (
    field: keyof OnboardingData,
    fieldValue: OnboardingFieldValue,
  ) => {
    onChange({
      [field]: {
        filled: typeof fieldValue === 'boolean' ? true : !!fieldValue,
        value: fieldValue
      }
    });
  };

  const aiTone = value.aiTone?.value;
  const autoImprove = value.autoImprove?.value;
  const autoSuggest = value.autoSuggest?.value;
  const smartRescheduling = value.smartRescheduling?.value;

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h5" fontWeight="700" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon color="primary" /> AI Personality
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Customize how your AI assistant interacts with you.
        </Typography>
      </Box>

      <Stack spacing={3}>
        <FormControl fullWidth>
          <InputLabel>Assistant Tone</InputLabel>
          <Select
            value={aiTone || ''}
            label="Assistant Tone"
            onChange={(e) => handleFieldChange('aiTone', e.target.value)}
            sx={{ borderRadius: 2 }}
          >
            <MenuItem value="Formal">Formal</MenuItem>
            <MenuItem value="Friendly">Friendly</MenuItem>
            <MenuItem value="Strict Coach">Strict Coach</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch 
                  checked={autoImprove || false} 
                  onChange={(e) => handleFieldChange('autoImprove', e.target.checked)} 
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight="600">Auto Improve Texts</Typography>
                  <Typography variant="caption" color="text.secondary">Automatically refine your notes and tasks.</Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              control={
                <Switch 
                  checked={autoSuggest || false} 
                  onChange={(e) => handleFieldChange('autoSuggest', e.target.checked)} 
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight="600">Auto Suggestions</Typography>
                  <Typography variant="caption" color="text.secondary">AI-driven tips and task suggestions.</Typography>
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Switch 
                  checked={smartRescheduling || false} 
                  onChange={(e) => handleFieldChange('smartRescheduling', e.target.checked)} 
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight="600">Smart Rescheduling</Typography>
                  <Typography variant="caption" color="text.secondary">Automatically suggest new times for missed tasks.</Typography>
                </Box>
              }
            />
          </Stack>
        </Box>
      </Stack>
    </Stack>
  );
}
