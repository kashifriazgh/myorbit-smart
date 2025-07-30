'use client';
import { motion } from 'framer-motion';

const HappyEmoji = ({
  level = 3, // mood level: 1 (low) to 5 (very happy)
  size = 64,
}: {
  level?: number;
  size?: number;
}) => {
  const eyeSize = size * 0.1;

  const clampedLevel = Math.max(1, Math.min(level, 5));
  const curveScale = (clampedLevel - 1) / 4;

  const mouthWidth = size * 0.4;
  const mouthHeight = size * (0.1 + 0.1 * curveScale);
  const borderRadius = `${10 + 90 * curveScale}px`;
  const borderWidth = 2 + 2 * curveScale;

  const greenShades = ['#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a'];
  const bgColor = greenShades[clampedLevel - 1];

  const eyeSpacing = size * (0.25 + 0.02 * curveScale);
  const dynamicEyeSize = eyeSize * (1 + 0.2 * curveScale);

  return (
    <motion.div
      className="relative rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
      }}
      animate={{ backgroundColor: bgColor }}
      transition={{
        type: 'tween',
        duration: 0.4,
        ease: 'easeInOut',
      }}
    >
      {/* Eyes */}
      <motion.div
        className="absolute bg-black rounded-full"
        style={{
          width: dynamicEyeSize,
          height: dynamicEyeSize,
          top: size * 0.3,
          left: eyeSpacing,
        }}
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
      <motion.div
        className="absolute bg-black rounded-full"
        style={{
          width: dynamicEyeSize,
          height: dynamicEyeSize,
          top: size * 0.3,
          right: eyeSpacing,
        }}
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />

      {/* Mouth */}
      <motion.div
        className="absolute border-b border-black"
        style={{
          width: mouthWidth,
          height: mouthHeight,
          bottom: size * 0.25,
          borderBottomWidth: borderWidth,
          borderRadius: `0 0 ${borderRadius} ${borderRadius}`,
        }}
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
    </motion.div>
  );
};

export default HappyEmoji;
