import { Link } from 'react-router-dom'
import { startsIn } from '@/lib/format'
import { formatMoney, formatOdds, payout } from '@/lib/odds'
import type { PopularSgp } from '@/lib/popular'
import { useBetslip } from '@/store/betslip'
import { useSettings } from '@/store/settings'
import { ChevronRight, FireIcon, SgpBadge } from '../Icons'
import { TeamLogo } from './TeamLogo'
import { eventPath } from '@/hooks/useSlip'

export function PopularSgpCard({ sgp, showTeams = true }: { sgp: PopularSgp; showTeams?: boolean }) {
  const fmt = useSettings((s) => s.oddsFormat)
  const add = useBetslip((s) => s.add)
  const setOpen = useBetslip((s) => s.setOpen)
  const ev = sgp.event
  const onAdd = () => {
    for (const s of sgp.slip) add(s)
    setOpen(true)
  }
  return (
    <div className="rounded-md overflow-hidden border" style={{ borderColor: '#1c4a86', background: 'var(--fd-surface)' }}>
      <div className="h-1.5 flex" style={{ background: '#0a2262' }}>
        <div className="h-full w-1/2 rounded-r" style={{ background: ev.away.team.color ?? '#d22839' }} />
      </div>
      {showTeams ? (
        <div className="flex items-center justify-between px-3 py-2" style={{ background: 'linear-gradient(180deg,#0a2d5a 0%,#092247 100%)' }}>
          <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#0d0d0d' }}>
            <TeamLogo team={ev.away.team} size={28} />
          </span>
          <div className="text-center">
            <Link to={eventPath(ev)} className="text-[14px] font-bold text-white">
              {ev.away.team.abbreviation} {ev.away.team.shortDisplayName} @ {ev.home.team.abbreviation} {ev.home.team.shortDisplayName}
            </Link>
            <div className="cond flex items-center justify-center gap-1.5 text-[11px] font-bold text-white mt-0.5" style={{ letterSpacing: 0.8 }}>
              <SgpBadge small /> {startsIn(ev.date)}
            </div>
          </div>
          <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#0d0d0d' }}>
            <TeamLogo team={ev.home.team} size={28} />
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'linear-gradient(180deg,#0a2d5a 0%,#092247 100%)' }}>
          <SgpBadge />
          <span className="text-[15px] font-bold text-white">{sgp.legs.length} leg Same Game Parlay</span>
        </div>
      )}
      <div className="px-4 pt-3 pb-4">
        <div className="text-[14px]" style={{ color: 'var(--fd-fg)' }}>
          {sgp.description}
        </div>
        <div className="relative mt-3 pl-6">
          <span className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: 'var(--fd-line)' }} />
          {sgp.legs.map((l) => (
            <div key={l.selection.id} className="relative py-1.5">
              <span className="absolute -left-6 top-2 w-[15px] h-[15px] rounded-full border" style={{ borderColor: 'var(--fd-fg-3)', background: 'var(--fd-surface)' }} />
              <div className="text-[14px] font-bold" style={{ color: 'var(--fd-fg)' }}>
                {l.selection.label}
              </div>
              <div className="cond text-[11px]" style={{ color: 'var(--fd-fg-3)', letterSpacing: 0.8 }}>
                {l.selection.sub ?? l.market.name}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <span className="cond inline-flex items-center gap-1 rounded-[3px] px-2 h-[18px] text-[11px] font-bold" style={{ background: '#f87a1e', color: '#fff', letterSpacing: 0.8 }}>
            <FireIcon size={12} color="#fff" /> {sgp.betsPlaced} BETS PLACED
          </span>
        </div>
        <button onClick={onAdd} className="w-full mt-3 h-[46px] rounded flex flex-col items-center justify-center text-white" style={{ background: '#128000' }}>
          <span className="text-[16px] font-bold leading-4">{formatOdds(sgp.odds, fmt)}</span>
          <span className="cond text-[11px] font-semibold mt-1" style={{ letterSpacing: 0.8 }}>
            $10 WAGER WINS {formatMoney(payout(10, sgp.odds))}
          </span>
        </button>
      </div>
    </div>
  )
}

export function ParlayHubLink() {
  return (
    <Link to="/parlay-hub" className="flex items-center justify-between h-11 px-4 text-[14px]" style={{ color: 'var(--fd-link)', background: 'var(--fd-surface)' }}>
      Enter Parlay Hub to view more
      <ChevronRight size={16} />
    </Link>
  )
}
