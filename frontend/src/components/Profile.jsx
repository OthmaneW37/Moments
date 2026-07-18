import { useEffect, useState } from 'react'
import { api, CATEGORY_META, setToken } from '../api'

export default function Profile({ user, onLogout, onUserChange, onOpenRecap }) {
  const [stats, setStats] = useState(null)
  const [summary, setSummary] = useState(null)
  const [friendsData, setFriendsData] = useState({ friends: [], pending: [], sent: [] })
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState(null)
  const [city, setCity] = useState(user.city || '')
  const [citySaved, setCitySaved] = useState(false)

  const refresh = () => {
    api.stats().then(setStats).catch(() => {})
    api.weekSummary().then(setSummary).catch(() => {})
    api.friends().then(setFriendsData).catch(() => {})
  }

  useEffect(refresh, [])

  async function handleSaveCity(e) {
    e.preventDefault()
    const updated = await api.updateProfile({ city: city.trim() })
    setCitySaved(true)
    setTimeout(() => setCitySaved(false), 2000)
    onUserChange?.(updated)
  }

  async function handleAddFriend(e) {
    e.preventDefault()
    if (!search.trim()) return
    setMessage(null)
    try {
      const res = await api.sendFriendRequest(search.trim().toLowerCase())
      setMessage({ ok: true, text: res.message })
      setSearch('')
      refresh()
    } catch (err) {
      setMessage({ ok: false, text: err.message })
    }
  }

  async function handleRespond(requestId, accept) {
    await api.respondFriendRequest(requestId, accept)
    refresh()
  }

  function handleLogout() {
    setToken(null)
    onLogout()
  }

  return (
    <div className="profile">
      <div className="profile-hero">
        <span className="profile-avatar">{user.emoji}</span>
        <div className="profile-id">
          <h2>{user.display_name}</h2>
          <p className="muted">@{user.username}{user.city ? ` · ${user.city}` : ''}</p>
        </div>
      </div>

      {summary && (
        <div className="week-summary">
          <div className="week-headline">{summary.headline}</div>
          <p className="week-text">{summary.text}</p>
        </div>
      )}

      <button className="recap-cta" onClick={onOpenRecap}>
        <span className="recap-cta-text">
          <strong>Ta rétro</strong>
          <span className="muted">Tes chiffres, ton moment star, ton lifestyle</span>
        </span>
        <span aria-hidden="true">→</span>
      </button>

      {stats && stats.streak > 0 && (
        <div className="streak-banner">
          🔥 <strong>{stats.streak} jour{stats.streak > 1 ? 's' : ''}</strong> de suite avec un moment capturé — continue !
        </div>
      )}

      {stats && (
        <div className="stat-grid">
          <div className="stat-box"><strong>{stats.events}</strong><span>moments</span></div>
          <div className="stat-box"><strong>{stats.photos}</strong><span>photos</span></div>
          <div className="stat-box"><strong>{friendsData.friends.length}</strong><span>amis</span></div>
          <div className="stat-box"><strong>{stats.likes_received}</strong><span>likes reçus</span></div>
        </div>
      )}

      <section className="profile-section">
        <h3>Ajouter un ami</h3>
        <form className="add-friend" onSubmit={handleAddFriend}>
          <input
            placeholder="Pseudo de ton ami…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoCapitalize="none"
          />
          <button className="btn primary" type="submit" disabled={!search.trim()}>
            Ajouter
          </button>
        </form>
        {message && (
          <p className={message.ok ? 'auth-ok' : 'auth-error'}>{message.text}</p>
        )}
      </section>

      {friendsData.pending.length > 0 && (
        <section className="profile-section">
          <h3>Demandes reçues 👋</h3>
          {friendsData.pending.map((p) => (
            <div className="friend-row" key={p.request_id}>
              <span className="friend-avatar">{p.emoji}</span>
              <div className="friend-who">
                <strong>{p.display_name}</strong>
                <span className="muted">@{p.username}</span>
              </div>
              <div className="friend-actions">
                <button className="btn primary sm" onClick={() => handleRespond(p.request_id, true)}>Accepter</button>
                <button className="btn ghost sm" onClick={() => handleRespond(p.request_id, false)}>Refuser</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="profile-section">
        <h3>Mes amis ({friendsData.friends.length})</h3>
        {friendsData.friends.length === 0 ? (
          <p className="muted">Pas encore d'amis — ajoute-les par leur pseudo !</p>
        ) : (
          friendsData.friends.map((f) => (
            <div className="friend-row" key={f.id}>
              <span className="friend-avatar">{f.emoji}</span>
              <div className="friend-who">
                <strong>{f.display_name}</strong>
                <span className="muted">@{f.username}</span>
              </div>
            </div>
          ))
        )}
        {friendsData.sent.length > 0 && (
          <p className="muted sent-info">
            En attente : {friendsData.sent.map((s) => `@${s.username}`).join(', ')}
          </p>
        )}
      </section>

      {stats && Object.keys(stats.by_category).length > 0 && (
        <section className="profile-section">
          <h3>Ton lifestyle</h3>
          <div className="cat-stats">
            {Object.entries(stats.by_category).map(([cat, n]) => {
              const meta = CATEGORY_META[cat] ?? CATEGORY_META.autre
              return (
                <span className="cat-stat" key={cat} style={{ '--cat': meta.color }}>
                  {meta.emoji} {meta.label} × {n}
                </span>
              )
            })}
          </div>
        </section>
      )}

      <section className="profile-section">
        <h3>Ma ville</h3>
        <form className="add-friend" onSubmit={handleSaveCity}>
          <input
            placeholder="ex : Casablanca"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <button className="btn primary" type="submit">Enregistrer</button>
        </form>
        {citySaved && <p className="auth-ok">Ville mise à jour ✅</p>}
        <p className="muted sent-info">Sert à te proposer les moments publics près de toi dans la Découverte.</p>
      </section>

      <button className="btn ghost logout" onClick={handleLogout}>
        Se déconnecter
      </button>
    </div>
  )
}
