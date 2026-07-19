import { useEffect, useState } from 'react'
import { api, CATEGORY_META, prettyDate } from '../api'
import Icon from './Icon'
import Media from './Media'
import ContextCard from './ContextCard'

// Vue publique en lecture seule d'un moment partagé (accessible sans compte).
export default function SharedMoment({ token }) {
  const [m, setM] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.sharedEvent(token).then(setM).catch(() => setError(true))
  }, [token])

  if (error) {
    return (
      <div className="phone shared">
        <div className="empty-state">
          <Icon name="camera" size="56" className="empty-emoji" />
          <h3>Lien introuvable</h3>
          <p>Ce moment n'est plus partagé, ou le lien est incorrect.</p>
          <a className="btn primary" href="/">Découvrir Moments</a>
        </div>
      </div>
    )
  }
  if (!m) return <div className="phone shared"><p className="muted center">Chargement…</p></div>

  const meta = CATEGORY_META[m.category] ?? CATEGORY_META.autre
  const tags = [...new Set((m.photos || []).flatMap((p) => p.tags || []))]

  return (
    <div className="phone shared">
      <header className="shared-top">
        <span className="brand"><Icon emoji="📸" size="22" className="brand-logo" /> <strong>Moments</strong></span>
        <a className="btn ghost sm" href="/">Ouvrir l'app</a>
      </header>

      <article className="shared-card" style={{ '--cat': meta.color }}>
        <div className="shared-media">
          <Media media={m.photos[0]} alt={m.title} autoPlay controls={m.photos[0]?.media_type === 'video'} />
          <div className="ifeed-veil" aria-hidden="true" />
          <div className="shared-cap">
            <div className="ifeed-who">
              <span className="ifeed-avatar"><Icon emoji={m.author.emoji} size="24" /></span>
              <span className="ifeed-name">
                <strong>{m.author.display_name}</strong>
                <span className="ifeed-handle">@{m.author.username}{m.author.city ? ` · ${m.author.city}` : ''}</span>
              </span>
            </div>
            <h2 className="ifeed-title">{m.title}</h2>
          </div>
        </div>

        <div className="shared-body">
          <span className="moment-cat"><Icon emoji={meta.emoji} size="15" /> {meta.label} · {prettyDate(m.date)}{m.start_time ? ` · ${m.start_time}` : ''}</span>
          {m.notes && <p className="shared-notes">{m.notes}</p>}
          {m.context?.title && <ContextCard context={m.context} />}
          {tags.length > 0 && (
            <div className="ifeed-vibes light">{tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}</div>
          )}
          {m.reaction_total > 0 && (
            <p className="muted">{m.reaction_total} réaction{m.reaction_total > 1 ? 's' : ''} sur Moments</p>
          )}
        </div>
      </article>

      <a className="shared-cta btn primary" href="/">Rejoins tes amis sur Moments</a>
    </div>
  )
}
