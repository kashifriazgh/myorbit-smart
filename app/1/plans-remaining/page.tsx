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
} from '@mui/material';
import { Assignment, AttachMoney, Book } from '@mui/icons-material';
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
import { useEffect, useState } from 'react';

export default function RemainingPlansPage() {
  const { user } = useAuth();
  const [remainingTodos, setRemainingTodos] = useState<string[]>([]);
  const [remainingIncomes, setRemainingIncomes] = useState<string[]>([]);
  const [remainingExpenses, setRemainingExpenses] = useState<string[]>([]);
  const [journalWritten, setJournalWritten] = useState<boolean>(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
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
    };

    fetchData();
  }, [user]);

  return (
    <Box className="p-4 space-y-6">
      <Typography variant="h5" fontWeight="bold">
        Today’s Remaining Plans
      </Typography>

      <Card className="shadow-md">
        <CardContent>
          <Typography variant="h6" className="mb-2">
            Todos
          </Typography>
          {remainingTodos.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              All todos done 🎉
            </Typography>
          ) : (
            <List dense>
              {remainingTodos.map((todo, index) => (
                <ListItem key={index}>
                  <ListItemIcon className="text-blue-600">
                    <Assignment fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={todo} />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardContent>
          <Typography variant="h6" className="mb-2">
            Pending Incomes
          </Typography>
          {remainingIncomes.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              No incomes due today
            </Typography>
          ) : (
            <List dense>
              {remainingIncomes.map((income, index) => (
                <ListItem key={index}>
                  <ListItemIcon className="text-green-600">
                    <AttachMoney fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={income} />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardContent>
          <Typography variant="h6" className="mb-2">
            Pending Expenses
          </Typography>
          {remainingExpenses.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              No expenses due today
            </Typography>
          ) : (
            <List dense>
              {remainingExpenses.map((expense, index) => (
                <ListItem key={index}>
                  <ListItemIcon className="text-red-600">
                    <AttachMoney fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={expense} />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardContent>
          <Typography variant="h6" className="mb-2">
            Journal
          </Typography>
          {journalWritten ? (
            <Typography color="success.main">
              Journal entry completed ✅
            </Typography>
          ) : (
            <Box className="flex items-center gap-2 text-purple-600">
              <Book fontSize="small" />
              <Typography>Journal not written yet</Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
