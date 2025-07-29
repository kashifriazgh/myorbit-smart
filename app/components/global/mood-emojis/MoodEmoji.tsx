'use client';

import HappyEmoji from './HappyEmoji';
import SlightlyHappyEmoji from './SlightlyHappyEmoji';
import NeutralEmoji from './NeutralEmoji';
import SadEmoji from './SadEmoji';
import DeadSadEmoji from './DeadSadEmoji';
import ExcitedEmoji from './ExcitedEmoji';
import AngryEmoji from './AngryEmoji';
import SatisfiedEmoji from './SatisfiedEmoji';
import CalmEmoji from './CalmEmoji';
import React from 'react';

interface MoodEmojiProps {
  mood:
    | 'happy'
    | 'slightly-happy'
    | 'neutral'
    | 'sad'
    | 'dead-sad'
    | 'excited'
    | 'angry'
    | 'satisfied'
    | 'calm';
  color?: string; // optional background color override
  size?: number; // optional size (default 64)
}

export default function MoodEmoji({ mood, color, size = 64 }: MoodEmojiProps) {
  const emojiMap: Record<MoodEmojiProps['mood'], React.ReactNode> = {
    happy: <HappyEmoji color={color} size={size} />,
    'slightly-happy': <SlightlyHappyEmoji color={color} size={size} />,
    neutral: <NeutralEmoji color={color} size={size} />,
    sad: <SadEmoji color={color} size={size} />,
    'dead-sad': <DeadSadEmoji color={color} size={size} />,
    excited: <ExcitedEmoji color={color} size={size} />,
    angry: <AngryEmoji color={color} size={size} />,
    satisfied: <SatisfiedEmoji color={color} size={size} />,
    calm: <CalmEmoji color={color} size={size} />,
  };

  return emojiMap[mood] || null;
}
