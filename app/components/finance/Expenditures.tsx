'use client';

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  useTheme,
  CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Expenditure } from '@/app/lib/interface';

export default function ExpendituresComponent({ userId }: { userId: string }) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const muiTheme = useTheme();

  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'fixed' | 'variable'>('fixed');
  const [isRecurring, setIsRecurring] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchExpenditures = async () => {
      const querySnapshot = await getDocs(collection(db, 'expenditures'));
      const docs = querySnapshot.docs
        .map((doc) => {
          const data = doc.data() as Expenditure;
          return {
            ...data,
            id: doc.id,
            createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
            dueDate: data.dueDate
              ? (data.dueDate as Timestamp)?.toDate?.()
              : undefined,
          };
        })
        .filter((doc) => doc.userId === userId);
      setExpenditures(docs);
      setLoading(false);
    };
    fetchExpenditures();
  }, [userId]);

  const totalAmount = expenditures.reduce((sum, e) => sum + e.amount, 0);

  const groupedByType: Record<'fixed' | 'variable', Expenditure[]> = {
    fixed: [],
    variable: [],
  };

  expenditures.forEach((e) => {
    groupedByType[e.type].push(e);
  });

  const handleSave = async () => {
    if (!title || !amount) return;
    const now = new Date();
    const newExpenditure: Expenditure = {
      userId,
      title,
      amount: Number(amount),
      type,
      category,
      isRecurring,
      isPaid,
      notes,
      createdAt: now,
      updatedAt: now,
    };

    await addDoc(collection(db, 'expenditures'), {
      ...newExpenditure,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setExpenditures((prev) => [...prev, newExpenditure]);
    setOpenModal(false);
    setTitle('');
    setAmount('');
    setType('fixed');
    setCategory('');
    setIsRecurring(false);
    setIsPaid(false);
    setNotes('');
  };

  function toDateSafe(date: Date | Timestamp | undefined): Date | undefined {
    if (!date) return undefined;
    return date instanceof Timestamp ? date.toDate() : date;
  }

  if (loading || !theme) {
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 600,
        mx: 'auto',
        my: 4,
        p: 4,
        boxShadow: 6,
        borderRadius: 3,
        backgroundColor: isDark ? muiTheme.palette.background.paper : '#fff',
      }}
    >
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
      >
        <Typography variant="h5" fontWeight="bold">
          Expenditures
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setOpenModal(true)}
        >
          + Add Expense
        </Button>
      </Box>

      {/* Summary */}
      <Typography
        variant="body2"
        color="text.secondary"
        mb={2}
        fontSize="0.85rem"
        fontWeight="medium"
      >
        Total Expenditures ({expenditures.length}) – Rs{' '}
        {totalAmount.toLocaleString()}
      </Typography>

      {/* Grouped by Type */}
      {(['fixed', 'variable'] as const).map((group) =>
        groupedByType[group].length > 0 ? (
          <Accordion key={group} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="bold" fontSize="1rem">
                {group.charAt(0).toUpperCase() + group.slice(1)} Expenses (
                {groupedByType[group].length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {groupedByType[group].map((exp, idx) => (
                <Accordion
                  key={idx}
                  sx={{
                    mb: 1,
                    backgroundColor: isDark ? '#1f2937' : '#f5f5f5',
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography fontWeight="medium">
                      {exp.title} –{' '}
                      <Typography
                        component="span"
                        fontWeight="bold"
                        fontSize="1.1rem"
                      >
                        Rs {exp.amount.toLocaleString()}
                      </Typography>
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {exp.category && (
                      <Typography variant="body2">
                        Category: {exp.category}
                      </Typography>
                    )}
                    {exp.dueDate && (
                      <Typography variant="body2">
                        Due Date:{' '}
                        {toDateSafe(exp.dueDate)?.toLocaleDateString()}
                      </Typography>
                    )}

                    <Typography variant="body2">
                      Recurring: {exp.isRecurring ? 'Yes' : 'No'}
                    </Typography>
                    <Typography variant="body2">
                      Paid: {exp.isPaid ? 'Yes' : 'No'}
                    </Typography>
                    {exp.notes && (
                      <Typography variant="body2" mt={1}>
                        📝 {exp.notes}
                      </Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </AccordionDetails>
          </Accordion>
        ) : null
      )}

      {/* Modal */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add Expenditure</DialogTitle>
        <DialogContent>
          <TextField
            label="Title"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            margin="normal"
          />
          <TextField
            label="Amount"
            fullWidth
            type="number"
            value={amount}
            onFocus={(e) => e.target.select()}
            onChange={(e) =>
              setAmount(e.target.value === '' ? '' : Number(e.target.value))
            }
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              label="Type"
              onChange={(e) => setType(e.target.value)}
            >
              <MenuItem value="fixed">Fixed</MenuItem>
              <MenuItem value="variable">Variable</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Category"
            fullWidth
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Recurring</InputLabel>
            <Select
              value={isRecurring ? 'yes' : 'no'}
              label="Recurring"
              onChange={(e) => setIsRecurring(e.target.value === 'yes')}
            >
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Paid</InputLabel>
            <Select
              value={isPaid ? 'yes' : 'no'}
              label="Paid"
              onChange={(e) => setIsPaid(e.target.value === 'yes')}
            >
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Notes"
            fullWidth
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            margin="normal"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="success"
            disabled={!title || amount === ''}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
