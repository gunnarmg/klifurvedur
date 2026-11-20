// Solar position. Standard NOAA-style algorithm, accurate to ~0.1° — far
// more than enough to decide whether a basalt wall is in sun.
//
// Inputs: Date (UTC inside JS), lat (deg), lon (deg).
// Outputs: { azimuth, elevation } in degrees. azimuth = 0 N, 90 E, 180 S, 270 W.

const toRad = (d) => (d * Math.PI) / 180
const toDeg = (r) => (r * 180) / Math.PI

export function sunPosition(date, lat, lon) {
  // Julian day
  const jd = date.getTime() / 86400000 + 2440587.5
  const n = jd - 2451545.0

  // Mean longitude and anomaly of the sun
  const L = (280.46 + 0.9856474 * n) % 360
  const g = toRad((357.528 + 0.9856003 * n) % 360)

  // Ecliptic longitude
  const lambda = toRad(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g))

  // Obliquity of the ecliptic
  const epsilon = toRad(23.439 - 0.0000004 * n)

  // Right ascension and declination
  const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda))
  const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda))

  // Greenwich mean sidereal time, then local sidereal time
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24
  const lst = toRad(((gmst * 15) + lon) % 360)

  // Hour angle
  let H = lst - alpha
  if (H < -Math.PI) H += 2 * Math.PI
  if (H > Math.PI) H -= 2 * Math.PI

  const phi = toRad(lat)

  const elevation = toDeg(
    Math.asin(Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(H))
  )

  let azimuth = toDeg(
    Math.atan2(
      -Math.sin(H),
      Math.tan(delta) * Math.cos(phi) - Math.sin(phi) * Math.cos(H)
    )
  )
  azimuth = (azimuth + 360) % 360

  return { azimuth, elevation }
}

// Smallest difference between two compass bearings, in [0, 180].
function bearingDiff(a, b) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

// Is a wall of given aspect in direct sun, considering terrain blocking?
// Returns { inSun: boolean, intensity: 0..1 } — intensity reflects how
// directly the sun hits the wall (cos of incidence angle, basically).
export function sunOnWall({ aspect, terrainAngle = 0 }, sun) {
  // 1. Wall geometry first: is the sun even on the right side of the wall?
  const diff = bearingDiff(sun.azimuth, aspect)
  if (diff >= 90) {
    return { inSun: false, intensity: 0, reason: 'wall faces away from sun' }
  }
  // 2. Then terrain blocking. Only relevant if the wall would otherwise be lit.
  if (sun.elevation <= 0) {
    return { inSun: false, intensity: 0, reason: 'sun below horizon' }
  }
  if (sun.elevation <= terrainAngle) {
    return { inSun: false, intensity: 0, reason: 'terrain blocks the sun' }
  }
  // Cosine of azimuthal incidence × cosine of complement of elevation gives
  // a rough "directness" — 1 means sun perpendicular to the wall, 0 grazing.
  const azFactor = Math.cos(toRad(diff))
  const elFactor = Math.cos(toRad(90 - sun.elevation))
  // Intensity is (very roughly) the cosine of the angle between sun ray and
  // wall normal. Clamp for safety.
  const intensity = Math.max(0, Math.min(1, azFactor * elFactor))
  return { inSun: true, intensity }
}
