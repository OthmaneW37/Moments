import { useEffect, useRef, useState } from 'react'
import { api, CATEGORY_META, REACTION_EMOJIS, prettyDate, toISO } from '../api'
import { useReaction } from '../useReaction'
import Comments from './Comments'
import ContextCard from './ContextCard'
import Icon from './Icon'
import Media from './Media'
import ShareButton from './ShareButton'

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
                    <Icon emoji={p.emoji} size="16" /> {p.is_me ? 'Toi' : p.display_name}{i < people.length - 1 ? ' · ' : ''}
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
  const media = moment.photos[0]
  const sectionRef = useRef(null)

  // Vidéos : lecture auto quand la slide est visible, pause sinon
  useEffect(() => {
    if (media?.media_type !== 'video') return
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = el.querySelector('video')
        if (!v) return
        if (entry.isIntersecting) v.play().catch(() => {})
        else v.pause()
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [media])

  function handleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      lastTap.current = 0
      likeOnDoubleTap()
      setBurst((b) => b + 1)
    } else {
      lastTap.current = now
      if (sheet) setSheet(null) // un tap sur le média referme la feuille ouverte
    }
  }

  return (
    <section className="ifeed-slide" style={{ '--cat': meta.color }} ref={sectionRef}>
      <Media media={media} className="ifeed-photo" alt={moment.title} onClick={handleTap} />
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
          <Icon emoji="💬" size="26" />
          <small>{commentCount > 0 ? commentCount : ''}</small>
        </button>
        {author.is_me && <ShareButton eventId={moment.id} className="ifeed-act" />}
        {multi && <span className="ifeed-multi">▦ {moment.photos.length}</span>}
      </div>

      {/* Légende en bas à gauche */}
      <div className="ifeed-caption">
        <div className="ifeed-who">
          <button className="ifeed-avatar" onClick={() => onOpenUser?.(author.username)}>
            <Icon emoji={author.emoji} size="24" />
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

export default function ImmersiveFeed({ moments, onOpenUser, onOpenContext, onRefresh }) {
  const ordered = orderMoments(moments)
  const scrollerRef = useRef(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(null)
  const pullRef = useRef(0)

  const THRESHOLD = 68

  // Tirer-pour-rafraîchir : geste natif quand on est en haut du feed
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !onRefresh) return

    const setPullValue = (v) => { pullRef.current = v; setPull(v) }

    function onStart(e) {
      startY.current = el.scrollTop <= 0 && !refreshing ? e.touches[0].clientY : null
    }
    function onMove(e) {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0 && el.scrollTop <= 0) {
        e.preventDefault()
        if (!dragging) setDragging(true)
        setPullValue(Math.min(120, dy * 0.5)) // résistance
      } else {
        startY.current = null
        setDragging(false)
        setPullValue(0)
      }
    }
    async function onEnd() {
      if (startY.current === null) return
      startY.current = null
      setDragging(false)
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true)
        setPullValue(52)
        try { await onRefresh() } catch { /* l'appelant gère */ }
        setRefreshing(false)
      }
      setPullValue(0)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [onRefresh, refreshing, dragging])

  const ready = pull >= THRESHOLD
  return (
    <div className="ifeed-wrap">
      {(pull > 0 || refreshing) && (
        <div className="ifeed-refresh" style={{ opacity: Math.min(1, pull / THRESHOLD) }}>
          <span className={`ifeed-refresh-icon ${refreshing ? 'spin' : ''}`}>
            {refreshing ? '↻' : ready ? '↑' : '↓'}
          </span>
          <span className="ifeed-refresh-label">
            {refreshing ? 'Actualisation…' : ready ? 'Relâche pour actualiser' : 'Tire pour actualiser'}
          </span>
        </div>
      )}
      <div
        className="ifeed-scroller"
        ref={scrollerRef}
        style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: dragging ? 'none' : 'transform 0.28s ease' }}
      >
        {ordered.map((m) => (
          <Slide key={m.id} moment={m} onOpenUser={onOpenUser} onOpenContext={onOpenContext} />
        ))}
      </div>
    </div>
  )
}
