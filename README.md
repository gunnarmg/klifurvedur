# Klifurveður

Sport climbing conditions for crags around Reykjavík. Scores each crag from 0–100 for a chosen day and time, combining a numerical weather forecast with a per-sector sun-on-wall calculation that accounts for aspect, wall height, and surrounding terrain.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Hosting and updates (GitHub Pages)

The site is built and published by GitHub Actions (`.github/workflows/update.yml`), the same way as the ice-climbing page:

- Every 3 hours, and on every push to `main`, the workflow runs `scripts/fetch.mjs`, which fetches the forecast for all crags from Open-Meteo and writes `public/data.json`. The file is committed, then the site is built and deployed to GitHub Pages.
- The page reads `data.json` first. If it is more than 4 hours old (or a crag is missing from it), the browser asks Open-Meteo directly and falls back to `data.json` if that fails.
- If Open-Meteo is down when the workflow runs, the site is still published with the previous `data.json`.

One-time setup: **Settings → Pages → Source: GitHub Actions**. To run an update by hand: **Actions → Uppfæra veðurgögn og birta síðu → Run workflow**.

Locally, `npm run fetch` writes `public/data.json`; without it the dev server just fetches live.

## Forecast source

We fetch forecasts directly from [Open-Meteo](https://open-meteo.com/en/docs) — free, no API key, CORS open, lat/lon based. They aggregate the best national models for each location (in Iceland that's ECMWF IFS at 9 km plus MET Norway). Hourly resolution.

The previous version used `apis.is/weather` (a community wrapper around Veðurstofa Íslands), but its TLS certificate had expired so browsers refused to connect. Open-Meteo is more robust as a primary source: lat/lon based (no station-mapping work), no auth, and they have an SLO around uptime.

If you ever want to add Veðurstofa back as an option (the official Icelandic model has the best mountain-microclimate detail), the place to do it is `src/lib/weather.js` — add a parallel client and a switch.

## How the score works

Each crag's selected sector is scored against the forecast row nearest the chosen time. The model:

1. **Currently raining hard** (≥ 1 mm/h): hard veto, score 0.
2. **Rock wetness from history.** This is the dominant factor. We run a simple drying model over the past 36 h: rain accumulates wetness; sun on the wall, wind, and dry air burn it off. Soaked rock floors the score; damp rock takes ~25 points; mostly-dry takes ~8.
3. **Wind.** 0–4 m/s ideal. Penalties scale up sharply over 8 m/s. The penalty is modulated ±40% by whether the wind direction blows onto the wall.
4. **Temperature.** Sweet spot 5–15 °C for Icelandic basalt.
5. **Humidity.** Dew-point spread (T − TD) under 3 °C costs points.
6. **Sun on the wall.** Computed from solar position at the crag's lat/lon and the sector's aspect / terrain. Cloud cover gates the sun term. Cold + sunny = bonus; hot + sunny = penalty.

The wetness model is opinionated. The constants in `src/lib/wetness.js` translate "5mm of rain 6h ago, mostly cloudy and 6°C since" into a wetness number; tune them if your local rock dries faster or slower than the model assumes.

## Editable crag data

The seed crag/sector data in `src/data/crags.js` is a starting point — aspects are best-guesses from guidebook descriptions and satellite imagery. Click any crag, scroll to "Sectors — edit", and fix the values. Edits persist to `localStorage` under `klifurvedur.crags.v3`.

To wipe edits and go back to seed values: hit "Reset data" in the top bar.

If you want changes to be the new defaults for everyone (rather than just your browser), update `src/data/crags.js` directly and commit.

## What's NOT in v1

- **Recent rain / drying time.** The API exposes forecast precipitation but not "hours since last rain". A wet crag stays wet — this isn't modeled.
- **Multiple sectors per scoring view.** The score uses sector 0. The detail view shows the editor for all sectors but doesn't yet score them independently.
- **Drive-time routing.** `driveMinFromRvk` is a hardcoded estimate, not a Google Maps lookup.
- **The whole country.** Only the 5 Reykjavík-area crags. To extend, add entries to `crags.js`.

## Files

```
scripts/fetch.mjs      writes public/data.json (run by GitHub Actions)
src/
  App.jsx              top-level state, top bar, list+map+detail composition
  data/crags.js        seed crag dataset (editable in UI)
  lib/
    sun.js             solar position + sun-on-wall test
    score.js           the conditions scoring model
    openmeteo.js       the Open-Meteo query, shared by the browser and scripts/fetch.mjs
    weather.js         data.json / Open-Meteo client + forecast row helpers
    wetness.js         rock-wetness model (rain history × drying conditions)
    useLocalStorage.js persisted state hook
  components/
    CragMap.jsx        Leaflet map with score-coloured markers
    CragDetail.jsx     detail pane: sun timeline + wetness + forecast table + editor
    SectorEditor.jsx   per-sector editing form
    SunTimeline.jsx    horizontal bar showing when the wall is in sun today
    AspectCompass.jsx  SVG compass showing aspect + sun position
    ScoreTile.jsx      the coloured score badge
  styles/app.css       all styles in one file
```

## Attribution

Forecasts © Open-Meteo (CC BY 4.0). Map tiles © OpenStreetMap contributors.
