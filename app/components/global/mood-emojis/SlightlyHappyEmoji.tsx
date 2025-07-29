const SlightlyHappyEmoji = ({
  color = '#fcd34d',
  size = 64,
}: {
  color?: string;
  size?: number;
}) => {
  const eyeSize = size * 0.1;
  const mouthWidth = size * 0.35;
  const mouthHeight = size * 0.1;

  return (
    <div
      className="relative rounded-full"
      style={{ backgroundColor: color, width: size, height: size }}
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

      {/* Slight Smile */}
      <div
        className="absolute border-b-4 border-black"
        style={{
          width: mouthWidth,
          height: mouthHeight,
          bottom: size * 0.23,
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: '0 0 50px 50px',
        }}
      />
    </div>
  );
};

export default SlightlyHappyEmoji;
