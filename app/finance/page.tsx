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
  Card,
  CardContent,
  Chip,
  Stack,
  Fade,
} from '@mui/material';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TotalCashSnapshotComponent from '../components/finance/TotalCashSnapshot';
import { useAuth } from '../lib/context/userContext';
import { useCustomTheme } from '../lib/context/themeContext';
import { db } from '../lib/firebase';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import PaidUnPaidChart from '../components/finance/PaidUnPaidChart';
import CashFlowChart from '../components/finance/CashFlowChart';

export default function Finance() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);

  const [incomeData, setIncomeData] = useState({
    paid: 0,
    unpaid: 0,
    total: 0,
  });
  const [expenseData, setExpenseData] = useState({
    paid: 0,
    unpaid: 0,
    total: 0,
  });
  const [shoppingData, setShoppingData] = useState({
    paid: 0,
    unpaid: 0,
    total: 0,
  });
  const [hasData, setHasData] = useState({
    income: false,
    expense: false,
    shopping: false,
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [expenditureSnap, incomeSnap, shoppingSnap] = await Promise.all([
        getDocs(collection(db, 'expenditures')),
        getDocs(collection(db, 'incomeSources')),
        getDocs(collection(db, 'buyItems')), // Replace with your collection name if different
      ]);

      const userId = user.uid;

      // Income calculations - matching the component logic
      let paidIncome = 0;
      let unpaidIncome = 0;
      let totalIncome = 0;
      let hasIncomeData = false;

      incomeSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.userId === userId) {
          hasIncomeData = true;
          const amount = d.amount || 0;
          totalIncome += amount;

          // For recurring incomes, check if they should be reset (like in context)
          if (d.type === 'recurring' && d.isReceived && d.lastReceivedDate) {
            const lastReceived =
              d.lastReceivedDate instanceof Timestamp
                ? d.lastReceivedDate.toDate()
                : new Date(d.lastReceivedDate);
            const today = new Date();
            const daysDiff = Math.floor(
              (today.getTime() - lastReceived.getTime()) / (1000 * 60 * 60 * 24)
            );

            let shouldReset = false;
            switch (d.frequency) {
              case 'daily':
                shouldReset = daysDiff >= 1;
                break;
              case 'weekly':
                shouldReset = daysDiff >= 7;
                break;
              case 'monthly':
                shouldReset = daysDiff >= 30;
                break;
            }

            if (shouldReset) {
              unpaidIncome += amount;
            } else {
              paidIncome += amount;
            }
          } else if (d.isReceived) {
            paidIncome += amount;
          } else {
            unpaidIncome += amount;
          }
        }
      });

      // Expenditure calculations - matching the component logic
      let paidExp = 0;
      let unpaidExp = 0;
      let totalExp = 0;
      let hasExpenseData = false;

      expenditureSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.userId === userId) {
          hasExpenseData = true;
          const amount = d.amount || 0;
          totalExp += amount;

          // For recurring expenses, check if they should be reset (like in context)
          if (d.type === 'recurring' && d.isPaid && d.lastPaidDate) {
            const lastPaid =
              d.lastPaidDate instanceof Timestamp
                ? d.lastPaidDate.toDate()
                : new Date(d.lastPaidDate);
            const today = new Date();
            const daysDiff = Math.floor(
              (today.getTime() - lastPaid.getTime()) / (1000 * 60 * 60 * 24)
            );

            let shouldReset = false;
            switch (d.frequency) {
              case 'daily':
                shouldReset = daysDiff >= 1;
                break;
              case 'weekly':
                shouldReset = daysDiff >= 7;
                break;
              case 'monthly':
                shouldReset = daysDiff >= 30;
                break;
            }

            if (shouldReset) {
              unpaidExp += amount;
            } else {
              paidExp += amount;
            }
          } else if (d.type === 'recurring') {
            // All recurring expenses are included
            if (d.isPaid) paidExp += amount;
            else unpaidExp += amount;
          } else if (d.type === 'one-time' && !d.isPaid) {
            // Only unpaid one-time expenses
            unpaidExp += amount;
          }
        }
      });

      // Shopping list calculations (last 6 months)
      let purchasedPrice = 0;
      let estimatedPrice = 0;
      let totalShopping = 0;
      let hasShoppingData = false;
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      shoppingSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.userId !== userId) return;

        const createdAt =
          d.createdAt?.toDate?.() || new Date(d.createdAt) || new Date();
        if (createdAt < sixMonthsAgo) return;

        const items = d.items || [];
        if (items.length > 0) hasShoppingData = true;

        items.forEach((item) => {
          if (item.isPurchased) {
            const price = item.purchasedPrice ?? item.estimatedPrice ?? 0;
            purchasedPrice += price;
            totalShopping += price;
          } else {
            const price = item.estimatedPrice ?? 0;
            estimatedPrice += price;
            totalShopping += price;
          }
        });
      });

      setIncomeData({
        paid: paidIncome,
        unpaid: unpaidIncome,
        total: totalIncome,
      });
      setExpenseData({ paid: paidExp, unpaid: unpaidExp, total: totalExp });
      setShoppingData({
        paid: purchasedPrice,
        unpaid: estimatedPrice,
        total: totalShopping,
      });
      setHasData({
        income: hasIncomeData,
        expense: hasExpenseData,
        shopping: hasShoppingData,
      });

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
    icon: React.ReactNode;
    chartType?: 'income' | 'expense' | 'shopping';
    chartData?: { paid: number; unpaid: number; total: number };
    hasData: boolean;
    emptyMessage: string;
    emptySubMessage: string;
  }[] = [
    {
      title: 'Income Sources',
      chartType: 'income',
      chartData: incomeData,
      hasData: hasData.income,
      href: '/finance/income-sources',
      description:
        'Add and track your recurring and one-time income streams with ease.',
      emptyMessage: 'Start Your Income Journey',
      emptySubMessage: 'Track your earnings and build financial stability',
      icon: <TrendingUpIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
      darkBg: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
      lightBubble: '#b2ebf2',
      darkBubble: '#1e293b',
    },
    {
      title: 'Expenditures',
      chartType: 'expense',
      chartData: expenseData,
      hasData: hasData.expense,
      href: '/finance/expenditures',
      description:
        'Add and monitor your fixed and variable expenses effectively.',
      emptyMessage: 'Take Control of Expenses',
      emptySubMessage: 'Track your spending and optimize your budget',
      icon: <TrendingDownIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)',
      darkBg: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
      lightBubble: '#f8bbd0',
      darkBubble: '#374151',
    },
    {
      title: 'Shopping List',
      chartType: 'shopping',
      chartData: shoppingData,
      hasData: hasData.shopping,
      href: '/finance/things-to-buy',
      description:
        'Track purchased vs pending items and their costs across shopping plans.',
      emptyMessage: 'Smart Shopping Starts Here',
      emptySubMessage: 'Plan your purchases and track your spending',
      icon: <ShoppingCartIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #f3e5f5 0%, #ce93d8 100%)',
      darkBg: 'linear-gradient(135deg, #3f3f46 0%, #27272a 100%)',
      lightBubble: '#ce93d8',
      darkBubble: '#27272a',
    },
  ];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <TotalCashSnapshotComponent userId={user.uid} />
      <CashFlowChart />

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
            gap={3}
          >
            {cardData.map((card, idx) => {
              const bgColor =
                theme?.mode === 'dark' ? card.darkBg : card.lightBg;
              const bubbleColor =
                theme?.mode === 'dark' ? card.darkBubble : card.lightBubble;

              return (
                <Fade in={true} timeout={300 + idx * 100} key={idx}>
                  <Card
                    sx={{
                      position: 'relative',
                      background: bgColor,
                      borderRadius: 3,
                      minHeight: isMobile ? 280 : 320,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      boxShadow:
                        theme?.mode === 'dark'
                          ? '0 8px 32px rgba(0,0,0,0.3)'
                          : '0 8px 32px rgba(0,0,0,0.1)',
                      border:
                        theme?.mode === 'dark'
                          ? '1px solid rgba(255,255,255,0.1)'
                          : '1px solid rgba(0,0,0,0.05)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow:
                          theme?.mode === 'dark'
                            ? '0 12px 40px rgba(0,0,0,0.4)'
                            : '0 12px 40px rgba(0,0,0,0.15)',
                      },
                    }}
                  >
                    {/* Decorative Elements */}
                    <Box
                      sx={{
                        position: 'absolute',
                        width: 120,
                        height: 120,
                        top: -30,
                        right: -30,
                        background: bubbleColor,
                        borderRadius: '50%',
                        opacity: 0.15,
                        zIndex: 0,
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        width: 80,
                        height: 80,
                        bottom: -20,
                        left: -20,
                        background: bubbleColor,
                        borderRadius: '50%',
                        opacity: 0.1,
                        zIndex: 0,
                      }}
                    />

                    <CardContent
                      sx={{
                        position: 'relative',
                        zIndex: 1,
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {/* Header */}
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={2}
                        mb={2}
                      >
                        <Box
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            background:
                              theme?.mode === 'dark'
                                ? 'rgba(255,255,255,0.1)'
                                : 'rgba(255,255,255,0.7)',
                            color: theme?.mode === 'dark' ? '#fff' : '#333',
                          }}
                        >
                          {card.icon}
                        </Box>
                        <Box>
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            sx={{ mb: 0.5 }}
                          >
                            {card.title}
                          </Typography>
                          {card.hasData && card.chartData && (
                            <Chip
                              label={`Rs ${card.chartData.total.toLocaleString()}`}
                              size="small"
                              sx={{
                                background:
                                  theme?.mode === 'dark'
                                    ? 'rgba(255,255,255,0.2)'
                                    : 'rgba(255,255,255,0.8)',
                                color: theme?.mode === 'dark' ? '#fff' : '#333',
                                fontWeight: 'bold',
                              }}
                            />
                          )}
                        </Box>
                      </Stack>

                      {/* Content */}
                      {card.hasData ? (
                        <>
                          {/* Chart */}
                          {card.chartData && (
                            <Box mb={2} flex={1}>
                              <PaidUnPaidChart
                                title="Overview"
                                paidValue={card.chartData.paid}
                                unpaidValue={card.chartData.unpaid}
                                type={card.chartType}
                              />
                            </Box>
                          )}

                          {/* Stats */}
                          <Stack direction="row" spacing={2} mb={2}>
                            <Box textAlign="center" flex={1}>
                              <Typography
                                variant="h6"
                                fontWeight="bold"
                                color="success.main"
                              >
                                Rs {card.chartData?.paid.toLocaleString() || 0}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {card.chartType === 'income'
                                  ? 'Received'
                                  : card.chartType === 'expense'
                                  ? 'Paid'
                                  : 'Purchased'}
                              </Typography>
                            </Box>
                            <Box textAlign="center" flex={1}>
                              <Typography
                                variant="h6"
                                fontWeight="bold"
                                color="warning.main"
                              >
                                Rs{' '}
                                {card.chartData?.unpaid.toLocaleString() || 0}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {card.chartType === 'income'
                                  ? 'Pending'
                                  : card.chartType === 'expense'
                                  ? 'Unpaid'
                                  : 'Pending'}
                              </Typography>
                            </Box>
                          </Stack>
                        </>
                      ) : (
                        /* Empty State */
                        <Box
                          flex={1}
                          display="flex"
                          flexDirection="column"
                          alignItems="center"
                          justifyContent="center"
                          textAlign="center"
                          py={3}
                        >
                          <AttachMoneyIcon
                            sx={{
                              fontSize: 48,
                              opacity: 0.3,
                              mb: 2,
                              color: theme?.mode === 'dark' ? '#fff' : '#333',
                            }}
                          />
                          <Typography variant="h6" fontWeight="bold" mb={1}>
                            {card.emptyMessage}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            mb={2}
                          >
                            {card.emptySubMessage}
                          </Typography>
                        </Box>
                      )}

                      {/* Action Button */}
                      <Link href={card.href} passHref>
                        <Button
                          fullWidth
                          variant="contained"
                          endIcon={<ArrowOutwardIcon />}
                          sx={{
                            mt: 'auto',
                            py: 1.5,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 'bold',
                            background:
                              theme?.mode === 'dark'
                                ? 'rgba(255,255,255,0.1)'
                                : 'rgba(255,255,255,0.9)',
                            color: theme?.mode === 'dark' ? '#fff' : '#333',
                            '&:hover': {
                              background:
                                theme?.mode === 'dark'
                                  ? 'rgba(255,255,255,0.2)'
                                  : 'rgba(255,255,255,1)',
                            },
                          }}
                        >
                          {card.hasData ? 'View Details' : 'Get Started'}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </Fade>
              );
            })}
          </Box>
        )}
      </Box>
    </Container>
  );
}
