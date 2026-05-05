'use client';

import {
  Box,
  Typography,
  Stack,
  Button,
  useTheme,
  CircularProgress,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/lib/context/userContext';
import { useOnboarding } from '@/app/lib/context/onBoardingContext';

const genderOptions: Array<'male' | 'female' | 'other'> = [
  'male',
  'female',
  'other',
];
const ageGroups: Array<'teen' | '20s' | '30s' | '40s' | '50+'> = [
  'teen',
  '20s',
  '30s',
  '40s',
  '50+',
];

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1 },
  }),
};

const AgeGender = () => {

  const { user } = useAuth();
  const theme = useTheme();
  const { onboarding, updateOnboarding, loading: contextLoading } = useOnboarding();

  const [gender, setGender] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState<string | null>(null);

  useEffect(() => {
    if (onboarding) {
      setGender(onboarding.gender?.value ?? null);
      setAgeGroup(onboarding.ageGroup?.value ?? null);
    }
  }, [onboarding]);

  const updateInitialOnboardingField = async (
    field: 'gender' | 'ageGroup',
    value: string
  ) => {
    if (!user?.uid) return;

    try {
      await updateOnboarding({
        [field]: {
          value,
          filled: true,
        },
      });

      if (field === 'gender') {
        setGender(value);
      } else {
        setAgeGroup(value);
      }
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
    }
  };

  if (contextLoading) return <CircularProgress />;


  return (
    <Stack className="my-6" spacing={6} alignItems="center" width="100%">
      {/* Gender Selection */}
      <Box width="100%">
        <Typography variant="h6" gutterBottom>
          Select your gender:
        </Typography>

        <Box
          sx={{
            overflowX: 'auto',
            pb: 1,
            mb: 3,
          }}
        >
          <Stack direction="row" spacing={2} sx={{ width: 'max-content' }}>
            {genderOptions.map((g, i) => (
              <motion.div
                key={g}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeIn}
              >
                <Button
                  variant={gender === g ? 'contained' : 'outlined'}
                  color={gender === g ? 'primary' : 'inherit'}
                  onClick={() => updateInitialOnboardingField('gender', g)}
                  sx={{
                    py: 1.5,
                    px: 3,
                    fontSize: '1rem',
                    borderRadius: 5,
                    textTransform: 'capitalize',
                    boxShadow: gender === g ? theme.shadows[3] : 'none',
                    transition: 'all 0.3s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {g}
                </Button>
              </motion.div>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Age Group Selection */}
      <Box width="100%">
        <Typography variant="h6" gutterBottom>
          Select your age group:
        </Typography>

        <Box
          sx={{
            overflowX: 'auto',
            pb: 1,
          }}
        >
          <Stack direction="row" spacing={2} sx={{ width: 'max-content' }}>
            {ageGroups.map((age, i) => (
              <motion.div
                key={age}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeIn}
              >
                <Box
                  onClick={() => updateInitialOnboardingField('ageGroup', age)}
                  sx={{
                    cursor: 'pointer',
                    px: 3,
                    py: 1.5,
                    borderRadius: 4,
                    minWidth: 100,
                    textAlign: 'center',
                    fontSize: '1rem',
                    fontWeight: ageGroup === age ? 600 : 400,
                    border: `2px solid ${
                      ageGroup === age
                        ? theme.palette.primary.main
                        : theme.palette.divider
                    }`,
                    backgroundColor:
                      ageGroup === age
                        ? theme.palette.primary.light
                        : theme.palette.background.paper,
                    color:
                      ageGroup === age
                        ? theme.palette.primary.contrastText
                        : theme.palette.text.primary,
                    boxShadow: ageGroup === age ? theme.shadows[4] : 'none',
                    transition: 'all 0.3s',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      boxShadow: theme.shadows[2],
                      backgroundColor:
                        ageGroup === age
                          ? theme.palette.primary.light
                          : theme.palette.action.hover,
                    },
                  }}
                >
                  {age}
                </Box>
              </motion.div>
            ))}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
};

export default AgeGender;
