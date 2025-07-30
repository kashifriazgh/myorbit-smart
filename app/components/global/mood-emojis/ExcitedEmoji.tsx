'use client';

import { motion } from 'framer-motion';

const ExcitedEmoji = ({
  color = '#facc15',
  size = 64,
  level = 2, // 1 (mild) -> 5 (very excited)
}: {
  color?: string;
  size?: number;
  level?: number;
}) => {
  const bgColorVariants = {
    1: '#fde68a',
    2: '#facc15',
    3: '#eab308',
    4: '#ca8a04',
    5: '#a16207',
  };

  const eyeSize = size * 0.12;
  const eyeOffsetY = size * 0.25;

  const mouthWidth = size * 0.4 + level * 2;
  const mouthHeight = size * 0.15 + level * 2;

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      animate={{
        backgroundColor: bgColorVariants[level] || color,
        width: size,
        height: size,
      }}
      className="relative rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
      }}
    >
      {/* Eyes */}
      <motion.div
        layout
        className="absolute bg-black rounded-full"
        animate={{
          scale: 1 + level * 0.05,
          y: [-1, 1, -1], // bouncy
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5 - level * 0.15,
          ease: 'easeInOut',
        }}
        style={{
          width: eyeSize,
          height: eyeSize,
          top: eyeOffsetY,
          left: size * 0.23,
        }}
      />
      <motion.div
        layout
        className="absolute bg-black rounded-full"
        animate={{
          scale: 1 + level * 0.05,
          y: [1, -1, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5 - level * 0.15,
          ease: 'easeInOut',
        }}
        style={{
          width: eyeSize,
          height: eyeSize,
          top: eyeOffsetY,
          right: size * 0.23,
        }}
      />

      {/* Mouth */}
      <motion.div
        layout
        className="absolute bg-black"
        animate={{
          width: mouthWidth,
          height: mouthHeight,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          bottom: size * 0.15,
          left: '50%',
          transform: 'translateX(-50%)',
          borderBottomLeftRadius: '100px',
          borderBottomRightRadius: '100px',
        }}
      />
    </motion.div>
  );
};

export default ExcitedEmoji;
