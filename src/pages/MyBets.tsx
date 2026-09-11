import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckIcon, CloseIcon, SgpBadge } from '@/components/Icons'
import { Card, EmptyState } from '@/components/shell/SectionHeader'
import { TextTabs } from '@/components/shell/SportChips'
import { LEAGUE_BY_ID } from '@/data/sports'
import { cashOutValue } from '@/lib/cashout'
import { formatDateTime, formatStartTime } from '@/lib/format'
import { getPregameLines } from '@/lib/lines'
import { legWinProbability } from '@/lib/live'
import { formatMoney, formatOdds } from '@/lib/odds'
import type { Bet, BetLeg, BetStatus } from '@/lib/types'
import { useAccount } from '@/store/account'
import { useLiveStore } from '@/store/live'
import { useSettings } from '@/store/settings'

const STATUS_STYLE: Record<BetStatus, { label: string; bg: string; color: string }> = {
  open: { label: 'OPEN', bg: 'var(--fd-surface-3)', color: 'var(--fd-fg)' },
  won: { label: 'WON', bg: '#128000', color: '#fff' },
  lost: { label: 'LOST', bg: '#d22839', color: '#fff' },
  push: { label: 'PUSH', bg: 'var(--fd-surface-3)', color: 'var(--fd-fg)' },
  void: { label: 'VOID', bg: 'var(--fd-surface-3)', color: 'var(--fd-fg)' },
  cashed_out: { label: 'CASHED OUT', bg: '#0070eb', color: '#fff' },
}

function LegStatus({ status }: { status: BetStatus }) {
  if (status === 'won')
    return (
      <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0" style={{ background: '#128000' }}>
        <CheckIcon size={12} color="#fff" strokeWidth={3} />
      </span>
    )
  if (status === 'lost')
    return (
      <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0" style={{ background: '#d22839' }}>
        <CloseIcon size={12} color="#fff" strokeWidth={3} />
      </span>
    )
  if (status === 'push' || status === 'void')
    return (
      <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ background: 'var(--fd-surface-3)', color: 'var(--fd-fg)' }}>
        P
      </span>
    )
  return <span className="w-[18px] h-[18px] rounded-full border-2 shrink-0" style={{ borderColor: 'var(--fd-fg-3)' }} />
}

