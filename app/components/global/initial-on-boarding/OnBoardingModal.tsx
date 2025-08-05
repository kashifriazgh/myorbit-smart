'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  useTheme,
  useMediaQuery,
  Box,
} from '@mui/material';
import FullName from './FullName';
import AgeGender from './AgeGender';
import { useState } from 'react';

const steps = ['Full Name', 'Age & Gender'];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function OnBoardingModal({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const handleNext = () => {
    if (step < steps.length - 1) setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    console.log('User skipped onboarding');
    onClose();
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return <FullName />;
      case 1:
        return <AgeGender />;
      default:
        return <Typography>All steps completed.</Typography>;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          display: 'flex',
          flexDirection: 'column',
          height: fullScreen ? '100vh' : 'auto',
        },
      }}
    >
      <DialogTitle>
        Onboarding - Step {step + 1} of {steps.length}: {steps[step]}
      </DialogTitle>

      <DialogContent
        sx={{
          bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#f9fafb',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
        }}
      >
        <Box width="100%" maxWidth={500}>
          {renderStepContent()}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1}>
          <Button onClick={handleBack} disabled={step === 0} variant="outlined">
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={step === steps.length - 1}
            variant="contained"
          >
            Next
          </Button>
        </Stack>
        <Button onClick={handleSkip} color="secondary">
          Skip
        </Button>
      </DialogActions>
    </Dialog>
  );
}
