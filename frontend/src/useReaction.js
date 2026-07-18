import { useState } from 'react'
import { api } from './api'

// État + logique de réaction partagés entre la carte du feed et la vue plein écran.
export function useReaction(moment) {
  const [reactions, setReactions] = useState(moment.reactions || {})
  const [myReaction, setMyReaction] = useState(moment.my_reaction || null)
  const [total, setTotal] = useState(moment.reaction_total || 0)

  async function react(emoji) {
    const prev = { reactions, myReaction, total }
    // Mise à jour optimiste
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
      setReactions(prev.reactions)
      setMyReaction(prev.myReaction)
      setTotal(prev.total)
    }
  }

  // Double-tap : pose un ❤️ sans jamais dé-liker (comme Instagram).
  function likeOnDoubleTap() {
    if (myReaction !== '❤️') react('❤️')
  }

  const topEmojis = Object.entries(reactions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([e]) => e)

  return { reactions, myReaction, total, topEmojis, react, likeOnDoubleTap }
}
