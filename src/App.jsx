import { useEffect, useMemo, useState, useCallback } from 'react'
import { CRAGS as SEED_CRAGS } from './data/crags.js'
import { fetchForecasts, nearestForecast } from './lib/weather.js'
import { sunPosition, sunOnWall } from './lib/sun.js'
import { scoreConditions } from './lib/score.js'
import { computeWetness, wetnessVerdict } from './lib/wetness.js'
import { useLocalStorage } from './lib/useLocalStorage.js'
import { ScoreTile } from './components/ScoreTile.jsx'
import { CragMap } from './components/CragMap.jsx'
import { CragDetail } from './components/CragDetail.jsx'

const ADMIN_PASS = 'klifur2024'

// Format a Date as "YYYY-MM-DDTHH:MM" in Atlantic/Reykjavik for <input type=datetime-local>.
// Reykjavik is UTC year-round, so we can use the UTC components directly.
function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

function fromLocalInput(str) {
  // Treat the input as Atlantic/Reykjavik (= UTC).
  return new Date(str + ':00Z')
}

// Round a Date to the nearest hour. We always store target rounded so that
// nearestForecast() finds an exact match against Open-Meteo's hourly rows
// — no tie-breaking, no off-by-one, no drift across +3/-3 round trips.
function roundToHour(d) {
  const x = new Date(d)
  x.setUTCMinutes(0, 0, 0)
  if (d.getUTCMinutes() >= 30) x.setUTCHours(x.getUTCHours() + 1)
  return x
}

// Always run target through this when calling setTarget so it stays aligned
// to the hour and equality checks are reliable.
function alignTarget(d) {
  const x = new Date(d)
  x.setUTCMinutes(0, 0, 0)
  return x
}

