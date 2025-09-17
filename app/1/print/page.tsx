'use client';

import { Box, Typography, Container, Divider, Button } from '@mui/material';
import {
  Assignment,
  AttachMoney,
  Book,
  EmojiEmotions,
  CheckCircle,
  Cancel,
  Payments,
  Print,
} from '@mui/icons-material';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { Todo, ToDoStep, SubStep } from '@/app/lib/interface';
import moment from 'moment';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PrintPage() {
  const { user } = useAuth();
  const [remainingTodos, setRemainingTodos] = useState<Todo[]>([]);
  const [remainingIncomes, setRemainingIncomes] = useState<string[]>([]);
  const [remainingExpenses, setRemainingExpenses] = useState<string[]>([]);
  const [journalWritten, setJournalWritten] = useState<boolean>(false);
  const [moodLogged, setMoodLogged] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      const today = moment().startOf('day');
      const endOfToday = moment().endOf('day');

      const checkDateInRange = (date: Date | Timestamp) => {
        const momentDate = moment(
          date instanceof Timestamp ? date.toDate() : date
        );
        return momentDate.isBetween(today, endOfToday, 'day', '[]');
      };

      // Fetch todos with steps and sub-steps
      const todosSnap = await getDocs(
        query(collection(db, 'todos'), where('authorId', '==', user.uid))
      );
      const todos = todosSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Todo))
        .filter(
          (todo) =>
            todo.dueDate &&
            checkDateInRange(todo.dueDate) &&
            todo.status !== 'completed'
        );

      const incomesSnap = await getDocs(
        query(collection(db, 'incomeSources'), where('userId', '==', user.uid))
      );
      const incomes = incomesSnap.docs
        .map((doc) => doc.data())
        .filter(
          (i) =>
            i.expectedDate && checkDateInRange(i.expectedDate) && !i.isReceived
        )
        .map((i) => i.source || 'Unnamed Income');

      const expensesSnap = await getDocs(
        query(collection(db, 'expenditures'), where('userId', '==', user.uid))
      );
      const expenses = expensesSnap.docs
        .map((doc) => doc.data())
        .filter((e) => e.dueDate && checkDateInRange(e.dueDate) && !e.isPaid)
        .map((e) => e.title || 'Unnamed Expense');

      const journalSnap = await getDocs(
        query(collection(db, 'journals'), where('userId', '==', user.uid))
      );
      const journals = journalSnap.docs
        .map((doc) => doc.data())
        .filter((j) => j.createdAt && checkDateInRange(j.createdAt));

      const moodSnap = await getDocs(
        query(collection(db, 'moods'), where('userId', '==', user.uid))
      );
      const moods = moodSnap.docs
        .map((doc) => doc.data())
        .filter((m) => m.createdAt && checkDateInRange(m.createdAt));

      setRemainingTodos(todos);
      setRemainingIncomes(incomes);
      setRemainingExpenses(expenses);
      setJournalWritten(journals.length > 0);
      setMoodLogged(moods.length > 0);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const handlePrint = () => {
    window.print();
  };

  const renderTodoWithSteps = (todo: Todo, index: number) => (
    <Box
      key={todo.id}
      sx={{ mb: 2, p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}
    >
      <Typography variant="body1" fontWeight="bold" sx={{ mb: 1 }}>
        {index + 1}. {todo.title || 'Unnamed Todo'}
      </Typography>

      {todo.description && (
        <Typography variant="body2" sx={{ mb: 1, color: '#666' }}>
          {todo.description}
        </Typography>
      )}

      {todo.steps && todo.steps.length > 0 && (
        <Box sx={{ ml: 2 }}>
          <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
            Steps:
          </Typography>
          {todo.steps.map((step: ToDoStep, stepIndex: number) => (
            <Box key={stepIndex} sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ ml: 1 }}>
                {stepIndex + 1}. {step.text || 'Unnamed Step'}
              </Typography>

              {step.subSteps && step.subSteps.length > 0 && (
                <Box sx={{ ml: 2 }}>
                  {step.subSteps.map((subStep: SubStep, subIndex: number) => (
                    <Typography
                      key={subIndex}
                      variant="body2"
                      sx={{ ml: 1, fontSize: '0.85rem', color: '#666' }}
                    >
                      • {subStep.text || 'Unnamed Sub-step'}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    items: string[],
    isComplete: boolean,
    isSpecial: boolean = false
  ) => (
    <Box sx={{ mb: 3, pageBreakInside: 'avoid' }}>
      <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
        {icon}
        <Typography variant="h6" fontWeight="bold">
          {title}
        </Typography>
        {isComplete ? (
          <CheckCircle sx={{ color: 'green', fontSize: 20 }} />
        ) : (
          <Cancel sx={{ color: 'red', fontSize: 20 }} />
        )}
      </Box>
      <Divider sx={{ mb: 1 }} />

      {isSpecial ? (
        <Typography
          variant="body2"
          sx={{ color: isComplete ? 'green' : 'red' }}
        >
          {isComplete ? 'Completed' : items[0]}
        </Typography>
      ) : (
        <Box>
          {items.length === 0 ? (
            <Typography variant="body2" color="green">
              All completed!
            </Typography>
          ) : (
            items.map((item, index) => (
              <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                {index + 1}. {item}
              </Typography>
            ))
          )}
        </Box>
      )}
    </Box>
  );

  if (loading) {
    return (
      <Container maxWidth="md">
        <Box py={4}>
          <Typography>Loading...</Typography>
        </Box>
      </Container>
    );
  }

  const hasAnyRemaining =
    remainingTodos.length > 0 ||
    remainingIncomes.length > 0 ||
    remainingExpenses.length > 0 ||
    !journalWritten ||
    !moodLogged;

  return (
    <Container maxWidth="md">
      <Box py={4}>
        {/* Print Button - Hidden when printing */}
        <Box sx={{ mb: 3, '@media print': { display: 'none' } }}>
          <Button
            variant="contained"
            startIcon={<Print />}
            onClick={handlePrint}
            sx={{ mr: 2 }}
          >
            Print This Page
          </Button>
          <Link href="/1/plans-remaining" style={{ textDecoration: 'none' }}>
            <Button variant="outlined">Back to Plans</Button>
          </Link>
        </Box>

        {/* Print-friendly content */}
        <Box
          sx={{
            '@media print': {
              '& *': {
                color: '#000 !important',
                backgroundColor: 'transparent !important',
              },
            },
          }}
        >
          <Typography
            variant="h4"
            fontWeight="bold"
            sx={{
              mb: 3,
              textAlign: 'center',
              '@media print': { fontSize: '24px' },
            }}
          >
            Today&#39;s Remaining Plans
          </Typography>

          <Typography
            variant="body2"
            sx={{
              mb: 3,
              textAlign: 'center',
              '@media print': { fontSize: '12px' },
            }}
          >
            Generated on {moment().format('MMMM Do YYYY, h:mm:ss a')}
          </Typography>

          {!hasAnyRemaining ? (
            <Typography
              variant="h6"
              color="green"
              sx={{
                textAlign: 'center',
                '@media print': { color: '#000 !important' },
              }}
            >
              All tasks for today are completed 🎉
            </Typography>
          ) : (
            <Box>
              {/* Todos with Steps */}
              {remainingTodos.length > 0 && (
                <Box sx={{ mb: 3, pageBreakInside: 'avoid' }}>
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    sx={{ mb: 1 }}
                  >
                    <Assignment sx={{ color: '#1976d2', fontSize: 20 }} />
                    <Typography variant="h6" fontWeight="bold">
                      Pending Tasks
                    </Typography>
                    <Cancel sx={{ color: 'red', fontSize: 20 }} />
                  </Box>
                  <Divider sx={{ mb: 1 }} />
                  {remainingTodos.map((todo, index) =>
                    renderTodoWithSteps(todo, index)
                  )}
                </Box>
              )}

              {/* Incomes */}
              {renderSection(
                'Pending Incomes',
                <AttachMoney sx={{ color: 'green', fontSize: 20 }} />,
                remainingIncomes,
                remainingIncomes.length === 0
              )}

              {/* Expenses */}
              {renderSection(
                'Pending Expenses',
                <Payments sx={{ color: 'red', fontSize: 20 }} />,
                remainingExpenses,
                remainingExpenses.length === 0
              )}

              {/* Journal */}
              {renderSection(
                'Journal',
                <Book sx={{ color: 'purple', fontSize: 20 }} />,
                ['Journal not written yet'],
                journalWritten,
                true
              )}

              {/* Mood */}
              {renderSection(
                'Mood',
                <EmojiEmotions sx={{ color: 'orange', fontSize: 20 }} />,
                ['Mood not logged yet'],
                moodLogged,
                true
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Container>
  );
}
