import { useEffect, useRef, useState } from 'react'
import { CATEGORY_META, REACTION_EMOJIS, prettyDate, toISO } from '../api'
import { useReaction } from '../useReaction'
import Comments from './Comments'
import ContextCard from './ContextCard'
import Icon from './Icon'

function dateLabel(iso) {
  const today = toISO(new Date())
  if (iso === today) return "Aujourd'hui"
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (toISO(y) === iso) return 'Hier'
  return prettyDate(iso)
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

  function handleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      lastTap.current = 0
      likeOnDoubleTap()
      setBurst((b) => b + 1)
    } else {
      lastTap.current = now
    }
  }

  const hero = moment.photos[0]

  return (
    <section className="viewer-slide">
      <img className="viewer-photo" src={hero.url} alt={moment.title} onClick={handleTap} />
      <div className="viewer-veil" aria-hidden="true" />
      {burst > 0 && <span key={burst} className="heart-burst big" aria-hidden="true">❤️</span>}

      <div className="viewer-info">
        <div className="viewer-who">
          <span className="viewer-avatar"><Icon emoji={author.emoji} size="20" /></span>
          <div>
            <strong>{author.is_me ? 'Toi' : author.display_name}</strong>
            <span className="viewer-sub">
              @{author.username}{author.city ? ` · ${author.city}` : ''} · {dateLabel(moment.date)}
              {moment.start_time ? ` · ${moment.start_time}` : ''}
            </span>
          </div>
          <span className="viewer-cat" style={{ '--cat': meta.color }}><Icon emoji={meta.emoji} size="14" /> {meta.label}</span>
        </div>

        {tags.length > 0 && (
          <div className="moment-vibes">
            {tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
          </div>
        )}
        <h2 className="viewer-title">{moment.title}</h2>
        {moment.notes && <p className="viewer-notes">{moment.notes}</p>}
        <ContextCard context={moment.context} />
      </div>

      <div className="viewer-actions">
        <button
          className={`viewer-act ${myReaction ? 'on' : ''}`}
          onClick={() => setSheet(sheet === 'react' ? null : 'react')}
        >
          <Icon emoji={myReaction || '🤍'} size="26" />
          <small>{total > 0 ? total : ''}</small>
        </button>
        <button
          className={`viewer-act ${sheet === 'comments' ? 'on' : ''}`}
          onClick={() => setSheet(sheet === 'comments' ? null : 'comments')}
        >
          <Icon emoji="💬" size="26" />
          <small>{commentCount > 0 ? commentCount : ''}</small>
        </button>
      </div>

      {sheet === 'react' && (
        <div className="viewer-sheet react-sheet">
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              className={myReaction === e ? 'chosen' : ''}
              onClick={() => { react(e); setSheet(null) }}
            >
              <Icon emoji={e} size="32" />
            </button>
          ))}
        </div>
      )}

      {sheet === 'comments' && (
        <div className="viewer-sheet comments-sheet" onClick={(e) => e.stopPropagation()}>
          <Comments eventId={moment.id} onCountChange={(d) => setCommentCount((n) => n + d)} />
        </div>
      )}
    </section>
  )
}

export default function MomentViewer({ moments, index = 0, onClose }) {
  const scrollerRef = useRef(null)

  // Positionne le scroll sur le moment ouvert + verrouille le scroll de fond
  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = index * el.clientHeight
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [index])

  // Échap pour fermer (desktop)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="viewer">
      <button className="viewer-close" onClick={onClose} aria-label="Fermer">✕</button>
      <div className="viewer-scroller" ref={scrollerRef}>
        {moments.map((m) => <Slide key={m.id} moment={m} />)}
      </div>
    </div>
  )
}
