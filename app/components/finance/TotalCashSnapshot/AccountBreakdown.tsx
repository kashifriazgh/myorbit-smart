import { Box, Typography, Button, Collapse } from '@mui/material';
import { useState } from 'react';
import { TotalCashSnapshot } from '@/app/lib/interface';
import { formatCurrency } from '@/app/lib/utilts';

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

  return (
    <>
      <Button onClick={() => setShowBreakdown((p) => !p)} size="small">
        {showBreakdown ? 'Hide' : 'Show'} Account Breakdown
      </Button>

      <Collapse in={showBreakdown}>
        <Box
          mt={2}
          borderRadius={2}
          p={1}
          bgcolor={isDark ? '#1f2937' : '#f9f9f9'}
        >
          {Object.entries(snapshot.sources || {}).map(([name, amt]) => {
            // if source is "bank", we expect amt to be an object {HBL: 5000, Meezan: 6000}
            if (name === 'bank' && typeof amt === 'object') {
              return (
                <Box key={name} mb={1}>
                  <Typography
                    fontSize="0.82rem"
                    fontWeight={600}
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                  >
                    Bank Accounts
                  </Typography>
                  {Object.entries(amt as Record<string, number>).map(
                    ([bankName, bankAmt]) => (
                      <Box
                        key={bankName}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        py={0.3}
                        px={1}
                        sx={{
                          fontSize: '0.8rem',
                          borderBottom: '1px dashed',
                          borderColor: isDark ? '#374151' : '#e0e0e0',
                          '&:last-child': { borderBottom: 'none' },
                        }}
                      >
                        <Typography fontSize="0.8rem" fontWeight={500}>
                          {bankName}
                        </Typography>
                        <Typography fontSize="0.8rem" fontWeight={600}>
                          {formatCurrency(bankAmt, currency)}
                        </Typography>
                      </Box>
                    )
                  )}
                </Box>
              );
            }

            // default (normal field like in_hand, easypaisa, etc.)
            return (
              <Box
                key={name}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                py={0.5}
                px={1}
                sx={{
                  fontSize: '0.82rem',
                  borderBottom: '1px solid',
                  borderColor: isDark ? '#374151' : '#e0e0e0',
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Typography
                  fontSize="0.82rem"
                  fontWeight={500}
                  color="text.secondary"
                >
                  {name}
                </Typography>
                <Typography fontSize="0.82rem" fontWeight={600}>
                  {formatCurrency(amt as number, currency)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </>
  );
}
