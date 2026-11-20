import { sunPosition, sunOnWall } from '../lib/sun.js'

// Build a bar that shows, for the local day containing `target`, when the
// wall is in the sun. Each hour becomes a slice; consecutive sunny slices
// merge into a band.
//
// Returns ranges as [{startHour, endHour}, ...] in local-clock hours
// (0–24, may include fractional). The day boundary is local midnight.

function buildSunRanges({ lat, lon, sector, dayStart }) {
  // Sample every 15 minutes through the 24h day
  const samples = []
  for (let i = 0; i < 24 * 4 + 1; i++) {
    const t = new Date(dayStart.getTime() + i * 15 * 60 * 1000)
    const sun = sunPosition(t, lat, lon)
    const onWall = sunOnWall(sector, sun)
    samples.push({
      hour: i / 4,
      lit: onWall.inSun && onWall.intensity > 0.05
    })
  }
  // Coalesce contiguous lit samples into ranges
  const ranges = []
  let start = null
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].lit && start == null) start = samples[i].hour
    if ((!samples[i].lit || i === samples.length - 1) && start != null) {
      const end = samples[i].lit ? samples[i].hour : samples[i - 1].hour
      ranges.push({ startHour: start, endHour: end })
      start = null
    }
  }
  return ranges
}

function fmtHour(h) {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function SunTimeline({ crag, sector, target }) {
  // Day starts at local midnight. Iceland = GMT, so UTC midnight is local midnight.
  const dayStart = new Date(target)
  dayStart.setUTCHours(0, 0, 0, 0)

  const ranges = buildSunRanges({ lat: crag.lat, lon: crag.lon, sector, dayStart })
  const totalHours = ranges.reduce((s, r) => s + (r.endHour - r.startHour), 0)

  // Where is `target` along the bar (0..1)
  const targetHour = (target.getTime() - dayStart.getTime()) / 3600 / 1000
  const nowPct = (targetHour / 24) * 100

  // Solar noon for the day (rough)
  const sunAtTarget = sunPosition(target, crag.lat, crag.lon)
  const targetOnWall = sunOnWall(sector, sunAtTarget)

  // Build a human summary
  let summary
  if (ranges.length === 0) {
    summary = <span><strong>No sun on the wall today.</strong></span>
  } else if (ranges.length === 1) {
    const r = ranges[0]
    summary = (
      <span>
        Sun on the wall <strong>{fmtHour(r.startHour)} – {fmtHour(r.endHour)}</strong>
        <span style={{ color: 'var(--ink-faint)', marginLeft: 8 }}>
          ({totalHours.toFixed(1)}h)
        </span>
      </span>
    )
  } else {
    summary = (
      <span>
        Sun: {ranges.map((r, i) => (
          <span key={i}>
            <strong>{fmtHour(r.startHour)}–{fmtHour(r.endHour)}</strong>
            {i < ranges.length - 1 ? ', ' : ''}
          </span>
        ))}
        <span style={{ color: 'var(--ink-faint)', marginLeft: 8 }}>
          ({totalHours.toFixed(1)}h)
        </span>
      </span>
    )
  }

  // Right now: in sun or in shade
  const nowState = targetOnWall.inSun
    ? <span style={{ color: 'var(--accent)' }}>● in sun now</span>
    : <span style={{ color: 'var(--ink-faint)' }}>○ in shade now</span>

  return (
    <div className="sun-timeline">
      <div className="sun-timeline-bar">
        {/* Night-shading: the part of the day where the sun is below horizon at all */}
        {(() => {
          // Find sun-up window for the day for night shading
          const samples = []
          for (let i = 0; i < 24 * 4 + 1; i++) {
            const t = new Date(dayStart.getTime() + i * 15 * 60 * 1000)
            const s = sunPosition(t, crag.lat, crag.lon)
            samples.push({ hour: i / 4, up: s.elevation > 0 })
          }
          const nightRanges = []
          let nstart = null
          for (let i = 0; i < samples.length; i++) {
            if (!samples[i].up && nstart == null) nstart = samples[i].hour
            if ((samples[i].up || i === samples.length - 1) && nstart != null) {
              const end = samples[i].up ? samples[i].hour : samples[i - 1].hour
              nightRanges.push({ startHour: nstart, endHour: end })
              nstart = null
            }
          }
          return nightRanges.map((r, i) => (
            <div
              key={`n${i}`}
              className="sun-timeline-night"
              style={{
                left: `${(r.startHour / 24) * 100}%`,
                width: `${((r.endHour - r.startHour) / 24) * 100}%`
              }}
            />
          ))
        })()}
        {/* Sun-on-wall ranges */}
        {ranges.map((r, i) => (
          <div
            key={i}
            className="sun-timeline-sun"
            style={{
              left: `${(r.startHour / 24) * 100}%`,
              width: `${((r.endHour - r.startHour) / 24) * 100}%`
            }}
            title={`${fmtHour(r.startHour)} – ${fmtHour(r.endHour)}`}
          />
        ))}
        {/* "Now" indicator */}
        <div
          className="sun-timeline-now"
          style={{ left: `${nowPct}%` }}
          title={`Selected time: ${fmtHour(targetHour)}`}
        />
      </div>
      <div className="sun-timeline-axis">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
      <div className="sun-timeline-summary">
        {summary}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 4 }}>
        {nowState}
      </div>
    </div>
  )
}
