import { useMemo } from 'react'
import { BoltIcon, InfoIcon } from '@/components/Icons'
import { Card } from '@/components/shell/SectionHeader'
import { formatMoney } from '@/lib/odds'
import { LEVEL_THRESHOLDS, useAccount } from '@/store/account'

function isoWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function Shield({ level, size = 64 }: { level: number; size?: number }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 64 64">
        <path d="M32 4 8 13v18c0 15 10 26 24 29 14-3 24-14 24-29V13L32 4Z" fill="url(#g)" stroke="#ffb15c" strokeWidth="2" />
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff8c31" />
            <stop offset="1" stopColor="#d22839" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-white font-black" style={{ fontSize: size * 0.42 }}>
        {level}
      </span>
      <span className="absolute -top-1 cond text-[8px] font-bold px-1 rounded-sm" style={{ background: '#d22839', color: '#fff' }}>
        LVL
      </span>
    </span>
  )
}

export function RewardsPage() {
  const rewards = useAccount((s) => s.rewards)
  const claim = useAccount((s) => s.claimWeekly)
  const addToken = useAccount((s) => s.addToken)
  const claimPromo = useAccount((s) => s.claimPromo)
  const allTokens = useAccount((s) => s.tokens)
  const tokens = useMemo(() => allTokens.filter((t) => !t.used && new Date(t.expiresAt).getTime() > Date.now()), [allTokens])
  const bonus = useAccount((s) => s.bonusBalance)
  const week = isoWeek()
  const claimedThisWeek = rewards.claimedWeekly.includes(week)
  const lvl = rewards.level
  const next = LEVEL_THRESHOLDS[lvl] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  const month = new Date().toLocaleDateString('en-US', { month: 'long' })
  const pct = Math.min(100, (rewards.monthPoints / next) * 100)
  const in14 = new Date(Date.now() + 14 * 86400_000).toISOString()
  const options = [
    { id: 'boost2x50', big: '2x 50%', small: 'Profit Boost', act: () => { addToken({ id: `tok_${Date.now()}_a`, kind: 'profit_boost', pct: 50, maxWager: 25, appliesTo: 'any', expiresAt: in14, title: '50% Profit Boost', description: 'Any bet · max wager $25' }); addToken({ id: `tok_${Date.now()}_b`, kind: 'profit_boost', pct: 50, maxWager: 25, appliesTo: 'any', expiresAt: in14, title: '50% Profit Boost', description: 'Any bet · max wager $25' }) } },
    { id: 'betreset', big: 'Bet Reset', small: 'Token', act: () => addToken({ id: `tok_${Date.now()}`, kind: 'no_sweat', maxWager: 50, appliesTo: 'any', expiresAt: in14, title: 'Bet Reset Token', description: 'Refund up to $50 in Bonus Bets if your bet loses' }) },
    { id: 'boost100', big: '100%', small: 'Profit Boost', act: () => addToken({ id: `tok_${Date.now()}`, kind: 'profit_boost', pct: 100, maxWager: 10, appliesTo: 'any', expiresAt: in14, title: '100% Profit Boost', description: 'Any bet · max wager $10' }) },
    { id: 'bonusback', big: '10% Bonus Back', small: 'Receive 10% back in Bonus Bets', act: () => claimPromo(`bonusback-${week}`, null, Math.max(5, Math.round(rewards.monthPoints / 100))) },
  ]
  return (
    <div className="px-4 lg:px-0">
      <Card className="mt-3">
        <div className="p-4 text-white" style={{ background: 'linear-gradient(135deg,#0d5fc4 0%,#06306e 100%)' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="cond font-black italic leading-none" style={{ fontSize: 28, color: '#cfe6ff' }}>
                REWARDS
              </div>
              <div className="cond font-black italic leading-none" style={{ fontSize: 22, color: '#ffdc2e' }}>
                CLUB
              </div>
              <div className="text-[14px] mt-3">{month}</div>
              <div className="text-[16px] font-bold">Level {lvl} Sportsbook Rewards</div>
              <button className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px]" style={{ background: 'rgba(255,255,255,0.15)' }}>
                How it works <InfoIcon size={14} />
              </button>
            </div>
            <Shield level={lvl} size={84} />
          </div>
        </div>
        <div className="p-4" style={{ background: '#05285a', color: '#fff' }}>
          <div className="flex items-center justify-between text-[14px]">
            <span>{month} progress</span>
            <span>
              <b>{rewards.monthPoints.toLocaleString()}</b> / {next.toLocaleString()} pts
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Shield level={lvl} size={28} />
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#d22839,#ff8c31)' }} />
            </div>
            <Shield level={Math.min(lvl + 1, 5)} size={28} />
          </div>
          <div className="text-[11px] mt-2" style={{ color: '#aac4de' }}>
            Earn 10 points for every $1 wagered.
          </div>
        </div>
      </Card>
      <Card>
        <div className="p-4">
          <div className="text-[16px] font-bold" style={{ color: 'var(--fd-fg)' }}>
            Weekly Level {lvl} Reward
          </div>
          <div className="rounded-md p-3 mt-3" style={{ background: 'linear-gradient(135deg,#d22839 0%,#ff8c31 100%)' }}>
            <div className="text-center text-white text-[14px] font-bold mb-3">{claimedThisWeek ? 'Reward claimed this week' : 'Choose 1 of 4 rewards'}</div>
            <div className="grid grid-cols-2 gap-2">
              {options.map((o) => (
                <button
                  key={o.id}
                  disabled={claimedThisWeek}
                  onClick={() => {
                    o.act()
                    claim(week)
                  }}
                  className="rounded-md p-3 text-center disabled:opacity-60"
                  style={{ background: '#fff' }}
                >
                  <BoltIcon size={18} color="#d5931b" className="mx-auto" />
                  <div className="text-[15px] font-bold mt-1" style={{ color: '#05285a' }}>
                    {o.big}
                  </div>
                  <div className="text-[12px]" style={{ color: '#1f375b' }}>
                    {o.small}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: 'var(--fd-line)' }}>
          <span className="relative">
            <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#ffdc2e' }}>
              <BoltIcon size={20} color="#05285a" />
            </span>
            {tokens.length ? (
              <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#d22839', color: '#fff' }}>
                {tokens.length}
              </span>
            ) : null}
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-bold" style={{ color: 'var(--fd-fg)' }}>
              Your Rewards
            </div>
            <div className="text-[12px]" style={{ color: 'var(--fd-fg-3)' }}>
              Available and ready to use
            </div>
          </div>
          <span className="h-9 px-3 rounded-full flex items-center gap-1 text-[14px] font-bold" style={{ background: '#fff6bd', color: '#05285a' }}>
            $ {formatMoney(bonus).slice(1)}
          </span>
        </div>
      </Card>
    </div>
  )
}
