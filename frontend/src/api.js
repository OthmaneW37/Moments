// Client API — toutes les requêtes passent par le proxy Vite (/api -> backend)

const TOKEN_KEY = 'moments_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch { /* pas de JSON */ }
    if (res.status === 401) setToken(null) // session expirée -> retour au login
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return null
  return res.json()
}

const jsonPost = (url, data, method = 'POST') =>
  request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const api = {
  // --- Auth ---
  signup: (data) => jsonPost('/api/auth/signup', data),
  login: (data) => jsonPost('/api/auth/login', data),
  me: () => request('/api/auth/me'),
  updateProfile: (data) => jsonPost('/api/profile', data, 'PUT'),

  // --- Events (perso) ---
  eventsForDate: (date) => request(`/api/events?date=${date}`),
  eventsRange: (start, end) => request(`/api/events/range?start=${start}&end=${end}`),
  createEvent: (data) => jsonPost('/api/events', data),
  updateEvent: (id, data) => jsonPost(`/api/events/${id}`, data, 'PUT'),
  deleteEvent: (id) => request(`/api/events/${id}`, { method: 'DELETE' }),

  // --- Photos ---
  uploadPhoto: (eventId, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(`/api/events/${eventId}/photos`, { method: 'POST', body: form })
  },
  deletePhoto: (id) => request(`/api/photos/${id}`, { method: 'DELETE' }),

  // --- Social ---
  feed: () => request('/api/feed'),
  discover: () => request('/api/discover'),
  react: (eventId, emoji) => jsonPost(`/api/events/${eventId}/react`, { emoji }),
  eventReactions: (eventId) => request(`/api/events/${eventId}/reactions`),
  follow: (username) => jsonPost(`/api/users/${encodeURIComponent(username)}/follow`, {}),
  followRequests: () => request('/api/follow/requests'),
  respondFollowRequest: (requestId, accept) =>
    jsonPost('/api/follow/respond', { request_id: requestId, accept }),
  followers: (username) => request(`/api/users/${encodeURIComponent(username)}/followers`),
  following: (username) => request(`/api/users/${encodeURIComponent(username)}/following`),

  // --- Commentaires ---
  comments: (eventId) => request(`/api/events/${eventId}/comments`),
  addComment: (eventId, text) => jsonPost(`/api/events/${eventId}/comments`, { text }),
  deleteComment: (id) => request(`/api/comments/${id}`, { method: 'DELETE' }),

  // --- Notifications ---
  notifications: () => request('/api/notifications'),
  markNotificationsRead: () => request('/api/notifications/read', { method: 'POST' }),

  // --- Phase IA ---
  memories: () => request('/api/memories'),
  weekSummary: () => request('/api/week-summary'),
  recap: () => request('/api/recap'),

  // --- Perso ---
  timeline: () => request('/api/timeline'),
  stats: () => request('/api/stats'),

  // --- Fiche contextuelle (film/série, livre, match, lieu) ---
  contextSearch: (category, q) =>
    request(`/api/context/search?category=${encodeURIComponent(category)}&q=${encodeURIComponent(q)}`),
  contextDetail: (kind, title) =>
    request(`/api/context/detail?kind=${encodeURIComponent(kind)}&title=${encodeURIComponent(title)}`),

  // --- Profils publics ---
  userProfile: (username) => request(`/api/users/${encodeURIComponent(username)}`),
}

// Catégories qui proposent une fiche contextuelle + libellé de recherche
export const CONTEXT_SEARCH = {
  cinema: 'Quel film / série ? 🎬',
  video: 'Quelle série / vidéo ? 📺',
  livre: 'Quel livre ? 📖',
  etude: 'Quel livre / manuel ? 📚',
  sport: 'Quel match ? (ex : Real Madrid vs Barcelona)',
  cafe: 'Quel café ? ☕',
  repas: 'Quel resto ? 🍽️',
  sortie: 'Quel lieu ? 🌆',
}

export const REACTION_EMOJIS = ['❤️', '🔥', '😂', '😍', '😮', '👏']

// ---- Helpers dates ----

// Tons profonds et feutrés, lisibles sur fond papier clair
export const CATEGORY_META = {
  cinema: { label: 'Cinéma', emoji: '🎬', color: '#7b3b8f' },
  livre: { label: 'Livre', emoji: '📖', color: '#7d3650' },
  cafe: { label: 'Café', emoji: '☕', color: '#8a5a17' },
  sport: { label: 'Sport', emoji: '🏟️', color: '#2f6b3c' },
  video: { label: 'Vidéo / YouTube', emoji: '📺', color: '#9c3535' },
  sortie: { label: 'Sortie', emoji: '🌆', color: '#3f5195' },
  etude: { label: 'Études', emoji: '📚', color: '#20657f' },
  repas: { label: 'Repas', emoji: '🍽️', color: '#a34e19' },
  autre: { label: 'Autre', emoji: '✨', color: '#6f6a60' },
}

export function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00')
  const shift = (d.getDay() + 6) % 7 // lundi = 0
  d.setDate(d.getDate() - shift)
  return toISO(d)
}

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

export function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00')
  return DAY_NAMES[d.getDay()]
}

export function prettyDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
