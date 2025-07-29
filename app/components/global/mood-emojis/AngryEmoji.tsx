const AngryEmoji = ({
  color = '#f87171',
  size = 64,
}: {
  color?: string;
  size?: number;
}) => {
  const eyeWidth = size * 0.12;

  return (
    <div
      className="relative rounded-full"
      style={{ backgroundColor: color, width: size, height: size }}
    >
      {/* Angry Eyes - Slanted */}
      <div
        className="absolute bg-black"
        style={{
          width: eyeWidth,
          height: 3,
          top: size * 0.3,
          left: size * 0.22,
          transform: 'rotate(20deg)',
          borderRadius: 2,
        }}
      />
      <div
        className="absolute bg-black"
        style={{
          width: eyeWidth,
          height: 3,
          top: size * 0.3,
          right: size * 0.22,
          transform: 'rotate(-20deg)',
          borderRadius: 2,
        }}
      />

      {/* Angry frown */}
      <div
        className="absolute border-t-4 border-black"
        style={{
          width: size * 0.35,
          height: size * 0.15,
          bottom: size * 0.2,
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: '100px 100px 0 0',
        }}
      />
    </div>
  );
};

export default AngryEmoji;
