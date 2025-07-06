'use client';

import { Box, Stack, Tooltip } from '@mui/material';
import Lottie from 'lottie-react';
import type { LottieComponentProps } from 'lottie-react';

type Mood = {
  label: string;
  value: string;
  animation: LottieComponentProps['animationData'];
};

type Props = {
  selectedMood: string | null;
  onSelect: (mood: string) => void;
};

// 🔁 Import your Lottie animations
import happyAnim from '@/public/lottie/happy.json';
import excitedAnim from '@/public/lottie/love-in.json';
import calmAnim from '@/public/lottie/very-sad.json';
import sadAnim from '@/public/lottie/sad.json';
import angryAnim from '@/public/lottie/angry.json';
// import anxiousAnim from '@/public/lottie/happy.json';

const MOODS: Mood[] = [
  { label: 'Happy', value: 'happy', animation: happyAnim },
  { label: 'Loving', value: 'loving', animation: excitedAnim },
  { label: 'Sad', value: 'sad', animation: sadAnim },
  { label: 'Heart Broken', value: 'heart-broken', animation: calmAnim },
  { label: 'Angry', value: 'angry', animation: angryAnim },
];

export default function MoodSelector({ selectedMood, onSelect }: Props) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      justifyContent="center"
      flexWrap="wrap"
      useFlexGap
    >
      {MOODS.map((mood) => (
        <Tooltip title={mood.label} key={mood.value}>
          <Box
            onClick={() => onSelect(mood.value)}
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border:
                selectedMood === mood.value
                  ? '2px solid #22c55e'
                  : '2px solid transparent',
              bgcolor: selectedMood === mood.value ? '#d1fae5' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
              padding: 0, // Make sure there's no padding
            }}
          >
            <Lottie
              animationData={mood.animation}
              loop
              autoplay
              style={{
                width: 36,
                height: 36,
                margin: 0,
                padding: 0,
              }}
            />
          </Box>
        </Tooltip>
      ))}
    </Stack>
  );
}
