import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { toast } from '../toast'
import Icon from './Icon'
import { ListSkeleton } from './Skeletons'

const FOLLOW_LABEL = { none: "S'abonner", pending: 'Demandé', following: 'Abonné' }

// Recherche globale de comptes, avec abonnement direct depuis les résultats.
export default function SearchUsers({ onOpenUser }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const debounce = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    debounce.current = setTimeout(() => {
      api.searchUsers(q.trim())
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 280)
    return () => clearTimeout(debounce.current)
  }, [q])

  async function toggleFollow(u) {
    // Optimiste : le bouton réagit immédiatement
    const optimistic = u.follow_state === 'none' ? (u.is_private ? 'pending' : 'following') : 'none'
    setResults((rs) => rs.map((x) => x.username === u.username ? { ...x, follow_state: optimistic } : x))
    try {
      const r = await api.follow(u.username)
      setResults((rs) => rs.map((x) => x.username === u.username ? { ...x, follow_state: r.state } : x))
      if (r.state === 'pending') toast.success('Demande d\'abonnement envoyée')
    } catch {
      setResults((rs) => rs.map((x) => x.username === u.username ? { ...x, follow_state: u.follow_state } : x))
      toast.error('Action impossible, réessaie')
    }
  }

  return (
    <div className="search-screen">
      <div className="search-bar">
        <Icon name="search" size="20" />
        <input
          ref={inputRef}
          placeholder="Rechercher un compte…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoCapitalize="none"
        />
        {q && <button className="search-clear" onClick={() => setQ('')}>×</button>}
      </div>

      {loading && results.length === 0 && <ListSkeleton count={4} />}

      {!loading && q.trim() && results.length === 0 && (
        <p className="muted center">Aucun compte trouvé pour « {q} ».</p>
      )}

      {!q.trim() && (
        <div className="empty-state">
          <Icon name="search" size="56" className="empty-emoji" />
          <h3>Trouve tes amis</h3>
          <p>Cherche par pseudo ou par nom pour t'abonner à leurs moments.</p>
        </div>
      )}

      <div className="search-results">
        {results.map((u) => (
          <div className="search-row" key={u.username}>
            <button className="search-row-main" onClick={() => onOpenUser?.(u.username)}>
              <span className="friend-avatar"><Icon emoji={u.emoji} size="22" /></span>
              <span className="search-row-id">
                <strong>{u.display_name}</strong>
                <span className="muted">@{u.username}{u.is_private ? ' · 🔒' : ''}</span>
              </span>
            </button>
            {!u.is_me && (
              <button
                className={`btn follow-btn sm ${u.follow_state === 'none' ? 'primary' : ''}`}
                onClick={() => toggleFollow(u)}
              >
                {FOLLOW_LABEL[u.follow_state]}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
