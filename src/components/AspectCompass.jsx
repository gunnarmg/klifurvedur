// A small compass diagram showing the wall aspect and the sun position.
// The dark arc is the wall (it faces outward in its aspect direction).
// The dot is the sun.

export function AspectCompass({ aspect, sun }) {
  const cx = 65
  const cy = 65
  const r = 50

  // Wall arc: 180° arc centered on the aspect direction (the wall's "facing"
  // hemisphere). We sketch this as an arc on the FAR side from the aspect,
  // because that's the side of the rock the climber stands on (open air).
  const arcStart = aspect - 90
  const arcEnd = aspect + 90
  const sx = cx + r * Math.sin((arcStart * Math.PI) / 180)
  const sy = cy - r * Math.cos((arcStart * Math.PI) / 180)
  const ex = cx + r * Math.sin((arcEnd * Math.PI) / 180)
  const ey = cy - r * Math.cos((arcEnd * Math.PI) / 180)

  // Sun position: x,y on a smaller radius if below horizon
  const sunVisible = sun && sun.elevation > -2
  const sunR = sun && sun.elevation > 0 ? r - 8 : r + 6
  const sax = cx + sunR * Math.sin(((sun?.azimuth || 0) * Math.PI) / 180)
  const say = cy - sunR * Math.cos(((sun?.azimuth || 0) * Math.PI) / 180)

  return (
    <div className="compass">
      <svg viewBox="0 0 130 130" width="130" height="130">
        {/* outer ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-strong)" />
        {/* cardinals */}
        {['N', 'E', 'S', 'W'].map((c, i) => {
          const a = i * 90
          const x = cx + (r + 8) * Math.sin((a * Math.PI) / 180)
          const y = cy - (r + 8) * Math.cos((a * Math.PI) / 180) + 4
          return (
            <text
              key={c}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize="9"
              fill="var(--ink-faint)"
              fontFamily="var(--mono)"
              letterSpacing="0.1em"
            >
              {c}
            </text>
          )
        })}
        {/* wall arc — the rock face */}
        <path
          d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
          stroke="var(--accent)"
          strokeWidth="3"
          fill="none"
        />
        {/* aspect arrow — points outward in the aspect direction */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 6) * Math.sin((aspect * Math.PI) / 180)}
          y2={cy - (r - 6) * Math.cos((aspect * Math.PI) / 180)}
          stroke="var(--accent-bright)"
          strokeWidth="1.5"
        />
        <circle cx={cx} cy={cy} r="2.5" fill="var(--accent-bright)" />

        {/* sun */}
        {sunVisible && (
          <g>
            <circle
              cx={sax}
              cy={say}
              r="6"
              fill={sun.elevation > 0 ? '#f5c668' : 'transparent'}
              stroke="#f5c668"
              strokeWidth="1.5"
              opacity={sun.elevation > 0 ? 1 : 0.5}
            />
          </g>
        )}
      </svg>
    </div>
  )
}
