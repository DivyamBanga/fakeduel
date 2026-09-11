import { Link, useNavigate } from 'react-router-dom'
import type { LeagueDef } from '@/data/sports'
import { formatStartTime } from '@/lib/format'
import { getDisplayLines } from '@/lib/lines'
import { buildGameMarkets } from '@/lib/markets'
import { formatLine } from '@/lib/odds'
import type { GameEvent, Market, Selection } from '@/lib/types'
import { useSlip, eventPath } from '@/hooks/useSlip'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { OddsButton } from './OddsButton'
import { TeamLogo } from './TeamLogo'
import { ChevronRight, SgpBadge } from '../Icons'

function cell(m: Market | undefined, side: string): Selection | undefined {
  return m?.selections.find((s) => s.grading.side === side || s.id.endsWith(`|${side}`))
}

export function LiveStatus({ ev, league }: { ev: GameEvent; league: LeagueDef }) {
  const st = ev.status
  let text = st.shortDetail || st.detail
  if (league.periods === 'quarters' || league.periods === 'halves' || league.periods === 'periods') {
    const p = st.period
    const ord = p === 1 ? '1st' : p === 2 ? '2nd' : p === 3 ? '3rd' : `${p}th`
    const unit = league.periods === 'quarters' ? (p > 4 ? 'OT' : ord) : league.periods === 'halves' ? (p > 2 ? 'OT' : ord) : p > 3 ? 'OT' : ord
    text = st.clock && st.state === 'in' ? `${unit} ${st.clock}` : text
  }
  return (
    <span className="cond inline-flex items-center gap-1 rounded-[3px] px-1.5 font-bold" style={{ background: '#d22839', color: '#fff', fontSize: 11, height: 18 }}>
      <span className="live-dot w-1.5 h-1.5 rounded-full bg-white" />
      {text}
    </span>
  )
}

export function EventRow({ ev, league, showLeague }: { ev: GameEvent; league: LeagueDef; showLeague?: boolean }) {
  const desktop = useIsDesktop()
  const { has, toggle } = useSlip()
  const nav = useNavigate()
  const { lines, live } = getDisplayLines(ev, league)
  const mk = buildGameMarkets(ev, league, lines)
  const ml = mk.moneyline ?? mk.threeWay
  const path = eventPath(ev)
  const isLive = ev.status.state === 'in'
  const isFinal = ev.status.state === 'post'
  const athlete = !!league.athleteEvent
  const cols: ('spread' | 'ml' | 'total')[] = athlete ? ['ml'] : ['spread', 'ml', 'total']

  const btn = (m: Market | undefined, side: string, lineText?: (s: Selection) => string) => {
    const s = cell(m, side)
    if (!s || !m) return <div className="rounded border border-dashed flex items-center justify-center text-[11px]" style={{ borderColor: 'var(--fd-line)', height: 44, color: 'var(--fd-fg-3)' }}>—</div>
    return <OddsButton line={lineText ? lineText(s) : undefined} odds={s.odds} selected={has(s.id)} suspended={isFinal} onClick={() => toggle(ev, m, s)} className="w-full" />
  }

  const teamName = (c: GameEvent['home']) => (desktop || athlete ? c.team.displayName : `${c.team.abbreviation} ${c.team.shortDisplayName}`)

  const TeamLine = ({ c }: { c: GameEvent['home'] }) => (
    <div className="flex items-center h-12 pr-2 min-w-0">
      <TeamLogo team={c.team} size={athlete ? 28 : 24} round={athlete} className="mr-2" />
      <Link to={path} className="text-[14px] truncate" style={{ color: 'var(--fd-link)' }}>
        {teamName(c)}
      </Link>
      {ev.probables?.find((p) => p.teamId === c.team.id) ? (
        <span className="ml-1 text-[11px] truncate" style={{ color: 'var(--fd-fg-3)' }}>
          {ev.probables.find((p) => p.teamId === c.team.id)?.name.replace(/^(\w)\w* /, '$1 ')}
        </span>
      ) : null}
      {isLive || isFinal ? (
        <span className="ml-auto pl-2 text-[15px] font-bold tabular" style={{ color: c.winner === false && isFinal ? 'var(--fd-fg-3)' : 'var(--fd-fg)' }}>
          {c.score}
        </span>
      ) : null}
    </div>
  )

  const colWidth = desktop ? 147 : undefined
  return (
    <div className="border-b" style={{ borderColor: 'var(--fd-line-2)', background: 'var(--fd-surface)' }}>
      <div className="flex items-stretch px-4 pt-2">
        <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ maxWidth: desktop ? 300 : undefined }}>
          <TeamLine c={ev.away} />
          <div className="flex items-center h-0">
            <span className="text-[12px] -mt-1 mr-2" style={{ color: 'var(--fd-fg-3)' }}>
              {ev.neutralSite ? 'vs' : '@'}
            </span>
            <span className="flex-1 h-px" style={{ background: 'var(--fd-line)' }} />
          </div>
          <TeamLine c={ev.home} />
          {league.hasDraw && ml ? (
            <div className="flex items-center h-12">
              <span className="w-6 mr-2" />
              <span className="text-[14px]" style={{ color: 'var(--fd-fg-2)' }}>
                Draw
              </span>
            </div>
          ) : null}
        </div>
        <div className="grid gap-x-1 gap-y-2 ml-2 shrink-0" style={{ gridTemplateColumns: `repeat(${cols.length}, ${colWidth ? `${colWidth}px` : 'minmax(64px, 1fr)'})`, width: desktop ? undefined : `${cols.length * 33}%`, alignContent: 'start', paddingTop: 2 }}>
          {cols.map((c) => (c === 'spread' ? btn(mk.spread, 'away', (s) => formatLine(s.line ?? 0)) : c === 'ml' ? btn(ml, 'away') : btn(mk.total, 'over', (s) => `O ${s.line}`)))}
          {cols.map((c) => (c === 'spread' ? btn(mk.spread, 'home', (s) => formatLine(s.line ?? 0)) : c === 'ml' ? btn(ml, 'home') : btn(mk.total, 'under', (s) => `U ${s.line}`)))}
          {league.hasDraw && ml ? (
            <>
              {cols.length === 3 ? <span /> : null}
              {btn(ml, 'draw')}
              {cols.length === 3 ? <span /> : null}
            </>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between h-8 px-4">
        <div className="flex items-center gap-2 min-w-0">
          {!athlete && !isFinal ? <SgpBadge /> : null}
          {isLive ? <LiveStatus ev={ev} league={league} /> : isFinal ? (
            <span className="cond text-[12px] font-bold" style={{ color: 'var(--fd-fg-3)' }}>
              FINAL
            </span>
          ) : (
            <span className="cond text-[12px] font-semibold truncate" style={{ color: 'var(--fd-fg-2)', letterSpacing: 0.8 }}>
              {formatStartTime(ev.date)}
            </span>
          )}
          {showLeague ? (
            <span className="text-[11px] ml-1" style={{ color: 'var(--fd-fg-3)' }}>
              {league.name}
            </span>
          ) : null}
          {live && !desktop ? null : null}
        </div>
        <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--fd-link)' }}>
          {desktop ? <span className="hidden lg:inline">{ev.broadcast ? ev.broadcast : ''}</span> : null}
          <button onClick={() => nav(path)} className="flex items-center gap-1">
            More wagers
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
