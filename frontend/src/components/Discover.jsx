import { useEffect, useMemo, useState } from 'react'
import { api, CATEGORY_META } from '../api'
import MomentCard from './MomentCard'

export default function Discover() {
  const [data, setData] = useState(null)
  const [cat, setCat] = useState(null) // null = tout

  useEffect(() => {
    api.discover().then(setData).catch(() => setData({ city: '', moments: [] }))
  }, [])

  // Seules les catégories réellement présentes deviennent des filtres
  const presentCats = useMemo(() => {
    if (!data) return []
    return [...new Set(data.moments.map((m) => m.category))]
  }, [data])

  if (data === null) return <p className="muted center">Chargement…</p>

  const shown = cat ? data.moments.filter((m) => m.category === cat) : data.moments

  return (
    <div className="feed">
      <div className="discover-head">
        <h1 className="page-title">Découverte</h1>
        <p className="muted">
          Les moments publics {data.city ? <>autour de <strong>{data.city}</strong></> : 'de la communauté'}
        </p>
      </div>

      {presentCats.length > 1 && (
        <div className="filter-row">
          <button
            className={`filter-chip ${cat === null ? 'active' : ''}`}
            onClick={() => setCat(null)}
          >
            Tout
          </button>
          {presentCats.map((c) => {
            const meta = CATEGORY_META[c] ?? CATEGORY_META.autre
            return (
              <button
                key={c}
                className={`filter-chip ${cat === c ? 'active' : ''}`}
                style={{ '--cat': meta.color }}
                onClick={() => setCat(cat === c ? null : c)}
              >
                {meta.emoji} {meta.label}
              </button>
            )
          })}
        </div>
      )}

      {data.moments.length === 0 ? (
        <div className="empty-state">
          <span className="empty-emoji">🌍</span>
          <h3>Rien à découvrir pour l'instant</h3>
          <p>
            Passe un de tes moments en <strong>public</strong> (dans le formulaire de création)
            {data.city ? '' : ' et renseigne ta ville dans ton profil'} — les autres pourront le voir ici.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted center">Aucun moment public dans cette catégorie.</p>
      ) : (
        shown.map((m) => <MomentCard key={m.id} moment={m} />)
      )}
    </div>
  )
}
