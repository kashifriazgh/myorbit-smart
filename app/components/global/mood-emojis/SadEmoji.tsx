const SadEmoji = ({
  color = '#f87171',
  size = 64,
}: {
  color?: string;
  size?: number;
}) => {
  const eyeSize = size * 0.1;
  const mouthWidth = size * 0.4;
  const mouthHeight = size * 0.2;

  return (
    <div
      className="relative rounded-full flex items-center justify-center"
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
          top: size * 0.3,
          left: size * 0.25,
        }}
      />
      <div
        className="absolute bg-black rounded-full"
        style={{
          width: eyeSize,
          height: eyeSize,
          top: size * 0.3,
          right: size * 0.25,
        }}
      />

      {/* Smooth sad mouth */}
      <div
        className="absolute border-t-4 border-black"
        style={{
          width: mouthWidth,
          height: mouthHeight,
          bottom: size * 0.2,
          borderRadius: '100px 100px 0 0',
        }}
      />
    </div>
  );
};

export default SadEmoji;
