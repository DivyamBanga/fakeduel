import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Bet, PromoToken, Transaction } from '@/lib/types'
import { round2 } from '@/lib/odds'

export const STARTING_BALANCE = 1000

export interface RewardsState {
  points: number
  level: number
  monthKey: string
  monthPoints: number
  claimedWeekly: string[]
}

interface AccountState {
  balance: number
  bonusBalance: number
  bets: Bet[]
  transactions: Transaction[]
  tokens: PromoToken[]
  rewards: RewardsState
  createdAt: string
  lastSeenAt: string
  notifications: { id: string; at: string; title: string; body: string; betId?: string; read: boolean }[]
  claimed: string[]
  claimPromo: (promoId: string, token: Omit<PromoToken, 'id'> | null, bonus?: number) => void
  deposit: (amount: number, method: string) => void
  withdraw: (amount: number, method: string) => boolean
  placeBets: (bets: Bet[], opts?: { bonusBet?: boolean }) => boolean
  settleBet: (betId: string, patch: Partial<Bet>) => void
  updateBet: (betId: string, patch: Partial<Bet> | ((b: Bet) => Partial<Bet>)) => void
  cashOut: (betId: string, amount: number) => void
  addToken: (t: PromoToken) => void
  useToken: (id: string, betId: string) => void
  addTransaction: (t: Omit<Transaction, 'id' | 'balanceAfter' | 'at'> & { at?: string }) => void
  addPoints: (pts: number) => void
  claimWeekly: (key: string) => void
  pushNotification: (n: { title: string; body: string; betId?: string }) => void
  markNotificationsRead: () => void
  resetAccount: () => void
  importState: (state: Partial<AccountState>) => void
  touch: () => void
}

