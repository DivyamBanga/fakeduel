import { useEffect, useRef } from 'react'
import { usePlaceBet } from '@/hooks/usePlaceBet'
import { formatOdds } from '@/lib/odds'
import { useBetslip } from '@/store/betslip'
import { useSettings } from '@/store/settings'
import { ChevronDown } from '../Icons'
import { Betslip } from './Betslip'

export function MobileBetslip() {
  const count = useBetslip((s) => s.selections.length)
  const open = useBetslip((s) => s.open)
  const setOpen = useBetslip((s) => s.setOpen)
  const receipt = useBetslip((s) => s.lastReceipt)
  const fmt = useSettings((s) => s.oddsFormat)
  const { plan } = usePlaceBet()
  const prev = useRef(count)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (prev.current === 0 && count === 1) setOpen(true)
    prev.current = count
  }, [count, setOpen])

  if (!count && !receipt) return null
  if (open) {
    return (
      <div className="fixed inset-0 z-50 slide-up flex flex-col" style={{ background: 'var(--fd-bg)' }}>
        <Betslip onClose={() => setOpen(false)} sheet />
      </div>
    )
  }
  const a = plan.analysis
  const oddsText = count === 1 ? formatOdds(a.units[0]?.legs[0]?.selection.odds ?? 0, fmt) : a.canParlay ? formatOdds(a.parlayOdds, fmt) : ''
  return (
    <button onClick={() => setOpen(true)} className="fixed left-0 right-0 z-40 flex items-center h-[56px] px-4 border-t" style={{ bottom: 'calc(62px + env(safe-area-inset-bottom, 0px))', background: 'var(--fd-surface)', borderColor: 'var(--fd-line)' }}>
      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold mr-3" style={{ background: '#2b90ff', color: '#fff' }}>
        {count}
      </span>
      <span className="text-[16px] font-bold" style={{ color: 'var(--fd-fg)' }}>
        Betslip
      </span>
      <span className="ml-auto flex items-center gap-2 text-[16px] font-bold tabular" style={{ color: 'var(--fd-fg)' }}>
        {oddsText}
        <ChevronDown size={22} className="rotate-180" color="var(--fd-link)" />
      </span>
    </button>
  )
}
