'use client';

import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { TimeTableProps, TimeTableStep } from '@/app/lib/interface';
import moment from 'moment';
import { Skeleton } from '@mui/material';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface ActiveStep {
  step: TimeTableStep;
  docTitle: string;
  message: string;
  priority: number; // 🔑 lower = more important
}

export default function TimeTableNotifier() {
  const [activeStep, setActiveStep] = useState<ActiveStep | null>(null);
  const [loading, setLoading] = useState(true);

  const { theme } = useCustomTheme();

  useEffect(() => {
    const q = query(collection(db, 'timeTables'));

    const unsub = onSnapshot(q, (snap) => {
      const docs: TimeTableProps[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as TimeTableProps),
      }));

      checkSteps(docs);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const checkSteps = (docs: TimeTableProps[]) => {
    const now = moment();
    let bestStep: ActiveStep | null = null;

    docs.forEach((doc) => {
      doc.steps.forEach((step) => {
        const start = moment(step.startTime, 'HH:mm');
        const end = step.endTime ? moment(step.endTime, 'HH:mm') : null;

        const diffFromStart = now.diff(start, 'minutes'); // negative if before
        const diffToStart = start.diff(now, 'minutes'); // negative if after

        let candidate: ActiveStep | null = null;

        // 1️⃣ Before Start (within 15 min)
        if (diffToStart > 0 && diffToStart <= 15) {
          candidate = {
            step,
            docTitle: doc.title,
            message: `${step.field1} is coming ahead from ${doc.title}`,
            priority: diffToStart,
          };
        }

        // 2️⃣ Exact Time ±15 minutes
        if (diffFromStart >= 0 && diffFromStart <= 15) {
          candidate = {
            step,
            docTitle: doc.title,
            message: `It is time for ${step.field1}`,
            priority: 0,
          };
        }

        // 3️⃣ Ongoing (after 15min but before endTime)
        if (end && now.isBetween(start.clone().add(15, 'minutes'), end)) {
          candidate = {
            step,
            docTitle: doc.title,
            message: `It is ${step.field1} time. Carry On!`,
            priority: 99,
          };
        }

        if (candidate) {
          if (!bestStep || candidate.priority < bestStep.priority) {
            bestStep = candidate;
          }
        }
      });
    });

    setActiveStep(bestStep);
  };

  const formatTime = (step: TimeTableStep) => {
    const start = moment(step.startTime, 'HH:mm').format('h:mm A');
    if (step.endTime) {
      const end = moment(step.endTime, 'HH:mm').format('h:mm A');
      return `${start} - ${end}`;
    }
    return start;
  };

  if (!theme) return null;

  return (
    <div
      className="p-4 shadow-md rounded-md border text-center mb-6"
      style={{
        background:
          theme.mode === 'dark'
            ? 'linear-gradient(to right, #1e293b, #334155)'
            : 'linear-gradient(to right, #e0f2fe, #f0f9ff)',
        borderColor: theme.mode === 'dark' ? '#475569' : '#bfdbfe',
        color: theme.mode === 'dark' ? '#f1f5f9' : 'inherit',
      }}
    >
      {loading ? (
        <div>
          <Skeleton
            variant="text"
            width="70%"
            height={28}
            sx={{ mx: 'auto' }}
          />
          <Skeleton
            variant="text"
            width="40%"
            height={20}
            sx={{ mx: 'auto', mt: 1 }}
          />
        </div>
      ) : activeStep ? (
        <div>
          <p
            style={{
              color: theme.mode === 'dark' ? '#93c5fd' : '#1e3a8a',
              fontWeight: 600,
              fontSize: '1.25rem',
            }}
          >
            {activeStep.message}
          </p>
          <p
            style={{
              color: theme.mode === 'dark' ? '#cbd5e1' : '#475569',
              marginTop: '0.25rem',
              fontSize: '0.875rem',
            }}
          >
            {formatTime(activeStep.step)}
          </p>
        </div>
      ) : (
        <div>
          <p
            style={{
              color: theme.mode === 'dark' ? '#94a3b8' : '#475569',
              fontWeight: 500,
              fontSize: '1.125rem',
            }}
          >
            No scheduled activity right now
          </p>
        </div>
      )}
    </div>
  );
}
