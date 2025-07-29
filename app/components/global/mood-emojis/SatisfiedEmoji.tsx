const SatisfiedEmoji = ({
  color = '#86efac',
  size = 64,
}: {
  color?: string;
  size?: number;
}) => {
  const eyeSize = size * 0.1;

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

      {/* Subtle smile with dimples */}
      <div
        className="absolute border-b-4 border-black"
        style={{
          width: size * 0.35,
          height: size * 0.15,
          bottom: size * 0.2,
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: '0 0 80px 80px',
        }}
      />
    </div>
  );
};

export default SatisfiedEmoji;
