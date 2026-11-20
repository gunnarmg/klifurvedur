import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

const TONE_COLORS = {
  go: '#16a34a',
  good: '#65a30d',
  marginal: '#ca8a04',
  poor: '#ea580c',
  nogo: '#dc2626',
  unknown: '#94a3b8'
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
  // Center on Iceland to include all crags (Reykjavík area + Öræfi)
  const center = [64.5, -19.2]
  return (
    <MapContainer center={center} zoom={6} style={{ width: '100%', height: '100%' }}>
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
              <div style={{ fontFamily: 'Inter, sans-serif' }}>
                <strong style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</strong>
                <div style={{ fontSize: 11, color: '#64748b' }}>{c.region}</div>
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
