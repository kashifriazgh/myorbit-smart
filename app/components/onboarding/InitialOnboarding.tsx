'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Button,
  Typography,
  Stack,
  IconButton,
  useTheme,
  useMediaQuery,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '@/app/lib/context/userContext';
import { userDb as db } from '@/app/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Steps
import NameStep from './steps/NameStep';
import ProfileDetailsStep from './steps/ProfileDetailsStep';
import ProfessionStep from './steps/ProfessionStep';

import { OnboardingData } from '@/app/lib/interface';

const GROUPS = [
  { id: 0, title: 'Name & Contact', component: NameStep },
  { id: 1, title: 'Profile Details', component: ProfileDetailsStep },
  { id: 2, title: 'Profession', component: ProfessionStep },
];

interface InitialOnboardingProps {
  open?: boolean;
  onClose?: () => void;
  startStep?: number;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 50 : -50,
    opacity: 0
  })
};

export default function InitialOnboarding({
  open: externalOpen,
  onClose: externalOnClose,
  startStep
}: InitialOnboardingProps) {
  const { user, isGuest } = useAuth();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = useCallback((val: boolean) => {
    if (externalOnClose && !val) externalOnClose();
    setInternalOpen(val);
  }, [externalOnClose]);

  const [currentGroupIdx, setCurrentGroupIdx] = useState(startStep ?? 0);
  const [showCTA, setShowCTA] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [completedGroups, setCompletedGroups] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [direction, setDirection] = useState(1); // 1 for next, -1 for back

  // Load state from localStorage and Firebase
  useEffect(() => {
    const initOnboarding = async () => {
      if (!user) return;

      // 1. Check LocalStorage (User-specific)
      const dataKey = `onboarding_data_${user.uid}`;
      const completedKey = `onboarding_completed_groups_${user.uid}`;
      const idxKey = `onboarding_current_group_idx_${user.uid}`;

      const localData = localStorage.getItem(dataKey);
      const localCompleted = localStorage.getItem(completedKey);
      const localIdx = localStorage.getItem(idxKey);

      let initialData: OnboardingData = localData ? JSON.parse(localData) : {};
      const initialCompleted: number[] = localCompleted ? JSON.parse(localCompleted) : [];

      if (localIdx && startStep === undefined) setCurrentGroupIdx(parseInt(localIdx));
      setCompletedGroups(initialCompleted);

      // 2. Check Firebase
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          initialData = {
            ...initialData,
            firstName: userData.firstName || initialData.firstName,
            lastName: userData.lastName || initialData.lastName
          };
        }

        const obRef = doc(db, 'initialOnboarding', user.uid);
        const obSnap = await getDoc(obRef);
        let fireData: OnboardingData | null = null;

        if (obSnap.exists()) {
          fireData = obSnap.data() as OnboardingData;
          initialData = { ...initialData, ...fireData };
        }

        // Logic to decide which step to show
        if (startStep === undefined) {
          const dismissUntilKey = `onboarding_dismissed_until_${user.uid}`;
          const dismissUntil = localStorage.getItem(dismissUntilKey);
          const isDismissed = dismissUntil && Date.now() < parseInt(dismissUntil);

          if (!isDismissed) {
            // Priority 1: Check localStorage first (explicitly check for 'true' vs 'false')
            const localInt = localStorage.getItem('onboarding_first_interaction');
            let hasInteracted = localInt === 'true';

            // Priority 2: If not in local storage (null), check firebase data
            if (localInt === null) {
              hasInteracted = !!initialData.onBoardingFirstInteraction;
            }

            console.log('Onboarding Check:', {
              localInt,
              hasInteracted,
              firstName: initialData.firstName,
              onBoardingFirstInteraction: initialData.onBoardingFirstInteraction
            });

            if (!initialData.firstName || !initialData.lastName) {
              // Priority 3: Missing Name - ALWAYS show
              setCurrentGroupIdx(0);
              setOpen(true);
            } else if (!hasInteracted) {
              // Priority 4: Haven't interacted yet (or manual reset to 'false')
              setCurrentGroupIdx(0);
              setOpen(true);
            } else if (fireData) {
              // Priority 5: Resume uncompleted major fields
              const firstUnfilledIdx = GROUPS.findIndex(group => {
                if (group.id === 0) return !initialData.firstName || !initialData.lastName || !initialData.mobile?.filled;
                if (group.id === 1) return !initialData.ageGroup?.filled || !initialData.gender?.filled || !initialData.education?.filled;
                if (group.id === 2) return !initialData.professionType?.filled || !initialData.profession?.filled;
                return false;
              });

              if (firstUnfilledIdx !== -1) {
                setCurrentGroupIdx(firstUnfilledIdx);
                setOpen(true);
              }
            }
          }
        }

        setOnboardingData(initialData);
      } catch (err) {
        console.error('Failed to fetch onboarding data', err);
      } finally {
        setLoading(false);
      }
    };

    initOnboarding();
  }, [user, startStep, setOpen]);

  // Sync with LocalStorage
  useEffect(() => {
    if (!user) return;
    const dataKey = `onboarding_data_${user.uid}`;
    const completedKey = `onboarding_completed_groups_${user.uid}`;
    const idxKey = `onboarding_current_group_idx_${user.uid}`;

    localStorage.setItem(dataKey, JSON.stringify(onboardingData));
    localStorage.setItem(completedKey, JSON.stringify(completedGroups));
    localStorage.setItem(idxKey, currentGroupIdx.toString());
  }, [onboardingData, completedGroups, currentGroupIdx, user]);

  const saveToFirebase = useCallback(async (data: Partial<OnboardingData>) => {
    if (!user) return;
    try {
      const ref = doc(db, 'initialOnboarding', user.uid);
      await setDoc(ref, { ...data, userId: user.uid }, { merge: true });

      // Also update 'users' collection if name changed
      if (data.firstName || data.lastName) {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          firstName: data.firstName,
          lastName: data.lastName
        }, { merge: true });
      }
    } catch (err) {
      console.error('Failed to sync with Firebase', err);
    }
  }, [user]);

  const isStepValid = () => {
    const data = onboardingData;
    switch (currentGroupIdx) {
      case 0: return !!(data.firstName?.trim() && data.lastName?.trim() && data.mobile?.value?.trim());
      case 1: return !!(data.ageGroup?.value && data.gender?.value && data.education?.value);
      case 2: return !!(data.professionType?.value && data.profession?.value);
      default: return true;
    }
  };

  const handleNext = async () => {
    setDirection(1);
    setTransitioning(true);

    const updatedData = { ...onboardingData };

    // Set first interaction when name step is completed
    if (currentGroupIdx === 0 && user) {
      updatedData.onBoardingFirstInteraction = true;
      setOnboardingData(updatedData);
      localStorage.setItem('onboarding_first_interaction', 'true');
    }

    // Mark current group as completed locally
    if (!completedGroups.includes(currentGroupIdx)) {
      setCompletedGroups(prev => [...prev, currentGroupIdx]);
    }

    // Save progress to Firebase
    await saveToFirebase(updatedData);

    // Artificial delay for smooth transition
    setTimeout(() => {
      if (currentGroupIdx === 0) {
        setShowCTA(true);
      } else if (currentGroupIdx < GROUPS.length - 1) {
        setShowCTA(true);
      } else {
        setOpen(false);
      }
      setTransitioning(false);
    }, 600);
  };

  const handleSkip = () => {
    setDirection(1);
    setTransitioning(true);
    setTimeout(() => {
      if (currentGroupIdx < GROUPS.length - 1) {
        setCurrentGroupIdx(prev => prev + 1);
      } else {
        setOpen(false);
      }
      setTransitioning(false);
    }, 400);
  };

  const handleCloseCross = () => {
    if (user) {
      const dismissUntil = Date.now() + 60 * 60 * 1000; // 1 hour
      localStorage.setItem(`onboarding_dismissed_until_${user.uid}`, dismissUntil.toString());
    }
    setOpen(false);
  };

  const handleAskMeLater = () => {
    if (user) {
      const dismissUntil = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
      localStorage.setItem(`onboarding_dismissed_until_${user.uid}`, dismissUntil.toString());
    }
    setOpen(false);
  };

  const handleCTAAction = (accept: boolean) => {
    setDirection(1);
    setTransitioning(true);
    setTimeout(() => {
      if (accept) {
        setCurrentGroupIdx(prev => prev + 1);
        setShowCTA(false);
      } else {
        if (user) {
          const dismissUntil = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
          localStorage.setItem(`onboarding_dismissed_until_${user.uid}`, dismissUntil.toString());
        }
        setOpen(false);
        setShowCTA(false);
      }
      setTransitioning(false);
    }, 500);
  };

  const handleBack = () => {
    setDirection(-1);
    setCurrentGroupIdx(prev => prev - 1);
  };

  const handleStepChange = (val: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...val }));
  };

  if (!user || isGuest || loading) return null;

  const CurrentStepComponent = GROUPS[currentGroupIdx].component;
  const isValid = isStepValid();

  return (
    <Dialog
      open={open}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : 4,
          overflow: 'hidden',
          bgcolor: theme.palette.background.paper,
          position: 'relative'
        }
      }}
    >
      <AnimatePresence mode="wait">
        {transitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 10,
              backgroundColor: 'rgba(255,255,255,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CircularProgress />
          </motion.div>
        )}
      </AnimatePresence>

      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton onClick={handleCloseCross}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: { xs: 3, md: 6 }, pb: 6, pt: 0, minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait" custom={direction}>
          {!showCTA ? (
            <motion.div
              key={`step-${currentGroupIdx}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <Box sx={{ flex: 1 }}>
                <Box sx={{ mb: 4 }}>
                  <CurrentStepComponent
                    value={onboardingData}
                    onChange={handleStepChange}
                  />
                </Box>
              </Box>

              <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center" sx={{ mt: 'auto' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {currentGroupIdx > 0 && (
                    <Button
                      onClick={handleBack}
                      startIcon={<ArrowBackIcon />}
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={handleAskMeLater}
                    sx={{ textTransform: 'none', color: 'text.secondary' }}
                  >
                    Ask me later
                  </Button>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    onClick={handleSkip}
                    startIcon={<SkipNextIcon />}
                    sx={{ borderRadius: 3, textTransform: 'none' }}
                  >
                    Skip to Next
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={!isValid || transitioning}
                    endIcon={transitioning ? <CircularProgress size={20} color="inherit" /> : <ArrowForwardIcon />}
                    sx={{
                      borderRadius: 3,
                      px: 4,
                      py: 1,
                      boxShadow: theme.shadows[4]
                    }}
                  >
                    {currentGroupIdx === 0 ? 'Start' : 'Next'}
                  </Button>
                </Stack>
              </Stack>
            </motion.div>
          ) : (
            <motion.div
              key="cta"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
            >
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                >
                  <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                </motion.div>
                <Typography variant="h4" fontWeight="800" gutterBottom>
                  Thanks {onboardingData.firstName}!
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  {currentGroupIdx === 0
                    ? "Would you like to give us some more info about you so that we can work with you better?"
                    : "That's great! Would you like to share some more details for an even better experience?"}
                </Typography>

                <Stack spacing={2} sx={{ mt: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => handleCTAAction(true)}
                    disabled={transitioning}
                    sx={{ borderRadius: 3, py: 1.5, textTransform: 'none', fontWeight: 600 }}
                  >
                    Yes, let&apos;s continue
                  </Button>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={() => handleCTAAction(false)}
                    disabled={transitioning}
                    sx={{ textTransform: 'none' }}
                  >
                    Maybe later
                  </Button>
                </Stack>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>

      {/* Progress Bar */}
      {!showCTA && (
        <Box sx={{ width: '100%', position: 'absolute', bottom: 0 }}>
          <LinearProgress
            variant="determinate"
            value={((currentGroupIdx + 1) / GROUPS.length) * 100}
            sx={{ height: 6 }}
          />
        </Box>
      )}
    </Dialog>
  );
}