export default function App() {
  // The user can edit crag data; we persist edits in localStorage.
  const [crags, setCrags] = useLocalStorage('klifurvedur.crags.v3', SEED_CRAGS)
  const [target, setTarget] = useState(() => roundToHour(new Date(Date.now() + 3 * 60 * 60 * 1000)))
  const [forecastsByCrag, setForecastsByCrag] = useState({})
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState(crags[0]?.id)

  // Admin auth — lightweight client-side gate for the sector editor.
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('klifurvedur.admin') === '1')
  const [showLogin, setShowLogin] = useState(false)
  const [loginError, setLoginError] = useState('')

  const handleLogin = useCallback((pass) => {
    if (pass === ADMIN_PASS) {
      sessionStorage.setItem('klifurvedur.admin', '1')
      setIsAdmin(true)
      setShowLogin(false)
      setLoginError('')
    } else {
      setLoginError('Wrong password')
    }
  }, [])

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('klifurvedur.admin')
    setIsAdmin(false)
  }, [])

  // Fetch forecasts for each crag (lat/lon based via Open-Meteo).
  // Refetches only when the list of crag locations changes.
  useEffect(() => {
    setLoading(true)
    fetchForecasts(crags)
      .then((data) => {
        setForecastsByCrag(data)
        // Per-crag errors are recorded inside the data; surface a banner only
        // if every single fetch failed (e.g. network/CORS).
        const errs = Object.values(data).filter((d) => d.error)
        if (errs.length === Object.keys(data).length && errs.length > 0) {
          setError(errs[0].error)
        } else {
          setError(null)
        }
      })
      .catch((e) => setError(e.message || 'Failed to fetch forecast'))
      .finally(() => setLoading(false))
  }, [crags.map((c) => `${c.id}:${c.lat},${c.lon}`).join('|')])

  // Compute the score for each crag at the target time.
  const scores = useMemo(() => {
    const out = {}
    for (const c of crags) {
      const data = forecastsByCrag[c.id]
      const f = nearestForecast(data?.forecast, target)
      const sun = sunPosition(target, c.lat, c.lon)
      const sector = c.sectors[0]
      const onWall = sunOnWall(sector, sun)
      const wet = computeWetness({
        forecasts: data?.forecast,
        target,
        sector,
        lat: c.lat,
        lon: c.lon
      })
      const wetnessInfo = {
        ...wet,
        verdict: wetnessVerdict(wet.wetness)
      }
      out[c.id] = scoreConditions({
        forecast: f,
        sun: onWall,
        sector,
        wetness: wetnessInfo
      })
    }
    return out
  }, [crags, forecastsByCrag, target])

  // Sort the list by score descending, with no-data sinking to the bottom.
  const sorted = useMemo(() => {
    return [...crags].sort((a, b) => {
      const sa = scores[a.id]?.score ?? -1
      const sb = scores[b.id]?.score ?? -1
      return sb - sa
    })
  }, [crags, scores])

  // When the weather data was fetched (oldest across crags), for the top bar.
  const dataTime = useMemo(() => {
    const times = Object.values(forecastsByCrag)
      .map((d) => d?.generated?.getTime?.())
      .filter((t) => Number.isFinite(t))
    if (!times.length) return null
    return new Date(Math.min(...times)).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'Atlantic/Reykjavik'
    })
  }, [forecastsByCrag])

  const selected = crags.find((c) => c.id === selectedId) || crags[0]
  const selectedData = selected ? forecastsByCrag[selected.id] : null

  const updateCrag = (updated) => {
    setCrags(crags.map((c) => (c.id === updated.id ? updated : c)))
  }

  const resetCrags = () => {
    if (window.confirm('Reset all sector edits to defaults?')) {
      setCrags(SEED_CRAGS)
    }
  }

  const setTomorrow5pm = () => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + 1)
    d.setUTCHours(17, 0, 0, 0)
    setTarget(d)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Klifurvedur
          <span className="sub">Sport climbing conditions — Iceland{dataTime ? ` · data from ${dataTime}` : ''}</span>
        </div>
        <div className="controls">
          <input
            type="datetime-local"
            step="3600"
            value={toLocalInput(target)}
            onChange={(e) => setTarget(alignTarget(fromLocalInput(e.target.value)))}
          />
          <div className="btn-group">
            <button onClick={() => setTarget(roundToHour(new Date()))}>Now</button>
            <button onClick={setTomorrow5pm}>Tomorrow</button>
          </div>
          <div className="btn-group">
            <button onClick={() => {
              const t = new Date(target)
              t.setUTCHours(t.getUTCHours() - 3)
              setTarget(alignTarget(t))
            }}>-3h</button>
            <button onClick={() => {
              const t = new Date(target)
              t.setUTCHours(t.getUTCHours() + 3)
              setTarget(alignTarget(t))
            }}>+3h</button>
          </div>
          <div className="sep" />
          <button onClick={resetCrags} title="Restore default crag/sector data">Reset</button>
          {isAdmin ? (
            <button onClick={handleLogout} title="Log out of admin">Admin ✓</button>
          ) : (
            <button onClick={() => setShowLogin(true)} title="Admin login to edit sectors">Admin</button>
          )}
        </div>
      </header>

      {showLogin && (
        <div className="modal-overlay" onClick={() => setShowLogin(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Admin login</h3>
            <form onSubmit={(e) => {
              e.preventDefault()
              handleLogin(e.target.elements.pass.value)
            }}>
              <label>
                Password
                <input name="pass" type="password" autoFocus />
              </label>
              {loginError && <div className="login-error">{loginError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" className="primary">Log in</button>
                <button type="button" onClick={() => setShowLogin(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && <div className="error-banner">⚠ {error}</div>}

      <div className="main">
        <div className="list-pane">
          {loading && !Object.keys(forecastsByCrag).length && (
            <div className="empty-state">Fetching forecasts…</div>
          )}
          {sorted.map((c) => {
            const s = scores[c.id]
            const data = forecastsByCrag[c.id]
            const hasError = data?.error
            return (
              <div
                key={c.id}
                className={`crag-row ${c.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <ScoreTile score={s?.score} band={s?.band} />
                <div>
                  <div className="crag-region">{c.region}</div>
                  <div className="crag-name">{c.name}</div>
                  <div className="crag-headline">
                    {hasError ? `⚠ ${data.error}` : (s?.headline || '—')}
                  </div>
                </div>
                <div className="crag-meta">
                  {c.driveMinFromRvk}<br/>min
                </div>
              </div>
            )
          })}
        </div>

        <div className="map-pane">
          <CragMap
            crags={crags}
            scores={scores}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>

      {selected && (
        <CragDetail
          crag={selected}
          station={selectedData}
          target={target}
          onChange={updateCrag}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
