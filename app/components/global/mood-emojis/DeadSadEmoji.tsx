const DeadSadEmoji = ({
  color = '#f87171',
  size = 64,
}: {
  color?: string;
  size?: number;
}) => {
  const mouthWidth = size * 0.4;
  const mouthHeight = size * 0.15;

  return (
    <div
      className="relative rounded-full"
      style={{ backgroundColor: color, width: size, height: size }}
    >
      {/* X Eyes */}
      {['left', 'right'].map((side) => (
        <div
          key={side}
          className="absolute"
          style={{ top: size * 0.28, [side]: size * 0.24 }}
        >
          <div
            className="absolute w-3 h-0.5 bg-black rotate-45"
            style={{ width: size * 0.08 }}
          />
          <div
            className="absolute w-3 h-0.5 bg-black -rotate-45"
            style={{ width: size * 0.08 }}
          />
        </div>
      ))}

      {/* Sad mouth */}
      <div
        className="absolute border-t-4 border-black"
        style={{
          width: mouthWidth,
          height: mouthHeight,
          bottom: size * 0.2,
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: '100px 100px 0 0',
        }}
      />
    </div>
  );
};

export default DeadSadEmoji;
