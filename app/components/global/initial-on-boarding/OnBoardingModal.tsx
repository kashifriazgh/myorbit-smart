'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  useTheme,
  useMediaQuery,
  Box,
  MobileStepper,
} from '@mui/material';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import { useState } from 'react';

import FullName from './FullName';
import AgeGender from './AgeGender';
import SelectCurrency from './SelectCurrency';
import ProfessionAndHobbies from './ProfessionAndHobbies';
import StartDaySelector from './StartDaySelector';
import IncomeAndShoppingHabits from './IncomeAndShoppingHabits';

const steps = [
  'Full Name',
  'Age & Gender',
  'Currency & Country',
  'Profession & Hobby',
  'Start of Month or Week',
  'Income And Shopping Habits',
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function OnBoardingModal({ open, onClose }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    console.log('User skipped onboarding');
    onClose();
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return <FullName />;
      case 1:
        return <AgeGender />;
      case 2:
        return <SelectCurrency />;
      case 3:
        return <ProfessionAndHobbies />;
      case 4:
        return <StartDaySelector />;
      case 5:
        return <IncomeAndShoppingHabits />;
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
          height: fullScreen ? '100vh' : 600, // 🔧 Fixed height on desktop
          maxHeight: fullScreen ? '100vh' : '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          flexShrink: 0,
          px: 3,
          pt: 3,
          pb: fullScreen ? 3 : 2, // add more padding on mobile
          fontWeight: 600,
          bgcolor: theme.palette.background.paper,
          zIndex: 1,
        }}
      >
        Onboarding - Step {activeStep + 1} of {steps.length}:{' '}
        {steps[activeStep]}
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          flex: 1,
          overflowY: 'auto',
          bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#f9fafb',
          px: 3,
          py: 6, // 🔧 consistent padding
        }}
      >
        <Box width="100%" maxWidth={500} mx="auto">
          {renderStepContent()}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 1,
          px: 3,
          pt: 2,
          pb: fullScreen ? `calc(env(safe-area-inset-bottom, 0px) + 32px)` : 5, // Ensures MINIMUM 32px bottom on mobile
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: theme.palette.background.paper,
        }}
      >
        {/* Mobile Stepper */}
        <MobileStepper
          variant="progress"
          steps={steps.length}
          position="static"
          activeStep={activeStep}
          nextButton={
            <Button
              size="small"
              onClick={handleNext}
              disabled={activeStep === steps.length - 1}
            >
              Next
              {theme.direction === 'rtl' ? (
                <KeyboardArrowLeft />
              ) : (
                <KeyboardArrowRight />
              )}
            </Button>
          }
          backButton={
            <Button
              size="small"
              onClick={handleBack}
              disabled={activeStep === 0}
            >
              {theme.direction === 'rtl' ? (
                <KeyboardArrowRight />
              ) : (
                <KeyboardArrowLeft />
              )}
              Back
            </Button>
          }
          sx={{ width: '100%' }}
        />

        <Button onClick={handleSkip} color="secondary" fullWidth>
          Skip
        </Button>
      </DialogActions>
    </Dialog>
  );
}
