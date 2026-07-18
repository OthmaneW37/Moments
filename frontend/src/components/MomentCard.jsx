import { useRef, useState } from 'react'
import { api, CATEGORY_META, REACTION_EMOJIS, prettyDate, toISO } from '../api'
import { useReaction } from '../useReaction'
import Comments from './Comments'
import ContextCard from './ContextCard'

function feedDateLabel(iso) {
  const today = toISO(new Date())
  if (iso === today) return "Aujourd'hui"
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (toISO(yesterday) === iso) return 'Hier'
  return prettyDate(iso)
}

export default function MomentCard({ moment, onOpen }) {
  const meta = CATEGORY_META[moment.category] ?? CATEGORY_META.autre
  const { author } = moment
  const { myReaction, total, topEmojis, react, likeOnDoubleTap } = useReaction(moment)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [reactors, setReactors] = useState(null)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(moment.comments || 0)
  const [burst, setBurst] = useState(0) // incrémenté à chaque double-tap pour rejouer l'animation

  const lastTap = useRef(0)
  const singleTimer = useRef(null)

  function handleMediaTap() {
    const now = Date.now()
    if (now - lastTap.current < 280) {
      clearTimeout(singleTimer.current)
      lastTap.current = 0
      likeOnDoubleTap()
      setBurst((b) => b + 1)
    } else {
      lastTap.current = now
      singleTimer.current = setTimeout(() => { onOpen?.(moment) }, 280)
    }
  }

  function togglePicker() {
    const opening = !pickerOpen
    setPickerOpen(opening)
    if (opening && total > 0 && reactors === null) {
      api.eventReactions(moment.id).then(setReactors).catch(() => setReactors([]))
    }
  }

  async function handleReact(emoji) {
    setPickerOpen(false)
    setReactors(null) // la liste change, on la rechargera à la prochaine ouverture
    await react(emoji)
  }

  // Tags IA agrégés depuis les photos (dédupliqués)
  const tags = [...new Set((moment.photos || []).flatMap((p) => p.tags || []))]
  const multi = moment.photos.length > 1

  return (
    <article className="moment" style={{ '--cat': meta.color }}>
      <div className="moment-media" onClick={handleMediaTap}>
        <div className="moment-track">
          {moment.photos.map((p) => (
            <img key={p.id} src={p.url} alt={moment.title} loading="lazy" />
          ))}
        </div>

        <div className="moment-veil" aria-hidden="true" />

        {burst > 0 && (
          <span key={burst} className="heart-burst" aria-hidden="true">❤️</span>
        )}

        <header className="moment-top">
          <span className="moment-avatar">{author.emoji}</span>
          <div className="moment-who">
            <strong>{author.is_me ? 'Toi' : author.display_name}</strong>
            <span>
              @{author.username}
              {author.city ? ` · ${author.city}` : ''}
              {' · '}{feedDateLabel(moment.date)}{moment.start_time ? ` · ${moment.start_time}` : ''}
            </span>
          </div>
          {multi && <span className="moment-count">1 / {moment.photos.length}</span>}
        </header>

        <span className="moment-cat">{meta.emoji} {meta.label}</span>

        <div className="moment-caption">
          {tags.length > 0 && (
            <div className="moment-vibes">
              {tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
            </div>
          )}
          <h3>{moment.title}</h3>
          {moment.notes && <p>{moment.notes}</p>}
          <ContextCard context={moment.context} />
        </div>
      </div>

      <footer className="moment-bar">
        <div className="react-wrap">
          <button
            className={`like-btn ${myReaction ? 'liked' : ''}`}
            onClick={togglePicker}
          >
            {myReaction || (topEmojis.length ? topEmojis.join('') : '🤍')} {total > 0 ? total : ''}
          </button>
          {pickerOpen && (
            <div className="react-pop">
              {total > 0 && (
                <p className="reactors">
                  {reactors === null
                    ? '…'
                    : reactors.map((r) => `${r.reaction} ${r.is_me ? 'Toi' : r.display_name}`).join(' · ')}
                </p>
              )}
              <div className="react-picker">
                {REACTION_EMOJIS.map((e) => (
                  <button key={e} className={myReaction === e ? 'chosen' : ''} onClick={() => handleReact(e)}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          className={`like-btn ${showComments ? 'liked' : ''}`}
          onClick={() => setShowComments((s) => !s)}
        >
          💬 {commentCount > 0 ? commentCount : ''}
        </button>
      </footer>

      {showComments && (
        <Comments eventId={moment.id} onCountChange={(d) => setCommentCount((n) => n + d)} />
      )}
    </article>
  )
}
