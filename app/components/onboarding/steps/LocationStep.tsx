import React from 'react';
import { 
  Typography, 
  Box, 
  Stack, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  ToggleButtonGroup, 
  ToggleButton 
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import WorkIcon from '@mui/icons-material/Work';
import { motion, AnimatePresence } from 'framer-motion';

const PAK_CITIES = [
  'Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 
  'Multan', 'Hyderabad', 'Peshawar', 'Quetta', 'Sialkot'
];

const JOB_OPTIONS = [
  'Software Engineer', 'Teacher', 'Doctor', 'Manager', 
  'Sales Executive', 'Accountant', 'Graphic Designer', 'Other'
];

const BUSINESS_OPTIONS = [
  'Retailer', 'E-commerce', 'Consultant', 'Real Estate', 
  'Manufacturer', 'Freelancer', 'Other'
];

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

export default function LocationStep({ value, onChange }: Props) {
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

  const professionType = value.professionType?.value;
  const profession = value.profession?.value;
  const country = value.country?.value;
  const city = value.city?.value;

  const handleProfessionTypeChange = (
    event: React.MouseEvent<HTMLElement>,
    newType: 'job' | 'business' | null,
  ) => {
    if (newType !== null) {
      onChange({ 
        professionType: { filled: true, value: newType },
        profession: { filled: false, value: '' }
      });
    }
  };

  const currentProfessionOptions = professionType === 'job' ? JOB_OPTIONS : BUSINESS_OPTIONS;

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
              Where are you located?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Help us tailor the app to your region and professional needs.
            </Typography>
          </Box>
        </motion.div>

        <Stack spacing={3}>
          <motion.div variants={item}>
            <FormControl fullWidth>
              <InputLabel>Country</InputLabel>
              <Select
                value={country || ''}
                label="Country"
                onChange={(e) => handleFieldChange('country', e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="Pakistan">Pakistan</MenuItem>
                <MenuItem value="USA">USA</MenuItem>
                <MenuItem value="UK">UK</MenuItem>
                <MenuItem value="Canada">Canada</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </motion.div>

          <motion.div variants={item}>
            <FormControl fullWidth disabled={country !== 'Pakistan'}>
              <InputLabel>City</InputLabel>
              <Select
                value={city || ''}
                label="City"
                onChange={(e) => handleFieldChange('city', e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                {PAK_CITIES.map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </motion.div>

          <motion.div variants={item}>
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="600">
                What&apos;s your primary profession?
              </Typography>
              <ToggleButtonGroup
                value={professionType}
                exclusive
                onChange={handleProfessionTypeChange}
                fullWidth
                sx={{ mb: 2 }}
              >
                <ToggleButton value="job" sx={{ borderRadius: '12px 0 0 12px', py: 1.5 }}>
                  <WorkIcon sx={{ mr: 1 }} /> Job
                </ToggleButton>
                <ToggleButton value="business" sx={{ borderRadius: '0 12px 12px 0', py: 1.5 }}>
                  <BusinessIcon sx={{ mr: 1 }} /> Business
                </ToggleButton>
              </ToggleButtonGroup>

              <AnimatePresence>
                {professionType && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <FormControl fullWidth sx={{ mt: 1 }}>
                      <InputLabel>Specific Field</InputLabel>
                      <Select
                        value={profession || ''}
                        label="Specific Field"
                        onChange={(e) => handleFieldChange('profession', e.target.value)}
                        sx={{ borderRadius: 2 }}
                      >
                        {currentProfessionOptions.map(opt => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>
          </motion.div>
        </Stack>
      </Stack>
    </motion.div>
  );
}
