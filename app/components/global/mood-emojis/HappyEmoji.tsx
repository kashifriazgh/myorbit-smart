const HappyEmoji = ({
  color = '#facc15',
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

      {/* Smooth smile using border curve */}
      <div
        className="absolute border-b-4 border-black"
        style={{
          width: mouthWidth,
          height: mouthHeight,
          bottom: size * 0.25,
          borderRadius: '0 0 100px 100px',
        }}
      />
    </div>
  );
};

export default HappyEmoji;
