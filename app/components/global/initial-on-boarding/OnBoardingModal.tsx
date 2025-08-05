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
import SelectCurrency from './SelectCurrency';
import { useState } from 'react';
import ProfessionAndHobbies from './ProfessionAndHobbies';

const steps = ['Full Name', 'Age & Gender', 'Currency', 'Profession & Hobby']; // ✅ Added step label

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
      case 2:
        return <SelectCurrency />; // ✅ New Step Component
      case 3:
        return <ProfessionAndHobbies />; // ✅ New Step Component
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
          maxHeight: fullScreen ? '100vh' : '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          flexShrink: 0,
          px: 3,
          pt: 3,
          pb: 2,
          fontWeight: 600,
          bgcolor: theme.palette.background.paper,
          zIndex: 1,
        }}
      >
        Onboarding - Step {step + 1} of {steps.length}: {steps[step]}
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          flex: 1,
          overflowY: 'auto',
          bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#f9fafb',
          px: 3,
          py: 2,
        }}
      >
        <Box width="100%" maxWidth={500} mx="auto">
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
          flexShrink: 0,
          bgcolor: theme.palette.background.paper,
          zIndex: 1,
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
