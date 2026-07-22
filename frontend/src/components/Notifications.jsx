import { useEffect, useRef } from 'react'
import Icon from './Icon'
import { ListSkeleton } from './Skeletons'

const NOTIF_TEXT = {
  follow: () => `s'est abonné à toi 🎉`,
  follow_request: () => `veut s'abonner à toi 👋`,
  follow_accept: () => `a accepté ta demande d'abonnement 🤝`,
  friend_request: () => `t'a envoyé une demande d'ami 👋`,
  friend_accept: () => `a accepté ta demande d'ami 🤝`,
  like: (n) => `a réagi à ton moment${n.event_title ? ` « ${n.event_title} »` : ''} ❤️`,
  comment: (n) => `a commenté ton moment${n.event_title ? ` « ${n.event_title} »` : ''} 💬`,
  message: () => `t'a envoyé un message 💌`,
}

function timeAgo(sqlDate) {
  const then = new Date(sqlDate.replace(' ', 'T') + 'Z')
  const mins = Math.max(0, Math.floor((Date.now() - then.getTime()) / 60000))
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return `il y a ${Math.floor(days / 7)} sem`
}

// Range une notif dans une section temporelle
function bucketOf(sqlDate) {
  const then = new Date(sqlDate.replace(' ', 'T') + 'Z')
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.floor((startToday - new Date(then.getFullYear(), then.getMonth(), then.getDate())) / 86400000)
  if (diffDays <= 0) return 'Aujourd\'hui'
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return 'Cette semaine'
  return 'Plus tôt'
}
const BUCKET_ORDER = ['Aujourd\'hui', 'Hier', 'Cette semaine', 'Plus tôt']

export default function Notifications({ data, onSeen, goProfile, goFeed, goMessages }) {
  // Fige la liste des notifs "nouvelles" à l'ouverture : elles restent
  // mises en avant pendant la consultation, même après le marquage lu.
  const newIds = useRef(null)
  if (data && newIds.current === null) {
    newIds.current = new Set(data.items.filter((i) => !i.read).map((i) => i.id))
  }

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

  function handleClick(n) {
    if (n.type === 'message') goMessages?.(n.actor.username)
    else if (n.type.startsWith('friend') || n.type.startsWith('follow')) goProfile()
    else goFeed?.()
  }

  // Regroupement par section temporelle, en conservant l'ordre chronologique
  const groups = {}
  for (const n of data.items) {
    const b = bucketOf(n.created_at)
    ;(groups[b] ??= []).push(n)
  }
  const newCount = newIds.current?.size ?? 0

  return (
    <div className="notif-list">
      <div className="notif-head">
        <h1 className="page-title">Notifications</h1>
        {newCount > 0 && <span className="notif-newcount">{newCount} nouveau{newCount > 1 ? 'x' : ''}</span>}
      </div>

      {BUCKET_ORDER.filter((b) => groups[b]).map((bucket) => (
        <section className="notif-section" key={bucket}>
          <h2 className="notif-section-title">{bucket}</h2>
          {groups[bucket].map((n) => {
            const isNew = newIds.current?.has(n.id)
            return (
              <button
                className={`notif-row ${isNew ? 'unread' : ''}`}
                key={n.id}
                onClick={() => handleClick(n)}
              >
                <span className="friend-avatar"><Icon emoji={n.actor.emoji} size="20" /></span>
                <div className="notif-body">
                  <span>
                    <strong>{n.actor.display_name}</strong>{' '}
                    {(NOTIF_TEXT[n.type] ?? (() => n.type))(n)}
                  </span>
                  <span className="muted">{timeAgo(n.created_at)}</span>
                </div>
                {isNew && <span className="notif-dot" />}
              </button>
            )
          })}
        </section>
      ))}
    </div>
  )
}
