// Conditions scoring for sport climbing on Icelandic basalt.
//
// Inputs: a forecast row (from vedur.js), a sun result (from sun.js),
// and the sector being scored. Output: { score: 0-100, band, headline,
// reasons: string[] }.
//
// Philosophy: precipitation is a hard veto. After that, wind is the next most
// important — high wind ruins both belays and friction. Temperature has a
// sweet-spot rather than "warmer is better" (Icelandic basalt + dry hands
// likes 5–15°C). Sun on the wall is a major modifier: bonus when cold, penalty
// when warm. Cloud cover gates the sun term.
//
// Thresholds are calibrated for Icelandic basalt. Adjust if you climb mostly
// in the rain like a true local.

const SCORE_BANDS = [
  { min: 80, label: 'Prime', tone: 'go' },
  { min: 60, label: 'Good', tone: 'good' },
  { min: 40, label: 'Marginal', tone: 'marginal' },
  { min: 20, label: 'Poor', tone: 'poor' },
  { min: -Infinity, label: 'No-go', tone: 'nogo' }
]

function band(score) {
  return SCORE_BANDS.find((b) => score >= b.min)
}

// Smallest signed difference (a - b) wrapped to [-180, 180].
function bearingDelta(a, b) {
  let d = ((a - b) % 360 + 540) % 360 - 180
  return d
}

function formatHoursAgo(h) {
  if (h < 1) return 'less than 1h ago'
  if (h < 1.5) return '1h ago'
  if (h < 24) return `${Math.round(h)}h ago`
  const days = h / 24
  if (days < 1.5) return '1 day ago'
  return `${Math.round(days)} days ago`
}

