const ExcitedEmoji = ({
  color = '#facc15',
  size = 64,
}: {
  color?: string;
  size?: number;
}) => {
  const eyeSize = size * 0.12;

  return (
    <div
      className="relative rounded-full"
      style={{ backgroundColor: color, width: size, height: size }}
    >
      {/* Open Eyes */}
      <div
        className="absolute bg-black rounded-full"
        style={{
          width: eyeSize,
          height: eyeSize,
          top: size * 0.25,
          left: size * 0.23,
        }}
      />
      <div
        className="absolute bg-black rounded-full"
        style={{
          width: eyeSize,
          height: eyeSize,
          top: size * 0.25,
          right: size * 0.23,
        }}
      />

      {/* Wide Open Smile */}
      <div
        className="absolute bg-black"
        style={{
          width: size * 0.4,
          height: size * 0.25,
          bottom: size * 0.15,
          left: '50%',
          transform: 'translateX(-50%)',
          borderBottomLeftRadius: '100px',
          borderBottomRightRadius: '100px',
        }}
      />
    </div>
  );
};

export default ExcitedEmoji;
