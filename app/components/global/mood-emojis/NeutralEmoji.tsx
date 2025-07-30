'use client';

import { motion } from 'framer-motion';

const NeutralEmoji = ({
  color = '#a3a3a3',
  size = 64,
}: {
  color?: string;
  size?: number;
}) => {
  const eyeSize = size * 0.12;
  const eyeOffsetY = size * 0.28;
  const eyeOffsetX = size * 0.25;
  const mouthWidth = size * 0.4;
  const mouthHeight = 3;

  return (
    <motion.div
      className="relative rounded-full flex items-center justify-center shadow-inner"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
      }}
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Left Eye */}
      <motion.div
        className="absolute bg-black rounded-full"
        style={{
          width: eyeSize,
          height: eyeSize,
          top: eyeOffsetY,
          left: eyeOffsetX,
        }}
        animate={{ y: [0, -1, 0] }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          repeatDelay: 2,
        }}
      />
      {/* Right Eye */}
      <motion.div
        className="absolute bg-black rounded-full"
        style={{
          width: eyeSize,
          height: eyeSize,
          top: eyeOffsetY,
          right: eyeOffsetX,
        }}
        animate={{ y: [0, -1, 0] }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          repeatDelay: 2,
        }}
      />
      {/* Mouth - Neutral line */}
      <motion.div
        className="absolute bg-black rounded"
        style={{
          width: mouthWidth,
          height: mouthHeight,
          bottom: size * 0.2,
        }}
      />
    </motion.div>
  );
};

export default NeutralEmoji;
