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
    transition: { delay: i * 0.05 },
  }),
};

export default function StartDaySelector() {
  const { user } = useAuth();
  const theme = useTheme();

  const [startDayOfWeek, setStartDayOfWeek] = useState<string | null>(null);
  const [startDayOfMonth, setStartDayOfMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) return;
      try {
        const ref = doc(db, 'settings', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setStartDayOfWeek(
            data?.initialOnBoarding?.startDayOfWeek?.value ?? null
          );
          setStartDayOfMonth(
            data?.initialOnBoarding?.startDayOfMonth?.value ?? null
          );
        }
      } catch (error) {
        console.error('Failed to fetch start days:', error);
      }
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const updateField = async (
    field: 'startDayOfWeek' | 'startDayOfMonth',
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

      if (field === 'startDayOfWeek') {
        setStartDayOfWeek(value);
      } else {
        setStartDayOfMonth(value);
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
        <Typography variant="h6" gutterBottom>
          Select the start day of your week:
        </Typography>

        <Box sx={{ overflowX: 'auto', pb: 1, mb: 3 }}>
          <Stack direction="row" spacing={2} sx={{ width: 'max-content' }}>
            {daysOfWeek.map((day, i) => (
              <motion.div
                key={day}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeIn}
              >
                <Button
                  variant={startDayOfWeek === day ? 'contained' : 'outlined'}
                  color={startDayOfWeek === day ? 'primary' : 'inherit'}
                  onClick={() => updateField('startDayOfWeek', day)}
                  sx={{
                    py: 1.5,
                    px: 3,
                    fontSize: '1rem',
                    borderRadius: 5,
                    textTransform: 'capitalize',
                    boxShadow:
                      startDayOfWeek === day ? theme.shadows[3] : 'none',
                    transition: 'all 0.3s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {day}
                </Button>
              </motion.div>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Start Day of Month */}
      <Box width="100%">
        <Typography variant="h6" gutterBottom>
          Select the start day of your month:
        </Typography>

        <Box sx={{ overflowX: 'auto', pb: 1 }}>
          <Stack direction="row" spacing={1} sx={{ width: 'max-content' }}>
            {daysOfMonth.map((day, i) => (
              <motion.div
                key={day}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeIn}
              >
                <Box
                  onClick={() => updateField('startDayOfMonth', day)}
                  sx={{
                    cursor: 'pointer',
                    px: 2,
                    py: 1,
                    borderRadius: 4,
                    minWidth: 50,
                    textAlign: 'center',
                    fontSize: '0.95rem',
                    fontWeight: startDayOfMonth === day ? 600 : 400,
                    border: `2px solid ${
                      startDayOfMonth === day
                        ? theme.palette.primary.main
                        : theme.palette.divider
                    }`,
                    backgroundColor:
                      startDayOfMonth === day
                        ? theme.palette.primary.light
                        : theme.palette.background.paper,
                    color:
                      startDayOfMonth === day
                        ? theme.palette.primary.contrastText
                        : theme.palette.text.primary,
                    boxShadow:
                      startDayOfMonth === day ? theme.shadows[4] : 'none',
                    transition: 'all 0.3s',
                    '&:hover': {
                      boxShadow: theme.shadows[2],
                      backgroundColor:
                        startDayOfMonth === day
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
        </Box>
      </Box>
    </Stack>
  );
}
