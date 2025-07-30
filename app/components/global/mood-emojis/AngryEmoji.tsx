'use client';

import { motion } from 'framer-motion';

interface AngryEmojiProps {
  color?: string;
  size?: number;
  level?: number; // 1 (mildly annoyed) to 10 (furious)
}

const AngryEmoji = ({
  color = '#f87171',
  size = 64,
  level = 5,
}: AngryEmojiProps) => {
  const eyeSize = size * 0.1;
  const browLength = size * 0.18;

  // Compute based on level (1-10)
  const browAngle = 15 + level * 1.5; // from 30° to 45°
  const mouthDepth = size * (0.15 + level / 50); // deeper frown with higher anger

  return (
    <div
      className="relative rounded-full shadow-md"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
      }}
    >
      {/* Brows */}
      <motion.div
        className="absolute bg-black"
        style={{
          width: browLength,
          height: 4,
          top: size * 0.22,
          left: size * 0.2,
          borderRadius: 4,
        }}
        animate={{ rotate: browAngle }}
        transition={{ type: 'spring', stiffness: 200 }}
      />
      <motion.div
        className="absolute bg-black"
        style={{
          width: browLength,
          height: 4,
          top: size * 0.22,
          right: size * 0.2,
          borderRadius: 4,
        }}
        animate={{ rotate: -browAngle }}
        transition={{ type: 'spring', stiffness: 200 }}
      />

      {/* Eyes */}
      <div
        className="absolute bg-black rounded-full"
        style={{
          width: eyeSize,
          height: eyeSize,
          top: size * 0.32,
          left: size * 0.27,
        }}
      />
      <div
        className="absolute bg-black rounded-full"
        style={{
          width: eyeSize,
          height: eyeSize,
          top: size * 0.32,
          right: size * 0.27,
        }}
      />

      {/* Frown */}
      <motion.div
        className="absolute border-b-4 border-black"
        style={{
          width: size * 0.4,
          bottom: size * 0.2,
          left: '50%',
          transform: 'translateX(-50%) rotate(180deg)',
          borderRadius: '0 0 100px 100px',
        }}
        animate={{ height: mouthDepth }}
        transition={{ type: 'spring', stiffness: 150 }}
      />
    </div>
  );
};

export default AngryEmoji;
