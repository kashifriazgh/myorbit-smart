'use client';

import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Container,
  Divider,
  Skeleton,
} from '@mui/material';
import {
  Assignment,
  AttachMoney,
  Book,
  CheckCircle,
  Cancel,
  Payments,
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
import moment from 'moment';
import React, { useEffect, useState } from 'react';

export default function RemainingPlansPage() {
  const { user } = useAuth();
  const [remainingTodos, setRemainingTodos] = useState<string[]>([]);
  const [remainingIncomes, setRemainingIncomes] = useState<string[]>([]);
  const [remainingExpenses, setRemainingExpenses] = useState<string[]>([]);
  const [journalWritten, setJournalWritten] = useState<boolean>(false);
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

      const todosSnap = await getDocs(
        query(collection(db, 'todos'), where('authorId', '==', user.uid))
      );
      const todos = todosSnap.docs
        .map((doc) => doc.data())
        .filter(
          (todo) =>
            todo.dueDate &&
            checkDateInRange(todo.dueDate) &&
            todo.status !== 'completed'
        )
        .map((todo) => todo.title || 'Unnamed Todo');

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
        query(collection(db, 'journals'), where('authorId', '==', user.uid))
      );
      const journals = journalSnap.docs
        .map((doc) => doc.data())
        .filter((j) => j.createdAt && checkDateInRange(j.createdAt));

      setRemainingTodos(todos);
      setRemainingIncomes(incomes);
      setRemainingExpenses(expenses);
      setJournalWritten(journals.length > 0);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const renderHeader = (
    icon: React.ReactNode,
    title: string,
    isComplete: boolean
  ) => (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      mb={1}
    >
      <Box display="flex" alignItems="center" gap={1}>
        {icon}
        <Typography variant="h6">{title}</Typography>
      </Box>
      {isComplete ? (
        <CheckCircle sx={{ color: 'green' }} />
      ) : (
        <Cancel sx={{ color: 'red' }} />
      )}
    </Box>
  );

  const renderList = (
    items: string[],
    color: string,
    icon: React.ReactNode
  ) => (
    <List dense>
      {items.map((item, index) => (
        <ListItem key={index}>
          <ListItemIcon sx={{ color }}>{icon}</ListItemIcon>
          <ListItemText
            primaryTypographyProps={{ fontSize: '0.95rem' }}
            primary={`${index + 1}. ${item}`}
          />
        </ListItem>
      ))}
    </List>
  );

  const sections = [
    {
      title: 'Todos',
      icon: <Assignment sx={{ color: '#1976d2' }} />,
      items: remainingTodos,
      color: '#1976d2',
      itemIcon: <Assignment fontSize="small" />,
    },
    {
      title: 'Pending Incomes',
      icon: <AttachMoney sx={{ color: 'green' }} />,
      items: remainingIncomes,
      color: 'green',
      itemIcon: <AttachMoney fontSize="small" />,
    },
    {
      title: 'Pending Expenses',
      icon: <Payments sx={{ color: 'red' }} />,
      items: remainingExpenses,
      color: 'red',
      itemIcon: <Payments fontSize="small" />,
    },
    {
      title: 'Journal',
      icon: <Book sx={{ color: 'purple' }} />,
      items: journalWritten ? [] : ['Journal not written yet'],
      color: 'purple',
      itemIcon: <Book fontSize="small" />,
      isJournal: true,
    },
  ];

  // Show only sections that have pending items
  const pendingSections = sections.filter((section) =>
    section.isJournal ? !journalWritten : section.items.length > 0
  );

  return (
    <Container maxWidth="md">
      <Box py={4}>
        <Typography variant="h5" fontWeight="bold" mb={3}>
          Today’s Remaining Plans
        </Typography>

        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} sx={{ mb: 3 }}>
                <CardContent>
                  <Skeleton variant="text" width="40%" height={30} />
                  <Divider sx={{ my: 2 }} />
                  {[1, 2, 3].map((j) => (
                    <Skeleton
                      key={j}
                      variant="text"
                      width={`${80 - j * 10}%`}
                      height={20}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </>
        ) : pendingSections.length === 0 ? (
          <Typography color="success.main">
            All tasks for today are completed 🎉
          </Typography>
        ) : (
          pendingSections.map((section, index) => (
            <Card key={index} sx={{ mb: 3 }}>
              <CardContent>
                {renderHeader(
                  section.icon,
                  section.title,
                  section.isJournal
                    ? journalWritten
                    : section.items.length === 0
                )}
                <Divider sx={{ mb: 2 }} />
                {section.isJournal ? (
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    sx={{ color: section.color }}
                  >
                    {section.itemIcon}
                    <Typography>{section.items[0]}</Typography>
                  </Box>
                ) : (
                  renderList(section.items, section.color, section.itemIcon)
                )}
              </CardContent>
            </Card>
          ))
        )}
      </Box>
    </Container>
  );
}
