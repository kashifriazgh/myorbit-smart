'use client';

import {
  Box,
  Typography,
  Button,
  Stack,
  CircularProgress,
} from '@mui/material';
import { db } from '@/app/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { THEME_PRESETS } from '@/app/lib/theme-presets';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useState } from 'react';

interface ThemePreset {
  name: string;
  primary: string;
  secondary: string;
}

export default function ThemeSettings() {
  const { theme, refreshTheme } = useCustomTheme(); // ✅ make sure this is available

  const [loadingTheme, setLoadingTheme] = useState<string | null>(null);

  if (!theme) return <CircularProgress />;

  const handleSetTheme = async (themeToApply: ThemePreset) => {
    setLoadingTheme(themeToApply.name);
    try {
      await setDoc(doc(db, 'theme', 'activeTheme'), themeToApply);
      await refreshTheme(); // ✅ refresh theme after saving
    } catch (err) {
      alert('Failed to apply theme: ' + (err as Error).message);
    } finally {
      setLoadingTheme(null);
    }
  };

  return (
    <Box
      mt={4}
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
        p: 2,
      }}
    >
      <Typography variant="h6" mb={2}>
        Choose a Theme
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        {THEME_PRESETS.map((preset) => {
          const isActive = preset.name === theme.name;

          return (
            <Box
              key={preset.name}
              p={2}
              border="2px solid"
              borderColor={isActive ? 'primary.main' : '#ccc'}
              borderRadius={2}
              width={180}
              textAlign="center"
              bgcolor={isActive ? '#f0f8ff' : 'white'}
            >
              <Typography fontWeight={600}>{preset.name}</Typography>
              <Box display="flex" justifyContent="center" gap={1} my={1}>
                <Box
                  width={20}
                  height={20}
                  bgcolor={preset.primary}
                  borderRadius="50%"
                />
                <Box
                  width={20}
                  height={20}
                  bgcolor={preset.secondary}
                  borderRadius="50%"
                />
              </Box>
              <Button
                size="small"
                variant="contained"
                disabled={loadingTheme !== null}
                onClick={() => handleSetTheme(preset)}
              >
                {loadingTheme === preset.name ? (
                  <CircularProgress size={18} color="inherit" />
                ) : isActive ? (
                  'Active'
                ) : (
                  'Apply'
                )}
              </Button>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
