export function LexaraIcon({ size = 36, className, onClick, style }) {
  const scale = size / 36;
  const rx = 9 * scale;
  const lineHeight = 1.5 * scale;
  const lineRadius = 0.75 * scale;
  const strokeWidth = 2.2 * scale;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      onClick={onClick}
      style={style}
      role="img"
      aria-label="Lexara icon"
    >
      <rect width={size} height={size} rx={rx} fill="#2356d8" />
      <rect x={8 * scale} y={16 * scale} width={9 * scale} height={lineHeight} rx={lineRadius} fill="rgba(255,255,255,0.4)" />
      <rect x={8 * scale} y={20 * scale} width={13 * scale} height={lineHeight} rx={lineRadius} fill="rgba(255,255,255,0.4)" />
      <rect x={8 * scale} y={24 * scale} width={7 * scale} height={lineHeight} rx={lineRadius} fill="rgba(255,255,255,0.4)" />
      <path
        d={`M${21 * scale} ${27 * scale} L${21 * scale} ${11 * scale} M${16.5 * scale} ${15.5 * scale} L${21 * scale} ${11 * scale} L${25.5 * scale} ${15.5 * scale}`}
        stroke="white"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function LexaraLogo({ height = 36, className, onClick, style }) {
  const markSize = height;
  const gap = 12;
  const textWidth = Math.max(90, height * 2.5);
  const width = markSize + gap + textWidth;
  const baselineY = height * 0.69;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      onClick={onClick}
      style={style}
      role="img"
      aria-label="Lexara logo"
    >
      <g>
        <rect width={markSize} height={markSize} rx={markSize * 0.25} fill="#2356d8" />
        <rect x={markSize * 0.2222} y={markSize * 0.4444} width={markSize * 0.25} height={markSize * 0.0416} rx={markSize * 0.0208} fill="rgba(255,255,255,0.4)" />
        <rect x={markSize * 0.2222} y={markSize * 0.5555} width={markSize * 0.3611} height={markSize * 0.0416} rx={markSize * 0.0208} fill="rgba(255,255,255,0.4)" />
        <rect x={markSize * 0.2222} y={markSize * 0.6666} width={markSize * 0.1944} height={markSize * 0.0416} rx={markSize * 0.0208} fill="rgba(255,255,255,0.4)" />
        <path
          d={`M${markSize * 0.5833} ${markSize * 0.75} L${markSize * 0.5833} ${markSize * 0.3055} M${markSize * 0.4583} ${markSize * 0.4305} L${markSize * 0.5833} ${markSize * 0.3055} L${markSize * 0.7083} ${markSize * 0.4305}`}
          stroke="white"
          strokeWidth={markSize * 0.0611}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
      <text
        x={markSize + gap}
        y={baselineY}
        fill="#1a1814"
        fontFamily="'DM Sans', sans-serif"
        fontWeight="700"
        fontSize={height * 0.63}
        letterSpacing="-0.3px"
      >
        Lexara
      </text>
    </svg>
  );
}
