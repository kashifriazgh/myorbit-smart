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
  Fade,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';

import { useAuth } from '@/app/lib/context/userContext';
import { db } from '@/app/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Steps
import NameStep from './steps/NameStep';
import LocationStep from './steps/LocationStep';
import ProfileDetailsStep from './steps/ProfileDetailsStep';
import ProductivityStep from './steps/ProductivityStep';
import NotificationStep from './steps/NotificationStep';
import AIBehaviorStep from './steps/AIBehaviorStep';
import PlanningStep from './steps/PlanningStep';

type OnBoardingField<T> = {
  filled: boolean;
  value: T;
};

export type OnboardingFieldValue = 
  | string 
  | number 
  | boolean 
  | string[] 
  | number[]
  | [number, number] 
  | 'job' 
  | 'business' 
  | 'male' 
  | 'female' 
  | 'other' 
  | 'Formal' 
  | 'Friendly' 
  | 'Strict Coach' 
  | 'Allow' 
  | 'Limited' 
  | 'Off' 
  | 'Strict' 
  | 'Flexible'
  | undefined;

export type OnboardingData = {
  firstName?: string;
  lastName?: string;
  country?: OnBoardingField<string>;
  city?: OnBoardingField<string>;
  professionType?: OnBoardingField<'job' | 'business'>;
  profession?: OnBoardingField<string>;
  skills?: OnBoardingField<string[]>;
  hobby?: OnBoardingField<string>;
  ageGroup?: OnBoardingField<string>;
  gender?: OnBoardingField<'male' | 'female' | 'other'>;
  education?: OnBoardingField<string>;
  workStyle?: OnBoardingField<string>;
  peakHours?: OnBoardingField<string[]>;
  socialPreference?: OnBoardingField<string>;
  preferredSocialTime?: OnBoardingField<string>;
  socialHourRange?: OnBoardingField<[number, number]>;
  reminderBefore?: OnBoardingField<number>;
  maxNotifications?: OnBoardingField<number>;
  quitHours?: OnBoardingField<[number, number]>;
  aiTone?: OnBoardingField<'Formal' | 'Friendly' | 'Strict Coach'>;
  autoImprove?: OnBoardingField<boolean>;
  autoSuggest?: OnBoardingField<boolean>;
  smartRescheduling?: OnBoardingField<boolean>;
  weekStart?: OnBoardingField<number>;
  monthStart?: OnBoardingField<number>;
  activityTracking?: OnBoardingField<'Allow' | 'Limited' | 'Off'>;
  deadlineType?: OnBoardingField<'Strict' | 'Flexible'>;
  firstInteraction?: boolean;
};

const GROUPS = [
  { id: 0, title: 'Name', component: NameStep },
  { id: 1, title: 'Location', component: LocationStep },
  { id: 2, title: 'Profile', component: ProfileDetailsStep },
  { id: 3, title: 'Productivity', component: ProductivityStep },
  { id: 4, title: 'Notifications', component: NotificationStep },
  { id: 5, title: 'AI Assistant', component: AIBehaviorStep },
  { id: 6, title: 'Planning', component: PlanningStep },
];

interface InitialOnboardingProps {
  open?: boolean;
  onClose?: () => void;
  startStep?: number;
}

export default function InitialOnboarding({ 
  open: externalOpen, 
  onClose: externalOnClose,
  startStep
}: InitialOnboardingProps) {
  const { user } = useAuth();
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

        const obRef = doc(db, 'initialOnBoarding', user.uid);
        const obSnap = await getDoc(obRef);
        let fireData: OnboardingData | null = null;
        
        if (obSnap.exists()) {
          fireData = obSnap.data() as OnboardingData;
          initialData = { ...initialData, ...fireData };
        }

        // Logic to decide which step to show
        if (startStep === undefined) {
          // Priority 1: Check localStorage first (explicitly check for 'true' vs 'false')
          const intKey = `onboarding_first_interaction_${user.uid}`;
          const localInt = localStorage.getItem(intKey);
          let hasInteracted = localInt === 'true';
          
          // Priority 2: If not in local storage (null), check firebase data
          if (localInt === null) {
            hasInteracted = !!initialData.firstInteraction;
          }
          
          console.log('Onboarding Check:', { 
            localInt, 
            hasInteracted, 
            firstName: initialData.firstName,
            firstInteraction: initialData.firstInteraction 
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
              if (group.id === 0) return false;
              if (group.id === 1) return !initialData.country?.filled;
              if (group.id === 2) return !initialData.ageGroup?.filled;
              if (group.id === 3) return !initialData.workStyle?.filled;
              return false;
            });

            if (firstUnfilledIdx !== -1) {
              setCurrentGroupIdx(firstUnfilledIdx);
              setOpen(true);
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
      const ref = doc(db, 'initialOnBoarding', user.uid);
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
      case 0: return !!(data.firstName?.trim() && data.lastName?.trim());
      case 1: return !!(data.country?.value && data.city?.value && data.professionType?.value);
      case 2: return !!(data.ageGroup?.value && data.gender?.value);
      case 3: return !!(data.workStyle?.value && data.peakHours?.value?.length);
      default: return true;
    }
  };

  const handleNext = async () => {
    setTransitioning(true);
    
    const updatedData = { ...onboardingData };

    // Set first interaction when name step is completed
    if (currentGroupIdx === 0 && user) {
      updatedData.firstInteraction = true;
      setOnboardingData(updatedData);
      const intKey = `onboarding_first_interaction_${user.uid}`;
      localStorage.setItem(intKey, 'true');
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

  const handleCTAAction = (accept: boolean) => {
    setTransitioning(true);
    setTimeout(() => {
      if (accept) {
        setCurrentGroupIdx(prev => prev + 1);
        setShowCTA(false);
      } else {
        setOpen(false);
        setShowCTA(false);
      }
      setTransitioning(false);
    }, 500);
  };

  const handleStepChange = (val: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...val }));
  };

  if (!user || loading) return null;

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
      {transitioning && (
        <Box sx={{ 
          position: 'absolute', 
          top: 0, left: 0, right: 0, bottom: 0, 
          zIndex: 10, 
          bgcolor: 'rgba(255,255,255,0.7)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <CircularProgress />
        </Box>
      )}

      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton onClick={() => setOpen(false)}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: { xs: 3, md: 6 }, pb: 6, pt: 0 }}>
        {!showCTA ? (
          <Fade in={!showCTA}>
            <Box>
              <Box sx={{ mb: 4 }}>
                <CurrentStepComponent 
                  value={onboardingData} 
                  onChange={handleStepChange} 
                />
              </Box>

              <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
                <Box>
                  {currentGroupIdx > 0 && (
                    <Button 
                      onClick={() => setCurrentGroupIdx(prev => prev - 1)}
                      startIcon={<ArrowBackIcon />}
                    >
                      Back
                    </Button>
                  )}
                </Box>
                
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
            </Box>
          </Fade>
        ) : (
          <Fade in={showCTA}>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
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
          </Fade>
        )}
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
