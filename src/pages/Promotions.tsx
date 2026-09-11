import { BoltIcon } from '@/components/Icons'
import { Card, SectionHeader } from '@/components/shell/SectionHeader'
import { formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/odds'
import type { PromoToken } from '@/lib/types'
import { useAccount } from '@/store/account'

interface Promo {
  id: string
  eyebrow: string
  title: string
  body: string
  gradient: string
  cta: string
  token?: Omit<PromoToken, 'id'>
  bonus?: number
}

function days(n: number) {
  return new Date(Date.now() + n * 86400_000).toISOString()
}

const PROMOS: Promo[] = [
  { id: 'weekly-boost', eyebrow: 'WEEKLY', title: '25% Profit Boost', body: 'Boost the profit on any wager up to $25. Applies to singles, parlays and Same Game Parlays.', gradient: 'linear-gradient(120deg,#0a2262,#1493ff)', cta: 'Claim', token: { kind: 'profit_boost', pct: 25, maxWager: 25, appliesTo: 'any', expiresAt: days(7), title: '25% Profit Boost', description: 'Any bet · max wager $25' } },
  { id: 'sgp-nosweat', eyebrow: 'SAME GAME PARLAY', title: 'No Sweat SGP up to $25', body: 'Place a 3+ leg Same Game Parlay. If it loses, get your stake back in Bonus Bets.', gradient: 'linear-gradient(120deg,#05285a,#005fc8)', cta: 'Claim', token: { kind: 'no_sweat', maxWager: 25, minLegs: 3, appliesTo: 'sgp', expiresAt: days(10), title: 'No Sweat SGP up to $25', description: '3+ leg SGP · refund in Bonus Bets' } },
  { id: 'live-boost', eyebrow: 'LIVE BETTING', title: '50% Live Profit Boost', body: 'Bet in-play and boost your winnings by 50% on wagers up to $10.', gradient: 'linear-gradient(120deg,#3a0a12,#d22839)', cta: 'Claim', token: { kind: 'profit_boost', pct: 50, maxWager: 10, appliesTo: 'live', expiresAt: days(5), title: '50% Live Profit Boost', description: 'Live bets · max wager $10' } },
  { id: 'parlay-boost', eyebrow: 'PARLAYS', title: '30% Parlay Boost', body: 'Combine 4+ legs across any games and boost your profit by 30%. Max wager $20.', gradient: 'linear-gradient(120deg,#0d0d0d,#0a2262)', cta: 'Claim', token: { kind: 'profit_boost', pct: 30, maxWager: 20, minLegs: 4, appliesTo: 'parlay', expiresAt: days(14), title: '30% Parlay Boost', description: '4+ leg parlay · max wager $20' } },
  { id: 'bonus-25', eyebrow: 'WELCOME', title: '$25 in Bonus Bets', body: 'Claim $25 in Bonus Bets to try parlays risk-free. Bonus Bet stakes are not returned with winnings.', gradient: 'linear-gradient(120deg,#1a0b3d,#005fc8)', cta: 'Claim $25', bonus: 25 },
]

export function PromotionsPage() {
  const tokens = useAccount((s) => s.tokens)
  const claimed = useAccount((s) => s.claimed)
  const claimPromo = useAccount((s) => s.claimPromo)
  const bonus = useAccount((s) => s.bonusBalance)
  const active = tokens.filter((t) => !t.used && new Date(t.expiresAt).getTime() > Date.now())
  const used = tokens.filter((t) => t.used || new Date(t.expiresAt).getTime() <= Date.now())
  return (
    <div className="px-4 lg:px-0">
      <h1 className="hidden lg:block text-[20px] font-bold mt-2 mb-3" style={{ color: 'var(--fd-fg)' }}>
        Promotions
      </h1>
      <Card className="mt-3">
        <SectionHeader title={`Your rewards (${active.length})`} right={bonus > 0 ? <span className="text-[13px] font-semibold" style={{ color: '#ffdc2e' }}>Bonus Bets {formatMoney(bonus)}</span> : undefined} />
        {active.length ? (
          active.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line-2)' }}>
              <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#ffdc2e' }}>
                <BoltIcon size={20} color="#05285a" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold" style={{ color: 'var(--fd-fg)' }}>
                  {t.title}
                </div>
                <div className="text-[12px]" style={{ color: 'var(--fd-fg-3)' }}>
                  {t.description} · Expires {formatDateTime(t.expiresAt)}
                </div>
              </div>
              <span className="cond text-[10px] font-bold px-1.5 rounded-[3px]" style={{ background: '#128000', color: '#fff', lineHeight: '16px' }}>
                READY
              </span>
            </div>
          ))
        ) : (
          <div className="px-4 py-4 text-[14px]" style={{ color: 'var(--fd-fg-3)' }}>
            No rewards available. Claim one below or earn more in the Rewards Hub.
          </div>
        )}
      </Card>
      <div className="cond text-[12px] font-bold px-1 pb-2" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
        AVAILABLE PROMOTIONS
      </div>
      {PROMOS.map((p) => {
        const isClaimed = claimed.includes(p.id)
        return (
          <Card key={p.id}>
            <div className="relative h-[120px] px-4 py-3 text-white" style={{ backgroundImage: p.gradient }}>
              <div className="cond text-[11px] font-bold" style={{ color: '#ffdc2e' }}>
                {p.eyebrow}
              </div>
              <div className="cond font-extrabold leading-none mt-1" style={{ fontSize: 28 }}>
                {p.title}
              </div>
              <BoltIcon size={64} color="rgba(255,220,46,0.9)" className="absolute right-3 top-5" />
            </div>
            <div className="p-4">
              <div className="text-[14px]" style={{ color: 'var(--fd-fg-2)' }}>
                {p.body}
              </div>
              <button disabled={isClaimed} onClick={() => claimPromo(p.id, p.token ?? null, p.bonus)} className="w-full h-[42px] rounded mt-3 text-[15px] font-semibold text-white disabled:opacity-60" style={{ background: isClaimed ? 'var(--fd-surface-3)' : '#128000' }}>
                {isClaimed ? 'Claimed' : p.cta}
              </button>
            </div>
          </Card>
        )
      })}
      {used.length ? (
        <Card>
          <SectionHeader title="Used & expired" size="sm" />
          {used.map((t) => (
            <div key={t.id} className="px-4 py-2.5 border-b text-[13px]" style={{ borderColor: 'var(--fd-line-2)', color: 'var(--fd-fg-3)' }}>
              {t.title} · {t.used ? `Used ${t.usedAt ? formatDateTime(t.usedAt) : ''}` : 'Expired'}
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  )
}
