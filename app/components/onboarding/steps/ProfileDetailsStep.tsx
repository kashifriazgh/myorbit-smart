import React from 'react';
import { 
  Typography, 
  Box, 
  Stack, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
} from '@mui/material';
import { motion } from 'framer-motion';

const AGE_GROUPS = ['15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50+'];
const EDUCATION_LEVELS = [
  'High School', '12th Classes', 'Intermediate', 'Bachelor\'s', 'Master\'s', 'PhD', 'Self-Taught', 'Other'
];

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
  const education = value.education?.value;

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
              Tell us more about you
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This information helps us understand your profile better.
            </Typography>
          </Box>
        </motion.div>

        <Stack spacing={3}>
          <motion.div variants={item}>
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
          </motion.div>

          <motion.div variants={item}>
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
          </motion.div>
        </Stack>
      </Stack>
    </motion.div>
  );
}
