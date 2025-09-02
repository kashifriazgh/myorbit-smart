'use client';

import {
  Box,
  Typography,
  Stack,
  Button,
  useTheme,
  CircularProgress,
} from '@mui/material';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import { db } from '@/app/lib/firebase';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const daysOfWeek = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const daysOfMonth = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.02 },
  }),
};

export default function StartDaySelector() {
  const { user } = useAuth();
  const theme = useTheme();

  const [startOfWeek, setStartOfWeek] = useState<string | null>(null);
  const [startOfMonth, setStartOfMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) return;
      try {
        const ref = doc(db, 'settings', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setStartOfWeek(data?.initialOnBoarding?.startOfWeek?.value ?? null);
          setStartOfMonth(data?.initialOnBoarding?.startOfMonth?.value ?? null);
        }
      } catch (error) {
        console.error('Failed to fetch start days:', error);
      }
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const updateField = async (
    field: 'startOfWeek' | 'startOfMonth',
    value: string
  ) => {
    if (!user?.uid) return;

    const ref = doc(db, 'settings', user.uid);
    const newField = {
      [`initialOnBoarding.${field}`]: {
        value,
        filled: true,
      },
    };

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          userId: user.uid,
          initialOnBoarding: {
            [field]: {
              value,
              filled: true,
            },
          },
        });
      } else {
        await updateDoc(ref, newField);
      }

      if (field === 'startOfWeek') {
        setStartOfWeek(value);
      } else {
        setStartOfMonth(value);
      }
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Stack className="my-6" spacing={6} alignItems="center" width="100%">
      {/* Start Day of Week */}
      <Box width="100%">
        <Typography variant="h5" gutterBottom fontWeight={600}>
          Select the start day of your week:
        </Typography>

        <Stack spacing={2}>
          {[0, 1].map((row) => (
            <Stack
              key={row}
              direction="row"
              spacing={1}
              justifyContent="center"
            >
              {daysOfWeek.slice(row * 4, row * 4 + 4).map((day, i) => (
                <motion.div
                  key={day}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeIn}
                >
                  <Button
                    size="small"
                    variant={startOfWeek === day ? 'contained' : 'outlined'}
                    color={startOfWeek === day ? 'primary' : 'inherit'}
                    onClick={() => updateField('startOfWeek', day)}
                    sx={{
                      px: 2,
                      py: 1,
                      fontSize: '0.8rem',
                      borderRadius: 4,
                      textTransform: 'capitalize',
                      boxShadow:
                        startOfWeek === day ? theme.shadows[2] : 'none',
                      minWidth: 80,
                    }}
                  >
                    {day}
                  </Button>
                </motion.div>
              ))}
            </Stack>
          ))}
        </Stack>
      </Box>

      {/* Start Day of Month */}
      <Box width="100%">
        <Typography variant="h5" gutterBottom fontWeight={600}>
          Select the start day of your month:
        </Typography>

        <Stack spacing={2} alignItems="center">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <Stack key={row} direction="row" spacing={1}>
              {daysOfMonth.slice(row * 6, row * 6 + 6).map((day, i) => (
                <motion.div
                  key={day}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeIn}
                >
                  <Box
                    onClick={() => updateField('startOfMonth', day)}
                    sx={{
                      cursor: 'pointer',
                      px: 2,
                      py: 1,
                      borderRadius: 3,
                      minWidth: 45,
                      textAlign: 'center',
                      fontSize: '0.9rem',
                      fontWeight: startOfMonth === day ? 600 : 400,
                      border: `2px solid ${
                        startOfMonth === day
                          ? theme.palette.primary.main
                          : theme.palette.divider
                      }`,
                      backgroundColor:
                        startOfMonth === day
                          ? theme.palette.primary.light
                          : theme.palette.background.paper,
                      color:
                        startOfMonth === day
                          ? theme.palette.primary.contrastText
                          : theme.palette.text.primary,
                      boxShadow:
                        startOfMonth === day ? theme.shadows[4] : 'none',
                      transition: 'all 0.3s',
                      '&:hover': {
                        boxShadow: theme.shadows[2],
                        backgroundColor:
                          startOfMonth === day
                            ? theme.palette.primary.light
                            : theme.palette.action.hover,
                      },
                    }}
                  >
                    {day}
                  </Box>
                </motion.div>
              ))}
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
