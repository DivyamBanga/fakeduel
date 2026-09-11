import { useState } from 'react'
import { Card, EmptyState } from '@/components/shell/SectionHeader'
import { formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/odds'
import type { TransactionType } from '@/lib/types'
import { useAccount } from '@/store/account'

const LABEL: Record<TransactionType, string> = { deposit: 'Deposit', withdrawal: 'Withdrawal', bet: 'Wager', payout: 'Payout', cashout: 'Cash Out', refund: 'Refund', bonus: 'Bonus', adjustment: 'Adjustment' }
const FILTERS: { id: string; label: string; types: TransactionType[] }[] = [
  { id: 'all', label: 'All', types: [] },
  { id: 'deposits', label: 'Deposits', types: ['deposit', 'withdrawal'] },
  { id: 'bets', label: 'Wagers', types: ['bet'] },
  { id: 'payouts', label: 'Payouts', types: ['payout', 'cashout', 'refund', 'bonus'] },
]

export function TransactionsPage() {
  const txs = useAccount((s) => s.transactions)
  const [filter, setFilter] = useState('all')
  const f = FILTERS.find((x) => x.id === filter)!
  const list = f.types.length ? txs.filter((t) => f.types.includes(t.type)) : txs
  return (
    <div className="px-4 lg:px-0">
      <h1 className="hidden lg:block text-[20px] font-bold mt-2 mb-3" style={{ color: 'var(--fd-fg)' }}>
        Transactions
      </h1>
      <div className="flex gap-2 py-3">
        {FILTERS.map((x) => (
          <button key={x.id} onClick={() => setFilter(x.id)} className="h-8 px-4 rounded-full text-[13px] font-semibold" style={{ background: filter === x.id ? '#2b90ff' : 'var(--fd-surface)', color: filter === x.id ? '#fff' : 'var(--fd-link)' }}>
            {x.label}
          </button>
        ))}
      </div>
      <Card>
        {list.length ? (
          list.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--fd-line-2)' }}>
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: t.amount >= 0 ? 'rgba(18,128,0,0.2)' : 'var(--fd-surface-3)', color: t.amount >= 0 ? '#41e878' : 'var(--fd-fg-2)' }}>
                {LABEL[t.type].slice(0, 3).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold truncate" style={{ color: 'var(--fd-fg)' }}>
                  {t.description}
                </div>
                <div className="text-[12px]" style={{ color: 'var(--fd-fg-3)' }}>
                  {formatDateTime(t.at)} · {LABEL[t.type]}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[15px] font-bold tabular" style={{ color: t.amount >= 0 ? '#41e878' : 'var(--fd-fg)' }}>
                  {formatMoney(t.amount, { sign: true })}
                </div>
                <div className="text-[11px] tabular" style={{ color: 'var(--fd-fg-3)' }}>
                  Bal {formatMoney(t.balanceAfter)}
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState title="No transactions" body="Deposits, wagers and payouts will appear here." />
        )}
      </Card>
    </div>
  )
}
