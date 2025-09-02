'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Box,
  Typography,
  Button,
  Container,
  useMediaQuery,
  useTheme,
  CircularProgress,
} from '@mui/material';
import FinancialCheckPoints from '../components/finance/FinancialCheckPoints';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import TotalCashSnapshotComponent from '../components/finance/TotalCashSnapshot';
import { useAuth } from '../lib/context/userContext';
import { useCustomTheme } from '../lib/context/themeContext';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import PaidUnPaidChart from '../components/finance/PaidUnPaidChart';
import CashFlowChart from '../components/finance/CashFlowChart';

export default function Finance() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);

  const [incomeData, setIncomeData] = useState({ paid: 0, unpaid: 0 });
  const [expenseData, setExpenseData] = useState({ paid: 0, unpaid: 0 });
  const [shoppingData, setShoppingData] = useState({ paid: 0, unpaid: 0 });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [expenditureSnap, incomeSnap, shoppingSnap] = await Promise.all([
        getDocs(collection(db, 'expenditures')),
        getDocs(collection(db, 'incomeSources')),
        getDocs(collection(db, 'buyItems')), // Replace with your collection name if different
      ]);

      const userId = user.uid;

      // Income calculations
      let paidIncome = 0;
      let unpaidIncome = 0;

      incomeSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.userId === userId) {
          if (d.isReceived) paidIncome += d.amount || 0;
          else unpaidIncome += d.amount || 0;
        }
      });

      // Expenditure calculations
      let paidExp = 0;
      let unpaidExp = 0;

      expenditureSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.userId === userId) {
          if (d.isPaid) paidExp += d.amount || 0;
          else unpaidExp += d.amount || 0;
        }
      });

      // Shopping list calculations (last 6 months)
      let purchasedPrice = 0;
      let estimatedPrice = 0;
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      shoppingSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.userId !== userId) return;

        const createdAt =
          d.createdAt?.toDate?.() || new Date(d.createdAt) || new Date();
        if (createdAt < sixMonthsAgo) return;

        const items = d.items || [];

        items.forEach((item) => {
          if (item.isPurchased) {
            purchasedPrice += item.purchasedPrice ?? item.estimatedPrice ?? 0;
          } else {
            estimatedPrice += item.estimatedPrice ?? 0;
          }
        });
      });

      setIncomeData({ paid: paidIncome, unpaid: unpaidIncome });
      setExpenseData({ paid: paidExp, unpaid: unpaidExp });
      setShoppingData({ paid: purchasedPrice, unpaid: estimatedPrice });

      setLoading(false);
    };

    fetchData();
  }, [user]);

  if (!user) return null;

  const cardData: {
    title: string;
    href: string;
    description: string;
    lightBg: string;
    darkBg: string;
    lightBubble: string;
    darkBubble: string;
    chartType?: 'income' | 'expense' | 'shopping';
    chartData?: { paid: number; unpaid: number };
  }[] = [
    {
      title: 'Income Sources',
      chartType: 'income',
      chartData: incomeData,
      href: '/finance/income-sources',
      description:
        'Add and track your recurring and one-time income streams with ease.',
      lightBg: '#e0f7fa',
      darkBg: '#334155',
      lightBubble: '#b2ebf2',
      darkBubble: '#1e293b',
    },
    {
      title: 'Expenditures',
      chartType: 'expense',
      chartData: expenseData,
      href: '/finance/expenditures',
      description:
        'Add and monitor your fixed and variable expenses effectively.',
      lightBg: '#fce4ec',
      darkBg: '#4b5563',
      lightBubble: '#f8bbd0',
      darkBubble: '#374151',
    },
    {
      title: 'Shopping List',
      chartType: 'shopping',
      chartData: shoppingData,
      href: '/finance/things-to-buy',
      description:
        'Track purchased vs pending items and their costs across shopping plans.',
      lightBg: '#f3e5f5',
      darkBg: '#3f3f46',
      lightBubble: '#ce93d8',
      darkBubble: '#27272a',
    },
  ];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <TotalCashSnapshotComponent userId={user.uid} />
      <CashFlowChart />
      <FinancialCheckPoints />

      <Box mt={4}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Budget Sections
        </Typography>

        {loading ? (
          <Box textAlign="center" py={5}>
            <CircularProgress />
          </Box>
        ) : (
          <Box
            display="grid"
            gridTemplateColumns={{
              xs: '1fr',
              sm: '1fr 1fr',
              md: '1fr 1fr 1fr',
            }}
            gap={1}
          >
            {cardData.map((card, idx) => {
              const bgColor =
                theme?.mode === 'dark' ? card.darkBg : card.lightBg;
              const bubbleColor =
                theme?.mode === 'dark' ? card.darkBubble : card.lightBubble;

              return (
                <Box
                  key={idx}
                  sx={{
                    position: 'relative',
                    backgroundColor: bgColor,
                    borderRadius: 1.5,
                    p: 2,
                    minHeight: isMobile ? 200 : 180,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* Decorative Bubble */}
                  <Box
                    sx={{
                      position: 'absolute',
                      width: 100,
                      height: 100,
                      top: -20,
                      right: -20,
                      backgroundColor: bubbleColor,
                      borderRadius: '50%',
                      opacity: 0.25,
                      zIndex: 0,
                    }}
                  />

                  {/* Chart */}
                  {card.chartData && card.chartData.paid !== undefined && (
                    <Box position="relative" zIndex={1} mb={1}>
                      <PaidUnPaidChart
                        title={isMobile ? '' : 'Overview'}
                        paidValue={card.chartData.paid}
                        unpaidValue={card.chartData.unpaid}
                        type={card.chartType}
                      />
                    </Box>
                  )}

                  {/* Content */}
                  <Box position="relative" zIndex={1}>
                    <Typography variant="subtitle2" fontWeight="bold" mb={0.5}>
                      {card.title}
                    </Typography>

                    {!isMobile && (
                      <Typography
                        variant="body2"
                        sx={{
                          mb: 1,
                          fontSize: '0.85rem',
                          color:
                            theme?.mode === 'dark'
                              ? '#cbd5e1'
                              : 'text.secondary',
                        }}
                      >
                        {card.description}
                      </Typography>
                    )}

                    <Link href={card.href} passHref>
                      <Button
                        size="small"
                        variant="outlined"
                        endIcon={<ArrowOutwardIcon fontSize="small" />}
                        sx={{
                          fontSize: '0.75rem',
                          textTransform: 'none',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 2,
                        }}
                      >
                        Link
                      </Button>
                    </Link>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Container>
  );
}
