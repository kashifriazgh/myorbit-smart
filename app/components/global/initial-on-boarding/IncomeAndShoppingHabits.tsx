'use client';

import {
  Box,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

  const fetchUser = async () => {
    if (!user) return;
    setLoading(true);
    const docRef = doc(db, 'users', user.uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      setIncomeType(data.incomeType?.value ?? null);
      setShoppingHabits(data.shoppingHabits?.value ?? null);
    }
    setLoading(false);
  };

  const handleSelect = async (
    type: 'incomeType' | 'shoppingHabits',
    value: string
  ) => {
    if (!user) return;
    const newValue = {
      value,
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);

    await setDoc(
      doc(db, 'users', user.uid),
      {
        [type]: newValue,
      },
      { merge: true }
    );

    if (type === 'incomeType') setIncomeType(value);
    else setShoppingHabits(value);

    setSaving(false);
  };

  useEffect(() => {
    fetchUser();
  }, [user]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={4} mt={4}>
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" mb={1}>
          Income Type
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {incomes.map((option) => (
            <motion.div
              key={option}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSelect('incomeType', option)}
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

      <Box>
        <Typography variant="subtitle1" fontWeight="bold" mb={1}>
          Shopping Habits
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {habits.map((option) => (
            <motion.div
              key={option}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSelect('shoppingHabits', option)}
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
