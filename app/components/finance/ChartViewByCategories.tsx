'use client';

import { Box, Typography, Stack } from '@mui/material';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useMemo } from 'react';

// Register required Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#FF6666',
];

export default function ChartViewByCategory({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const chartData = useMemo(() => {
    return {
      labels: data.map((d) => d.name),
      datasets: [
        {
          data: data.map((d) => d.value),
          backgroundColor: data.map((_, idx) => COLORS[idx % COLORS.length]),
          borderWidth: 1,
        },
      ],
    };
  }, [data]);

  const options = {
    cutout: '50%',
    plugins: {
      legend: {
        display: false, // we are showing custom legend
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
    <Box sx={{ width: '100%', height: 200 }}>
      {/* Doughnut Chart */}
      <Box sx={{ width: 160, height: 160, mx: 'auto' }}>
        <Doughnut data={chartData} options={options} />
      </Box>

      {/* Legend */}
      <Stack
        direction="row"
        flexWrap="wrap"
        spacing={1}
        justifyContent="center"
        mt={1}
      >
        {data.map((entry, index) => (
          <Box
            key={entry.name}
            display="flex"
            alignItems="center"
            gap={0.5}
            mr={1}
            mb={0.5}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: COLORS[index % COLORS.length],
              }}
            />
            <Typography variant="caption">{entry.name}</Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
