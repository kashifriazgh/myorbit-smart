'use client';

import React from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Container,
  Typography,
  Card,
  CardContent,
  Stack,
  Fab,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { useCustomTheme } from '../../lib/context/themeContext';

export default function FinanceTutorial() {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  return (
    <div style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', color: isDark ? '#f1f5f9' : '#0f172a', minHeight: '100vh' }}>
      <Container maxWidth="md" sx={{ py: 5 }}>
        
        {/* Top Navigation */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
          <Link href="/finance" style={{ textDecoration: 'none' }}>
            <Button startIcon={<ArrowBackIcon />} variant="outlined" sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}>
              Back to Finance
            </Button>
          </Link>
          <Typography variant="h5" fontWeight={900} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HelpOutlineIcon color="primary" /> Quick Visual Guide
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" mb={4} sx={{ maxWidth: 600 }}>
          This visual guide shows you exactly how cash management, transfers, loans, and liabilities function with direct inline previews of the interface.
        </Typography>

        <Stack spacing={4}>

          {/* 1. Add Funds */}
          <Card sx={{ borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, bgcolor: isDark ? '#1e293b' : '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="800" color="primary" mb={2}>
                1. Add Funds (e.g. PKR 1,000)
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, lineHeight: 1.6 }}>
                Suppose you start at <strong>PKR 0</strong>. To add money, click the floating 
                <Fab size="small" color="primary" sx={{ width: 28, height: 28, minHeight: 'unset', mx: 1, pointerEvents: 'none' }}><AddIcon sx={{ fontSize: 16 }} /></Fab> 
                button, then click the green 
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.2, py: 0.4, mx: 1, borderRadius: 99, bgcolor: '#22c55e', color: '#fff', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  <AddCircleOutlineIcon sx={{ fontSize: 14 }} /> Add Money
                </Box>
                button. Select <strong>Cash in Hand</strong>, enter <strong>1000</strong>, and click <strong>Add Fund</strong>.
              </Typography>
              
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block" mb={1}>
                REAL BALANCE PREVIEW:
              </Typography>
              <Box display="inline-flex" p={2} borderRadius={3} sx={{ background: isDark ? 'rgba(20,184,166,0.1)' : '#f0fdfa', border: '1px solid #99f6e4' }}>
                <Box>
                  <Typography variant="caption" fontWeight="bold" color={isDark ? '#2dd4bf' : '#0f766e'}>OVERALL TOTAL</Typography>
                  <Typography variant="h5" fontWeight="950" color={isDark ? '#5eead4' : '#0f766e'}>PKR 1,000</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* 2. Deduct Funds */}
          <Card sx={{ borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, bgcolor: isDark ? '#1e293b' : '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="800" color="error" mb={2}>
                2. Deduct Funds (e.g. Spent PKR 500)
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, lineHeight: 1.6 }}>
                Suppose you spent <strong>PKR 500</strong>. To record this, click the 
                <Fab size="small" color="primary" sx={{ width: 28, height: 28, minHeight: 'unset', mx: 1, pointerEvents: 'none' }}><AddIcon sx={{ fontSize: 16 }} /></Fab> 
                button, then click the red
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.2, py: 0.4, mx: 1, borderRadius: 99, bgcolor: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} /> Deduct
                </Box>
                button. Enter amount, select <strong>Cash in Hand</strong>, and click <strong>Deduct Funds</strong>.
              </Typography>

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block" mb={1}>
                REAL BALANCE PREVIEW:
              </Typography>
              <Box display="inline-flex" p={2} borderRadius={3} sx={{ background: isDark ? 'rgba(20,184,166,0.1)' : '#f0fdfa', border: '1px solid #99f6e4' }}>
                <Box>
                  <Typography variant="caption" fontWeight="bold" color={isDark ? '#2dd4bf' : '#0f766e'}>OVERALL TOTAL</Typography>
                  <Typography variant="h5" fontWeight="950" color={isDark ? '#5eead4' : '#0f766e'}>PKR 500</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* 3. Transfer Funds */}
          <Card sx={{ borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, bgcolor: isDark ? '#1e293b' : '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="800" color="info.main" mb={2}>
                3. Transfer Funds
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, lineHeight: 1.6 }}>
                Suppose you transfer the remaining <strong>PKR 500</strong> to <strong>Easypaisa</strong>. Click 
                <Fab size="small" color="primary" sx={{ width: 28, height: 28, minHeight: 'unset', mx: 1, pointerEvents: 'none' }}><AddIcon sx={{ fontSize: 16 }} /></Fab> 
                button, select the blue
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.2, py: 0.4, mx: 1, borderRadius: 99, bgcolor: '#3b82f6', color: '#fff', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  <SwapHorizIcon sx={{ fontSize: 14 }} /> Transfer
                </Box>
                button. Choose <strong>Cash in Hand</strong> as From, click Next, choose <strong>Easypaisa</strong> as To, and confirm.
              </Typography>

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block" mb={1}>
                REAL ACCOUNT BREAKDOWN VIEW:
              </Typography>
              <Stack spacing={1} sx={{ maxWidth: 300 }}>
                <Box display="flex" justifyContent="space-between" p={1} borderRadius={2} sx={{ bgcolor: isDark ? '#0f172a' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Typography variant="body2" fontWeight="bold">Cash in Hand</Typography>
                  <Typography variant="body2" fontWeight="bold">PKR 0</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" p={1} borderRadius={2} sx={{ bgcolor: isDark ? '#0f172a' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Typography variant="body2" fontWeight="bold">Easypaisa</Typography>
                  <Typography variant="body2" fontWeight="bold" color="primary">PKR 500</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* 4. Loans */}
          <Card sx={{ borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, bgcolor: isDark ? '#1e293b' : '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="800" color="secondary" mb={2}>
                4. Loans (e.g. Borrowed PKR 1,000)
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, lineHeight: 1.6 }}>
                Suppose you borrow <strong>PKR 1,000</strong> from <strong>Ali</strong>. Click 
                <Fab size="small" color="primary" sx={{ width: 28, height: 28, minHeight: 'unset', mx: 1, pointerEvents: 'none' }}><AddIcon sx={{ fontSize: 16 }} /></Fab> 
                button, select the purple
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.2, py: 0.4, mx: 1, borderRadius: 99, bgcolor: '#a855f7', color: '#fff', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  <ReceiptLongIcon sx={{ fontSize: 14 }} /> Loan Record
                </Box>
                button. Select <strong>Borrow</strong>, set amount 1000, choose outside person, and Cash in Hand.
              </Typography>

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block" mb={1}>
                REAL BALANCE PREVIEW:
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Box p={1.5} borderRadius={2.5} sx={{ bgcolor: isDark ? 'rgba(99,102,241,0.1)' : '#eef2ff', border: '1px solid #ddd6fe' }}>
                  <Typography variant="caption" fontWeight="bold" color={isDark ? '#a78bfa' : '#7c3aed'} display="block">I OWN</Typography>
                  <Typography variant="subtitle1" fontWeight="black">PKR 1,500</Typography>
                </Box>
                <Box p={1.5} borderRadius={2.5} sx={{ bgcolor: isDark ? 'rgba(244,63,94,0.1)' : '#fff5f5', border: '1px solid #fecdd3' }}>
                  <Typography variant="caption" fontWeight="bold" color="error.main" display="block">TO PAY BACK</Typography>
                  <Typography variant="subtitle1" fontWeight="black" color="error.main">PKR 1,000</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* 5. Liabilities */}
          <Card sx={{ borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, bgcolor: isDark ? '#1e293b' : '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#ec4899' }} mb={2}>
                5. Liabilities vs Loans
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                Unlike Loans, adding a 
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.2, py: 0.4, mx: 1, borderRadius: 99, bgcolor: '#ec4899', color: '#fff', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  <AssignmentOutlinedIcon sx={{ fontSize: 14 }} /> Add Liability
                </Box>
                record <strong>does not affect</strong> your active balance or cash sources. It serves as a read-only future reference of debt to receive/return.
              </Typography>
            </CardContent>
          </Card>

          {/* 6. Manage Sources */}
          <Card sx={{ borderRadius: '16px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, bgcolor: isDark ? '#1e293b' : '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="800" color="text.primary" mb={1.5}>
                6. Manage Sources
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                Create or delete customized payment sources (e.g. Bank name, custom envelope) by clicking the <strong>Manage sources</strong> button on the finance dashboard.
              </Typography>
            </CardContent>
          </Card>

        </Stack>

      </Container>
    </div>
  );
}
