export function SectorEditor({ crag, onChange }) {
  const update = (idx, patch) => {
    const sectors = crag.sectors.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    onChange({ ...crag, sectors })
  }

  const remove = (idx) => {
    if (crag.sectors.length <= 1) return
    onChange({ ...crag, sectors: crag.sectors.filter((_, i) => i !== idx) })
  }

  const add = () => {
    onChange({
      ...crag,
      sectors: [
        ...crag.sectors,
        {
          id: `sector-${Date.now()}`,
          name: `Sector ${crag.sectors.length + 1}`,
          aspect: 180,
          wallHeight: 15,
          terrainAngle: 5,
          notes: ''
        }
      ]
    })
  }

  return (
    <div className="sector-editor">
      {crag.sectors.map((s, i) => (
        <div key={s.id} className="sector">
          <div className="row">
            <label style={{ flex: 1 }}>
              Name
              <input
                type="text"
                value={s.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
            </label>
            {crag.sectors.length > 1 && (
              <button onClick={() => remove(i)} title="Remove sector">×</button>
            )}
          </div>
          <div className="row">
            <label>
              Aspect (°)
              <input
                type="number"
                min="0"
                max="359"
                value={s.aspect}
                onChange={(e) => update(i, { aspect: parseFloat(e.target.value) || 0 })}
              />
            </label>
            <label>
              Wall height (m)
              <input
                type="number"
                min="0"
                value={s.wallHeight}
                onChange={(e) => update(i, { wallHeight: parseFloat(e.target.value) || 0 })}
              />
            </label>
            <label>
              Terrain block (°)
              <input
                type="number"
                min="0"
                max="60"
                value={s.terrainAngle}
                onChange={(e) => update(i, { terrainAngle: parseFloat(e.target.value) || 0 })}
              />
            </label>
          </div>
          <div className="row">
            <label style={{ flex: 1 }}>
              Notes
              <input
                type="text"
                value={s.notes || ''}
                onChange={(e) => update(i, { notes: e.target.value })}
              />
            </label>
          </div>
        </div>
      ))}
      <button onClick={add}>+ Add sector</button>
    </div>
  )
}
