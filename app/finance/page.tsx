'use client';

import React from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Container,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  Stack,
  Fade,
} from '@mui/material';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

import TotalCashSnapshotComponent from '../components/finance/TotalCashSnapshot';
import { useAuth } from '../lib/context/userContext';
import { useCustomTheme } from '../lib/context/themeContext';
import CashFlowChart from '../components/finance/CashFlowChart';

export default function Finance() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const isDark = theme?.mode === 'dark';

  if (!user) return null;

  const cardData = [
    {
      title: 'Income Sources',
      href: '/finance/income-sources',
      description: 'Manage your income streams',
      icon: <TrendingUpIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
      darkBg: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
      lightBubble: '#b2ebf2',
      darkBubble: '#1e293b',
      lightText: '#0f172a',
      darkText: '#f1f5f9',
      lightSubText: '#334155',
      darkSubText: '#94a3b8',
    },
    {
      title: 'Expenditures',
      href: '/finance/expenditures',
      description: 'Track your expenses',
      icon: <TrendingDownIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)',
      darkBg: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
      lightBubble: '#f8bbd0',
      darkBubble: '#374151',
      lightText: '#0f172a',
      darkText: '#f1f5f9',
      lightSubText: '#334155',
      darkSubText: '#94a3b8',
    },
    {
      title: 'Shopping List',
      href: '/finance/things-to-buy',
      description: 'Plan your purchases',
      icon: <ShoppingCartIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #f3e5f5 0%, #ce93d8 100%)',
      darkBg: 'linear-gradient(135deg, #3f3f46 0%, #27272a 100%)',
      lightBubble: '#ce93d8',
      darkBubble: '#27272a',
      lightText: '#0f172a',
      darkText: '#f1f5f9',
      lightSubText: '#334155',
      darkSubText: '#94a3b8',
    },
    {
      title: 'Loans',
      href: '/finance/loans',
      description: 'Manage loans & debts',
      icon: <AccountBalanceIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #e8f5e9 0%, #a5d6a7 100%)',
      darkBg: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
      lightBubble: '#a5d6a7',
      darkBubble: '#111827',
      lightText: '#0f172a',
      darkText: '#f1f5f9',
      lightSubText: '#334155',
      darkSubText: '#94a3b8',
    },
  ];

  return (
    <div
      style={{
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#0f172a',
        minHeight: '100vh',
      }}
    >
      <Container maxWidth="md" sx={{ py: 4 }}>
        <TotalCashSnapshotComponent userId={user.uid} />
        <CashFlowChart />

        <div className="mt-8">
          <p
            className="text-lg font-bold mb-4"
            style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
          >
            Budget Sections
          </p>

          <div
            className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}
          >
            {cardData.map((card, idx) => {
              const bgColor = isDark ? card.darkBg : card.lightBg;
              const bubbleColor = isDark ? card.darkBubble : card.lightBubble;
              const titleColor = isDark ? card.darkText : card.lightText;
              const subColor = isDark ? card.darkSubText : card.lightSubText;

              return (
                <Fade in timeout={300 + idx * 100} key={idx}>
                  <Card
                    sx={{
                      position: 'relative',
                      background: bgColor,
                      borderRadius: 3,
                      minHeight: isMobile ? 180 : 200,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      transition: '0.3s',
                      boxShadow: isDark
                        ? '0 2px 12px rgba(0,0,0,0.4)'
                        : '0 2px 12px rgba(0,0,0,0.08)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                      },
                    }}
                  >
                    {/* Decorative bubble */}
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
                      }}
                    />

                    <CardContent
                      sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Stack direction="row" spacing={2}>
                        {/* Icon */}
                        <Box style={{ color: titleColor }}>{card.icon}</Box>

                        <Box>
                          <p
                            className="text-base font-bold"
                            style={{ color: titleColor }}
                          >
                            {card.title}
                          </p>
                          <p
                            className="text-sm mt-0.5"
                            style={{ color: subColor }}
                          >
                            {card.description}
                          </p>
                        </Box>
                      </Stack>

                      <Link href={card.href}>
                        <Button
                          fullWidth
                          endIcon={<ArrowOutwardIcon />}
                          sx={{
                            mt: 2,
                            color: isDark ? '#93c5fd' : undefined,
                            borderColor: isDark
                              ? 'rgba(147,197,253,0.4)'
                              : undefined,
                            '&:hover': {
                              backgroundColor: isDark
                                ? 'rgba(147,197,253,0.1)'
                                : undefined,
                            },
                          }}
                        >
                          Open
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </Fade>
              );
            })}
          </div>
        </div>
      </Container>
    </div>
  );
}
