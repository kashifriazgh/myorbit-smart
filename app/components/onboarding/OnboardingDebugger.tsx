'use client';

import React, { useState, useEffect } from 'react';
import { 
  Paper, 
  Typography, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon, 
  Button, 
  Box,
  Divider,
  Collapse,
  IconButton
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import BugReportIcon from '@mui/icons-material/BugReport';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import { useAuth } from '@/app/lib/context/userContext';
import { db } from '@/app/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import InitialOnboarding, { OnboardingData } from './InitialOnboarding';

const GROUPS = [
  { id: 0, title: 'Name (Step 1)', fields: ['firstName', 'lastName'] },
  { id: 1, title: 'Location (Step 2)', fields: ['country', 'city', 'professionType'] },
  { id: 2, title: 'Profile (Step 3)', fields: ['ageGroup', 'gender', 'skills', 'hobby', 'education'] },
  { id: 3, title: 'Productivity (Step 4)', fields: ['workStyle', 'peakHours', 'socialPreference'] },
  { id: 4, title: 'Notifications (Step 5)', fields: ['reminderBefore', 'maxNotifications', 'quitHours'] },
  { id: 5, title: 'AI Assistant (Step 6)', fields: ['aiTone', 'autoImprove'] },
  { id: 6, title: 'Planning (Step 7)', fields: ['weekStart', 'monthStart', 'activityTracking'] },
];

export default function OnboardingDebugger() {
  const { user } = useAuth();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'initialOnBoarding', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setData(snap.data());
    });
    return () => unsub();
  }, [user]);

  const isGroupFilled = (fields: string[]) => {
    if (!data) return false;
    return fields.every(field => {
      const f = data[field];
      // Special case for simple string fields (firstName, lastName)
      if (field === 'firstName' || field === 'lastName') {
        return typeof f === 'string' && f.trim().length > 0;
      }
      // Standard check for OnBoardingField structure
      return f && f.filled === true;
    });
  };

  if (!user) return null;

  return (
    <Box sx={{ my: 2 }}>
      <Paper 
        elevation={0} 
        sx={{ 
          p: 2, 
          border: '1px solid', 
          borderColor: 'primary.main', 
          borderRadius: 3,
          bgcolor: 'primary.light',
          color: 'primary.contrastText'
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <BugReportIcon />
            <Typography variant="subtitle1" fontWeight="700">Onboarding Debugger</Typography>
          </Box>
          <IconButton size="small" onClick={() => setIsExpanded(!isExpanded)} color="inherit">
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>

        <Collapse in={isExpanded}>
          <Box mt={2} bgcolor="background.paper" borderRadius={2} color="text.primary" overflow="hidden">
            <List disablePadding>
              {GROUPS.map((group, index) => {
                const filled = isGroupFilled(group.fields);
                return (
                  <React.Fragment key={group.id}>
                    <ListItem 
                      secondaryAction={
                        <Button 
                          size="small" 
                          variant="outlined" 
                          startIcon={<PlayArrowIcon />}
                          onClick={() => setOpenStep(index)}
                        >
                          Trigger
                        </Button>
                      }
                    >
                      <ListItemIcon>
                        {filled ? <CheckCircleIcon color="success" /> : <RadioButtonUncheckedIcon color="disabled" />}
                      </ListItemIcon>
                      <ListItemText 
                        primary={group.title} 
                        secondary={filled ? 'Completed' : 'Pending'}
                        primaryTypographyProps={{ fontWeight: 600 }}
                      />
                    </ListItem>
                    {index < GROUPS.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          </Box>
        </Collapse>
      </Paper>

      {/* Manual Trigger Modal */}
      {openStep !== null && (
        <InitialOnboarding 
          open={true} 
          onClose={() => setOpenStep(null)} 
          startStep={openStep} 
        />
      )}
    </Box>
  );
}

import { Stack } from '@mui/material';
