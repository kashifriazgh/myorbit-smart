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
import { IncomeSource } from '@/app/lib/interface';

const FREQUENCIES = ['monthly', 'weekly', 'daily', 'one_time'] as const;

export default function IncomeSourcesComponent({ userId }: { userId: string }) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const muiTheme = useTheme();

  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [frequency, setFrequency] = useState('monthly');
  const [isRecurring, setIsRecurring] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchSources = async () => {
      const querySnapshot = await getDocs(collection(db, 'incomeSources'));
      const docs = querySnapshot.docs
        .map((doc) => {
          const data = doc.data() as IncomeSource;
          return {
            ...data,
            id: doc.id,
            createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
          };
        })
        .filter((doc) => doc.userId === userId);
      setIncomeSources(docs);
      setLoading(false);
    };
    fetchSources();
  }, [userId]);

  const totalAmount = incomeSources.reduce((sum, i) => sum + i.amount, 0);

  const groupedByFrequency: Record<string, IncomeSource[]> =
    incomeSources.reduce((acc, source) => {
      const freq = source.frequency;
      if (!acc[freq]) acc[freq] = [];
      acc[freq].push(source);
      return acc;
    }, {} as Record<string, IncomeSource[]>);

  const handleSave = async () => {
    if (!title || !amount) return;
    const now = new Date();
    const newIncome: IncomeSource = {
      userId,
      title,
      amount: Number(amount),
      frequency: frequency as IncomeSource['frequency'],
      isRecurring,
      notes,
      createdAt: now,
      updatedAt: now,
    };

    await addDoc(collection(db, 'incomeSources'), {
      ...newIncome,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setIncomeSources((prev) => [...prev, newIncome]);
    setOpenModal(false);
    setTitle('');
    setAmount('');
    setFrequency('monthly');
    setIsRecurring(true);
    setNotes('');
  };

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
          Income Sources
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setOpenModal(true)}
        >
          + Add Income
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
        Total Income Sources ({incomeSources.length}) – Rs{' '}
        {totalAmount.toLocaleString()}
      </Typography>

      {/* Grouped Display */}
      {Object.entries(groupedByFrequency).map(([freq, sources]) => (
        <Accordion key={freq} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="bold" fontSize="1rem">
              {freq.charAt(0).toUpperCase() + freq.slice(1)} Income (
              {sources.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {sources.map((item, idx) => (
              <Accordion
                key={idx}
                sx={{ mb: 1, backgroundColor: isDark ? '#1f2937' : '#f5f5f5' }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight="medium">
                    {item.title} –{' '}
                    <Typography
                      component="span"
                      fontWeight="bold"
                      fontSize="1.1rem"
                    >
                      Rs {item.amount.toLocaleString()}
                    </Typography>
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary">
                    Frequency: {item.frequency}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Recurring: {item.isRecurring ? 'Yes' : 'No'}
                  </Typography>
                  {item.notes && (
                    <Typography variant="body2" mt={1}>
                      📝 {item.notes}
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Modal */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add Income Source</DialogTitle>
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
            <InputLabel>Frequency</InputLabel>
            <Select
              value={frequency}
              label="Frequency"
              onChange={(e) => setFrequency(e.target.value)}
            >
              {FREQUENCIES.map((freq) => (
                <MenuItem key={freq} value={freq}>
                  {freq}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
