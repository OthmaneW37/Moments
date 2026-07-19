import { useEffect, useState } from 'react'
import { api, CATEGORY_META } from '../api'
import Icon from './Icon'
import Media from './Media'

const FOLLOW_LABEL = { none: "S'abonner", pending: 'Demandé', following: 'Abonné' }

// Page profil d'un utilisateur, en feuille plein écran par-dessus le feed.
export default function UserSheet({ username, onClose, onOpenContext, onOpenUser, onMessage }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [peopleList, setPeopleList] = useState(null) // { title, users } | null

  function load() {
    api.userProfile(username).then(setData).catch(() => setError(true))
  }
  useEffect(() => {
    setData(null); setError(false); setPeopleList(null)
    load()
  }, [username]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function toggleFollow() {
    if (busy) return
    setBusy(true)
    try {
      const r = await api.follow(username)
      setData((d) => ({ ...d, follow_state: r.state, followers: r.followers,
                        locked: d.is_private && !d.is_me && r.state !== 'following' }))
      if (data && (data.follow_state === 'none') !== (r.state === 'none')) load()
    } finally {
      setBusy(false)
    }
  }

  async function openPeople(kind) {
    try {
      const users = kind === 'followers' ? await api.followers(username) : await api.following(username)
      setPeopleList({ title: kind === 'followers' ? 'Abonnés' : 'Abonnements', users })
    } catch {
      /* compte privé non suivi : listes verrouillées */
    }
  }

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
            <span className="usheet-avatar"><Icon emoji={data.emoji} size="36" /></span>
            <div className="usheet-hero-main">
              <h2>{data.is_me ? 'Toi' : data.display_name}</h2>
              <p className="muted">
                @{data.username}{data.city ? ` · ${data.city}` : ''}
                {data.is_private ? ' · 🔒' : ''}
                {data.follows_me && !data.is_me ? ' · te suit' : ''}
              </p>
            </div>
            {!data.is_me && (
              <div className="usheet-hero-actions">
                <button
                  className={`btn follow-btn ${data.follow_state === 'none' ? 'primary' : ''}`}
                  onClick={toggleFollow}
                  disabled={busy}
                >
                  {FOLLOW_LABEL[data.follow_state]}
                </button>
                {onMessage && (
                  <button className="btn ghost msg-btn" onClick={() => onMessage(data.username)} aria-label="Message">
                    <Icon name="message" size="18" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="usheet-stats">
            <div><strong>{data.moments.length}</strong><span>moments</span></div>
            <button onClick={() => openPeople('followers')}>
              <strong>{data.followers}</strong><span>abonnés</span>
            </button>
            <button onClick={() => openPeople('following')}>
              <strong>{data.following}</strong><span>abonnements</span>
            </button>
          </div>

          {peopleList && (
            <div className="people-list">
              <div className="people-list-head">
                <strong>{peopleList.title}</strong>
                <button className="people-list-close" onClick={() => setPeopleList(null)}>×</button>
              </div>
              {peopleList.users.length === 0 && <p className="muted">Personne pour l'instant.</p>}
              {peopleList.users.map((u) => (
                <button key={u.username} className="people-row" onClick={() => onOpenUser?.(u.username)}>
                  <Icon emoji={u.emoji} size="20" />
                  <span className="people-name">{u.is_me ? 'Toi' : u.display_name}</span>
                  <span className="muted">@{u.username}</span>
                </button>
              ))}
            </div>
          )}

          {data.locked ? (
            <div className="empty-state">
              <span className="empty-emoji">🔒</span>
              <h3>Compte privé</h3>
              <p>
                {data.follow_state === 'pending'
                  ? 'Ta demande est en attente — dès qu’elle est acceptée, ses moments apparaîtront ici.'
                  : 'Abonne-toi pour voir ses moments.'}
              </p>
            </div>
          ) : data.moments.length === 0 ? (
            <p className="muted center">Aucun moment capturé pour l'instant.</p>
          ) : (
            <div className="usheet-grid">
              {data.moments.map((m) => {
                const meta = CATEGORY_META[m.category] ?? CATEGORY_META.autre
                return (
                  <figure className="usheet-cell" key={m.id} style={{ '--cat': meta.color }}>
                    <Media media={m.photos[0]} alt={m.title} />
                    {m.photos[0].media_type === 'video' && <Icon name="video-badge" size="22" className="cell-video-badge" />}
                    <figcaption>
                      <span className="usheet-cat"><Icon emoji={meta.emoji} size="15" /></span>
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
