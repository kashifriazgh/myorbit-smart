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
import { motion } from 'framer-motion';

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
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
    >
      <Stack spacing={4}>
        <motion.div variants={item}>
          <Box>
            <Typography variant="h5" fontWeight="700" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeIcon color="primary" /> AI Personality
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Customize how your AI assistant interacts with you.
            </Typography>
          </Box>
        </motion.div>

        <Stack spacing={3}>
          <motion.div variants={item}>
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
          </motion.div>

          <motion.div variants={item}>
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
              <Stack spacing={2}>
                <motion.div variants={item}>
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
                </motion.div>
                
                <motion.div variants={item}>
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
                </motion.div>

                <motion.div variants={item}>
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
                </motion.div>
              </Stack>
            </Box>
          </motion.div>
        </Stack>
      </Stack>
    </motion.div>
  );
}
