/**
 * AgentAvatar - shows agent photo from Supabase Storage, or initials fallback.
 *
 * Props:
 *   agentCode: string — used to look up photo in storage (agent-photos/{agentCode}.jpg)
 *   name: string — agent full name, used to derive initials (first + last word)
 *   size: number — pixel size of avatar (width and height), default 36
 *   tierKey: string — one of ADVISOR_TIERS keys, used for fallback bg color
 *   className: string — extra CSS classes
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TIER_COLORS } from '../constants'
import { usePhotoVersion } from '../context/PhotoVersionContext'

export default function AgentAvatar({ agentCode, name = '', size = 36, tierKey, className = '' }) {
  const [photoUrl, setPhotoUrl] = useState(null)
  const { version } = usePhotoVersion()

  useEffect(() => {
    if (!agentCode) {
      setPhotoUrl(null)
      return
    }
    const { data } = supabase.storage.from('agent-photos').getPublicUrl(`${agentCode}.jpg`)
    // Append version as cache-buster so all avatars refresh immediately after upload
    setPhotoUrl(data?.publicUrl ? `${data.publicUrl}?v=${version}` : null)
  }, [agentCode, version])

  // Derive initials: first char of first word + first char of last word
  const words = name.trim().split(/\s+/).filter(Boolean)
  const initials =
    words.length === 0
      ? '?'
      : words.length === 1
      ? words[0][0].toUpperCase()
      : (words[0][0] + words[words.length - 1][0]).toUpperCase()

  const bgColor  = TIER_COLORS[tierKey]?.bg   ?? '#1C1C28'
  const textColor = TIER_COLORS[tierKey]?.text ?? '#FFFFFF'

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{ width: size, height: size }}
        className={`object-cover rounded-lg ${className}`}
        onError={() => setPhotoUrl(null)}
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size, background: bgColor, color: textColor }}
      className={`rounded-lg flex items-center justify-center font-bold text-xs select-none ${className}`}
    >
      {initials}
    </div>
  )
}
