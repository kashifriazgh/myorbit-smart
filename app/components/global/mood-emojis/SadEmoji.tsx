'use client';
import { motion } from 'framer-motion';

interface SadEmojiProps {
  level?: number; // 0 (not sad) to 10 (very sad)
  size?: number;
}

const SadEmoji = ({ level = 0, size = 64 }: SadEmojiProps) => {
  const eyeSize = size * 0.1;
  const sadness = Math.min(Math.max(level, 0), 10);

  // Greenish red to red spectrum for sadness (staying mostly within red hue)
  const bgColor = [
    '#fef2f2', // lightest
    '#fde8e8',
    '#fbd5d5',
    '#f8b4b4',
    '#f98080',
    '#f05252',
    '#e02424',
    '#c81e1e',
    '#9b1c1c',
    '#771d1d',
    '#5a1d1d', // darkest
  ][sadness];

  // Mouth arc adjustment (deeper curve with higher sadness)
  const mouthHeight = size * 0.05 + sadness * 0.015 * size; // from 5% to ~20% of size

  return (
    <motion.div
      layout
      className="relative rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
      }}
      animate={{
        backgroundColor: bgColor,
      }}
      transition={{ duration: 0.4 }}
    >
      {/* Eyes */}
      <motion.div
        className="absolute bg-black rounded-full"
        style={{
          width: eyeSize,
          height: eyeSize,
          top: size * 0.3,
          left: size * 0.25,
          rotate: -sadness * 2,
        }}
        animate={{ scaleY: 1 + sadness * 0.05 }}
        transition={{ duration: 0.3 }}
      />
      <motion.div
        className="absolute bg-black rounded-full"
        style={{
          width: eyeSize,
          height: eyeSize,
          top: size * 0.3,
          right: size * 0.25,
          rotate: sadness * 2,
        }}
        animate={{ scaleY: 1 + sadness * 0.05 }}
        transition={{ duration: 0.3 }}
      />

      {/* Mouth */}
      <motion.div
        className="absolute border-t-4 border-black"
        style={{
          width: size * 0.4,
          height: mouthHeight,
          bottom: size * 0.2,
          borderRadius: '100px 100px 0 0',
        }}
        animate={{ scaleY: 1 + sadness * 0.1 }}
        transition={{ duration: 0.4 }}
      />
    </motion.div>
  );
};

export default SadEmoji;
