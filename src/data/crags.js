// Seed data for Reykjavík-area sport crags.
//
// Aspects are seeded from guidebook descriptions (UKC, theCrag, klifur.is) and
// satellite imagery. They are *approximate* — the in-app editor lets you fix
// them. Each value is in compass degrees: 0=N, 90=E, 180=S, 270=W.
//
// `wallHeight` and `terrainAngle` are used to estimate when the sun is blocked
// by the surrounding hillside. terrainAngle is the angle in degrees above
// horizontal that surrounding terrain blocks (rough estimate).
//
// Forecasts are pulled from Open-Meteo using lat/lon directly — no station
// IDs to map.

export const CRAGS = [
  {
    id: 'valshamar',
    name: 'Valshamar',
    region: 'Hvalfjörður',
    lat: 64.297707,
    lon: -21.654317,
    driveMinFromRvk: 45,
    notes: 'North side of Esja above Hvalfjörður. Sport, ~5.4–5.11 / 4–7a+.',
    topo: 'https://www.thecrag.com/en/climbing/iceland/reykjavik/area/428044938',
    sectors: [
      {
        id: 'main',
        name: 'Main wall',
        aspect: 135, // SE per UKC: "afternoon to evening sun"
        wallHeight: 25,
        terrainAngle: 5,
        notes: 'Afternoon→evening sun in summer.'
      }
    ]
  },
  {
    id: 'stardalur',
    name: 'Stardalur',
    region: 'Mosfellsheiði',
    lat: 64.1908,
    lon: -21.5469,
    driveMinFromRvk: 30,
    notes: 'Coarse dolerite from the Stardalur central volcano. Mostly trad with some sport. Best mid-day.',
    topo: 'https://www.klifur.is/crag/stardalur',
    sectors: [
      {
        id: 'main',
        name: 'Main',
        aspect: 135, // SE per UKC: "best done during the middle of the day"
        wallHeight: 30,
        terrainAngle: 8,
        notes: '10–50 m walls, mid-day sun.'
      }
    ]
  },
  {
    id: 'buahamrar',
    name: 'Búahamrar',
    region: 'Esja, Mosfellsbær',
    lat: 64.2406,
    lon: -21.6453,
    driveMinFromRvk: 25,
    notes: 'Low on Esja above Mosfellsbær. Mostly sport with some trad.',
    topo: 'https://www.thecrag.com/en/climbing/iceland/buahamrar',
    sectors: [
      {
        id: 'main',
        name: 'Main',
        aspect: 200, // S/SSW estimate, edit if wrong
        wallHeight: 20,
        terrainAngle: 10,
        notes: 'Edit aspect — verify against guidebook.'
      }
    ]
  },
  {
    id: 'akrafjall',
    name: 'Akrafjall',
    region: 'Akranes',
    lat: 64.3219,
    lon: -22.0094,
    driveMinFromRvk: 50,
    notes: 'Short bolted routes and bouldering at the foot of Akrafjall. Sea views.',
    topo: 'https://www.klifur.is/crag/akrafjall',
    sectors: [
      {
        id: 'main',
        name: 'Main',
        aspect: 180, // S guess
        wallHeight: 12,
        terrainAngle: 5,
        notes: 'Edit aspect.'
      }
    ]
  },
  {
    id: 'leirvogsgil',
    name: 'Leirvogsgil',
    region: 'Mosfellsbær',
    lat: 64.1739,
    lon: -21.5728,
    driveMinFromRvk: 25,
    notes: 'Small sport venue in a gully near Mosfellsbær.',
    topo: 'https://www.klifur.is/crag/leirvogsgil',
    sectors: [
      {
        id: 'main',
        name: 'Main',
        aspect: 160, // SSE guess given gully orientation
        wallHeight: 15,
        terrainAngle: 15, // gully = significant horizon blocking
        notes: 'Gully — terrain blocks low sun. Edit aspect.'
      }
    ]
  },
  {
    id: 'hnappavellir',
    name: 'Hnappavellir',
    region: 'Öræfi',
    lat: 63.953,
    lon: -16.851,
    driveMinFromRvk: 320,
    notes: 'Iceland\'s premier sport crag. Columnar basalt in Öræfi, southeast Iceland. Multi-pitch and single-pitch, 5.6–5.13 / 4–8a.',
    topo: 'https://www.thecrag.com/en/climbing/iceland/south-east/area/12462159',
    sectors: [
      {
        id: 'main',
        name: 'Main wall',
        aspect: 200, // SSW — afternoon sun
        wallHeight: 30,
        terrainAngle: 8,
        notes: 'Main columnar basalt face. Afternoon sun.'
      },
      {
        id: 'left-wing',
        name: 'Left wing',
        aspect: 160, // SSE — midday sun
        wallHeight: 25,
        terrainAngle: 10,
        notes: 'Left section, catches midday sun earlier.'
      }
    ]
  }
]
