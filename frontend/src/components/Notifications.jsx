import { useEffect } from 'react'
import Icon from './Icon'
import { ListSkeleton } from './Skeletons'

const NOTIF_TEXT = {
  follow: () => `s'est abonné à toi 🎉`,
  follow_request: () => `veut s'abonner à toi 👋`,
  follow_accept: () => `a accepté ta demande d'abonnement 🤝`,
  friend_request: () => `t'a envoyé une demande d'ami 👋`,
  friend_accept: () => `a accepté ta demande d'ami 🤝`,
  like: (n) => `a liké ton moment${n.event_title ? ` « ${n.event_title} »` : ''} ❤️`,
  comment: (n) => `a commenté ton moment${n.event_title ? ` « ${n.event_title} »` : ''} 💬`,
  message: () => `t'a envoyé un message 💌`,
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

export default function Notifications({ data, onSeen, goProfile, goFeed, goMessages }) {
  // Marquer tout lu dès l'ouverture de l'écran
  useEffect(() => {
    if (data?.unread > 0) onSeen()
  }, [data, onSeen])

  if (!data) return <ListSkeleton count={6} />

  if (data.items.length === 0) {
    return (
      <div className="empty-state">
        <Icon emoji="🔔" size="56" className="empty-emoji" />
        <h3>Rien pour l'instant</h3>
        <p>Quand tes abonnés réagiront ou commenteront tes moments, tu le verras ici.</p>
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
          onClick={() => {
            if (n.type === 'message') goMessages?.(n.actor.username)
            else if (n.type.startsWith('friend') || n.type.startsWith('follow')) goProfile()
            else goFeed?.()
          }}
        >
          <span className="friend-avatar"><Icon emoji={n.actor.emoji} size="20" /></span>
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