function uid(prefix = 'tx'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function levelForPoints(pts: number): number {
  if (pts >= 28000) return 4
  if (pts >= 13500) return 3
  if (pts >= 5000) return 2
  return 1
}

export const LEVEL_THRESHOLDS = [0, 5000, 13500, 28000, 60000]

function seedTokens(): PromoToken[] {
  const in14 = new Date(Date.now() + 14 * 86400_000).toISOString()
  const in7 = new Date(Date.now() + 7 * 86400_000).toISOString()
  return [
    { id: uid('tok'), kind: 'profit_boost', pct: 30, maxWager: 50, appliesTo: 'any', expiresAt: in7, title: '30% Profit Boost', description: 'Boost the profit on any bet up to $50 wager.' },
    { id: uid('tok'), kind: 'profit_boost', pct: 50, maxWager: 25, minLegs: 3, appliesTo: 'parlay', expiresAt: in14, title: '50% Parlay Profit Boost', description: 'Boost a 3+ leg parlay or Same Game Parlay. Max wager $25.' },
    { id: uid('tok'), kind: 'no_sweat', maxWager: 50, appliesTo: 'any', expiresAt: in14, title: 'No Sweat Bet up to $50', description: "If your bet loses, you'll get a refund in Bonus Bets up to $50." },
  ]
}

const initial = () => ({
  balance: STARTING_BALANCE,
  bonusBalance: 0,
  bets: [] as Bet[],
  transactions: [
    { id: uid(), at: new Date().toISOString(), type: 'deposit' as const, amount: STARTING_BALANCE, balanceAfter: STARTING_BALANCE, description: 'Welcome practice funds' },
  ] as Transaction[],
  tokens: seedTokens(),
  rewards: { points: 0, level: 1, monthKey: monthKey(), monthPoints: 0, claimedWeekly: [] as string[] },
  createdAt: new Date().toISOString(),
  lastSeenAt: new Date().toISOString(),
  notifications: [] as AccountState['notifications'],
  claimed: [] as string[],
})

export const useAccount = create<AccountState>()(
  persist(
    (set, get) => ({
      ...initial(),
      claimPromo: (promoId, token, bonus) => {
        if (get().claimed.includes(promoId)) return
        set((st) => ({
          claimed: [...st.claimed, promoId],
          tokens: token ? [{ id: uid('tok'), ...token }, ...st.tokens] : st.tokens,
          bonusBalance: bonus ? round2(st.bonusBalance + bonus) : st.bonusBalance,
          transactions: bonus ? [{ id: uid(), at: new Date().toISOString(), type: 'bonus', amount: bonus, balanceAfter: st.balance, description: 'Bonus Bets credited' }, ...st.transactions] : st.transactions,
        }))
      },
      deposit: (amount, method) => {
        const bal = round2(get().balance + amount)
        set((s) => ({
          balance: bal,
          transactions: [{ id: uid(), at: new Date().toISOString(), type: 'deposit', amount, balanceAfter: bal, description: `Deposit · ${method}` }, ...s.transactions],
        }))
      },
      withdraw: (amount, method) => {
        if (amount <= 0 || amount > get().balance) return false
        const bal = round2(get().balance - amount)
        set((s) => ({
          balance: bal,
          transactions: [{ id: uid(), at: new Date().toISOString(), type: 'withdrawal', amount: -amount, balanceAfter: bal, description: `Withdrawal · ${method}` }, ...s.transactions],
        }))
        return true
      },
      placeBets: (bets, opts) => {
        const total = round2(bets.reduce((a, b) => a + b.stake * (b.rrCombos ?? 1), 0))
        const s = get()
        if (opts?.bonusBet) {
          if (total > s.bonusBalance + 1e-9) return false
        } else if (total > s.balance + 1e-9) return false
        let bal = s.balance
        let bonus = s.bonusBalance
        const txs: Transaction[] = []
        for (const b of bets) {
          const amt = round2(b.stake * (b.rrCombos ?? 1))
          if (opts?.bonusBet) bonus = round2(bonus - amt)
          else bal = round2(bal - amt)
          txs.push({ id: uid(), at: b.placedAt, type: 'bet', amount: -amt, balanceAfter: bal, description: `${b.title} · Bet ID ${b.betId}`, betId: b.id })
        }
        const pts = Math.round(total * 10)
        set((st) => ({
          balance: bal,
          bonusBalance: bonus,
          bets: [...bets, ...st.bets],
          transactions: [...txs.reverse(), ...st.transactions],
          rewards: bumpRewards(st.rewards, pts),
        }))
        return true
      },
      settleBet: (betId, patch) => {
        const s = get()
        const bet = s.bets.find((b) => b.id === betId)
        if (!bet || bet.status !== 'open') return
        let bal = s.balance
        let bonus = s.bonusBalance
        const txs: Transaction[] = []
        const now = new Date().toISOString()
        const payoutAmt = round2(patch.payout ?? 0)
        if (payoutAmt > 0) {
          bal = round2(bal + payoutAmt)
          txs.push({ id: uid(), at: now, type: 'payout', amount: payoutAmt, balanceAfter: bal, description: `${patch.status === 'push' || patch.status === 'void' ? 'Refund' : 'Winnings'} · ${bet.title} · Bet ID ${bet.betId}`, betId })
        }
        if (patch.status === 'lost' && bet.noSweat && !bet.bonusBet) {
          const refund = round2(bet.stake * (bet.rrCombos ?? 1))
          bonus = round2(bonus + refund)
          txs.push({ id: uid(), at: now, type: 'bonus', amount: refund, balanceAfter: bal, description: `No Sweat Bet refund (Bonus Bets) · Bet ID ${bet.betId}`, betId })
        }
        const notif = patch.status === 'won'
          ? { id: uid('n'), at: now, title: 'You won!', body: `${bet.title} paid ${formatUsd(payoutAmt)}`, betId, read: false }
          : patch.status === 'lost'
            ? { id: uid('n'), at: now, title: 'Bet settled', body: `${bet.title} lost`, betId, read: false }
            : { id: uid('n'), at: now, title: 'Bet settled', body: `${bet.title} · ${patch.status}`, betId, read: false }
        set((st) => ({
          balance: bal,
          bonusBalance: bonus,
          bets: st.bets.map((b) => (b.id === betId ? { ...b, ...patch, settledAt: patch.settledAt ?? now } : b)),
          transactions: [...txs.reverse(), ...st.transactions],
          notifications: [notif, ...st.notifications].slice(0, 50),
        }))
      },
      updateBet: (betId, patch) => {
        set((st) => ({ bets: st.bets.map((b) => (b.id === betId ? { ...b, ...(typeof patch === 'function' ? patch(b) : patch) } : b)) }))
      },
      cashOut: (betId, amount) => {
        const s = get()
        const bet = s.bets.find((b) => b.id === betId)
        if (!bet || bet.status !== 'open') return
        const bal = round2(s.balance + amount)
        const now = new Date().toISOString()
        set((st) => ({
          balance: bal,
          bets: st.bets.map((b) => (b.id === betId ? { ...b, status: 'cashed_out', payout: amount, cashedOutAt: now, settledAt: now } : b)),
          transactions: [{ id: uid(), at: now, type: 'cashout', amount, balanceAfter: bal, description: `Cash Out · ${bet.title} · Bet ID ${bet.betId}`, betId }, ...st.transactions],
          notifications: [{ id: uid('n'), at: now, title: 'Cashed out', body: `${bet.title} cashed out for ${formatUsd(amount)}`, betId, read: false }, ...st.notifications].slice(0, 50),
        }))
      },
      addToken: (t) => set((st) => ({ tokens: [t, ...st.tokens] })),
      useToken: (id, betId) => set((st) => ({ tokens: st.tokens.map((t) => (t.id === id ? { ...t, used: true, usedAt: new Date().toISOString(), betId } : t)) })),
      addTransaction: (t) => {
        set((st) => ({ transactions: [{ id: uid(), at: t.at ?? new Date().toISOString(), balanceAfter: st.balance, ...t }, ...st.transactions] }))
      },
      addPoints: (pts) => set((st) => ({ rewards: bumpRewards(st.rewards, pts) })),
      claimWeekly: (key) => set((st) => ({ rewards: { ...st.rewards, claimedWeekly: [...st.rewards.claimedWeekly, key] } })),
      pushNotification: (n) => set((st) => ({ notifications: [{ id: uid('n'), at: new Date().toISOString(), read: false, ...n }, ...st.notifications].slice(0, 50) })),
      markNotificationsRead: () => set((st) => ({ notifications: st.notifications.map((n) => ({ ...n, read: true })) })),
      resetAccount: () => set({ ...initial() }),
      importState: (state) => set((st) => ({ ...st, ...state })),
      touch: () => set({ lastSeenAt: new Date().toISOString() }),
    }),
    { name: 'fd.account', version: 1 },
  ),
)

function bumpRewards(r: RewardsState, pts: number): RewardsState {
  const mk = monthKey()
  const monthPoints = (r.monthKey === mk ? r.monthPoints : 0) + pts
  const points = r.points + pts
  return { ...r, points, monthKey: mk, monthPoints, level: Math.max(r.level, levelForPoints(monthPoints)) }
}

function formatUsd(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function nextBetId(): string {
  const n = Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000
  return `O/${n.toString().slice(0, 10)}/${String(Math.floor(Math.random() * 9000) + 1000)}`
}
