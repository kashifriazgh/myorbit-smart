import React from 'react';
import { 
  Typography, 
  Box, 
  Stack, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Autocomplete, 
  TextField, 
  Chip 
} from '@mui/material';

const AGE_GROUPS = ['15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50+'];
const SKILLS_OPTIONS = [
  'Graphic Designer', 'Web Developer', 'Content Writer', 'Sports Coach', 
  'Digital Marketer', 'Video Editor', 'Data Analyst', 'Project Manager',
  'UI/UX Designer', 'SEO Specialist', 'Public Speaker'
];
const EDUCATION_LEVELS = [
  'High School', '12th Classes', 'Intermediate', 'Bachelor\'s', 'Master\'s', 'PhD', 'Self-Taught', 'Other'
];

import { OnboardingData, OnboardingFieldValue } from '../InitialOnboarding';

interface Props {
  value: OnboardingData;
  onChange: (val: Partial<OnboardingData>) => void;
}

export default function ProfileDetailsStep({ value, onChange }: Props) {
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

  const ageGroup = value.ageGroup?.value;
  const gender = value.gender?.value;
  const skills = value.skills?.value || [];
  const hobby = value.hobby?.value;
  const education = value.education?.value;

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h5" fontWeight="700" gutterBottom>
          Tell us more about you
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This information helps us understand your profile better.
        </Typography>
      </Box>

      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Age Group</InputLabel>
            <Select
              value={ageGroup || ''}
              label="Age Group"
              onChange={(e) => handleFieldChange('ageGroup', e.target.value)}
              sx={{ borderRadius: 2 }}
            >
              {AGE_GROUPS.map(age => (
                <MenuItem key={age} value={age}>{age}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Gender</InputLabel>
            <Select
              value={gender || ''}
              label="Gender"
              onChange={(e) => handleFieldChange('gender', e.target.value)}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Autocomplete
          multiple
          freeSolo
          options={SKILLS_OPTIONS}
          value={skills}
          onChange={(_, newValue) => handleFieldChange('skills', newValue)}
          renderTags={(val, getTagProps) =>
            val.map((option: string, index: number) => (
              <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option} />
            ))
          }
          renderInput={(params) => (
            <TextField {...params} label="Skills" placeholder="Add skills (type and press Enter)" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
          )}
        />

        <TextField
          label="Hobby"
          fullWidth
          value={hobby || ''}
          onChange={(e) => handleFieldChange('hobby', e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />

        <FormControl fullWidth>
          <InputLabel>Education Level</InputLabel>
          <Select
            value={education || ''}
            label="Education Level"
            onChange={(e) => handleFieldChange('education', e.target.value)}
            sx={{ borderRadius: 2 }}
          >
            {EDUCATION_LEVELS.map(level => (
              <MenuItem key={level} value={level}>{level}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Stack>
  );
}
