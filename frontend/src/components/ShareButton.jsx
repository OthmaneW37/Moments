import { useState } from 'react'
import { api, PUBLIC_URL } from '../api'
import { toast } from '../toast'
import Icon from './Icon'

// Bouton de partage d'un moment : génère un lien public puis ouvre le partage
// natif (Web Share API sur mobile) ou copie le lien dans le presse-papiers.
export default function ShareButton({ eventId, className = '' }) {
  const [busy, setBusy] = useState(false)

  async function handleShare(e) {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const { path } = await api.shareEvent(eventId)
      const url = `${PUBLIC_URL}${path}`
      if (navigator.share) {
        await navigator.share({ title: 'Un moment sur Moments', url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Lien copié — partage-le où tu veux')
      }
    } catch (err) {
      // AbortError = partage annulé par l'utilisateur : on ne dit rien
      if (err && err.name !== 'AbortError') {
        toast.error('Partage impossible, réessaie')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button className={className} onClick={handleShare} disabled={busy} aria-label="Partager ce moment">
      <Icon name="share" size="24" />
    </button>
  )
}
