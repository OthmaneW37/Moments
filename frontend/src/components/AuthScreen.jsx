import { useState } from 'react'
import { api, setToken } from '../api'

const AVATARS = ['😎', '🔥', '✨', '🌙', '⚡', '🦁', '🌸', '🎧', '⚽', '📚']

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [emoji, setEmoji] = useState('😎')
  const [city, setCity] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res =
        mode === 'signup'
          ? await api.signup({ username, display_name: displayName || username, password, emoji, city })
          : await api.login({ username, password })
      setToken(res.token)
      onAuthed(res.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <span className="auth-logo">📸</span>
        <h1 className="brand-name big">Moments</h1>
        <p className="auth-tagline">Ta vraie vie. Tes vrais moments.<br />Partagés avec tes vrais amis.</p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''}
                  onClick={() => { setMode('login'); setError(null) }}>
            Connexion
          </button>
          <button type="button" className={mode === 'signup' ? 'active' : ''}
                  onClick={() => { setMode('signup'); setError(null) }}>
            Inscription
          </button>
        </div>

        <label>
          Pseudo
          <input
            autoFocus
            placeholder="ex : othmane"
            value={username}
            onChange={(e) => setUsername(e.target.value.trim().toLowerCase())}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>

        {mode === 'signup' && (
          <>
            <label>
              Nom affiché
              <input
                placeholder="ex : Othmane M."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label>
              Ville <span className="label-hint">(pour la Découverte)</span>
              <input
                placeholder="ex : Casablanca"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <label>
              Ton avatar
              <div className="avatar-picker">
                {AVATARS.map((a) => (
                  <button key={a} type="button"
                          className={`avatar-chip ${emoji === a ? 'active' : ''}`}
                          onClick={() => setEmoji(a)}>
                    {a}
                  </button>
                ))}
              </div>
            </label>
          </>
        )}

        <label>
          Mot de passe
          <input
            type="password"
            placeholder={mode === 'signup' ? '6 caractères minimum' : '••••••••'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn primary big" type="submit"
                disabled={loading || !username || password.length < 6}>
          {loading ? '...' : mode === 'signup' ? "Rejoindre Moments 🚀" : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
