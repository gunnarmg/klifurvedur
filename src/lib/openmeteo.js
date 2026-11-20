// Sameiginlegt fyrir vafrann (weather.js) og scripts/fetch.mjs, svo að
// data.json og bein köll noti nákvæmlega sömu fyrirspurn.

export const BASE = 'https://api.open-meteo.com/v1/forecast'

export const HOURLY_VARS = [
  'temperature_2m',
  'precipitation',
  'wind_speed_10m',
  'wind_direction_10m',
  'cloud_cover',
  'dew_point_2m'
].join(',')

// Round coordinates to 3 dp so cache keys for nearby crags can collide and
// we share fetches when crags are within ~100 m.
export const round3 = (n) => Math.round(n * 1000) / 1000

export const pointKey = (lat, lon) => `${round3(lat)},${round3(lon)}`

// latitude/longitude may be single values or comma-separated lists.
export function forecastParams(latitude, longitude) {
  return new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: HOURLY_VARS,
    wind_speed_unit: 'ms',
    timezone: 'GMT', // Iceland = GMT year-round, no DST
    past_days: '2',
    forecast_days: '3'
  })
}
