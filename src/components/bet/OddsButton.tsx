import { useEffect, useRef, useState } from 'react'
import { formatOdds } from '@/lib/odds'
import { useSettings } from '@/store/settings'
import { LockIcon } from '../Icons'

export interface OddsButtonProps {
  line?: string
  odds: number
  selected?: boolean
  suspended?: boolean
  onClick?: () => void
  className?: string
  height?: number
  compact?: boolean
  align?: 'center' | 'between'
  label?: string
}

/** FanDuel-style odds cell: line on top (white), price below (blue). Selected = solid blue. */
export function OddsButton({ line, odds, selected, suspended, onClick, className = '', height = 44, compact, align = 'center', label }: OddsButtonProps) {
  const fmt = useSettings((s) => s.oddsFormat)
  const prev = useRef(odds)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)
  useEffect(() => {
    if (prev.current !== odds) {
      setFlash(odds > prev.current ? 'up' : 'down')
      prev.current = odds
      const t = window.setTimeout(() => setFlash(null), 1200)
      return () => window.clearTimeout(t)
    }
  }, [odds])
  const text = formatOdds(odds, fmt)
  return (
    <button
      type="button"
      disabled={suspended}
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex ${align === 'between' ? 'flex-row items-center justify-between px-3' : 'flex-col items-center justify-center'} rounded border select-none transition-colors ${flash === 'up' ? 'odds-up' : flash === 'down' ? 'odds-down' : ''} ${suspended ? 'opacity-50' : 'hover:bg-[var(--fd-odds-hover)]'} ${className}`}
      style={{
        height,
        borderColor: selected ? '#2b90ff' : 'var(--fd-odds-border)',
        background: selected ? '#2b90ff' : 'var(--fd-odds-bg)',
        color: selected ? '#eaf0f6' : 'var(--fd-fg)',
      }}
    >
      {suspended ? (
        <LockIcon size={16} color="var(--fd-fg-3)" />
      ) : (
        <>
          {label ? (
            <span className="text-[13px] font-semibold truncate" style={{ color: selected ? '#eaf0f6' : 'var(--fd-fg)' }}>
              {label}
            </span>
          ) : null}
          {line ? (
            <span className="font-bold leading-3" style={{ fontSize: compact ? 11 : 12, letterSpacing: 0.3, color: selected ? '#eaf0f6' : 'var(--fd-fg)' }}>
              {line}
            </span>
          ) : null}
          <span className={`font-bold leading-3 ${line ? 'mt-1' : ''}`} style={{ fontSize: compact ? 11 : 12, letterSpacing: 0.5, color: selected ? '#eaf0f6' : 'var(--fd-link)' }}>
            {text}
          </span>
        </>
      )}
    </button>
  )
}
