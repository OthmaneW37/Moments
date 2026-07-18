import { useRef, useState } from 'react'
import { CATEGORY_META, REACTION_EMOJIS, prettyDate, toISO } from '../api'
import { useReaction } from '../useReaction'
import Comments from './Comments'
import ContextCard from './ContextCard'

function dayLabel(iso) {
  const today = toISO(new Date())
  if (iso === today) return "Aujourd'hui"
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (toISO(y) === iso) return 'Hier'
  return prettyDate(iso)
}

// Moment du jour le plus récent en premier, puis du matin vers le soir.
function orderMoments(moments) {
  return [...moments].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return (a.start_time || '99:99').localeCompare(b.start_time || '99:99')
  })
}

function Slide({ moment }) {
  const meta = CATEGORY_META[moment.category] ?? CATEGORY_META.autre
  const { author } = moment
  const { myReaction, total, react, likeOnDoubleTap } = useReaction(moment)
  const [burst, setBurst] = useState(0)
  const [sheet, setSheet] = useState(null) // null | 'react' | 'comments'
  const [commentCount, setCommentCount] = useState(moment.comments || 0)
  const lastTap = useRef(0)

  const tags = [...new Set((moment.photos || []).flatMap((p) => p.tags || []))]
  const multi = moment.photos.length > 1

  function handleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      lastTap.current = 0
      likeOnDoubleTap()
      setBurst((b) => b + 1)
    } else {
      lastTap.current = now
      if (sheet) setSheet(null) // un tap sur la photo referme la feuille ouverte
    }
  }

  return (
    <section className="ifeed-slide" style={{ '--cat': meta.color }}>
      <img className="ifeed-photo" src={moment.photos[0].url} alt={moment.title} onClick={handleTap} />
      <div className="ifeed-veil" aria-hidden="true" />
      {burst > 0 && <span key={burst} className="heart-burst big" aria-hidden="true">❤️</span>}

      {/* Contexte agenda — l'ADN Moments, en haut à gauche */}
      <div className="ifeed-context">
        <span className="ifeed-day">{dayLabel(moment.date)}</span>
        {moment.start_time && <span className="ifeed-time">{moment.start_time}</span>}
      </div>

      {/* Rail d'actions à droite, façon TikTok */}
      <div className="ifeed-rail">
        <span className="ifeed-cat">{meta.emoji}</span>
        <button
          className={`ifeed-act ${myReaction ? 'on' : ''}`}
          onClick={() => setSheet(sheet === 'react' ? null : 'react')}
        >
          <span>{myReaction || '🤍'}</span>
          <small>{total > 0 ? total : ''}</small>
        </button>
        <button
          className={`ifeed-act ${sheet === 'comments' ? 'on' : ''}`}
          onClick={() => setSheet(sheet === 'comments' ? null : 'comments')}
        >
          <span>💬</span>
          <small>{commentCount > 0 ? commentCount : ''}</small>
        </button>
        {multi && <span className="ifeed-multi">▦ {moment.photos.length}</span>}
      </div>

      {/* Légende en bas à gauche */}
      <div className="ifeed-caption">
        <div className="ifeed-who">
          <span className="ifeed-avatar">{author.emoji}</span>
          <strong>{author.is_me ? 'Toi' : author.display_name}</strong>
          <span className="ifeed-handle">@{author.username}{author.city ? ` · ${author.city}` : ''}</span>
        </div>
        <h2 className="ifeed-title">{moment.title}</h2>
        {moment.notes && <p className="ifeed-notes">{moment.notes}</p>}
        <ContextCard context={moment.context} />
        {tags.length > 0 && (
          <div className="ifeed-vibes">
            {tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
          </div>
        )}
      </div>

      {sheet === 'react' && (
        <div className="ifeed-sheet react-sheet">
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              className={myReaction === e ? 'chosen' : ''}
              onClick={() => { react(e); setSheet(null) }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      {sheet === 'comments' && (
        <div className="ifeed-sheet comments-sheet">
          <Comments eventId={moment.id} onCountChange={(d) => setCommentCount((n) => n + d)} />
        </div>
      )}
    </section>
  )
}

export default function ImmersiveFeed({ moments }) {
  const ordered = orderMoments(moments)
  return (
    <div className="ifeed-scroller">
      {ordered.map((m) => <Slide key={m.id} moment={m} />)}
    </div>
  )
}