function LegRow({ leg, bet }: { leg: BetLeg; bet: Bet }) {
  const ev = useLiveStore((s) => s.events[leg.eventId])
  const live = ev?.status.state === 'in'
  const score = ev && (live || ev.status.state === 'post') ? `${ev.away.team.abbreviation} ${ev.away.score} - ${ev.home.team.abbreviation} ${ev.home.score}` : leg.score
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="pt-0.5">
        <LegStatus status={leg.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[14px] font-bold" style={{ color: leg.status === 'lost' ? 'var(--fd-fg-3)' : 'var(--fd-fg)' }}>
            {leg.selectionLabel}
          </span>
          {bet.legs.length > 1 ? <span className="text-[13px] tabular shrink-0" style={{ color: 'var(--fd-fg-2)' }}>{formatOdds(leg.odds)}</span> : null}
        </div>
        <div className="cond text-[11px]" style={{ color: 'var(--fd-fg-3)', letterSpacing: 0.6 }}>
          {leg.marketName}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5 text-[12px]" style={{ color: 'var(--fd-fg-2)' }}>
          <span className="truncate">{leg.eventName}</span>
          <span className="shrink-0 flex items-center gap-1.5">
            {live ? (
              <span className="cond text-[10px] font-bold px-1 rounded-[3px]" style={{ background: '#d22839', color: '#fff' }}>
                LIVE
              </span>
            ) : null}
            {score ? <span className="tabular">{score}</span> : <span className="cond" style={{ color: 'var(--fd-fg-3)' }}>{formatStartTime(leg.startTime)}</span>}
          </span>
        </div>
        {leg.resultText && leg.status !== 'open' ? (
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-fg-3)' }}>
            Result: {leg.resultText}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function useCashOut(bet: Bet): number | null {
  const events = useLiveStore((s) => s.events)
  return useMemo(() => {
    if (bet.status !== 'open') return null
    return cashOutValue(bet, (leg) => {
      const ev = events[leg.eventId] ?? null
      const league = LEAGUE_BY_ID[leg.leagueId]
      const pregame = ev && league ? getPregameLines(ev, league) : undefined
      return legWinProbability(leg, ev, league, pregame)
    })
  }, [bet, events])
}

function BetCard({ bet }: { bet: Bet }) {
  const fmt = useSettings((s) => s.oddsFormat)
  const cashOut = useAccount((s) => s.cashOut)
  const value = useCashOut(bet)
  const [confirm, setConfirm] = useState(false)
  const st = STATUS_STYLE[bet.status]
  const totalStake = bet.stake * (bet.rrCombos ?? 1)
  return (
    <div className="rounded-md overflow-hidden mb-3 border" style={{ background: 'var(--fd-surface)', borderColor: bet.status === 'won' ? '#128000' : 'var(--fd-line)' }}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2 border-b" style={{ borderColor: 'var(--fd-line-2)' }}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[16px] font-bold" style={{ color: 'var(--fd-fg)' }}>
            {bet.type === 'sgp' || bet.type === 'sgp_plus' ? <SgpBadge plus={bet.type === 'sgp_plus'} small /> : null}
            <span className="truncate">{bet.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="cond text-[10px] font-bold px-1.5 rounded-[3px]" style={{ background: st.bg, color: st.color, lineHeight: '16px', letterSpacing: 0.6 }}>
              {st.label}
            </span>
            {bet.boostPct ? (
              <span className="cond text-[10px] font-bold px-1.5 rounded-[3px]" style={{ background: '#ffdc2e', color: '#05285a', lineHeight: '16px' }}>
                {bet.boostPct}% BOOST
              </span>
            ) : null}
            {bet.noSweat ? (
              <span className="cond text-[10px] font-bold px-1.5 rounded-[3px]" style={{ background: 'var(--fd-surface-3)', color: 'var(--fd-fg)', lineHeight: '16px' }}>
                NO SWEAT
              </span>
            ) : null}
            {bet.live ? (
              <span className="cond text-[10px] font-bold px-1.5 rounded-[3px]" style={{ background: '#d22839', color: '#fff', lineHeight: '16px' }}>
                LIVE
              </span>
            ) : null}
          </div>
        </div>
        <span className="text-[16px] font-bold tabular shrink-0" style={{ color: 'var(--fd-fg)' }}>
          {formatOdds(bet.odds, fmt)}
        </span>
      </div>
      <div className="px-4 py-1">
        {bet.legs.map((l) => (
          <LegRow key={l.selectionId} leg={l} bet={bet} />
        ))}
      </div>
      <div className="px-4 py-3 border-t grid grid-cols-3 gap-2" style={{ borderColor: 'var(--fd-line-2)' }}>
        <div>
          <div className="cond text-[10px]" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
            WAGER
          </div>
          <div className="text-[14px] font-semibold tabular" style={{ color: 'var(--fd-fg)' }}>
            {formatMoney(totalStake)}
          </div>
        </div>
        <div>
          <div className="cond text-[10px]" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
            {bet.status === 'open' ? 'TO WIN' : 'PAID'}
          </div>
          <div className="text-[14px] font-semibold tabular" style={{ color: bet.status === 'won' ? '#41e878' : 'var(--fd-fg)' }}>
            {bet.status === 'open' ? formatMoney(bet.toWin) : formatMoney(bet.payout ?? 0)}
          </div>
        </div>
        <div className="text-right">
          {bet.status === 'open' && value !== null ? (
            confirm ? (
              <div className="flex gap-1 justify-end">
                <button onClick={() => setConfirm(false)} className="h-8 px-2 rounded border text-[12px]" style={{ borderColor: 'var(--fd-line)', color: 'var(--fd-fg-2)' }}>
                  Cancel
                </button>
                <button onClick={() => cashOut(bet.id, value)} className="h-8 px-2 rounded text-[12px] font-bold text-white" style={{ background: '#128000' }}>
                  Confirm {formatMoney(value)}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirm(true)} className="h-8 px-3 rounded border text-[12px] font-bold" style={{ borderColor: '#41e878', color: '#41e878' }}>
                Cash out {formatMoney(value)}
              </button>
            )
          ) : bet.status === 'open' ? (
            <span className="text-[11px]" style={{ color: 'var(--fd-fg-3)' }}>
              Cash out unavailable
            </span>
          ) : null}
        </div>
      </div>
      <div className="px-4 pb-3 text-[11px]" style={{ color: 'var(--fd-fg-3)' }}>
        Bet ID {bet.betId} · Placed {formatDateTime(bet.placedAt)}
        {bet.settledAt ? ` · Settled ${formatDateTime(bet.settledAt)}` : ''}
        {bet.rrCombos ? ` · ${bet.rrCombos} wagers × ${formatMoney(bet.stake)}` : ''}
      </div>
    </div>
  )
}

export function MyBetsPage() {
  const bets = useAccount((s) => s.bets)
  const [tab, setTab] = useState<'open' | 'settled'>('open')
  const [filter, setFilter] = useState<'all' | 'won' | 'lost'>('all')
  const open = bets.filter((b) => b.status === 'open')
  const settled = bets.filter((b) => b.status !== 'open').filter((b) => (filter === 'all' ? true : filter === 'won' ? b.status === 'won' || b.status === 'cashed_out' : b.status === 'lost'))
  const list = tab === 'open' ? open : settled
  return (
    <div>
      <h1 className="hidden lg:block text-[20px] font-bold mt-2 mb-2" style={{ color: 'var(--fd-fg)' }}>
        My Bets
      </h1>
      <TextTabs tabs={[{ id: 'open', label: `Open${open.length ? ` (${open.length})` : ''}` }, { id: 'settled', label: 'Settled' }]} active={tab} onSelect={(t) => setTab(t as 'open' | 'settled')} />
      {tab === 'settled' ? (
        <div className="flex gap-2 px-4 lg:px-0 py-3">
          {(['all', 'won', 'lost'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className="h-8 px-4 rounded-full text-[13px] font-semibold capitalize" style={{ background: filter === f ? '#2b90ff' : 'var(--fd-surface)', color: filter === f ? '#fff' : 'var(--fd-link)' }}>
              {f}
            </button>
          ))}
        </div>
      ) : (
        <div className="h-3" />
      )}
      <div className="px-4 lg:px-0">
        {list.length ? (
          list.map((b) => <BetCard key={b.id} bet={b} />)
        ) : (
          <Card>
            <EmptyState title={tab === 'open' ? 'No open bets' : 'No settled bets'} body={tab === 'open' ? 'Bets you place will show up here until they settle.' : 'Settled bets will appear here.'} />
            <div className="pb-6 text-center">
              <Link to="/" className="inline-flex items-center justify-center h-[40px] px-6 rounded text-[14px] font-semibold text-white" style={{ background: '#128000' }}>
                Browse sports
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
