import { useState } from 'react'
import { api, PUBLIC_URL } from '../api'
import Icon from './Icon'

// Bouton de partage d'un moment : génère un lien public puis ouvre le partage
// natif (Web Share API sur mobile) ou copie le lien dans le presse-papiers.
export default function ShareButton({ eventId, className = '' }) {
  const [state, setState] = useState('idle') // idle | copied

  async function handleShare(e) {
    e.stopPropagation()
    try {
      const { path } = await api.shareEvent(eventId)
      const url = `${PUBLIC_URL}${path}`
      if (navigator.share) {
        await navigator.share({ title: 'Un moment sur Moments', url })
      } else {
        await navigator.clipboard.writeText(url)
        setState('copied')
        setTimeout(() => setState('idle'), 1800)
      }
    } catch {
      /* partage annulé par l'utilisateur : rien à faire */
    }
  }

  return (
    <button className={className} onClick={handleShare} aria-label="Partager ce moment">
      <Icon name="share" size="24" />
      <small>{state === 'copied' ? 'copié !' : ''}</small>
    </button>
  )
}
