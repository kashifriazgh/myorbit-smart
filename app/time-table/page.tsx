'use client';

import { useState } from 'react';
import { Box, Button } from '@mui/material';
import TimeTableList from '../components/time-table/TimeTableList';
import TimeTableModal from '../components/time-table/TimeTableModal';

import { Add } from '@mui/icons-material';

const TimeTablePage = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <Box className="p-4 max-w-4xl mx-auto">
      <Box className="flex justify-between mb-4">
        <h1 className="text-xl font-bold">Time Tables</h1>
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
