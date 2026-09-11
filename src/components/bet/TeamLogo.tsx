import { useState } from 'react'
import type { Team } from '@/lib/types'

export function TeamLogo({ team, size = 24, round = false, className = '' }: { team: Team; size?: number; round?: boolean; className?: string }) {
  const [err, setErr] = useState(false)
  if (!team.logo || err) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 ${className}`} style={{ width: size, height: size, background: team.color ?? 'var(--fd-surface-3)', color: '#fff', fontSize: Math.max(8, Math.round(size * 0.36)) }}>
        {team.abbreviation.slice(0, 3)}
      </span>
    )
  }
  return <img src={team.logo} alt="" width={size} height={size} onError={() => setErr(true)} className={`shrink-0 object-contain ${round ? 'rounded-full' : ''} ${className}`} style={{ width: size, height: size }} loading="lazy" />
}

export function Headshot({ src, name, size = 32 }: { src?: string; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
  if (!src || err)
    return (
      <span className="inline-flex items-center justify-center rounded-full font-bold shrink-0" style={{ width: size, height: size, background: 'var(--fd-surface-3)', color: 'var(--fd-fg-2)', fontSize: Math.round(size * 0.36) }}>
        {initials}
      </span>
    )
  return <img src={src} alt="" onError={() => setErr(true)} className="rounded-full object-cover shrink-0" style={{ width: size, height: size, background: 'var(--fd-surface-3)' }} loading="lazy" />
}
