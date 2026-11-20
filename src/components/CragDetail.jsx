import { useMemo } from 'react'
import { sunPosition, sunOnWall } from '../lib/sun.js'
import { scoreConditions } from '../lib/score.js'
import { computeWetness, wetnessVerdict } from '../lib/wetness.js'
import { ScoreTile } from './ScoreTile.jsx'
import { SectorEditor } from './SectorEditor.jsx'
import { AspectCompass } from './AspectCompass.jsx'
import { SunTimeline } from './SunTimeline.jsx'

function formatHour(d) {
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Atlantic/Reykjavik'
  })
}

function formatDay(d) {
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'Atlantic/Reykjavik'
  })
}

export function CragDetail({ crag, station, target, onChange, isAdmin }) {
  const sector = crag.sectors[0]

  // Build a timeline of forecasts × per-sector conditions, including the
  // past_days rows. Each row carries its own wetness estimate computed from
  // the history up to that row's time.
  const timeline = useMemo(() => {
    if (!station?.forecast) return []
    return station.forecast.map((f) => {
      const sun = sunPosition(f.time, crag.lat, crag.lon)
      const onWall = sunOnWall(sector, sun)
      const wet = computeWetness({
        forecasts: station.forecast,
        target: f.time,
        sector,
        lat: crag.lat,
        lon: crag.lon
      })
      const wetnessInfo = { ...wet, verdict: wetnessVerdict(wet.wetness) }
      const conds = scoreConditions({ forecast: f, sun: onWall, sector, wetness: wetnessInfo })
      return { f, sun, onWall, conds, wetness: wetnessInfo }
    })
  }, [station, crag, sector])

  // Find the row at the target time for highlighting
  const targetTime = target?.getTime?.()
  const targetSun = useMemo(() => target ? sunPosition(target, crag.lat, crag.lon) : null, [target, crag])
  const targetOnWall = useMemo(() => targetSun ? sunOnWall(sector, targetSun) : null, [targetSun, sector])

  // Wetness at target — extract for the wetness panel
  const targetWetness = useMemo(() => {
    if (!station?.forecast) return null
    const wet = computeWetness({
      forecasts: station.forecast,
      target,
      sector,
      lat: crag.lat,
      lon: crag.lon
    })
    return { ...wet, verdict: wetnessVerdict(wet.wetness) }
  }, [station, target, sector, crag.lat, crag.lon])

  // Recent precipitation summary for the wetness panel
  const recentPrecip = useMemo(() => {
    if (!station?.forecast) return null
    const since = target.getTime() - 36 * 3600 * 1000
    const rows = station.forecast.filter(
      (f) => f.time.getTime() >= since && f.time.getTime() <= target.getTime()
    )
    const total = rows.reduce((s, r) => s + (r.precipMm || 0), 0)
    const last24 = rows
      .filter((f) => f.time.getTime() >= target.getTime() - 24 * 3600 * 1000)
      .reduce((s, r) => s + (r.precipMm || 0), 0)
    return { total36h: total, total24h: last24 }
  }, [station, target])

  return (
    <section className="detail">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="sub">{crag.region}</div>
          <h2>{crag.name}</h2>
          <div style={{ color: 'var(--ink-dim)', fontSize: 13, maxWidth: 600, marginTop: 6 }}>{crag.notes}</div>
          {crag.topo && (
            <div style={{ marginTop: 10 }}>
              <a href={crag.topo} target="_blank" rel="noreferrer">↗ Topo / route guide</a>
            </div>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {/* Sun timeline — the headline sun explainer */}
        <div className="panel" style={{ gridColumn: 'span 2' }}>
          <h3>Sun on the wall — today</h3>
          <SunTimeline crag={crag} sector={sector} target={target} />
        </div>

        {/* Wetness — the new panel */}
        <div className="panel">
          <h3>Rock wetness</h3>
          {targetWetness ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 28,
                  fontWeight: 600,
                  color: wetnessColor(targetWetness.verdict.label)
                }}>
                  {targetWetness.verdict.label}
                </span>
                <span style={{ color: 'var(--ink-faint)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  ({(targetWetness.wetness * 100).toFixed(0)}%)
                </span>
              </div>
              <dl className="kv" style={{ marginTop: 12 }}>
                {targetWetness.lastRainHoursAgo != null && (
                  <>
                    <dt>Last rain</dt>
                    <dd>
                      {targetWetness.lastRainHoursAgo < 1
                        ? 'right now'
                        : targetWetness.lastRainHoursAgo < 24
                          ? `${Math.round(targetWetness.lastRainHoursAgo)}h ago`
                          : `${Math.round(targetWetness.lastRainHoursAgo / 24)} day(s) ago`}
                    </dd>
                  </>
                )}
                {recentPrecip && (
                  <>
                    <dt>Past 24h</dt>
                    <dd>{recentPrecip.total24h.toFixed(1)} mm</dd>
                    <dt>Past 36h</dt>
                    <dd>{recentPrecip.total36h.toFixed(1)} mm</dd>
                  </>
                )}
              </dl>
            </>
          ) : (
            <div style={{ color: 'var(--ink-faint)' }}>No data</div>
          )}
        </div>

        {/* Sector geometry — compass moved here as a smaller detail */}
        <div className="panel">
          <h3>Sector geometry</h3>
          <AspectCompass aspect={sector.aspect} sun={targetSun} />
          <dl className="kv" style={{ marginTop: 10 }}>
            <dt>Aspect</dt>
            <dd>
              {sector.aspect.toFixed(0)}° <span style={{ color: 'var(--ink-faint)' }}>({compassFromDeg(sector.aspect)})</span>
            </dd>
            <dt>Sun azimuth</dt>
            <dd>{targetSun ? `${targetSun.azimuth.toFixed(0)}°` : '—'}</dd>
            <dt>Sun elevation</dt>
            <dd>{targetSun ? `${targetSun.elevation.toFixed(1)}°` : '—'}</dd>
            <dt>On the wall</dt>
            <dd>{targetOnWall?.inSun ? `Yes (${(targetOnWall.intensity * 100).toFixed(0)}%)` : 'No'}</dd>
          </dl>
        </div>

        {/* Sector editor — admin only */}
        <div className="panel">
          {isAdmin ? (
            <>
              <h3>Sectors — edit</h3>
              <SectorEditor crag={crag} onChange={onChange} />
            </>
          ) : (
            <h3>Sectors</h3>
          )}
          <dl className="kv" style={{ marginTop: 12 }}>
            {!isAdmin && crag.sectors.map((s) => (
              <span key={s.id}>
                <dt>{s.name} aspect</dt>
                <dd>{s.aspect.toFixed(0)}° ({compassFromDeg(s.aspect)})</dd>
              </span>
            ))}
            <dt>Coordinates</dt>
            <dd>{crag.lat.toFixed(4)}, {crag.lon.toFixed(4)}</dd>
            <dt>Drive from RVK</dt>
            <dd>{crag.driveMinFromRvk} min</dd>
          </dl>
        </div>

        {/* Forecast table */}
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <h3>Forecast — past 48h + next 72h</h3>
          {timeline.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>No forecast data.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="forecast">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>°C</th>
                    <th>Wind</th>
                    <th>Cloud</th>
                    <th>Rain</th>
                    <th>Wet</th>
                    <th>Sun</th>
                    <th>Score</th>
                    <th style={{ minWidth: 220 }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map(({ f, onWall, conds, wetness }, i) => {
                    const isTarget = targetTime && Math.abs(f.time.getTime() - targetTime) < 30 * 60 * 1000
                    const isPast = f.time.getTime() < Date.now() - 60 * 60 * 1000
                    const cls = `${isTarget ? 'is-target' : ''} ${isPast ? 'is-past' : ''}`.trim()
                    return (
                      <tr key={i} className={cls}>
                        <td>
                          <span style={{ color: 'var(--ink-faint)', marginRight: 6 }}>
                            {formatDay(f.time)}
                          </span>
                          {formatHour(f.time)}
                        </td>
                        <td>{Number.isFinite(f.temp) ? f.temp.toFixed(0) : '—'}</td>
                        <td>
                          {Number.isFinite(f.windSpeed) ? `${f.windSpeed.toFixed(0)} m/s` : '—'}
                          {f.windDirText && (
                            <span style={{ color: 'var(--ink-faint)', marginLeft: 4 }}>{f.windDirText}</span>
                          )}
                        </td>
                        <td>{Number.isFinite(f.cloudPct) ? `${f.cloudPct}%` : '—'}</td>
                        <td>{Number.isFinite(f.precipMm) ? f.precipMm.toFixed(1) : '—'}</td>
                        <td style={{ color: wetnessColor(wetness?.verdict.label) }}>
                          {wetness ? wetness.verdict.label : '—'}
                        </td>
                        <td>{onWall?.inSun ? `${(onWall.intensity * 100).toFixed(0)}%` : '—'}</td>
                        <td>
                          <span className="score-cell" style={{ color: bandColor(conds.band?.tone) }}>
                            {conds.score ?? '—'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--ink-dim)', textAlign: 'left', fontSize: 11 }}>
                          {conds.headline}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function compassFromDeg(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function bandColor(tone) {
  return ({
    go: 'var(--tone-go)',
    good: 'var(--tone-good)',
    marginal: 'var(--tone-marginal)',
    poor: 'var(--tone-poor)',
    nogo: 'var(--tone-nogo)'
  })[tone] || 'var(--ink)'
}

function wetnessColor(label) {
  return ({
    'Dry': 'var(--tone-go)',
    'Mostly dry': 'var(--tone-good)',
    'Damp': 'var(--tone-marginal)',
    'Wet': 'var(--tone-poor)',
    'Soaked': 'var(--tone-nogo)'
  })[label] || 'var(--ink)'
}
