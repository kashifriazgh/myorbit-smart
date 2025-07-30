'use client';

const DeadSadEmoji = ({
  color = '#f87171',
  size = 64,
}: {
  color?: string;
  size?: number;
}) => {
  const eyeSize = size * 0.12;
  const mouthWidth = size * 0.4;
  const mouthHeight = size * 0.2;

  return (
    <div
      className="relative rounded-full shadow-sm"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
      }}
    >
      {/* X Eyes */}
      {['left', 'right'].map((side) => (
        <div
          key={side}
          className="absolute"
          style={{
            top: size * 0.28,
            [side]: size * 0.22,
            width: eyeSize,
            height: eyeSize,
          }}
        >
          <div
            className="absolute bg-black"
            style={{
              width: eyeSize,
              height: 2,
              transform: 'rotate(45deg)',
              borderRadius: 2,
              top: eyeSize / 2 - 1,
              left: 0,
            }}
          />
          <div
            className="absolute bg-black"
            style={{
              width: eyeSize,
              height: 2,
              transform: 'rotate(-45deg)',
              borderRadius: 2,
              top: eyeSize / 2 - 1,
              left: 0,
            }}
          />
        </div>
      ))}

      {/* Sad curved mouth */}
      <svg
        className="absolute"
        style={{
          bottom: size * 0.18,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
        width={mouthWidth}
        height={mouthHeight}
        viewBox={`0 0 ${mouthWidth} ${mouthHeight}`}
      >
        <path
          d={`M0 ${mouthHeight} Q ${
            mouthWidth / 2
          } 0, ${mouthWidth} ${mouthHeight}`}
          stroke="black"
          strokeWidth="4"
          fill="transparent"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default DeadSadEmoji;
