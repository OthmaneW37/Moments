import { useEffect, useState } from 'react'
import { api, CATEGORY_META } from '../api'

// Page profil d'un utilisateur, en feuille plein écran par-dessus le feed.
export default function UserSheet({ username, onClose, onOpenContext }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setData(null)
    api.userProfile(username).then(setData).catch(() => setError(true))
  }, [username])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="page-sheet">
      <header className="page-sheet-head">
        <button className="page-sheet-back" onClick={onClose} aria-label="Retour">←</button>
        <span className="page-sheet-title">@{username}</span>
      </header>

      {error && <p className="muted center">Profil introuvable.</p>}
      {!data && !error && <p className="muted center">Chargement…</p>}

      {data && (
        <div className="usheet">
          <div className="usheet-hero">
            <span className="usheet-avatar">{data.emoji}</span>
            <div>
              <h2>{data.is_me ? 'Toi' : data.display_name}</h2>
              <p className="muted">
                @{data.username}{data.city ? ` · ${data.city}` : ''}
                {data.is_friend ? ' · 🤝 ami' : ''}
              </p>
            </div>
          </div>

          <div className="usheet-stats">
            <div><strong>{data.moments.length}</strong><span>moments visibles</span></div>
            <div><strong>{data.photos}</strong><span>photos</span></div>
            <div><strong>{data.days}</strong><span>jours capturés</span></div>
          </div>

          {data.moments.length === 0 ? (
            <p className="muted center">
              {data.is_friend ? 'Aucun moment capturé pour l’instant.' : 'Ses moments sont privés — devenez amis pour les voir.'}
            </p>
          ) : (
            <div className="usheet-grid">
              {data.moments.map((m) => {
                const meta = CATEGORY_META[m.category] ?? CATEGORY_META.autre
                return (
                  <figure className="usheet-cell" key={m.id} style={{ '--cat': meta.color }}>
                    <img src={m.photos[0].url} alt={m.title} loading="lazy" />
                    <figcaption>
                      <span className="usheet-cat">{meta.emoji}</span>
                      <span className="usheet-cell-title">{m.title}</span>
                      {m.context?.title && (
                        <button
                          className="usheet-ctx"
                          onClick={() => onOpenContext?.(m.context)}
                        >
                          {m.context.title}
                          {m.context.my_rating ? ` · ${'★'.repeat(m.context.my_rating)}` : ''}
                        </button>
                      )}
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
