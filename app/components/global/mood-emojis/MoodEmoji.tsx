import HappyEmoji from './HappyEmoji';
import SlightlyHappyEmoji from './SlightlyHappyEmoji';
import NeutralEmoji from './NeutralEmoji';
import SadEmoji from './SadEmoji';
import ExcitedEmoji from './ExcitedEmoji';
import AngryEmoji from './AngryEmoji';
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
  color?: string;
  size?: number;
  level?: number; // <-- ADD THIS
}

export default function MoodEmoji({
  mood,
  color,
  size = 64,
  level = 3,
}: MoodEmojiProps) {
  const emojiMap: Record<MoodEmojiProps['mood'], React.ReactNode> = {
    happy: <HappyEmoji color={color} size={size} level={level} />,
    'slightly-happy': (
      <SlightlyHappyEmoji color={color} size={size} level={level} />
    ),
    neutral: <NeutralEmoji color={color} size={size} level={level} />,
    sad: <SadEmoji color={color} size={size} level={level} />,
    excited: <ExcitedEmoji color={color} size={size} level={level} />,
    angry: <AngryEmoji color={color} size={size} level={level} />,
    calm: <CalmEmoji color={color} size={size} level={level} />,
  };

  return emojiMap[mood] || null;
}
