'use client';

import { useState } from 'react';
import { Box, Button, Typography, Stack } from '@mui/material';
import TimeTableList from '../components/time-table/TimeTableList';
import TimeTableModal from '../components/time-table/TimeTableModal';
import { useCustomTheme } from '@/app/lib/context/themeContext';

import { Add } from '@mui/icons-material';

const TimeTablePage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const { theme } = useCustomTheme();

  return (
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        maxWidth: '1000px',
        mx: 'auto',
        backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '16px' : '0px',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Creative Header */}
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mb: 5,
          pb: 3,
          borderBottom: '1px solid',
          borderColor: theme?.mode === 'dark' ? '#1e293b' : '#f1f5f9',
        }}
      >
        <Stack spacing={0.5}>
          <Typography 
            variant="h4" 
            fontWeight="900" 
            sx={{ 
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Timetables
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
              fontWeight: 500,
            }}
          >
            Design, schedule, and optimize your daily routines in high fidelity.
          </Typography>
        </Stack>

        <Button 
          variant="contained"
          startIcon={<Add />} 
          onClick={() => setModalOpen(true)}
          sx={{
            py: 1.25,
            px: 3,
            borderRadius: 3,
            textTransform: 'none',
            fontWeight: 800,
            fontSize: '0.9rem',
            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.4)',
            transition: 'all 0.2s',
            '&:hover': {
              background: 'linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)',
              boxShadow: '0 6px 20px 0 rgba(37, 99, 235, 0.6)',
              transform: 'translateY(-2px)',
            }
          }}
        >
          Create Timetable
        </Button>
      </Box>

      {/* Timetable Listing */}
      <TimeTableList />

      {/* Timetable Editor Modal */}
      <TimeTableModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Box>
  );
};

export default TimeTablePage;
