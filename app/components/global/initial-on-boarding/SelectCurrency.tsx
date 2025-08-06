'use client';

import {
  Box,
  Typography,
  CircularProgress,
  Stack,
  Chip,
  useTheme,
  Autocomplete,
  TextField,
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
import { COUNTRIES } from '@/app/lib/constant';
type Country = {
  code: string;
  name: string;
  flag: string;
};

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
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) return;

      try {
        const ref = doc(db, 'settings', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const currency = data?.initialOnBoarding?.currency?.value;
          const countryCode = data?.initialOnBoarding?.country?.value;

          if (currency) setSelectedCurrency(currency);
          if (countryCode) {
            const foundCountry = COUNTRIES.find((c) => c.code === countryCode);
            if (foundCountry) setSelectedCountry(foundCountry);
          }
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const updateField = async (key: 'currency' | 'country', value: string) => {
    if (!user?.uid) return;

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

      if (key === 'currency') setSelectedCurrency(value);
      else {
        const newCountry = COUNTRIES.find((c) => c.code === value) || null;
        setSelectedCountry(newCountry);
      }
    } catch (err) {
      console.error(`Failed to update ${key}:`, err);
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
      {/* CURRENCY */}
      <Typography variant="h6" gutterBottom>
        Select your preferred currency:
      </Typography>

      <Stack direction="row" spacing={2} mb={4}>
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
              onClick={() => updateField('currency', currency)}
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

      {/* COUNTRY */}
      <Typography variant="h6" gutterBottom>
        Select your country:
      </Typography>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        custom={currencies.length + 1}
      >
        <Autocomplete
          fullWidth
          options={COUNTRIES}
          autoHighlight
          getOptionLabel={(option) => `${option.flag} ${option.name}`}
          value={selectedCountry}
          onChange={(_, newValue) => {
            if (newValue) updateField('country', newValue.code);
          }}
          renderOption={(props, option) => (
            <li {...props}>
              <span style={{ fontSize: '1.2rem', marginRight: 8 }}>
                {option.flag}
              </span>
              {option.name}
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Country"
              variant="outlined"
              inputProps={{
                ...params.inputProps,
                autoComplete: 'new-password',
              }}
            />
          )}
          sx={{
            mt: 2,
            maxWidth: 400,
            '& .MuiInputBase-root': {
              fontWeight: 600,
              fontSize: '1rem',
            },
          }}
        />
      </motion.div>
    </Box>
  );
}
