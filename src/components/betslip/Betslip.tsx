import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlaceBet } from '@/hooks/usePlaceBet'
import { decimalToAmerican, formatMoney, formatOdds, round2 } from '@/lib/odds'
import { useAccount } from '@/store/account'
import { useBetslip } from '@/store/betslip'
import { useSettings } from '@/store/settings'
import { ChevronDown, ChevronRight, CloseIcon, InfoIcon, SgpBadge, TrashIcon, BoltIcon } from '../Icons'
import { LogoMark } from '../shell/Logo'
import { Receipt } from './Receipt'
import { RoundRobinView } from './RoundRobinView'
import { CashOutTag, SelectionCard, SgpGroupCard } from './SelectionCard'
import { TeaserView } from './TeaserView'
import { WagerInput } from './WagerInput'

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="relative w-[46px] h-[26px] rounded-full transition-colors shrink-0" style={{ background: on ? '#128000' : 'var(--fd-surface-3)' }}>
      <span className="absolute top-[3px] w-5 h-5 rounded-full bg-white transition-all" style={{ left: on ? 23 : 3 }} />
    </button>
  )
}

function Collapsible({ title, info, children, defaultOpen = false }: { title: string; info?: boolean; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between h-[52px] px-4">
        <span className="flex items-center gap-1.5 text-[16px] font-bold" style={{ color: 'var(--fd-fg)' }}>
          {title}
          {info ? <InfoIcon size={16} color="var(--fd-link)" /> : null}
        </span>
        <ChevronDown size={20} color="var(--fd-link)" className={open ? 'rotate-180' : ''} />
      </button>
      {open ? <div style={{ background: 'var(--fd-bg)' }}>{children}</div> : null}
    </div>
  )
}

