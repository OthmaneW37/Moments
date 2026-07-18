import { useEffect } from 'react'

const NOTIF_TEXT = {
  friend_request: (n) => `t'a envoyé une demande d'ami 👋`,
  friend_accept: (n) => `a accepté ta demande d'ami 🤝`,
  like: (n) => `a liké ton moment${n.event_title ? ` « ${n.event_title} »` : ''} ❤️`,
  comment: (n) => `a commenté ton moment${n.event_title ? ` « ${n.event_title} »` : ''} 💬`,
}

function timeAgo(sqlDate) {
  // SQLite datetime('now') est en UTC
  const then = new Date(sqlDate.replace(' ', 'T') + 'Z')
  const mins = Math.max(0, Math.floor((Date.now() - then.getTime()) / 60000))
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

export default function Notifications({ data, onSeen, goProfile, goFeed }) {
  // Marquer tout lu dès l'ouverture de l'écran
  useEffect(() => {
    if (data?.unread > 0) onSeen()
  }, [data, onSeen])

  if (!data) return <p className="muted center">Chargement…</p>

  if (data.items.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-emoji">🔔</span>
        <h3>Rien pour l'instant</h3>
        <p>Quand tes amis likeront ou commenteront tes moments, tu le verras ici.</p>
      </div>
    )
  }

  return (
    <div className="notif-list">
      <h1 className="page-title">Notifications</h1>
      {data.items.map((n) => (
        <button
          className={`notif-row ${n.read ? '' : 'unread'}`}
          key={n.id}
          onClick={() => { n.type.startsWith('friend') ? goProfile() : goFeed?.() }}
        >
          <span className="friend-avatar">{n.actor.emoji}</span>
          <div className="notif-body">
            <span>
              <strong>{n.actor.display_name}</strong>{' '}
              {(NOTIF_TEXT[n.type] ?? (() => n.type))(n)}
            </span>
            <span className="muted">{timeAgo(n.created_at)}</span>
          </div>
          {!n.read && <span className="notif-dot" />}
        </button>
      ))}
    </div>
  )
}