export function scoreConditions({ forecast, sun, sector, wetness }) {
  if (!forecast) {
    return {
      score: null,
      band: { label: 'No data', tone: 'unknown' },
      headline: 'No forecast available',
      reasons: []
    }
  }

  const reasons = []
  let score = 100

  // 1. Currently raining heavily — hard veto regardless of history.
  const rain = forecast.precipMm ?? 0
  if (rain >= 1.0) {
    return {
      score: 0,
      band: { label: 'No-go', tone: 'nogo' },
      headline: `Raining (${rain.toFixed(1)} mm/h)`,
      reasons: [`${rain.toFixed(1)} mm/h precipitation right now`]
    }
  }

  // 2. Wetness from history (recent rain that hasn't dried out yet) is the
  // dominant signal. If we don't have a wetness estimate, fall back to the
  // forecast precipitation row.
  if (wetness) {
    const v = wetness.verdict
    if (v.penalty >= 100) {
      return {
        score: 0,
        band: { label: 'No-go', tone: 'nogo' },
        headline: 'Soaked rock',
        reasons: [`Rock soaked${wetness.lastRainHoursAgo != null ? ` (rain ${formatHoursAgo(wetness.lastRainHoursAgo)})` : ''}`]
      }
    }
    if (v.penalty > 0) {
      score -= v.penalty
      const since = wetness.lastRainHoursAgo
      if (v.label === 'Damp') {
        reasons.push(`Damp${since != null ? ` — rain ${formatHoursAgo(since)}` : ''}`)
      } else if (v.label === 'Wet') {
        reasons.push(`Wet${since != null ? ` — rain ${formatHoursAgo(since)}` : ''}`)
      } else if (v.label === 'Mostly dry') {
        reasons.push(`Mostly dry${since != null && since < 24 ? ` — rain ${formatHoursAgo(since)}` : ''}`)
      }
    }
  } else if (rain > 0) {
    // No wetness model available — light current rain still penalised.
    score -= 15
    reasons.push(`Trace precip ${rain.toFixed(1)} mm`)
  }

  // 2. Wind. Direction matters: a wall sheltered from the wind direction
  // is fine even at moderate speeds; a wall facing into the wind suffers.
  const wind = forecast.windSpeed ?? 0
  let windPenalty = 0
  if (wind <= 4) {
    reasons.push(`Light wind ${wind.toFixed(0)} m/s`)
  } else if (wind <= 8) {
    windPenalty = (wind - 4) * 2 // 0–8
    reasons.push(`Wind ${wind.toFixed(0)} m/s`)
  } else if (wind <= 12) {
    windPenalty = 8 + (wind - 8) * 4 // 8–24
    reasons.push(`Stiff wind ${wind.toFixed(0)} m/s`)
  } else {
    windPenalty = 24 + (wind - 12) * 6
    reasons.push(`Strong wind ${wind.toFixed(0)} m/s — dangerous`)
  }

  // Wind exposure: if wind blows TOWARD the wall (into the climber's face),
  // it's worse than wind blowing parallel or from behind. Wind direction in
  // meteorology is "where the wind is coming FROM." A wall of aspect A faces
  // direction A; wind from direction A blows directly onto it.
  if (forecast.windDir != null && wind > 3) {
    const delta = Math.abs(bearingDelta(forecast.windDir, sector.aspect))
    // delta=0 means wind from the direction the wall faces → straight at it.
    // delta=180 means wind from behind → sheltered.
    const exposure = Math.cos((delta * Math.PI) / 180) // 1 exposed, -1 sheltered
    windPenalty *= 1 + exposure * 0.4 // up to ±40%
    if (exposure > 0.5) reasons.push('Wind on the wall')
    else if (exposure < -0.5) reasons.push('Wall sheltered from wind')
  }
  score -= windPenalty

  // 3. Temperature sweet spot: 5–15 °C ideal. Below 0 or above 20 painful.
  const t = forecast.temp ?? 10
  let tempPenalty = 0
  if (t >= 5 && t <= 15) {
    reasons.push(`${t.toFixed(0)}°C — sweet spot`)
  } else if (t >= 0 && t < 5) {
    tempPenalty = (5 - t) * 3 // up to 15
    reasons.push(`Cool ${t.toFixed(0)}°C`)
  } else if (t > 15 && t <= 20) {
    tempPenalty = (t - 15) * 3
    reasons.push(`Warm ${t.toFixed(0)}°C`)
  } else if (t < 0) {
    tempPenalty = 15 + (0 - t) * 4
    reasons.push(`Cold ${t.toFixed(0)}°C — fingers will hurt`)
  } else {
    tempPenalty = 15 + (t - 20) * 4
    reasons.push(`Hot ${t.toFixed(0)}°C — friction gone`)
  }
  score -= tempPenalty

  // 4. Humidity proxy: T - TD spread. Small spread = damp. Anything < 2°C is
  // greasy basalt territory.
  if (forecast.dewPoint != null) {
    const spread = t - forecast.dewPoint
    if (spread < 1) {
      score -= 12
      reasons.push('Very humid — damp rock')
    } else if (spread < 3) {
      score -= 6
      reasons.push('Humid')
    } else if (spread > 8) {
      reasons.push('Dry air')
    }
  }

  // 5. Sun on the wall — gated by cloud cover.
  const cloudPct = forecast.cloudPct ?? 50
  const cloudFactor = 1 - cloudPct / 100 // 1 = clear, 0 = overcast
  if (sun?.inSun) {
    const effectiveSun = sun.intensity * cloudFactor
    // When cold (< 8 °C), sun helps. When warm (> 16 °C), it hurts.
    if (t < 8) {
      const bonus = effectiveSun * (8 - t) * 1.5 // up to ~12 if sunny + cold
      score += bonus
      if (effectiveSun > 0.3) reasons.push('Sun warming the wall')
    } else if (t > 16) {
      const penalty = effectiveSun * (t - 16) * 2
      score -= penalty
      if (effectiveSun > 0.3) reasons.push('Sun on the wall — greasy')
    } else if (effectiveSun > 0.3) {
      reasons.push('Sun on the wall')
    }
  } else if (sun) {
    // Wall in shade. Note it.
    if (sun.reason === 'sun below horizon') reasons.push('Sun below horizon')
    else if (sun.reason === 'terrain blocks the sun') reasons.push('Terrain blocks sun')
    else if (sun.reason === 'wall faces away from sun') reasons.push('Wall in shade')
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const b = band(score)

  // Headline: pick the two most informative reasons, but from different
  // categories so we don't say "Light wind · Wind on the wall" — pick one
  // wind reason, one temp reason, etc. Order of priority for the lead reason:
  // precipitation > strong-wind warning > temp extreme > sun > everything else.
  const categorize = (r) => {
    if (/precip|wet|damp|soaked|dry — rain|raining|mostly dry/i.test(r)) return 'precip'
    if (/wind|gale/i.test(r)) return 'wind'
    if (/°C|sweet spot|cool|cold|warm|hot/i.test(r)) return 'temp'
    if (/sun|shade|horizon|terrain/i.test(r)) return 'sun'
    if (/humid|damp air|dry air/i.test(r)) return 'humidity'
    return 'other'
  }
  const seen = new Set()
  const headlineParts = []
  for (const r of reasons) {
    const cat = categorize(r)
    if (seen.has(cat)) continue
    seen.add(cat)
    headlineParts.push(r)
    if (headlineParts.length === 2) break
  }
  const headline = headlineParts.join(' · ') || `${t.toFixed(0)}°C`

  return { score, band: b, headline, reasons }
}
