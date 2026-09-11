import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from '@/components/Icons'
import { Card } from '@/components/shell/SectionHeader'
import { formatMoney } from '@/lib/odds'
import { useAccount, LEVEL_THRESHOLDS } from '@/store/account'
import { useSettings } from '@/store/settings'

const MENU = [
  { label: 'My Bets', to: '/my-bets' },
  { label: 'Transactions', to: '/account/transactions' },
  { label: 'Promotions', to: '/promotions' },
  { label: 'Rewards Hub', to: '/rewards' },
  { label: 'Settings', to: '/account/settings' },
  { label: 'Responsible Gaming', to: '/responsible-gaming' },
  { label: 'House Rules', to: '/house-rules' },
  { label: 'Help & Support', to: '/support' },
]

export function AccountPage() {
  const name = useSettings((s) => s.displayName)
  const balance = useAccount((s) => s.balance)
  const bonus = useAccount((s) => s.bonusBalance)
  const rewards = useAccount((s) => s.rewards)
  const tokens = useAccount((s) => s.tokens.filter((t) => !t.used && new Date(t.expiresAt).getTime() > Date.now()))
  const bets = useAccount((s) => s.bets)
  const reset = useAccount((s) => s.resetAccount)
  const [confirm, setConfirm] = useState(false)
  const settledCount = bets.filter((b) => b.status !== 'open').length
  const won = bets.filter((b) => b.status === 'won' || b.status === 'cashed_out').length
  const net = bets.filter((b) => b.status !== 'open').reduce((a, b) => a + (b.payout ?? 0) - b.stake * (b.rrCombos ?? 1), 0)
  const next = LEVEL_THRESHOLDS[rewards.level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  return (
    <div className="px-4 lg:px-0">
      <h1 className="text-[20px] font-bold mt-3 mb-3" style={{ color: 'var(--fd-fg)' }}>
        Hi, {name}
      </h1>
      <Card>
        <div className="p-4">
          <div className="text-[13px]" style={{ color: 'var(--fd-fg-2)' }}>
            Available balance
          </div>
          <div className="text-[32px] font-bold tabular mt-0.5" style={{ color: 'var(--fd-fg)' }}>
            {formatMoney(balance)}
          </div>
          <div className="text-[13px] mt-1" style={{ color: 'var(--fd-fg-3)' }}>
            Bonus Bets {formatMoney(bonus)} · Practice money only
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Link to="/account/deposit" className="h-[44px] rounded flex items-center justify-center text-[15px] font-semibold text-white" style={{ background: '#128000' }}>
              Deposit
            </Link>
            <Link to="/account/withdraw" className="h-[44px] rounded border flex items-center justify-center text-[15px] font-semibold" style={{ borderColor: '#ced4db', color: 'var(--fd-fg)' }}>
              Withdraw
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-3 border-t text-center" style={{ borderColor: 'var(--fd-line)' }}>
          {[
            ['Settled bets', String(settledCount)],
            ['Win rate', settledCount ? `${Math.round((won / settledCount) * 100)}%` : '—'],
            ['Net profit', formatMoney(Math.round(net * 100) / 100, { sign: true })],
          ].map(([l, v]) => (
            <div key={l} className="py-3">
              <div className="text-[11px]" style={{ color: 'var(--fd-fg-3)' }}>
                {l}
              </div>
              <div className="text-[15px] font-bold tabular" style={{ color: l === 'Net profit' ? (net >= 0 ? '#41e878' : '#d22839') : 'var(--fd-fg)' }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Link to="/rewards" className="block mb-3">
        <Card className="mb-0">
          <div className="flex items-center gap-3 p-4">
            <span className="w-11 h-11 rounded-full flex items-center justify-center font-black text-[16px]" style={{ background: 'linear-gradient(160deg,#ff8c31,#d22839)', color: '#fff' }}>
              {rewards.level}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold" style={{ color: 'var(--fd-fg)' }}>
                Rewards Club · Level {rewards.level}
              </div>
              <div className="text-[12px]" style={{ color: 'var(--fd-fg-3)' }}>
                {rewards.monthPoints.toLocaleString()} / {next.toLocaleString()} pts this month · {tokens.length} reward{tokens.length === 1 ? '' : 's'} available
              </div>
              <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--fd-surface-3)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (rewards.monthPoints / next) * 100)}%`, background: 'linear-gradient(90deg,#d22839,#ff8c31)' }} />
              </div>
            </div>
            <ChevronRight size={20} color="var(--fd-link)" />
          </div>
        </Card>
      </Link>
      <Card>
        {MENU.map((m) => (
          <Link key={m.to} to={m.to} className="flex items-center justify-between h-[52px] px-4 border-b text-[15px]" style={{ borderColor: 'var(--fd-line-2)', color: 'var(--fd-fg)' }}>
            {m.label}
            <ChevronRight size={18} color="var(--fd-link)" />
          </Link>
        ))}
      </Card>
      <Card>
        <div className="p-4">
          {confirm ? (
            <div>
              <div className="text-[14px] mb-3" style={{ color: 'var(--fd-fg-2)' }}>
                This clears every bet, transaction and token and restores the $1,000 starting balance. Continue?
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirm(false)} className="flex-1 h-[40px] rounded border text-[14px]" style={{ borderColor: 'var(--fd-line)', color: 'var(--fd-fg)' }}>
                  Cancel
                </button>
                <button onClick={() => { reset(); setConfirm(false) }} className="flex-1 h-[40px] rounded text-[14px] font-semibold text-white" style={{ background: '#d22839' }}>
                  Reset account
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} className="text-[14px] font-semibold" style={{ color: '#d22839' }}>
              Reset practice account
            </button>
          )}
        </div>
      </Card>
      <div className="text-[11px] text-center py-4" style={{ color: 'var(--fd-fg-3)' }}>
        FakeDuel is a practice sportsbook. No real money is ever wagered or paid out.
      </div>
    </div>
  )
}
