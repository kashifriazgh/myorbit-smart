'use client';

import { motion } from 'framer-motion';

interface CalmEmojiProps {
  color?: string;
  size?: number;
  level?: number; // 1 (slightly calm) to 10 (super calm)
}

const CalmEmoji = ({
  color = '#60a5fa', // Soft blue
  size = 64,
  level = 5,
}: CalmEmojiProps) => {
  const eyeSize = size * 0.1;

  // Mouth width increases with calmness level
  const mouthWidth = size * (0.2 + level * 0.05); // 0.2 to 0.7 of face width

  return (
    <div
      className="relative rounded-full shadow-inner"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
      }}
    >
      {/* Eyes */}
      <div
        className="absolute bg-black rounded-full"
        style={{
          width: eyeSize,
          height: eyeSize,
          top: size * 0.35,
          left: size * 0.27,
        }}
      />
      <div
        className="absolute bg-black rounded-full"
        style={{
          width: eyeSize,
          height: eyeSize,
          top: size * 0.35,
          right: size * 0.27,
        }}
      />

      {/* Calm Mouth */}
      <motion.div
        className="absolute bg-black rounded-full"
        style={{
          height: 5,
          bottom: size * 0.25,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
        animate={{
          width: mouthWidth,
        }}
        transition={{ type: 'spring', stiffness: 150 }}
      />
    </div>
  );
};

export default CalmEmoji;
