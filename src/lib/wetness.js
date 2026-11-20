// Wetness model.
//
// Given the sequence of hourly forecast rows leading up to the target time,
// estimate how wet the rock is. Rain accumulates; sun, wind, and dry air burn
// it off over the following hours.
//
// We track a single "wetness" number in [0, 1]:
//   0 = bone dry
//   ~0.3 = the surface is dry but seams/cracks may seep
//   ~0.6 = visibly damp, slick
//   1 = streaming wet
//
// Each hour we add precipitation to the budget (capped) and subtract a drying
// rate that depends on local conditions. This is *not* physics — it's a
// calibrated heuristic that matches what climbers actually observe: a heavy
// rain on a windless overcast day takes ~24h to dry; the same rain followed
// by sun and wind dries by lunch.

import { sunPosition, sunOnWall } from './sun.js'

// How much each mm of precipitation adds to wetness. Saturating: more than
// ~6mm in an hour doesn't make the rock meaningfully wetter than 6mm did.
function wettingFromRain(mmPerHour) {
  if (!mmPerHour || mmPerHour <= 0) return 0
  // mm 0.1 → +0.05, mm 1 → +0.3, mm 5 → +0.85, mm 10 → +1
  return Math.min(1, 0.3 * Math.log10(1 + mmPerHour * 9))
}

// Drying rate per hour, in wetness units. Determined by:
//   - direct sun on the wall (biggest factor)
//   - wind speed (drying breeze)
//   - dew-point spread (dry air)
//   - cold or freezing air (slows drying a lot)
function dryingPerHour({ forecast, onWall }) {
  const t = forecast.temp ?? 5
  if (t < 0) return 0.005 // freezing — basically no drying

  let rate = 0.02 // baseline overcast still air

  // Sun on the wall is the king. Effective sun is intensity × clear sky.
  const cloudFactor = 1 - (forecast.cloudPct ?? 50) / 100
  if (onWall?.inSun) {
    rate += onWall.intensity * cloudFactor * 0.18
  }

  // Wind helps a lot.
  const wind = forecast.windSpeed ?? 0
  rate += Math.min(wind, 12) * 0.012 // 0–0.14 across 0–12 m/s

  // Dry air helps.
  if (forecast.dewPoint != null) {
    const spread = t - forecast.dewPoint
    if (spread > 6) rate += 0.04
    else if (spread > 3) rate += 0.02
    else if (spread < 1) rate -= 0.01 // saturated air doesn't dry
  }

  // Warm air helps (more energy + lower RH).
  if (t > 12) rate += (t - 12) * 0.005

  return Math.max(0.005, rate)
}

// Run the model from `lookbackHours` before the target time up to the target,
// stepping hourly, returning the final wetness value plus a trace for
// debugging / display.
//
// `forecasts` is the full series (which may include past_days from the API).
// We pick the rows whose times fall in [target − lookback, target].
export function computeWetness({ forecasts, target, sector, lat, lon, lookbackHours = 36 }) {
  if (!forecasts?.length) return { wetness: 0, trace: [], lastRainHoursAgo: null }

  const start = target.getTime() - lookbackHours * 3600 * 1000
  const window = forecasts
    .filter((f) => f.time.getTime() >= start && f.time.getTime() <= target.getTime())
    .sort((a, b) => a.time - b.time)

  if (!window.length) return { wetness: 0, trace: [], lastRainHoursAgo: null }

  let wetness = 0
  let lastRainAt = null
  const trace = []

  for (const f of window) {
    const sun = sunPosition(f.time, lat, lon)
    const onWall = sunOnWall(sector, sun)
    const wet = wettingFromRain(f.precipMm)
    // If it's actively raining this hour, we don't dry — the rock can't dry
    // while water is hitting it. (This matters most for the "right now"
    // forecast row when it's drizzling.)
    const dry = wet > 0.02 ? 0 : dryingPerHour({ forecast: f, onWall })
    wetness = Math.max(0, Math.min(1, wetness + wet - dry))
    if (wet > 0) lastRainAt = f.time
    trace.push({ time: f.time, precipMm: f.precipMm, wet, dry, wetness, sun, onWall })
  }

  const lastRainHoursAgo =
    lastRainAt == null ? null : (target.getTime() - lastRainAt.getTime()) / 3600 / 1000

  return { wetness, trace, lastRainHoursAgo }
}

// Translate a wetness number into a human label and the score multiplier the
// scorer should apply.
export function wetnessVerdict(wetness) {
  if (wetness < 0.05) return { label: 'Dry', penalty: 0 }
  if (wetness < 0.2) return { label: 'Mostly dry', penalty: 8 }
  if (wetness < 0.4) return { label: 'Damp', penalty: 25 }
  if (wetness < 0.7) return { label: 'Wet', penalty: 60 }
  return { label: 'Soaked', penalty: 100 } // floor the score
}
