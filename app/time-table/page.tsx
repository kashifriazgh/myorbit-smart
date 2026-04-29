'use client';

import { useState } from 'react';
import { Box, Button } from '@mui/material';
import TimeTableList from '../components/time-table/TimeTableList';
import TimeTableModal from '../components/time-table/TimeTableModal';
import { useCustomTheme } from '@/app/lib/context/themeContext';

import { Add } from '@mui/icons-material';

const TimeTablePage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const { theme } = useCustomTheme();

  return (
    <Box
      className="p-4 max-w-4xl mx-auto"
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      <Box className="flex justify-between mb-4">
        <h1 className="text-xl font-bold dark:text-slate-50">Time Tables</h1>
        <Button startIcon={<Add />} onClick={() => setModalOpen(true)}>
          Create Time Table
        </Button>
      </Box>

      <TimeTableList />

      <TimeTableModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Box>
  );
};

export default TimeTablePage;
