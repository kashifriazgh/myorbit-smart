import React from 'react';
import { 
  Typography, 
  Box, 
  Stack, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem 
} from '@mui/material';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

import { OnboardingData, OnboardingFieldValue } from '../InitialOnboarding';

interface Props {
  value: OnboardingData;
  onChange: (val: Partial<OnboardingData>) => void;
}

export default function PlanningStep({ value, onChange }: Props) {
  const handleFieldChange = (
    field: keyof OnboardingData,
    fieldValue: OnboardingFieldValue,
  ) => {
    onChange({
      [field]: {
        filled: fieldValue !== undefined && fieldValue !== '',
        value: fieldValue
      }
    });
  };

  const weekStart = value.weekStart?.value;
  const monthStart = value.monthStart?.value;
  const activityTracking = value.activityTracking?.value;
  const deadlineType = value.deadlineType?.value;

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h5" fontWeight="700" gutterBottom>
          Planning Preferences
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Set up your calendar and tracking preferences.
        </Typography>
      </Box>

      <Stack spacing={3}>
        <FormControl fullWidth>
          <InputLabel>Week Starts On</InputLabel>
          <Select
            value={weekStart ?? 1}
            label="Week Starts On"
            onChange={(e) => handleFieldChange('weekStart', e.target.value)}
            sx={{ borderRadius: 2 }}
          >
            {DAYS.map((day, index) => (
              <MenuItem key={day} value={index}>{day}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Month Starts On (Day)</InputLabel>
          <Select
            value={monthStart ?? 1}
            label="Month Starts On (Day)"
            onChange={(e) => handleFieldChange('monthStart', e.target.value)}
            sx={{ borderRadius: 2 }}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
              <MenuItem key={day} value={day}>Day {day}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Activity Tracking</InputLabel>
          <Select
            value={activityTracking || 'Allow'}
            label="Activity Tracking"
            onChange={(e) => handleFieldChange('activityTracking', e.target.value)}
            sx={{ borderRadius: 2 }}
          >
            <MenuItem value="Allow">Allow (Best Experience)</MenuItem>
            <MenuItem value="Limited">Limited</MenuItem>
            <MenuItem value="Off">Off</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Deadline Type</InputLabel>
          <Select
            value={deadlineType || 'Flexible'}
            label="Deadline Type"
            onChange={(e) => handleFieldChange('deadlineType', e.target.value)}
            sx={{ borderRadius: 2 }}
          >
            <MenuItem value="Strict">Strict (Focus on Discipline)</MenuItem>
            <MenuItem value="Flexible">Flexible (Adapts to you)</MenuItem>
          </Select>
        </FormControl>
      </Stack>
    </Stack>
  );
}