function ParlayCard() {
  const { plan } = usePlaceBet()
  const a = plan.analysis
  const stake = useBetslip((s) => s.parlayStake)
  const setStake = useBetslip((s) => s.setParlayStake)
  const fmt = useSettings((s) => s.oddsFormat)
  if (!a.canParlay) return null
  const n = a.legCount
  const title = a.parlayType === 'sgp' ? `${n} leg Same Game Parlay` : a.parlayType === 'sgp_plus' ? `${n} leg Same Game Parlay+` : `${n} leg parlay`
  const boostPct = plan.boost?.pct
  const baseWin = round2(stake * (a.parlayDecimal - 1))
  const win = boostPct ? round2(baseWin * (1 + boostPct / 100)) : baseWin
  return (
    <div className="px-4 py-3 border-b border-t-2" style={{ borderColor: 'var(--fd-line)', borderTopColor: '#2b90ff', background: 'var(--fd-surface)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {a.parlayType !== 'parlay' ? <SgpBadge plus={a.parlayType === 'sgp_plus'} /> : null}
            <span className="text-[16px] font-bold" style={{ color: 'var(--fd-fg)' }}>
              {title}
            </span>
          </div>
          <div className="mt-1">
            <CashOutTag />
          </div>
          {a.parlayType === 'sgp_plus' ? (
            <div className="text-[12px] mt-1.5" style={{ color: 'var(--fd-fg-2)' }}>
              Includes: {a.sgpGroups} Same Game Parlay™{a.sgpGroups > 1 ? 's' : ''}
              {a.units.length - a.sgpGroups > 0 ? ` + ${a.units.length - a.sgpGroups} selection${a.units.length - a.sgpGroups > 1 ? 's' : ''}` : ''}
            </div>
          ) : null}
        </div>
        <div className="text-[16px] font-bold tabular shrink-0" style={{ color: 'var(--fd-fg)' }}>
          {formatOdds(a.parlayOdds, fmt)}
        </div>
      </div>
      {boostPct ? (
        <div className="flex items-center gap-1 mt-2 text-[12px] font-semibold" style={{ color: '#ffdc2e' }}>
          <BoltIcon size={14} color="#ffdc2e" /> {boostPct}% Profit Boost applied
        </div>
      ) : null}
      <div className="mt-3">
        <WagerInput stake={stake} onChange={setStake} toWin={win} />
      </div>
    </div>
  )
}

function SgpUnitStake({ eventId, decimal }: { eventId: string; decimal: number }) {
  const stake = useBetslip((s) => s.sgpStakes[eventId] ?? 0)
  const setStake = useBetslip((s) => s.setSgpStake)
  return (
    <div className="mt-3">
      <WagerInput stake={stake} onChange={(n) => setStake(eventId, n)} toWin={round2(stake * (decimal - 1))} />
    </div>
  )
}

export function EmptyBetslip() {
  return (
    <div className="flex flex-col items-center pt-20 pb-10 px-6 text-center">
      <div className="relative w-[184px] h-[184px] rounded-full flex items-center justify-center" style={{ background: 'var(--fd-surface-2)' }}>
        <div className="w-[120px] h-[150px] rounded-md rotate-[8deg] flex flex-col items-center pt-3 gap-2" style={{ background: 'var(--fd-surface-3)' }}>
          <LogoMark size={22} />
          <div className="w-[88px] h-2 rounded" style={{ background: 'var(--fd-surface-2)' }} />
          <div className="w-[88px] h-2 rounded" style={{ background: 'var(--fd-surface-2)' }} />
          <div className="w-[70px] h-2 rounded" style={{ background: 'var(--fd-surface-2)' }} />
        </div>
        <span className="absolute -left-4 top-[70px] px-2 py-1 rounded-full text-[12px] font-bold" style={{ background: 'var(--fd-surface-3)', color: 'var(--fd-fg-2)' }}>
          +125
        </span>
      </div>
      <div className="text-[18px] mt-6" style={{ color: 'var(--fd-fg-2)' }}>
        Betslip empty
      </div>
      <div className="text-[14px] mt-1" style={{ color: 'var(--fd-fg-3)' }}>
        Add selections to place bet
      </div>
    </div>
  )
}

function TokenRow({ label, tokens, value, onChange }: { label: string; tokens: { id: string; title: string }[]; value: string | null; onChange: (id: string | null) => void }) {
  if (!tokens.length) return null
  return (
    <div className="flex items-center justify-between gap-2 h-[46px] px-4 border-t" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
      <span className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: '#ffdc2e' }}>
        <BoltIcon size={14} color="#ffdc2e" /> {label}
      </span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className="text-[13px] rounded px-2 h-8 max-w-[190px]" style={{ background: 'var(--fd-input-bg)', color: 'var(--fd-fg)', border: '1px solid var(--fd-line)' }}>
        <option value="">Don't use</option>
        {tokens.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Betslip({ onClose, sheet }: { onClose?: () => void; sheet?: boolean }) {
  const slip = useBetslip()
  const { plan, place } = usePlaceBet()
  const accept = useSettings((s) => s.acceptOddsMovements)
  const setAccept = useSettings((s) => s.setAcceptOddsMovements)
  const bonusBalance = useAccount((s) => s.bonusBalance)
  const balance = useAccount((s) => s.balance)
  const [placing, setPlacing] = useState(false)
  const a = plan.analysis
  const count = slip.selections.length

  if (slip.lastReceipt) return <Receipt onClose={onClose} sheet={sheet} />

  const header = (
    <div className="flex items-center h-[55px] px-4 border-b shrink-0" style={{ background: 'var(--fd-surface)', borderColor: 'var(--fd-line)' }}>
      {slip.mode !== 'betslip' ? (
        <>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold mr-2" style={{ background: '#2b90ff', color: '#fff' }}>
            {count}
          </span>
          <span className="flex items-center gap-1.5 text-[16px] font-bold" style={{ color: 'var(--fd-fg-2)' }}>
            {slip.mode === 'roundrobin' ? 'Round Robins' : 'Teasers'} <InfoIcon size={16} color="var(--fd-link)" />
          </span>
          <button onClick={() => slip.setMode('betslip')} className="ml-auto text-[14px]" style={{ color: 'var(--fd-link)' }}>
            Back to betslip
          </button>
        </>
      ) : (
        <>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold mr-2" style={{ background: count ? '#2b90ff' : 'var(--fd-surface-3)', color: '#fff' }}>
            {count}
          </span>
          <span className="text-[16px] font-bold" style={{ color: 'var(--fd-fg-2)' }}>
            Betslip
          </span>
          {onClose ? (
            <button onClick={onClose} aria-label="Close betslip" className="ml-auto w-9 h-9 flex items-center justify-center" style={{ color: 'var(--fd-fg)' }}>
              <CloseIcon size={22} />
            </button>
          ) : null}
        </>
      )}
    </div>
  )

  const body = (() => {
    if (!count) return <EmptyBetslip />
    if (slip.mode === 'roundrobin') return <RoundRobinView />
    if (slip.mode === 'teaser') return <TeaserView />
    if (count === 1) return <SelectionCard s={slip.selections[0]} withInput />
    const byEvent = new Map<string, typeof slip.selections>()
    for (const s of slip.selections) (byEvent.get(s.event.id) ?? byEvent.set(s.event.id, []).get(s.event.id)!).push(s)
    return (
      <div>
        {[...byEvent.entries()].map(([eventId, legs]) => {
          const unit = a.units.find((u) => u.eventId === eventId)
          const conflicted = legs.some((l) => a.conflicts.has(l.selection.id) || a.sgpIneligible.has(l.selection.id))
          if (legs.length > 1 && unit?.isSgp && !conflicted) return <SgpGroupCard key={eventId} legs={legs} odds={decimalToAmerican(unit.decimal)} />
          return (
            <div key={eventId}>
              {legs.map((l) => (
                <SelectionCard key={l.selection.id} s={l} />
              ))}
              {conflicted ? (
                <div className="px-4 py-2 text-[12px]" style={{ color: '#d22839', background: 'var(--fd-surface)' }}>
                  {a.conflicts.size ? 'These selections are from the same market and cannot be combined.' : "One of these selections can't be combined in a Same Game Parlay. Place them as straight bets."}
                </div>
              ) : null}
            </div>
          )
        })}
        <ParlayCard />
        {a.sgpGroups > 0 && a.units.length > 1 ? (
          <Collapsible title="Same Game Parlays" info>
            {a.units
              .filter((u) => u.isSgp)
              .map((u) => (
                <div key={u.key} className="px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line)' }}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[14px] font-bold" style={{ color: 'var(--fd-fg)' }}>
                      <SgpBadge small /> {u.legs.length} leg Same Game Parlay
                    </span>
                    <span className="text-[14px] font-bold tabular">{formatOdds(decimalToAmerican(u.decimal))}</span>
                  </div>
                  <div className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--fd-fg-3)' }}>
                    {u.legs[0].event.name}
                  </div>
                  <SgpUnitStake eventId={u.eventId} decimal={u.decimal} />
                </div>
              ))}
          </Collapsible>
        ) : null}
        <Collapsible title="Straight bets" info defaultOpen={!a.canParlay}>
          {slip.selections.map((s) => (
            <SelectionCard key={s.selection.id} s={s} withInput compact />
          ))}
        </Collapsible>
        {a.rrSizes.length ? (
          <button onClick={() => slip.setMode('roundrobin')} className="w-full flex items-center justify-between h-[52px] px-4 border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
            <span className="text-[16px]" style={{ color: 'var(--fd-link)' }}>
              Round Robins
            </span>
            <ChevronRight size={20} color="var(--fd-link)" />
          </button>
        ) : null}
        {a.teaserEligible ? (
          <button onClick={() => slip.setMode('teaser')} className="w-full flex items-center justify-between h-[52px] px-4 border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)' }}>
            <span className="text-[16px]" style={{ color: 'var(--fd-link)' }}>
              Teasers
            </span>
            <ChevronRight size={20} color="var(--fd-link)" />
          </button>
        ) : null}
        <button onClick={() => slip.clear()} className="w-full flex items-center justify-center gap-2 h-[51px] border-b" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface)', color: '#d22839' }}>
          <TrashIcon size={18} color="#d22839" />
          <span className="text-[14px]">Remove all selections</span>
        </button>
      </div>
    )
  })()

  const footer = count ? (
    <div className="shrink-0" style={{ background: 'var(--fd-surface)' }}>
      <TokenRow label="Profit Boost" tokens={plan.eligibleBoosts} value={slip.boostTokenId} onChange={slip.setBoostToken} />
      <TokenRow label="No Sweat Bet" tokens={plan.eligibleNoSweat} value={slip.noSweatTokenId} onChange={slip.setNoSweatToken} />
      {bonusBalance > 0 ? (
        <div className="flex items-center justify-between h-[42px] px-4 border-t" style={{ borderColor: 'var(--fd-line)' }}>
          <span className="text-[14px]" style={{ color: 'var(--fd-fg-2)' }}>
            Use Bonus Bets ({formatMoney(bonusBalance)})
          </span>
          <Toggle on={slip.useBonusBet} onChange={slip.setUseBonusBet} label="Use bonus bets" />
        </div>
      ) : null}
      <div className="flex items-center justify-between h-[42px] px-4 border-t" style={{ borderColor: 'var(--fd-line)' }}>
        <span className="flex items-center gap-1.5 text-[14px]" style={{ color: 'var(--fd-fg-2)' }}>
          Accept odds movements <InfoIcon size={16} color="var(--fd-link)" />
        </span>
        <Toggle on={accept} onChange={setAccept} label="Accept odds movements" />
      </div>
      {plan.bets.length ? (
        <div className="px-4 pt-2 text-[13px] space-y-0.5" style={{ color: 'var(--fd-fg-2)' }}>
          <div className="flex justify-between">
            <span>Total wager</span>
            <span className="tabular font-semibold" style={{ color: 'var(--fd-fg)' }}>
              {formatMoney(plan.totalWager)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Total payout</span>
            <span className="tabular font-semibold" style={{ color: 'var(--fd-fg)' }}>
              {formatMoney(plan.totalPayout)}
            </span>
          </div>
        </div>
      ) : null}
      <div className="p-2">
        {plan.reason === 'Insufficient funds' ? (
          <Link to="/account/deposit" className="flex items-center justify-center h-[50px] rounded text-[16px] font-semibold text-white" style={{ background: '#128000' }}>
            Insufficient funds · Deposit
          </Link>
        ) : (
          <button
            disabled={!plan.canPlace || placing}
            onClick={() => {
              setPlacing(true)
              window.setTimeout(() => {
                place()
                setPlacing(false)
              }, 450)
            }}
            className="w-full h-[50px] rounded text-[16px] font-semibold text-white disabled:opacity-60"
            style={{ background: '#128000' }}
          >
            {placing ? 'Placing bet…' : plan.canPlace ? `Place bet${plan.bets.length > 1 ? 's' : ''} · ${formatMoney(plan.totalWager)}` : plan.reason}
          </button>
        )}
        <div className="text-center text-[11px] mt-1.5" style={{ color: 'var(--fd-fg-3)' }}>
          Balance {formatMoney(balance)} · Practice money only
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--fd-bg)' }}>
      {header}
      <div className="flex-1 min-h-0 overflow-y-auto">{body}</div>
      {footer}
    </div>
  )
}
