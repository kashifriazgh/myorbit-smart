'use client';

import {
  Box,
  CircularProgress,
  InputLabel,
  MenuItem,
  Select,
  FormControl,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/lib/context/userContext';
import { db } from '@/app/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

const professions = [
  'Student',
  'Teacher',
  'Driver',
  'Shopkeeper',
  'Tailor',
  'Electrician',
  'Plumber',
  'Daily Wage Worker',
  'Salesperson',
  'Housewife',
  'Farmer',
  'Office Clerk',
  'Labourer',
  'Cashier',
];

const hobbies = [
  'Reading',
  'Gardening',
  'Watching TV',
  'Cooking',
  'Traveling',
  'Cricket',
  'Football',
  'Sewing',
  'Drawing',
  'Singing',
  'Fishing',
  'Walking',
  'Volunteering',
  'Photography',
];

const ProfessionAndHobbies = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profession, setProfession] = useState('');
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) return;

      const ref = doc(db, 'settings', user.uid);
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const p = data?.initialOnBoarding?.profession?.value || '';
          const h = data?.initialOnBoarding?.hobbies?.value || [];
          setProfession(p);
          setSelectedHobbies(h);
        }
      } catch (err) {
        console.error('Failed to fetch onboarding data:', err);
      }
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const updateField = async (
    field: 'profession' | 'hobbies',
    value: string | string[]
  ) => {
    if (!user?.uid) return;

    const ref = doc(db, 'settings', user.uid);
    const newField = {
      [`initialOnBoarding.${field}`]: {
        value,
        filled: Array.isArray(value) ? value.length > 0 : !!value,
        updatedAt: serverTimestamp(),
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
              filled: Array.isArray(value) ? value.length > 0 : !!value,
              updatedAt: serverTimestamp(),
            },
          },
        });
      } else {
        await updateDoc(ref, newField);
      }
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
    }
  };

  const handleProfessionChange = (event) => {
    const value = event.target.value;
    setProfession(value);
    updateField('profession', value);
  };

  const handleHobbiesChange = (event) => {
    const {
      target: { value },
    } = event;

    if (value.length <= 3) {
      setSelectedHobbies(value);
      updateField('hobbies', value);
    }
  };

  if (loading || !user) {
    return (
      <Box py={6} display="flex" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Box px={2} py={4}>
        <Typography fontSize="1.2rem" fontWeight={600} mb={2}>
          Your Profession
        </Typography>
        <FormControl fullWidth variant="outlined">
          <InputLabel>Profession</InputLabel>
          <Select
            value={profession}
            onChange={handleProfessionChange}
            input={<OutlinedInput label="Profession" />}
          >
            {professions.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography fontSize="1.2rem" fontWeight={600} mt={4} mb={2}>
          Your Hobbies (Select max 3)
        </Typography>
        <FormControl fullWidth variant="outlined">
          <InputLabel>Hobbies</InputLabel>
          <Select
            multiple
            value={selectedHobbies}
            onChange={handleHobbiesChange}
            input={<OutlinedInput label="Hobbies" />}
            renderValue={(selected) => selected.join(', ')}
          >
            {hobbies.map((hobby) => (
              <MenuItem
                key={hobby}
                value={hobby}
                disabled={
                  selectedHobbies.length >= 3 &&
                  !selectedHobbies.includes(hobby)
                }
              >
                <Checkbox checked={selectedHobbies.includes(hobby)} />
                <ListItemText primary={hobby} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </motion.div>
  );
};

export default ProfessionAndHobbies;
