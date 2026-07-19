// Map emoji → icône SVG maison (public/icons/). Fallback : l'emoji lui-même.
// Usage : <Icon emoji="❤️" size="24" /> ou <Icon name="camera" size="24" />

const ICON_MAP = {
  // Réactions
  '❤️': { name: 'love', label: 'Love' },
  '🤍': { name: 'heart-empty', label: 'Réagir' },
  '🔥': { name: 'flame', label: 'Flame' },
  '😂': { name: 'laugh', label: 'Laugh' },
  '😍': { name: 'Love-struck', label: 'Love-struck' },
  '😮': { name: 'Surprised', label: 'Surprised' },
  '👏': { name: 'clap', label: 'Clap' },
  // Catégories
  '🎬': { name: 'cinema', label: 'Cinéma' },
  '📖': { name: 'livre', label: 'Livre' },
  '☕': { name: 'cafe', label: 'Café' },
  '🏟️': { name: 'sport', label: 'Sport' },
  '📺': { name: 'video', label: 'Vidéo' },
  '🌆': { name: 'sortie', label: 'Sortie' },
  '📚': { name: 'books', label: 'Études' },
  '🍽️': { name: 'repas', label: 'Repas' },
  '✨': { name: 'autre', label: 'Autre' },
  // Navigation & app
  '💬': { name: 'comment', label: 'Commentaires' },
  '📸': { name: 'camera', label: 'Moments' },
  '🫂': { name: 'friends', label: 'Feed' },
  '🌍': { name: 'globe', label: 'Découverte' },
  '🗓️': { name: 'calendar', label: 'Journée' },
  '👤': { name: 'profile', label: 'Profil' },
  '🔔': { name: 'bell', label: 'Notifications' },
  '🕰️': { name: 'clock', label: 'Souvenirs' },
  '💌': { name: 'message', label: 'Message' },
  '🔗': { name: 'share', label: 'Partager' },
  // Avatars
  '😎': { name: 'cool', label: 'Avatar' },
  '🌙': { name: 'moon', label: 'Avatar' },
  '⚡': { name: 'bolt', label: 'Avatar' },
  '🦁': { name: 'lion', label: 'Avatar' },
  '🌸': { name: 'flower', label: 'Avatar' },
  '🎧': { name: 'headphones', label: 'Avatar' },
  '⚽': { name: 'sport', label: 'Avatar' },
}

export default function Icon({ emoji, name, size = '24', className = '' }) {
  const iconName = name || (emoji && ICON_MAP[emoji]?.name)
  const iconLabel = (name && 'icon') || (emoji && ICON_MAP[emoji]?.label)
  const fallbackEmoji = emoji || '✨'

  if (!iconName) {
    return <span className={className} title={iconLabel} style={{ fontSize: size + 'px', lineHeight: 1 }}>{fallbackEmoji}</span>
  }

  return (
    <img
      src={`/icons/${iconName}.svg`}
      alt={iconLabel || 'icon'}
      width={size}
      height={size}
      style={{ width: size + 'px', height: size + 'px', display: 'inline-block', verticalAlign: 'middle' }}
      className={className}
      loading="lazy"
    />
  )
}
