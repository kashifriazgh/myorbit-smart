'use client';

import { Box, Typography } from '@mui/material';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useMemo } from 'react';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ['#22c55e', '#ef4444']; // Green = Paid/Received, Red = Unpaid

export default function PaidUnPaidChart({
  title,
  paidValue,
  unpaidValue,
  type = 'expense', // default to expense if not provided
}: {
  title?: string;
  paidValue: number;
  unpaidValue: number;
  type?: 'income' | 'expense' | 'shopping';
}) {
  const paidLabel =
    type === 'income' ? 'Received' : type === 'shopping' ? 'Spent' : 'Paid';

  const unpaidLabel =
    type === 'income'
      ? 'Not Received'
      : type === 'shopping'
      ? 'Pending'
      : 'Not Paid';

  const data = useMemo(
    () => ({
      labels: [paidLabel, unpaidLabel],
      datasets: [
        {
          data: [paidValue, unpaidValue],
          backgroundColor: COLORS,
          borderWidth: 1,
        },
      ],
    }),
    [paidValue, unpaidValue, type]
  );

  const options = {
    cutout: '50%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (tooltipItem) {
            const label = tooltipItem.label;
            const value = tooltipItem.raw;
            return `${label}: Rs ${value.toLocaleString()}`;
          },
        },
      },
    },
  };

  return (
    <Box textAlign="center" mb={2}>
      {title && (
        <Typography variant="subtitle2" fontWeight="bold" mb={1}>
          {title}
        </Typography>
      )}

      <Box
        sx={{
          width: 120, // was 200
          height: 120, // was 200
          mx: 'auto',
        }}
      >
        <Doughnut data={data} options={options} />
      </Box>

      <Typography variant="body2" mt={1}>
        ✅ {paidLabel} <strong>{paidValue.toLocaleString()}</strong>
        &nbsp;&nbsp;|&nbsp;&nbsp; ❌ {unpaidLabel}{' '}
        <strong>{unpaidValue.toLocaleString()}</strong>
      </Typography>
    </Box>
  );
}
