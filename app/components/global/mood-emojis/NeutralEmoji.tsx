const NeutralEmoji = ({
  color = '#a3a3a3',
  size = 64,
}: {
  color?: string;
  size?: number;
}) => {
  const eyeSize = size * 0.1;

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

      {/* Straight line */}
      <div
        className="absolute bg-black"
        style={{
          width: size * 0.4,
          height: 3,
          bottom: size * 0.2,
        }}
      />
    </div>
  );
};

export default NeutralEmoji;
