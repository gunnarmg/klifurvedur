export function ScoreTile({ score, band }) {
  const tone = band?.tone || 'unknown'
  if (score == null) {
    return (
      <div className={`score-tile ${tone}`}>
        <span className="label">N/A</span>
      </div>
    )
  }
  return (
    <div className={`score-tile ${tone}`}>
      {score}
      <span className="label">{band.label}</span>
    </div>
  )
}
