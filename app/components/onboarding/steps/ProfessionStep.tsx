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

const JOB_OPTIONS = [
  'Software Engineer', 'Teacher', 'Doctor', 'Manager', 
  'Sales Executive', 'Accountant', 'Graphic Designer', 'Govt Employee', 'Other'
];

const BUSINESS_OPTIONS = [
  'Retailer', 'E-commerce', 'Consultant', 'Real Estate', 
  'Manufacturer', 'Freelancer', 'Other'
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

export default function ProfessionStep({ value, onChange }: Props) {
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
              What is your profession?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Help us understand your daily schedule context.
            </Typography>
          </Box>
        </motion.div>

        <Stack spacing={3}>
          <motion.div variants={item}>
            <Box>
              <ToggleButtonGroup
                value={professionType || ''}
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
