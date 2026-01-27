'use client';

import {
  Box,
  Typography,
  Button,
  Container,
  Card,
  CardContent,
  Chip,
  Stack,
  Skeleton,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { LoanRecord } from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function LoanRecordsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeLoans, setActiveLoans] = useState<LoanRecord[]>([]);
  const [settledLoans, setSettledLoans] = useState<LoanRecord[]>([]);
  const [totals, setTotals] = useState({ toPay: 0, toReceive: 0 });

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const fetchLoans = async () => {
      try {
        const q = query(
          collection(db, 'loans'),
          where('userId', '==', user.uid)
        );

        const snap = await getDocs(q);

        const loans: LoanRecord[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<LoanRecord, 'id'>),
        }));

        const outstanding = loans.filter((l) => !l.isSettled);
        const settled = loans.filter((l) => l.isSettled);

        setActiveLoans(outstanding);
        setSettledLoans(settled);

        const toPay = outstanding
          .filter((l) => l.type === 'lend')
          .reduce((sum, l) => sum + (l.amount ?? 0), 0);

        const toReceive = outstanding
          .filter((l) => l.type === 'borrow')
          .reduce((sum, l) => sum + (l.amount ?? 0), 0);

        setTotals({ toPay, toReceive });
      } catch (err) {
        console.error('Error fetching loans:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLoans();
  }, [user]);

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Please log in to view loan records.</Typography>
      </Container>
    );
  }

  // ✅ Properly typed (no `any`)
  const formatDate = (
    date?: Date | Timestamp | null
  ): string => {
    if (!date) return 'N/A';

    if (date instanceof Date) {
      return date.toLocaleDateString();
    }

    if (date instanceof Timestamp) {
      return date.toDate().toLocaleDateString();
    }

    return 'N/A';
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Link href="/finance" passHref>
          <Button
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            sx={{ textTransform: 'none' }}
          >
            Back
          </Button>
        </Link>
        <Typography variant="h4" fontWeight="bold">
          Loan Records
        </Typography>
      </Box>

      {/* Totals Summary */}
      {loading ? (
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Skeleton variant="rectangular" width="100%" height={100} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <Card
            sx={{
              flex: 1,
              minWidth: 200,
              background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Total To Pay Back
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                ₨{totals.toPay.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>

          <Card
            sx={{
              flex: 1,
              minWidth: 200,
              background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Total To Receive
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                ₨{totals.toReceive.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Active Loans */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Active Loans ({activeLoans.length})
        </Typography>

        {loading ? (
          <Stack spacing={2}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={100} />
            ))}
          </Stack>
        ) : activeLoans.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary" textAlign="center" py={2}>
                No active loans found.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {activeLoans.map((loan) => (
              <Card
                key={loan.id}
                sx={{
                  border: '1px solid #e0e0e0',
                  backgroundColor:
                    loan.type === 'borrow' ? '#fff3e0' : '#e8f5e8',
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight="bold">
                        {loan.counterparty}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {loan.type === 'borrow' ? 'You borrowed' : 'You lent'} •
                        Due: {formatDate(loan.dueDate)}
                      </Typography>
                      {loan.note && (
                        <Typography variant="body2" color="text.secondary" mt={1}>
                          Note: {loan.note}
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" fontWeight="bold">
                        ₨{loan.amount?.toLocaleString()}
                      </Typography>
                      <Chip
                        label={loan.type === 'borrow' ? 'Borrow' : 'Lend'}
                        color={loan.type === 'borrow' ? 'warning' : 'success'}
                        size="small"
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      {/* Settled Loans */}
      {settledLoans.length > 0 && (
        <Box>
          <Typography variant="h6" fontWeight="bold" mb={2}>
            Settled Loans ({settledLoans.length})
          </Typography>
          <Stack spacing={2}>
            {settledLoans.map((loan) => (
              <Card key={loan.id} sx={{ opacity: 0.7 }}>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight="bold">
                        {loan.counterparty}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {loan.type === 'borrow' ? 'You borrowed' : 'You lent'} •
                        Due: {formatDate(loan.dueDate)}
                      </Typography>
                    </Box>

                    <Box sx={{ textAlign: 'right' }}>
                      <Typography
                        variant="h6"
                        sx={{ textDecoration: 'line-through' }}
                      >
                        ₨{loan.amount?.toLocaleString()}
                      </Typography>
                      <Chip label="Settled" size="small" />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
    </Container>
  );
}
