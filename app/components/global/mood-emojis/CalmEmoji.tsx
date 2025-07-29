const CalmEmoji = ({
  color = '#93c5fd',
  size = 64,
}: {
  color?: string;
  size?: number;
}) => {
  const eyeWidth = size * 0.15;

  return (
    <div
      className="relative rounded-full"
      style={{ backgroundColor: color, width: size, height: size }}
    >
      {/* Calm Eyes – curved downward */}
      {['left', 'right'].map((side) => (
        <div
          key={side}
          className="absolute border-b-2 border-black"
          style={{
            width: eyeWidth,
            height: 5,
            top: size * 0.3,
            [side]: size * 0.22,
            borderRadius: '100px',
          }}
        />
      ))}

      {/* Calm straight mouth */}
      <div
        className="absolute bg-black"
        style={{
          width: size * 0.3,
          height: 3,
          bottom: size * 0.2,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
    </div>
  );
};

export default CalmEmoji;
