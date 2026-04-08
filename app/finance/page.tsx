'use client';

import React from 'react';
import Link from 'next/link';
import {
  Box,
  Typography,
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

  if (!user) return null;

  // 🔥 Updated Cards (Navigation Only)
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

        <Box
          display="grid"
          gridTemplateColumns={{
            xs: '1fr',
            sm: '1fr 1fr',
          }}
          gap={3}
        >
          {cardData.map((card, idx) => {
            const bgColor = theme?.mode === 'dark' ? card.darkBg : card.lightBg;

            const bubbleColor =
              theme?.mode === 'dark' ? card.darkBubble : card.lightBubble;

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
                    '&:hover': {
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
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
                      <Box>{card.icon}</Box>
                      <Box>
                        <Typography variant="h6" fontWeight="bold">
                          {card.title}
                        </Typography>
                        <Typography variant="body2">
                          {card.description}
                        </Typography>
                      </Box>
                    </Stack>

                    <Link href={card.href}>
                      <Button
                        fullWidth
                        endIcon={<ArrowOutwardIcon />}
                        sx={{ mt: 2 }}
                      >
                        Open
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </Fade>
            );
          })}
        </Box>
      </Box>
    </Container>
  );
}
