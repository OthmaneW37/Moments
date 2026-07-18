import { useEffect, useRef, useState } from 'react'
import { api, CATEGORY_META, REACTION_EMOJIS, prettyDate, toISO } from '../api'
import { useReaction } from '../useReaction'
import Comments from './Comments'
import ContextCard from './ContextCard'
import Icon from './Icon'

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

// Empile les icônes de réaction : la plus mise devant, les autres derrière.
function ReactionStack({ reactions, total, myReaction, onClick }) {
  const ordered = Object.entries(reactions).sort((a, b) => b[1] - a[1]).map(([e]) => e)
  return (
    <button className={`ifeed-act ${myReaction ? 'on' : ''}`} onClick={onClick}>
      {ordered.length === 0 ? (
        <Icon emoji="🤍" size="24" />
      ) : (
        <span className="react-stack">
          {ordered.slice(0, 3).map((e, i) => (
            <Icon key={e} emoji={e} size={i === 0 ? '28' : i === 1 ? '20' : '16'} className="react-stack-emoji" />
          ))}
        </span>
      )}
      <small>{total > 0 ? total : ''}</small>
    </button>
  )
}

// Feuille "qui a réagi avec quoi", groupée par réaction la plus faite d'abord.
function ReactionSheet({ moment, myReaction, onReact, onOpenUser }) {
  const [reactors, setReactors] = useState(null)

  useEffect(() => {
    api.eventReactions(moment.id).then(setReactors).catch(() => setReactors([]))
  }, [moment.id])

  const groups = []
  if (reactors) {
    const byEmoji = new Map()
    for (const r of reactors) {
      if (!byEmoji.has(r.reaction)) byEmoji.set(r.reaction, [])
      byEmoji.get(r.reaction).push(r)
    }
    groups.push(...[...byEmoji.entries()].sort((a, b) => b[1].length - a[1].length))
  }

  return (
    <div className="ifeed-sheet react-sheet2">
      {reactors === null ? (
        <p className="muted center">…</p>
      ) : groups.length > 0 && (
        <div className="react-groups">
          {groups.map(([emoji, people]) => (
            <div className="react-group" key={emoji}>
              <Icon emoji={emoji} size="24" className="react-group-emoji" />
              <span className="react-group-count">×{people.length}</span>
              <span className="react-group-people">
                {people.map((p, i) => (
                  <button key={p.username} className="linklike" onClick={() => onOpenUser?.(p.username)}>
                    {p.emoji} {p.is_me ? 'Toi' : p.display_name}{i < people.length - 1 ? ' · ' : ''}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="react-picker-row">
        {REACTION_EMOJIS.map((e) => (
          <button key={e} className={myReaction === e ? 'chosen' : ''} onClick={() => onReact(e)}>
            <Icon emoji={e} size="36" />
          </button>
        ))}
      </div>
    </div>
  )
}

function Slide({ moment, onOpenUser, onOpenContext }) {
  const meta = CATEGORY_META[moment.category] ?? CATEGORY_META.autre
  const { author } = moment
  const { reactions, myReaction, total, react, likeOnDoubleTap } = useReaction(moment)
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
        <Icon emoji={meta.emoji} size="24" className="ifeed-cat" />
        <ReactionStack
          reactions={reactions}
          total={total}
          myReaction={myReaction}
          onClick={() => setSheet(sheet === 'react' ? null : 'react')}
        />
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
          <button className="ifeed-avatar" onClick={() => onOpenUser?.(author.username)}>
            {author.emoji}
          </button>
          <button className="ifeed-name" onClick={() => onOpenUser?.(author.username)}>
            <strong>{author.is_me ? 'Toi' : author.display_name}</strong>
            <span className="ifeed-handle">@{author.username}{author.city ? ` · ${author.city}` : ''}</span>
          </button>
        </div>
        <h2 className="ifeed-title">{moment.title}</h2>
        {moment.notes && <p className="ifeed-notes">{moment.notes}</p>}
        {moment.context?.title && (
          <button className="ctx-card-btn" onClick={() => onOpenContext?.(moment.context)}>
            <ContextCard context={moment.context} />
          </button>
        )}
        {tags.length > 0 && (
          <div className="ifeed-vibes">
            {tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
          </div>
        )}
      </div>

      {sheet === 'react' && (
        <ReactionSheet
          key={total /* recharge la liste après un changement */}
          moment={moment}
          myReaction={myReaction}
          onReact={(e) => { react(e); setSheet(null) }}
          onOpenUser={onOpenUser}
        />
      )}
      {sheet === 'comments' && (
        <div className="ifeed-sheet comments-sheet">
          <Comments
            eventId={moment.id}
            onCountChange={(d) => setCommentCount((n) => n + d)}
            onOpenUser={onOpenUser}
          />
        </div>
      )}
    </section>
  )
}

export default function ImmersiveFeed({ moments, onOpenUser, onOpenContext }) {
  const ordered = orderMoments(moments)
  return (
    <div className="ifeed-scroller">
      {ordered.map((m) => (
        <Slide key={m.id} moment={m} onOpenUser={onOpenUser} onOpenContext={onOpenContext} />
      ))}
    </div>
  )
}
