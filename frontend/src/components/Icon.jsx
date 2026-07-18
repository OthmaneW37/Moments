// Map emoji → SVG icon. Fallback to emoji if SVG not found.
// Usage: <Icon emoji="❤️" /> or <Icon name="love" size="24" />

const ICON_MAP = {
  '❤️': { name: 'love', label: 'Love' },
  '🔥': { name: 'flame', label: 'Flame' },
  '😂': { name: 'laugh', label: 'Laugh' },
  '😍': { name: 'Love-struck', label: 'Love-struck' },
  '😮': { name: 'Surprised', label: 'Surprised' },
  '👏': { name: 'clap', label: 'Clap' },
  '🎬': { name: 'cinema', label: 'Cinema' },
}

export default function Icon({ emoji, name, size = '24', className = '' }) {
  const iconName = name || (emoji && ICON_MAP[emoji]?.name)
  const iconLabel = emoji && ICON_MAP[emoji]?.label
  const fallbackEmoji = emoji || '✨'

  if (!iconName) {
    return <span className={className} title={iconLabel} style={{ fontSize: size }}>{fallbackEmoji}</span>
  }

  return (
    <img
      src={`/icons/${iconName}.svg`}
      alt={iconLabel || 'icon'}
      width={size}
      height={size}
      style={{ width: size, height: size, display: 'inline-block' }}
      className={className}
      loading="lazy"
    />
  )
}
