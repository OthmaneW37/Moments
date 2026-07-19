// Affiche une photo OU une vidéo selon media_type. Même API que <img> :
// on passe le média {url, media_type} et une className.
// Les vidéos du feed : muet + boucle + inline, lecture au tap gérée par le parent.
export default function Media({ media, className, alt = '', onClick, autoPlay = false, controls = false }) {
  if (media?.media_type === 'video') {
    return (
      <video
        className={className}
        src={media.url}
        onClick={onClick}
        muted
        loop
        playsInline
        autoPlay={autoPlay}
        controls={controls}
        preload="metadata"
      />
    )
  }
  return <img className={className} src={media?.url} alt={alt} onClick={onClick} loading="lazy" />
}
