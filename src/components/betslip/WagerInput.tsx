import { useState } from 'react'
import { formatMoney } from '@/lib/odds'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useSettings } from '@/store/settings'

function toNum(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''))
  return isFinite(n) ? Math.round(n * 100) / 100 : 0
}

export function WagerInput({ stake, onChange, toWin, label = 'WAGER', winLabel = 'TO WIN', autoFocus, disabled }: { stake: number; onChange: (n: number) => void; toWin: number; label?: string; winLabel?: string; autoFocus?: boolean; disabled?: boolean }) {
  const [text, setText] = useState(stake ? String(stake) : '')
  const [focus, setFocus] = useState(false)
  const desktop = useIsDesktop()
  const quick = useSettings((s) => s.quickBetAmounts)
  const commit = (v: string) => {
    setText(v)
    onChange(toNum(v))
  }
  const display = focus ? text : stake ? (Number.isInteger(stake) ? String(stake) : stake.toFixed(2)) : ''
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col justify-center h-[52px] px-3 rounded border" style={{ borderColor: focus ? '#2b90ff' : 'var(--fd-line)', background: 'var(--fd-input-bg)' }}>
          <span className="cond text-[10px] font-bold" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
            {label}
          </span>
          <span className="flex items-center gap-0.5 text-[16px] font-semibold" style={{ color: 'var(--fd-fg)' }}>
            $
            <input
              inputMode="decimal"
              disabled={disabled}
              value={display}
              autoFocus={autoFocus}
              onFocus={() => {
                setFocus(true)
                setText(stake ? String(stake) : '')
              }}
              onBlur={() => setFocus(false)}
              onChange={(e) => commit(e.target.value)}
              className="w-full bg-transparent outline-none text-[16px] font-semibold"
              placeholder=""
              aria-label={label}
            />
          </span>
        </label>
        <div className="flex flex-col justify-center h-[52px] px-3 rounded border" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-input-bg)' }}>
          <span className="cond text-[10px] font-bold" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
            {winLabel}
          </span>
          <span className="text-[16px] font-semibold tabular" style={{ color: 'var(--fd-fg)' }}>
            {toWin > 0 ? formatMoney(toWin) : '$'}
          </span>
        </div>
      </div>
      {focus && !desktop ? (
        <div className="flex gap-2 mt-2">
          {quick.map((q) => (
            <button key={q} onMouseDown={(e) => e.preventDefault()} onClick={() => commit(String(Math.round((stake + q) * 100) / 100))} className="flex-1 h-8 rounded-full border text-[13px] font-semibold" style={{ borderColor: 'var(--fd-line)', color: 'var(--fd-fg)' }}>
              +${q}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
