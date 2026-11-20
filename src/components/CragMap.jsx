import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

const TONE_COLORS = {
  go: '#2f7d3a',
  good: '#6b8b1a',
  marginal: '#c8941a',
  poor: '#c45a1a',
  nogo: '#9b1f1f',
  unknown: '#8a8273'
}

function makeIcon(score, tone) {
  const color = TONE_COLORS[tone] || TONE_COLORS.unknown
  const html = `<div class="crag-marker" style="background:${color}">${score ?? '?'}</div>`
  return L.divIcon({
    html,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
}

export function CragMap({ crags, scores, selectedId, onSelect }) {
  // Center somewhere between Reykjavík and Akranes
  const center = [64.22, -21.78]
  return (
    <MapContainer center={center} zoom={9} style={{ width: '100%', height: '100%' }}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {crags.map((c) => {
        const s = scores[c.id]
        return (
          <Marker
            key={c.id}
            position={[c.lat, c.lon]}
            icon={makeIcon(s?.score ?? null, s?.band?.tone)}
            eventHandlers={{ click: () => onSelect(c.id) }}
          >
            <Popup>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                <strong style={{ fontFamily: 'Fraunces, serif', fontSize: 16 }}>{c.name}</strong>
                <div style={{ fontSize: 11, color: '#666' }}>{c.region}</div>
                <div style={{ marginTop: 6 }}>
                  Score: <strong>{s?.score ?? '—'}</strong> ({s?.band?.label || 'no data'})
                </div>
                <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>{s?.headline}</div>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
