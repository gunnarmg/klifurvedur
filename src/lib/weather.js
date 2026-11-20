// Open-Meteo client.
//
// Why Open-Meteo: free, no API key, CORS-open, lat/lon based (no station
// mapping). Combines national weather models including MET Norway and ECMWF
// IFS, both with good Iceland coverage. Hourly resolution, ~10 ms response.
//
// Docs: https://open-meteo.com/en/docs
//
// Endpoint:
//   GET https://api.open-meteo.com/v1/forecast
//     ?latitude=...&longitude=...
//     &hourly=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,dew_point_2m
//     &wind_speed_unit=ms
//     &timezone=GMT
//     &past_days=2&forecast_days=3
//
// The query itself lives in openmeteo.js, shared with scripts/fetch.mjs.
//
// Response:
//   {
//     latitude, longitude, timezone, ...,
//     hourly: {
//       time: ['2026-05-09T00:00', ...],     // ISO local time (no Z)
//       temperature_2m: [4.2, 4.1, ...],
//       precipitation: [0, 0.1, ...],
//       wind_speed_10m: [3.4, 3.6, ...],     // m/s
//       wind_direction_10m: [110, 115, ...], // degrees
//       cloud_cover: [80, 75, ...],          // %
//       dew_point_2m: [1.2, 1.1, ...]
//     }
//   }

import { BASE, forecastParams, pointKey } from './openmeteo.js'

const cache = new Map() // 'lat,lon' → { fetchedAt, data }
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 min — Open-Meteo updates hourly

// data.json is written by scripts/fetch.mjs on a schedule (GitHub Actions) and
// shipped with the site. We use it while it is fresh; once it is older than
// this we ask Open-Meteo directly and keep the snapshot as the fallback.
const SNAPSHOT_FRESH_MS = 4 * 60 * 60 * 1000

// Parse the local-time string (no Z) coming back. We always request
// timezone=GMT, and Iceland is UTC year-round, so tagging with Z gives the
// correct instant.
function parseTime(s) {
  return new Date(s + ':00Z')
}

// Turn Open-Meteo's column-oriented `hourly` block into forecast rows.
function toRows(h) {
  const times = h?.time || []
  return times.map((t, i) => ({
    time: parseTime(t),
    temp: h.temperature_2m?.[i],
    precipMm: h.precipitation?.[i],
    windSpeed: h.wind_speed_10m?.[i],
    windDir: h.wind_direction_10m?.[i],
    windDirText: degToCompass(h.wind_direction_10m?.[i]),
    cloudPct: h.cloud_cover?.[i],
    dewPoint: h.dew_point_2m?.[i],
    weatherText: '' // Open-Meteo has weather_code but we omit it for now
  }))
}

let snapshotPromise = null

// Load data.json once per page load. Resolves to null if it is missing or
// unreadable (e.g. local dev before the first `npm run fetch`).
function loadSnapshot() {
  if (!snapshotPromise) {
    snapshotPromise = fetch(`${import.meta.env.BASE_URL}data.json`, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const generated = json?.generated ? new Date(json.generated) : null
        if (!json?.points || !generated || Number.isNaN(generated.getTime())) return null
        return { generated, points: json.points }
      })
      .catch(() => null)
  }
  return snapshotPromise
}

async function fetchLive(lat, lon) {
  const key = pointKey(lat, lon)
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.data

  const [la, lo] = key.split(',')
  const res = await fetch(`${BASE}?${forecastParams(la, lo)}`)
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json()).reason || '' } catch {}
    throw new Error(`Open-Meteo ${res.status}${detail ? ': ' + detail : ''}`)
  }
  const json = await res.json()
  const data = { name: key, forecast: toRows(json.hourly), source: 'live', generated: new Date(now) }
  cache.set(key, { fetchedAt: now, data })
  return data
}

async function fetchOne(lat, lon) {
  const key = pointKey(lat, lon)
  const snap = await loadSnapshot()
  const hourly = snap?.points?.[key]
  const fromSnapshot = hourly
    ? { name: key, forecast: toRows(hourly), source: 'snapshot', generated: snap.generated }
    : null

  if (fromSnapshot && Date.now() - snap.generated.getTime() < SNAPSHOT_FRESH_MS) return fromSnapshot

  try {
    return await fetchLive(lat, lon)
  } catch (e) {
    if (fromSnapshot) return fromSnapshot // stale beats nothing
    throw e
  }
}

// Fetch forecasts for many points in parallel; returns a map keyed by crag id.
export async function fetchForecasts(crags) {
  const entries = await Promise.all(
    crags.map(async (c) => {
      try {
        const data = await fetchOne(c.lat, c.lon)
        return [c.id, data]
      } catch (e) {
        return [c.id, { error: e.message || 'Failed' }]
      }
    })
  )
  return Object.fromEntries(entries)
}

export function nearestForecast(forecasts, target) {
  if (!forecasts?.length) return null
  let best = null
  let bestDiff = Infinity
  for (const f of forecasts) {
    const diff = Math.abs(f.time.getTime() - target.getTime())
    if (diff < bestDiff) {
      bestDiff = diff
      best = f
    }
  }
  // Open-Meteo gives hourly data so >75 min away means we're past the window.
  if (bestDiff > 75 * 60 * 1000) return null
  return best
}

function degToCompass(deg) {
  if (deg == null || Number.isNaN(deg)) return null
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}
