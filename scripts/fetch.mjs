#!/usr/bin/env node
// Sækir veðurspá (Open-Meteo) fyrir öll klifursvæðin og skrifar public/data.json.
// Keyrt af GitHub Actions (.github/workflows/update.yml). Notar aðeins Node 20+.
//
// Síðan les data.json fyrst og sækir aðeins beint frá Open-Meteo ef skráin er
// orðin gömul eða svæði vantar (sjá src/lib/weather.js).

import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CRAGS } from '../src/data/crags.js'
import { BASE, forecastParams, pointKey } from '../src/lib/openmeteo.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public', 'data.json')
const URL_BASE = process.env.OPEN_METEO_URL || BASE

async function get(url, tries = 3) {
  let err
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'klifurvedur (github.com/gunnarmg/klifurvedur)' },
        signal: AbortSignal.timeout(60_000)
      })
      if (res.ok) return await res.json()
      err = new Error(`HTTP ${res.status}`)
    } catch (e) {
      err = e
    }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
  }
  throw new Error(`Tókst ekki að sækja ${url}: ${err?.message || err}`)
}

function fail(msg) {
  console.error(`${msg}; data.json ekki uppfært.`)
  process.exit(1)
}

// Einn punktur á hvert hnit (svæði innan ~100 m deila spá).
const points = new Map()
for (const c of CRAGS) points.set(pointKey(c.lat, c.lon), { lat: c.lat, lon: c.lon })
const keys = [...points.keys()]

const params = forecastParams(
  keys.map((k) => k.split(',')[0]).join(','),
  keys.map((k) => k.split(',')[1]).join(',')
)
// URLSearchParams kóðar kommur; Open-Meteo vill þær óbreyttar.
const url = `${URL_BASE}?${params.toString().replaceAll('%2C', ',')}`

let json
try {
  json = await get(url)
} catch (e) {
  fail(e.message)
}
const list = Array.isArray(json) ? json : [json]
if (list.length !== keys.length) fail('Spá frá Open-Meteo barst ekki fyrir öll svæði')

const VARS = ['temperature_2m', 'precipitation', 'wind_speed_10m', 'wind_direction_10m', 'cloud_cover', 'dew_point_2m']
const out = {}
list.forEach((p, i) => {
  const h = p.hourly
  if (!h?.time?.length) fail(`Engin spá fyrir ${keys[i]}`)
  for (const v of VARS) {
    if (!Array.isArray(h[v]) || h[v].length !== h.time.length) fail(`Vantar ${v} fyrir ${keys[i]}`)
  }
  // Hiti má ekki vanta í meira en fáeinar stundir, annars er spáin ónothæf.
  if (h.temperature_2m.filter((v) => v == null).length > h.time.length / 10) fail(`Göt í spá fyrir ${keys[i]}`)
  out[keys[i]] = { time: h.time, ...Object.fromEntries(VARS.map((v) => [v, h[v]])) }
})

const data = { generated: new Date().toISOString().slice(0, 16) + 'Z', points: out }
await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(data), 'utf8')
const t = out[keys[0]].time
console.log(`Skrifaði public/data.json: ${keys.length} punktar, ${t[0]} .. ${t[t.length - 1]}`)
