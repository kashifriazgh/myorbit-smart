'use client';

import {
  Box,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';

const habits = ['weekly', 'monthly', 'as-needed'] as const;
const incomes = ['monthly', 'weekly', 'irregular'] as const;

const IncomeAndShoppingHabits = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [incomeType, setIncomeType] = useState<string | null>(null);
  const [shoppingHabits, setShoppingHabits] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const ref = doc(db, 'settings', user.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      const onboarding = data?.initialOnBoarding;
      setIncomeType(onboarding?.incomeType?.value ?? null);
      setShoppingHabits(onboarding?.shoppingHabits?.value ?? null);
    }

    setLoading(false);
  }, [user]);

  const updateField = async (
    key: 'incomeType' | 'shoppingHabits',
    value: string
  ) => {
    if (!user) return;
    setSaving(true);

    const ref = doc(db, 'settings', user.uid);
    const newField = {
      [`initialOnBoarding.${key}`]: {
        value,
        filled: !!value,
        updatedAt: serverTimestamp(),
      },
    };

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          userId: user.uid,
          initialOnBoarding: {
            [key]: {
              value,
              filled: true,
              updatedAt: serverTimestamp(),
            },
          },
        });
      } else {
        await updateDoc(ref, newField);
      }

      if (key === 'incomeType') setIncomeType(value);
      else setShoppingHabits(value);
    } catch (err) {
      console.error('Failed to update field:', err);
    }

    setSaving(false);
  };

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={4} mt={4}>
      {/* Income Type */}
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" mb={1}>
          Income Type
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {incomes.map((option) => (
            <motion.div
              key={option}
              whileTap={{ scale: 0.95 }}
              onClick={() => updateField('incomeType', option)}
              style={{
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: '20px',
                border:
                  incomeType === option
                    ? `2px solid ${theme.palette.primary.main}`
                    : `1px solid ${theme.palette.grey[400]}`,
                backgroundColor:
                  incomeType === option
                    ? theme.palette.primary.light
                    : 'transparent',
                color:
                  incomeType === option
                    ? theme.palette.primary.dark
                    : theme.palette.text.primary,
                fontWeight: 500,
              }}
            >
              {option.toUpperCase()}
            </motion.div>
          ))}
        </Stack>
      </Box>

      {/* Shopping Habits */}
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" mb={1}>
          Shopping Habits
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {habits.map((option) => (
            <motion.div
              key={option}
              whileTap={{ scale: 0.95 }}
              onClick={() => updateField('shoppingHabits', option)}
              style={{
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: '20px',
                border:
                  shoppingHabits === option
                    ? `2px solid ${theme.palette.primary.main}`
                    : `1px solid ${theme.palette.grey[400]}`,
                backgroundColor:
                  shoppingHabits === option
                    ? theme.palette.primary.light
                    : 'transparent',
                color:
                  shoppingHabits === option
                    ? theme.palette.primary.dark
                    : theme.palette.text.primary,
                fontWeight: 500,
              }}
            >
              {option.toUpperCase()}
            </motion.div>
          ))}
        </Stack>
      </Box>

      {saving && (
        <Typography variant="body2" color="text.secondary" mt={2}>
          Saving...
        </Typography>
      )}
    </Stack>
  );
};

export default IncomeAndShoppingHabits;
