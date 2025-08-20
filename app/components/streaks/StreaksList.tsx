'use client';
import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  Button,
} from '@mui/material';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { StreakProps } from '@/app/lib/interface';
import moment from 'moment-timezone';
import ProgressModal from './StreakMarkDone';
import DeleteStreak from './StreakDelete';

export default function StreaksList() {
  const [streaks, setStreaks] = useState<StreakProps[]>([]);
  const [loading, setLoading] = useState(true);

  // For modal state
  const [selectedStreak, setSelectedStreak] = useState<StreakProps | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const streaksRef = collection(db, 'streaks');

    const unsub = onSnapshot(streaksRef, (snap) => {
      const allStreaks = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as StreakProps),
      }));

      setStreaks(allStreaks);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSaveProgress = async (progress: string) => {
    if (!selectedStreak?.id) return;

    const today = moment().format('YYYY-MM-DD');
    const dayName = moment().format('dddd');

    const alreadyDone = selectedStreak.attendance?.some(
      (a) => a.date === today
    );
    if (alreadyDone) {
      setModalOpen(false);
      return;
    }

    const updatedAttendance = [
      ...(selectedStreak.attendance || []),
      { date: today, day: dayName, progress },
    ];

    const streakRef = doc(db, 'streaks', selectedStreak.id);
    await updateDoc(streakRef, {
      lastChecked: Timestamp.now(),
      attendance: updatedAttendance,
      streaksCount: (selectedStreak.streaksCount || 0) + 1,
      updatedAt: Timestamp.now(),
      currentProgress: progress,
    });

    setModalOpen(false);
    setSelectedStreak(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (streaks.length === 0) {
    return <Typography>No streaks found.</Typography>;
  }

  return (
    <Box mt={4} display="grid" gap={2}>
      {streaks.map((streak) => {
        const timeFormatted = streak.reminder?.time
          ? moment(streak.reminder.time, 'HH:mm').format('hh:mm A')
          : null;

        const last7Days = Array.from({ length: 7 }, (_, i) =>
          moment()
            .subtract(6 - i, 'days')
            .format('YYYY-MM-DD')
        );

        const attendanceDots = last7Days.map((date) => {
          const isPresent = streak.attendance?.some((a) => a.date === date);
          return { date, isPresent };
        });

        const today = moment().format('YYYY-MM-DD');
        const alreadyDoneToday = streak.attendance?.some(
          (a) => a.date === today
        );

        return (
          <Card
            key={streak.id}
            sx={{
              position: 'relative',
              borderRadius: 2,
              boxShadow: 2,
              bgcolor: 'background.paper',
              '&:hover .delete-btn': { opacity: 1 }, // show delete only on hover
            }}
          >
            {/* Delete Button (top-right, hidden until hover) */}
            <Box
              className="delete-btn"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                opacity: 0,
                transition: 'opacity 0.3s',
              }}
            >
              <DeleteStreak streakId={streak.id!} />
            </Box>

            <CardContent>
              {/* Title */}
              <Typography variant="h6">{streak.title}</Typography>

              {/* Description */}
              {streak.description && (
                <Typography variant="body2" color="text.secondary">
                  {streak.description}
                </Typography>
              )}

              {/* Habit Type + Time + Streak Count */}
              <Typography
                variant="body2"
                mt={1}
                sx={{ color: 'green', fontWeight: 500 }}
              >
                {streak.habitType.toUpperCase()} •{' '}
                {timeFormatted ? `at ${timeFormatted}` : '—'} •{' '}
                {streak.streaksCount}🔥
              </Typography>

              {/* Attendance Stepper */}
              <Box mt={2}>
                <Stepper activeStep={-1} alternativeLabel>
                  {attendanceDots.map((dot, i) => {
                    const dayLetter = moment(dot.date).format('dd')[0];
                    return (
                      <Step key={i}>
                        <StepLabel
                          icon={
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                bgcolor: dot.isPresent ? 'green' : 'grey.300',
                                color: dot.isPresent ? 'white' : 'black',
                                fontSize: 14,
                                fontWeight: 600,
                              }}
                            >
                              {dayLetter}
                            </Box>
                          }
                        />
                      </Step>
                    );
                  })}
                </Stepper>
              </Box>

              {/* Mark Done + Current Progress */}
              <Box
                mt={2}
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap={1}
              >
                <Button
                  variant="contained"
                  color="success"
                  disabled={alreadyDoneToday}
                  onClick={() => {
                    setSelectedStreak(streak);
                    setModalOpen(true);
                  }}
                >
                  {alreadyDoneToday ? 'Done Today ✅' : 'Mark as Done'}
                </Button>

                {/* Show current progress if available */}
                {streak.currentProgress && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic' }}
                  >
                    {streak.currentProgress}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        );
      })}

      {/* ✅ Dynamic Progress Modal */}
      {selectedStreak && (
        <ProgressModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          streakTitle={selectedStreak.title}
          onSave={handleSaveProgress}
        />
      )}
    </Box>
  );
}
