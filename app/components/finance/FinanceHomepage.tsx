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
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PieChartOutlineIcon from '@mui/icons-material/PieChartOutline';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CalculateIcon from '@mui/icons-material/Calculate';

import TotalCashSnapshotComponent from './TotalCashSnapshot';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function FinanceHomepage() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const isDark = theme?.mode === 'dark';

  if (!user) return null;

  const cardData = [
    {
      title: 'Can I Purchase?',
      href: '/finance/affordability',
      description: 'کیا میں خرید سکتا ہوں؟ Check safe spending limit',
      icon: <CalculateIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #ede9fe 0%, #c7d2fe 100%)',
      darkBg: 'linear-gradient(135deg, #312e81 0%, #0f172a 100%)',
      lightBubble: '#c7d2fe',
      darkBubble: '#312e81',
      lightText: '#0f172a',
      darkText: '#f1f5f9',
      lightSubText: '#334155',
      darkSubText: '#94a3b8',
    },
    {
      title: 'Budget Allocation',
      href: '/finance/budget',
      description: 'Allocate monthly income across expenses & savings',
      icon: <PieChartOutlineIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%)',
      darkBg: 'linear-gradient(135deg, #115e59 0%, #0f172a 100%)',
      lightBubble: '#99f6e4',
      darkBubble: '#115e59',
      lightText: '#0f172a',
      darkText: '#f1f5f9',
      lightSubText: '#334155',
      darkSubText: '#94a3b8',
    },
    {
      title: 'View Wallets',
      href: '/finance/wallets',
      description: 'Manage cash, bank, mobile & virtual wallets',
      icon: <AccountBalanceWalletIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)',
      darkBg: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
      lightBubble: '#bfdbfe',
      darkBubble: '#1e3a8a',
      lightText: '#0f172a',
      darkText: '#f1f5f9',
      lightSubText: '#334155',
      darkSubText: '#94a3b8',
    },
    {
      title: 'Expenses & Bills',
      href: '/finance/expenses',
      description: 'Track recurring bills and monthly expenses',
      icon: <ReceiptLongIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
      darkBg: 'linear-gradient(135deg, #881337 0%, #1e1b4b 100%)',
      lightBubble: '#fecaca',
      darkBubble: '#881337',
      lightText: '#0f172a',
      darkText: '#f1f5f9',
      lightSubText: '#334155',
      darkSubText: '#94a3b8',
    },
    {
      title: 'Income Sources',
      href: '/finance/income-sources',
      description: 'Manage active & proposed income streams',
      icon: <MonetizationOnIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)',
      darkBg: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
      lightBubble: '#86efac',
      darkBubble: '#022c22',
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
    {
      title: 'Guide & Sandbox',
      href: '/finance/tutorial',
      description: 'Interactive tutorial & sandbox guide',
      icon: <HelpOutlineIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
      darkBg: 'linear-gradient(135deg, #303643 0%, #1e293b 100%)',
      lightBubble: '#bae6fd',
      darkBubble: '#1e293b',
      lightText: '#0f172a',
      darkText: '#f1f5f9',
      lightSubText: '#334155',
      darkSubText: '#94a3b8',
    },
    {
      title: 'Urdu Money eBook',
      href: '/finance/ebook',
      description: '11-chapter Urdu guide on managing money & expenses',
      icon: <MenuBookIcon sx={{ fontSize: 28 }} />,
      lightBg: 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%)',
      darkBg: 'linear-gradient(135deg, #065f46 0%, #0f172a 100%)',
      lightBubble: '#a7f3d0',
      darkBubble: '#065f46',
      lightText: '#0f172a',
      darkText: '#f1f5f9',
      lightSubText: '#334155',
      darkSubText: '#94a3b8',
    },
  ];

  return (
    <div
      style={{
        backgroundColor: isDark ? '#181c24' : '#f1f5f9',
        color: isDark ? '#f1f5f9' : '#0f172a',
        minHeight: '100vh',
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 2.5 } }}>
        <TotalCashSnapshotComponent userId={user.uid} />

        <div
          className={`mt-4 rounded-3xl border p-4 sm:p-5 transition-colors ${
            isDark
              ? 'border-white/10 bg-[#1f2430] text-white shadow-xl'
              : 'border-slate-200 bg-white text-slate-900 shadow-sm'
          }`}
        >
          <p
            className="text-base sm:text-lg font-bold mb-3.5"
            style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
          >
            Budget Sections
          </p>

          <div className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
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

