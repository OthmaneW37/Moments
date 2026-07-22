import { useEffect, useState } from 'react'
import { api, CATEGORY_META, setToken } from '../api'
import { toast } from '../toast'
import Icon from './Icon'

export default function Profile({ user, onLogout, onUserChange, onOpenRecap, onOpenUser }) {
  const [stats, setStats] = useState(null)
  const [summary, setSummary] = useState(null)
  const [me, setMe] = useState(null)             // profil public (compteurs)
  const [requests, setRequests] = useState([])   // demandes d'abonnement reçues
  const [peopleList, setPeopleList] = useState(null) // { title, users } | null
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState(null)
  const [city, setCity] = useState(user.city || '')
  const [citySaved, setCitySaved] = useState(false)
  const [isPrivate, setIsPrivate] = useState(Boolean(user.is_private))

  const refresh = () => {
    api.stats().then(setStats).catch(() => {})
    api.weekSummary().then(setSummary).catch(() => {})
    api.userProfile(user.username).then(setMe).catch(() => {})
    api.followRequests().then(setRequests).catch(() => {})
  }

  useEffect(refresh, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveCity(e) {
    e.preventDefault()
    try {
      const updated = await api.updateProfile({ city: city.trim() })
      setCitySaved(true)
      setTimeout(() => setCitySaved(false), 2000)
      onUserChange?.(updated)
      toast.success('Ville mise à jour')
    } catch {
      toast.error('Impossible d\'enregistrer, réessaie')
    }
  }

  async function handleTogglePrivate() {
    const next = !isPrivate
    setIsPrivate(next)
    try {
      const updated = await api.updateProfile({ is_private: next })
      onUserChange?.(updated)
      refresh() // en repassant en public, les demandes en attente sont acceptées
      toast.success(next ? '🔒 Ton compte est désormais privé' : '🌍 Ton compte est désormais public')
    } catch {
      setIsPrivate(!next)
      toast.error('Changement impossible, réessaie')
    }
  }

  async function handleFollow(e) {
    e.preventDefault()
    if (!search.trim()) return
    setMessage(null)
    try {
      const username = search.trim().toLowerCase().replace(/^@/, '')
      const r = await api.follow(username)
      setMessage({
        ok: true,
        text: r.state === 'pending'
          ? `Demande envoyée à @${username} (compte privé)`
          : r.state === 'following'
            ? `Tu es maintenant abonné à @${username} 🎉`
            : `Désabonné de @${username}`,
      })
      setSearch('')
      refresh()
    } catch (err) {
      setMessage({ ok: false, text: err.message })
    }
  }

  async function handleRespond(requestId, accept) {
    // Optimiste : la demande disparaît tout de suite de la liste
    setRequests((rs) => rs.filter((r) => r.request_id !== requestId))
    try {
      await api.respondFollowRequest(requestId, accept)
      toast.success(accept ? 'Demande acceptée 🤝' : 'Demande refusée')
      refresh()
    } catch {
      toast.error('Action impossible, réessaie')
      refresh()
    }
  }

  async function openPeople(kind) {
    try {
      const users = kind === 'followers'
        ? await api.followers(user.username)
        : await api.following(user.username)
      setPeopleList({ title: kind === 'followers' ? 'Mes abonnés' : 'Mes abonnements', users })
    } catch { /* ignore */ }
  }

  function handleLogout() {
    setToken(null)
    onLogout()
  }

  return (
    <div className="profile">
      <div className="profile-hero">
        <span className="profile-avatar"><Icon emoji={user.emoji} size="34" /></span>
        <div className="profile-id">
          <h2>{user.display_name}</h2>
          <p className="muted">
            @{user.username}{user.city ? ` · ${user.city}` : ''}{isPrivate ? ' · 🔒' : ''}
          </p>
        </div>
      </div>

      {me && (
        <div className="usheet-stats">
          <div><strong>{stats?.events ?? '…'}</strong><span>moments</span></div>
          <button onClick={() => openPeople('followers')}>
            <strong>{me.followers}</strong><span>abonnés</span>
          </button>
          <button onClick={() => openPeople('following')}>
            <strong>{me.following}</strong><span>abonnements</span>
          </button>
        </div>
      )}

      {peopleList && (
        <div className="people-list">
          <div className="people-list-head">
            <strong>{peopleList.title}</strong>
            <button className="people-list-close" onClick={() => setPeopleList(null)}>×</button>
          </div>
          {peopleList.users.length === 0 && <p className="muted">Personne pour l'instant.</p>}
          {peopleList.users.map((u) => (
            <button key={u.username} className="people-row" onClick={() => onOpenUser?.(u.username)}>
              <Icon emoji={u.emoji} size="20" />
              <span className="people-name">{u.is_me ? 'Toi' : u.display_name}</span>
              <span className="muted">@{u.username}</span>
            </button>
          ))}
        </div>
      )}

      {requests.length > 0 && (
        <section className="profile-section">
          <h3>Demandes d'abonnement 👋</h3>
          {requests.map((p) => (
            <div className="friend-row" key={p.request_id}>
              <span className="friend-avatar"><Icon emoji={p.emoji} size="20" /></span>
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
        <h3>Suivre un compte</h3>
        <form className="add-friend" onSubmit={handleFollow}>
          <input
            placeholder="Pseudo (ex : sara)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoCapitalize="none"
          />
          <button className="btn primary" type="submit" disabled={!search.trim()}>
            S'abonner
          </button>
        </form>
        {message && (
          <p className={message.ok ? 'auth-ok' : 'auth-error'}>{message.text}</p>
        )}
      </section>

      <section className="profile-section">
        <h3>Confidentialité</h3>
        <button className="privacy-toggle" onClick={handleTogglePrivate}>
          <span className="privacy-info">
            <strong>{isPrivate ? '🔒 Compte privé' : '🌍 Compte public'}</strong>
            <span className="muted">
              {isPrivate
                ? "Les nouvelles personnes doivent t'envoyer une demande pour te suivre et voir tes moments."
                : 'Tout le monde peut te suivre et voir tes moments publics dans la Découverte.'}
            </span>
          </span>
          <span className={`switch ${isPrivate ? 'on' : ''}`} aria-hidden="true"><span className="switch-dot" /></span>
        </button>
      </section>

      {summary && (
        <div className="week-summary">
          <div className="week-summary-top">
            <span className="week-insight-badge">Ta semaine</span>
            <span className="week-headline">{summary.headline}</span>
          </div>
          {summary.insight && <p className="week-insight">{summary.insight}</p>}
          <p className="week-text muted">{summary.text}</p>
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
          <Icon emoji="🔥" size="18" /> <strong>{stats.streak} jour{stats.streak > 1 ? 's' : ''}</strong> de suite avec un moment capturé — continue !
        </div>
      )}

      {stats && Object.keys(stats.by_category).length > 0 && (
        <section className="profile-section">
          <h3>Ton lifestyle</h3>
          <div className="cat-stats">
            {Object.entries(stats.by_category).map(([cat, n]) => {
              const meta = CATEGORY_META[cat] ?? CATEGORY_META.autre
              return (
                <span className="cat-stat" key={cat} style={{ '--cat': meta.color }}>
                  <Icon emoji={meta.emoji} size="14" /> {meta.label} × {n}
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
