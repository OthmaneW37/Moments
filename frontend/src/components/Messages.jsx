import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import Icon from './Icon'

function timeAgo(sqlDate) {
  if (!sqlDate) return ''
  const then = new Date(sqlDate.replace(' ', 'T') + 'Z')
  const mins = Math.max(0, Math.floor((Date.now() - then.getTime()) / 60000))
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} j`
}

// Vue d'une conversation ouverte.
function Thread({ username, onBack, onOpenUser }) {
  const [data, setData] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  function load() {
    api.conversationWith(username).then(setData).catch(() => {})
  }
  useEffect(() => {
    load()
    const id = setInterval(load, 5000) // rafraîchit pour recevoir les réponses
    return () => clearInterval(id)
  }, [username]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data?.messages?.length])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    const body = text.trim()
    setText('')
    try {
      const m = await api.sendMessage(username, body)
      setData((d) => ({ ...d, messages: [...d.messages, m] }))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="thread">
      <header className="thread-head">
        <button className="page-sheet-back" onClick={onBack} aria-label="Retour">←</button>
        <button className="thread-who" onClick={() => data && onOpenUser?.(data.other.username)}>
          {data && <><Icon emoji={data.other.emoji} size="24" />
            <span><strong>{data.other.display_name}</strong><span className="muted">@{data.other.username}</span></span></>}
        </button>
      </header>

      <div className="thread-body">
        {data?.messages.length === 0 && (
          <p className="muted center thread-empty">Écris le premier message 👋</p>
        )}
        {data?.messages.map((m) => (
          <div className={`bubble-row ${m.is_me ? 'me' : 'them'}`} key={m.id}>
            <div className="bubble">
              {m.text}
              <span className="bubble-time">{timeAgo(m.created_at)}</span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form className="thread-form" onSubmit={handleSend}>
        <input
          placeholder="Ton message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
        />
        <button className="btn primary" type="submit" disabled={!text.trim() || sending}>➤</button>
      </form>
    </div>
  )
}

export default function Messages({ openWith, onConsumeOpen, onOpenUser }) {
  const [convs, setConvs] = useState(null)
  const [active, setActive] = useState(openWith || null) // username de la conv ouverte

  useEffect(() => {
    if (openWith) { setActive(openWith); onConsumeOpen?.() }
  }, [openWith]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadList() {
    api.conversations().then((d) => setConvs(d.conversations)).catch(() => setConvs([]))
  }
  useEffect(() => { if (!active) loadList() }, [active])

  if (active) {
    return <Thread username={active} onBack={() => setActive(null)} onOpenUser={onOpenUser} />
  }

  return (
    <div className="messages">
      <h1 className="page-title">Messages</h1>
      {convs === null && <p className="muted center">Chargement…</p>}
      {convs?.length === 0 && (
        <div className="empty-state">
          <Icon name="message" size="56" className="empty-emoji" />
          <h3>Aucune conversation</h3>
          <p>Ouvre le profil d'un compte et appuie sur « Message » pour lui écrire.</p>
        </div>
      )}
      <div className="conv-list">
        {convs?.map((c) => (
          <button className="conv-row" key={c.id} onClick={() => setActive(c.other.username)}>
            <span className="friend-avatar"><Icon emoji={c.other.emoji} size="24" /></span>
            <span className="conv-main">
              <span className="conv-top">
                <strong>{c.other.display_name}</strong>
                <span className="muted">{timeAgo(c.last_at)}</span>
              </span>
              <span className={`conv-preview ${c.unread ? 'unread' : ''}`}>
                {c.last_from_me ? 'Toi : ' : ''}{c.last_text}
              </span>
            </span>
            {c.unread > 0 && <span className="conv-badge">{c.unread}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
