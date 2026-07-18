import { useEffect, useState } from 'react'
import { api, CATEGORY_META, prettyDate } from '../api'

function buildHeatmapCells(heatmap) {
  // Colonnes = semaines, lignes = Lun..Dim
  const cells = []
  const start = new Date(heatmap.start + 'T00:00:00')
  const end = new Date(heatmap.end + 'T00:00:00')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const iso = `${y}-${m}-${day}`
    cells.push({ iso, count: heatmap.days[iso] ?? 0 })
  }
  return cells
}

export default function Recap({ onBack }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.recap().then(setData).catch(() => setError(true))
  }, [])

  if (error) return <p className="muted center">Impossible de charger ta rétro.</p>
  if (!data) return <p className="muted center">Chargement…</p>

  const cells = buildHeatmapCells(data.heatmap)
  const topMeta = data.top_moment ? (CATEGORY_META[data.top_moment.category] ?? CATEGORY_META.autre) : null
  const maxCat = Math.max(1, ...Object.values(data.by_category))

  return (
    <div className="recap">
      <button className="link-btn recap-back" onClick={onBack}>← Retour au profil</button>

      <header className="recap-hero">
        <p className="recap-kicker">Ta rétro</p>
        <h1>
          {data.moments_captured > 0
            ? <>Tu as capturé <em>{data.moments_captured}</em> moment{data.moments_captured > 1 ? 's' : ''} de ta vraie vie.</>
            : <>Ta rétro t'attend — capture ton premier moment.</>}
        </h1>
        {data.first_capture && (
          <p className="muted">Depuis le {prettyDate(data.first_capture)}</p>
        )}
      </header>

      {data.moments_captured > 0 && (
        <>
          <section className="recap-numbers">
            <div className="recap-num"><strong>{data.photos}</strong><span>photos</span></div>
            <div className="recap-num"><strong>{data.days_captured}</strong><span>jours capturés</span></div>
            <div className="recap-num"><strong>{data.max_streak}</strong><span>record de streak</span></div>
            <div className="recap-num"><strong>{data.reactions_received}</strong><span>réactions reçues</span></div>
            <div className="recap-num"><strong>{data.comments_received}</strong><span>commentaires reçus</span></div>
            <div className="recap-num"><strong>{data.friends}</strong><span>ami{data.friends > 1 ? 's' : ''}</span></div>
          </section>

          <section className="recap-section">
            <h2>Tes 12 dernières semaines</h2>
            <div className="heatmap" role="img" aria-label="Jours avec moments capturés">
              {cells.map((c) => (
                <span
                  key={c.iso}
                  className={`heat-cell ${c.count === 0 ? '' : c.count === 1 ? 'heat-1' : 'heat-2'}`}
                  title={`${c.iso}${c.count ? ` · ${c.count} moment(s)` : ''}`}
                />
              ))}
            </div>
            <div className="heat-legend">
              <span className="muted">Moins</span>
              <span className="heat-cell" />
              <span className="heat-cell heat-1" />
              <span className="heat-cell heat-2" />
              <span className="muted">Plus</span>
            </div>
          </section>

          {data.top_moment && (
            <section className="recap-section">
              <h2>Ton moment star</h2>
              <div className="top-moment" style={{ '--cat': topMeta.color }}>
                {data.top_moment.photo_url && (
                  <img src={data.top_moment.photo_url} alt={data.top_moment.title} loading="lazy" />
                )}
                <div className="top-moment-body">
                  <span className="event-cat">{topMeta.emoji} {topMeta.label}</span>
                  <h3>{data.top_moment.title}</h3>
                  <p className="muted">
                    {prettyDate(data.top_moment.date)}
                    {data.top_moment.reactions > 0 && <> · {data.top_moment.reactions} réaction{data.top_moment.reactions > 1 ? 's' : ''}</>}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="recap-section">
            <h2>Ton lifestyle</h2>
            <div className="cat-bars">
              {Object.entries(data.by_category).map(([cat, n]) => {
                const meta = CATEGORY_META[cat] ?? CATEGORY_META.autre
                return (
                  <div className="cat-bar-row" key={cat}>
                    <span className="cat-bar-label">{meta.emoji} {meta.label}</span>
                    <div className="cat-bar-track">
                      <div
                        className="cat-bar-fill"
                        style={{ width: `${(n / maxCat) * 100}%`, background: meta.color }}
                      />
                    </div>
                    <span className="cat-bar-n">{n}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      {data.moments_captured === 0 && (
        <div className="empty-state">
          <span className="empty-emoji">📸</span>
          <h3>Encore rien à raconter</h3>
          <p>Planifie un moment, prends-le en photo — et ta rétro commencera à s'écrire.</p>
        </div>
      )}
    </div>
  )
}
