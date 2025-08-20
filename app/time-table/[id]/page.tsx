'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Paper,
  Avatar,
} from '@mui/material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { TimeTableProps } from '@/app/lib/interface';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

const TimeTableDetail = () => {
  const { id } = useParams(); // get the id from URL
  const [table, setTable] = useState<TimeTableProps | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchTable = async () => {
      try {
        const docRef = doc(db, 'timeTables', id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTable({ id: docSnap.id, ...(docSnap.data() as TimeTableProps) });
        } else {
          setTable(null);
        }
      } catch (error) {
        console.error('Error fetching table:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTable();
  }, [id]);

  if (loading)
    return (
      <Box className="flex justify-center items-center min-h-[200px]">
        <CircularProgress />
      </Box>
    );

  if (!table)
    return (
      <Typography variant="body1" color="text.secondary">
        No time table found.
      </Typography>
    );

  return (
    <Box maxWidth="700px" mx="auto" p={2}>
      {/* Title */}
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {table.title}
      </Typography>

      {/* Description */}
      {table.description && (
        <Typography
          variant="body1"
          color="text.secondary"
          gutterBottom
          sx={{ mb: 3 }}
        >
          {table.description}
        </Typography>
      )}

      {/* Steps */}
      <Paper elevation={2} className="rounded-xl p-4">
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Time Table
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Stack spacing={2}>
          {table.steps.map((step, idx) => (
            <Card
              key={idx}
              className="rounded-lg shadow-sm border border-gray-100"
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  {/* Icon */}
                  <Avatar
                    sx={{ bgcolor: 'primary.light', width: 48, height: 48 }}
                  >
                    <CalendarTodayIcon color="primary" />
                  </Avatar>

                  {/* Content */}
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {step.field1}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {step.startTime}
                      {step.endTime ? ` – ${step.endTime}` : ''}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
};

export default TimeTableDetail;
