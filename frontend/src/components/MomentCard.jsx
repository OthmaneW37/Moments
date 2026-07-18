import { useEffect, useState } from 'react'
import { api, CATEGORY_META, REACTION_EMOJIS, prettyDate, toISO } from '../api'

function feedDateLabel(iso) {
  const today = toISO(new Date())
  if (iso === today) return "Aujourd'hui"
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (toISO(yesterday) === iso) return 'Hier'
  return prettyDate(iso)
}

function Comments({ eventId, onCountChange }) {
  const [comments, setComments] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api.comments(eventId).then(setComments).catch(() => setComments([]))
  }, [eventId])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const c = await api.addComment(eventId, text.trim())
      setComments((cs) => [...cs, c])
      setText('')
      onCountChange(1)
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id) {
    await api.deleteComment(id)
    setComments((cs) => cs.filter((c) => c.id !== id))
    onCountChange(-1)
  }

  if (comments === null) return <p className="muted comment-loading">…</p>

  return (
    <div className="comments">
      {comments.map((c) => (
        <div className="comment" key={c.id}>
          <span className="comment-avatar">{c.emoji}</span>
          <div className="comment-body">
            <span className="comment-author">{c.is_me ? 'Toi' : c.display_name}</span>
            <span className="comment-text">{c.text}</span>
          </div>
          {Boolean(c.is_me) && (
            <button className="comment-del" onClick={() => handleDelete(c.id)}>×</button>
          )}
        </div>
      ))}
      <form className="comment-form" onSubmit={handleSend}>
        <input
          placeholder="Ajoute un commentaire…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <button className="btn primary sm" type="submit" disabled={!text.trim() || sending}>➤</button>
      </form>
    </div>
  )
}

export default function MomentCard({ moment }) {
  const meta = CATEGORY_META[moment.category] ?? CATEGORY_META.autre
  const { author } = moment
  const [reactions, setReactions] = useState(moment.reactions || {})
  const [myReaction, setMyReaction] = useState(moment.my_reaction || null)
  const [total, setTotal] = useState(moment.reaction_total || 0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [reactors, setReactors] = useState(null)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(moment.comments || 0)

  function togglePicker() {
    const opening = !pickerOpen
    setPickerOpen(opening)
    if (opening && total > 0 && reactors === null) {
      api.eventReactions(moment.id).then(setReactors).catch(() => setReactors([]))
    }
  }

  // Tags IA agrégés depuis les photos (dédupliqués)
  const tags = [...new Set((moment.photos || []).flatMap((p) => p.tags || []))]

  async function handleReact(emoji) {
    setPickerOpen(false)
    setReactors(null) // la liste change, on la rechargera à la prochaine ouverture
    // Optimiste
    const prev = { reactions, myReaction, total }
    const next = { ...reactions }
    if (myReaction) next[myReaction] = Math.max(0, (next[myReaction] || 1) - 1)
    let newMine = null
    if (myReaction !== emoji) {
      next[emoji] = (next[emoji] || 0) + 1
      newMine = emoji
    }
    Object.keys(next).forEach((k) => next[k] === 0 && delete next[k])
    setReactions(next)
    setMyReaction(newMine)
    setTotal(Object.values(next).reduce((a, b) => a + b, 0))
    try {
      const res = await api.react(moment.id, emoji)
      setReactions(res.reactions)
      setMyReaction(res.my_reaction)
      setTotal(res.reaction_total)
    } catch {
      setReactions(prev.reactions); setMyReaction(prev.myReaction); setTotal(prev.total)
    }
  }

  const topEmojis = Object.entries(reactions).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e]) => e)

  return (
    <article className="feed-card" style={{ '--cat': meta.color }}>
      <header className="feed-head">
        <span className="feed-avatar">{author.emoji}</span>
        <div className="feed-who">
          <strong>{author.is_me ? 'Toi' : author.display_name}</strong>
          <span className="muted">
            @{author.username}
            {author.city ? ` · ${author.city}` : ''}
            {' · '}{feedDateLabel(moment.date)}{moment.start_time ? ` · ${moment.start_time}` : ''}
          </span>
        </div>
        <span className="event-cat">{meta.emoji} {meta.label}</span>
      </header>

      <h3 className="feed-title">{moment.title}</h3>
      {moment.notes && <p className="event-notes">{moment.notes}</p>}

      <div className="feed-photos">
        {moment.photos.map((p) => (
          <img key={p.id} src={p.url} alt={moment.title} loading="lazy" />
        ))}
      </div>

      {tags.length > 0 && (
        <div className="ai-tags">
          <span className="ai-badge">IA</span>
          {tags.map((t) => <span className="ai-tag" key={t}>{t}</span>)}
        </div>
      )}

      <footer className="feed-foot">
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
