'use client';

import {
  Box,
  Typography,
  CircularProgress,
  Stack,
  Chip,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';

const currencies = ['PKR', 'USD'] as const;

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1 },
  }),
};

export default function SelectCurrency() {
  const { user } = useAuth();
  const theme = useTheme();
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurrency = async () => {
      if (!user?.uid) return;

      try {
        const ref = doc(db, 'settings', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const currencyValue = data?.initialOnBoarding?.currency?.value;
          if (currencyValue) setSelectedCurrency(currencyValue);
        }
      } catch (err) {
        console.error('Failed to fetch currency:', err);
      }
      setLoading(false);
    };

    fetchCurrency();
  }, [user]);

  const updateCurrency = async (currency: string) => {
    if (!user?.uid) return;

    const ref = doc(db, 'settings', user.uid);
    const newField = {
      [`initialOnBoarding.currency`]: {
        value: currency,
        filled: true,
        updatedAt: serverTimestamp(),
      },
    };

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          userId: user.uid,
          initialOnBoarding: {
            currency: {
              value: currency,
              filled: true,
              updatedAt: serverTimestamp(),
            },
          },
        });
      } else {
        await updateDoc(ref, newField);
      }

      setSelectedCurrency(currency);
    } catch (err) {
      console.error('Failed to update currency:', err);
    }
  };

  if (!user || loading) {
    return (
      <Box textAlign="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select your preferred currency:
      </Typography>

      <Stack direction="row" spacing={2}>
        {currencies.map((currency, i) => (
          <motion.div
            key={currency}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={fadeIn}
          >
            <Chip
              label={currency}
              onClick={() => updateCurrency(currency)}
              color={selectedCurrency === currency ? 'primary' : 'default'}
              variant={selectedCurrency === currency ? 'filled' : 'outlined'}
              sx={{
                px: 2,
                py: 1,
                fontWeight: 600,
                boxShadow:
                  selectedCurrency === currency ? theme.shadows[3] : 'none',
                transition: 'all 0.3s',
              }}
            />
          </motion.div>
        ))}
      </Stack>
    </Box>
  );
}
