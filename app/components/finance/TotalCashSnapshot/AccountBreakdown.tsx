import { Box, Typography, Button, Collapse, Stack } from '@mui/material';
import { useState } from 'react';
import { TotalCashSnapshot } from '@/app/lib/interface';
import { formatCurrency } from '@/app/lib/utilts';
import Link from 'next/link';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentsIcon from '@mui/icons-material/Payments';

interface Props {
  snapshot: TotalCashSnapshot;
  currency: 'PKR' | 'USD';
  isDark: boolean;
}

export default function AccountBreakdown({
  snapshot,
  currency,
  isDark,
}: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const renderHolders = (sourceKey: string, totalAmount: number) => {
    const holders = snapshot.heldBy?.[sourceKey] || [];
    if (holders.length === 0) return null;

    const holdersSum = holders.reduce((s, h) => s + h.amount, 0);
    const unassigned = totalAmount - holdersSum;

    return (
      <Stack spacing={0.5} sx={{ pl: 2, mt: 0.8, borderLeft: `2.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}` }}>
        {holders.map((h) => (
          <Box key={h.holderName} display="flex" justifyContent="space-between" alignItems="center">
            <Typography fontSize="0.74rem" color="text.secondary" sx={{ fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              👤 {h.holderName}
            </Typography>
            <Typography fontSize="0.74rem" fontWeight="600" color="text.secondary">
              {formatCurrency(h.amount, currency)}
            </Typography>
          </Box>
        ))}
        {unassigned >= 1 && (
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography fontSize="0.74rem" color="text.secondary" sx={{ fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              👤 Self / Unassigned
            </Typography>
            <Typography fontSize="0.74rem" fontWeight="600" color="text.secondary">
              {formatCurrency(unassigned, currency)}
            </Typography>
          </Box>
        )}
      </Stack>
    );
  };

  return (
    <>
      <Button onClick={() => setShowBreakdown((p) => !p)} size="small">
        {showBreakdown ? 'Hide' : 'Show'} Account Breakdown
      </Button>

      <Collapse in={showBreakdown}>
        <Box
          mt={2}
          borderRadius={3}
          p={2}
          bgcolor={isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc'}
          border={`1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`}
        >
          {Object.entries(snapshot.sources || {}).map(([name, amt]) => {
            // Filter: only show if amount is >= 1 (or has sub-accounts with amount >= 1)
            
            if (name === 'bank' && typeof amt === 'object') {
              const bankAccounts = Object.entries(amt as Record<string, number>).filter(([, v]) => v >= 1);
              if (bankAccounts.length === 0) return null;

              return (
                <Box key={name} mb={2}>
                  <Typography
                    variant="caption"
                    fontWeight="800"
                    color="primary"
                    sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >
                    <AccountBalanceIcon sx={{ fontSize: 14 }} /> Bank Accounts
                  </Typography>
                  <Stack spacing={0.8}>
                    {bankAccounts.map(([bankName, bankAmt]) => {
                      const bankKey = `bank:${bankName}`;
                      return (
                        <Box
                          key={bankName}
                          sx={{
                            borderRadius: 1.5,
                            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9'}`,
                            p: 1.2,
                          }}
                        >
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography fontSize="0.82rem" fontWeight={600}>
                              {bankName}
                            </Typography>
                            <Typography fontSize="0.82rem" fontWeight="900" color="primary">
                              {formatCurrency(bankAmt, currency)}
                            </Typography>
                          </Box>
                          {renderHolders(bankKey, bankAmt)}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              );
            }

            if (name === 'custom' && typeof amt === 'object') {
              const customHeads = Object.entries(amt as Record<string, number>).filter(([, v]) => v >= 1);
              if (customHeads.length === 0) return null;

              return (
                <Box key={name} mb={2}>
                  <Typography
                    variant="caption"
                    fontWeight="800"
                    color="secondary"
                    sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >
                    <PaymentsIcon sx={{ fontSize: 14 }} /> Custom Payment Heads
                  </Typography>
                  <Stack spacing={0.8}>
                    {customHeads.map(([customName, customAmt]) => {
                      const customKey = `custom:${customName}`;
                      return (
                        <Box
                          key={customName}
                          sx={{
                            borderRadius: 1.5,
                            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9'}`,
                            p: 1.2,
                          }}
                        >
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography fontSize="0.82rem" fontWeight={600}>
                              {customName}
                            </Typography>
                            <Typography fontSize="0.82rem" fontWeight="900" color="secondary">
                              {formatCurrency(customAmt, currency)}
                            </Typography>
                          </Box>
                          {renderHolders(customKey, customAmt)}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              );
            }

            // default (normal field like in_hand, easypaisa, etc.)
            const val = amt as number;
            if (val < 1) return null;

            return (
              <Box
                key={name}
                mb={0.5}
                sx={{
                  borderRadius: 1.5,
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`,
                  p: 1.2,
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography
                    fontSize="0.82rem"
                    fontWeight={700}
                    color="text.secondary"
                    sx={{ textTransform: 'capitalize' }}
                  >
                    {name.replace('_', ' ')}
                  </Typography>
                  <Typography fontSize="0.82rem" fontWeight="900">
                    {formatCurrency(val, currency)}
                  </Typography>
                </Box>
                {renderHolders(name, val)}
              </Box>
            );
          })}

          <Box mt={2} pt={1} borderTop={`1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`} textAlign="center">
            <Link href="/finance/manage-sources" style={{ textDecoration: 'none' }}>
              <Button 
                size="small" 
                startIcon={<SettingsIcon sx={{ fontSize: 16 }} />}
                sx={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  color: isDark ? '#94a3b8' : '#64748b',
                  '&:hover': { color: 'primary.main' }
                }}
              >
                Manage Sources
              </Button>
            </Link>
          </Box>
        </Box>
      </Collapse>
    </>
  );
}
