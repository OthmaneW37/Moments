import { useEffect, useState } from 'react'
import { api } from '../api'
import Icon from './Icon'
import Media from './Media'
import WorkDiscussion from './WorkDiscussion'

// Page d'une fiche (film / série / livre / match / lieu) : la note de la
// communauté Moments, la note de la source, et les moments qui en parlent.
export default function ContextSheet({ context, onClose, onOpenUser }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setData(null)
    api.contextDetail(context.kind, context.title).then(setData).catch(() => setError(true))
  }, [context])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fiche = data?.context ?? context

  return (
    <div className="page-sheet">
      <header className="page-sheet-head">
        <button className="page-sheet-back" onClick={onClose} aria-label="Retour">←</button>
        <span className="page-sheet-title">{fiche.title}</span>
      </header>

      <div className="csheet">
        <div className="csheet-hero">
          {fiche.image && <img className="csheet-cover" src={fiche.image} alt="" />}
          <div className="csheet-hero-info">
            <h2>{fiche.title}</h2>
            {fiche.subtitle && <p className="muted">{fiche.subtitle}</p>}
            <div className="csheet-notes">
              {data?.app_rating != null && (
                <span className="csheet-note app">
                  ★ {data.app_rating}
                  <small>{data.app_rating_count} note{data.app_rating_count > 1 ? 's' : ''} sur Moments</small>
                </span>
              )}
              {fiche.rating != null && (
                <span className="csheet-note">
                  ★ {fiche.rating}
                  <small>{fiche.source}</small>
                </span>
              )}
            </div>
          </div>
        </div>

        {error && <p className="muted center">Personne n'en parle encore.</p>}
        {!data && !error && <p className="muted center">Chargement…</p>}

        {data && (
          <WorkDiscussion
            kind={fiche.kind}
            title={fiche.title}
            initial={data.discussion || []}
            onOpenUser={onOpenUser}
          />
        )}

        {data && data.moments.length > 0 && (
          <div className="csheet-moments">
            <h3>{data.moments.length} moment{data.moments.length > 1 ? 's' : ''} · qui en parle</h3>
            {data.moments.map((m) => (
              <article className="csheet-moment" key={m.id}>
                <Media media={m.photos[0]} alt="" />
                <div className="csheet-moment-info">
                  <button className="linklike" onClick={() => onOpenUser?.(m.author.username)}>
                    <Icon emoji={m.author.emoji} size="16" /> {m.author.is_me ? 'Toi' : m.author.display_name}
                  </button>
                  {m.context?.my_rating && (
                    <span className="csheet-stars">
                      {'★'.repeat(m.context.my_rating)}{'☆'.repeat(5 - m.context.my_rating)}
                    </span>
                  )}
                  <strong>{m.title}</strong>
                  {m.notes && <p>{m.notes}</p>}
                  <span className="muted">
                    <Icon emoji="💬" size="13" /> {m.comments || 0} · {Object.values(m.reactions || {}).reduce((a, b) => a + b, 0)} réaction(s)
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
