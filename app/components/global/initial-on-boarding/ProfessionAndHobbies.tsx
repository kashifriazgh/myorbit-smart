'use client';

import {
  Box,
  Typography,
  Stack,
  CircularProgress,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Chip,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/lib/context/userContext';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';

const professions = [
  'Student',
  'Shop Owner',
  'Online Seller',
  'Electrician',
  'Plumber',
  'Mechanic',
  'Clerk',
  'Receptionist',
  'Accountant',
  'Graphic Designer',
  'Computer Operator',
  'Teacher',
  'Nurse',
  'Housekeeper',
  'Factory Worker',
  'Daily Wager',
  'Freelancer',
  'Unemployed',
];

const hobbies = [
  'Watching TV / Drama',
  'Cooking',
  'Reading Books',
  'Gardening',
  'Traveling',
  'Playing Mobile Games',
  'Listening to Music',
  'Photography',
  'Drawing / Art',
  'Browsing Social Media',
  'Fitness / Walking / Yoga',
  'Sewing / Handicrafts',
];

const ProfessionAndHobbies = () => {
  const { user } = useAuth();
  const [profession, setProfession] = useState('');
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const docRef = doc(db, 'onboarding', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfession(data.profession || '');
        setSelectedHobbies(data.hobbies || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleSave = async (field: string, value: string | string[]) => {
    if (!user) return;
    const ref = doc(db, 'onboarding', user.uid);
    await setDoc(
      ref,
      {
        [field]: value,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleProfessionChange = (e) => {
    const value = e.target.value;
    setProfession(value);
    handleSave('profession', value);
  };

  const handleHobbiesChange = (e) => {
    const value = e.target.value;
    if (value.length > 3) return; // limit to 3 hobbies
    setSelectedHobbies(value);
    handleSave('hobbies', value);
  };

  if (loading) {
    return (
      <Stack alignItems="center" py={4}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Typography variant="h6" fontWeight="bold" mb={2}>
        Select Your Profession & Hobbies
      </Typography>

      <Stack spacing={3}>
        <FormControl fullWidth>
          <InputLabel>Profession</InputLabel>
          <Select
            label="Profession"
            value={profession}
            onChange={handleProfessionChange}
            sx={{ fontWeight: 600, fontSize: '1.1rem' }}
          >
            {professions.map((prof) => (
              <MenuItem key={prof} value={prof}>
                {prof}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Hobbies (max 3)</InputLabel>
          <Select
            multiple
            label="Hobbies"
            value={selectedHobbies}
            onChange={handleHobbiesChange}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {(selected as string[]).map((value) => (
                  <Chip key={value} label={value} />
                ))}
              </Box>
            )}
            sx={{ fontWeight: 600, fontSize: '1.1rem' }}
          >
            {hobbies.map((hob) => (
              <MenuItem key={hob} value={hob}>
                {hob}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Box>
  );
};

export default ProfessionAndHobbies;
