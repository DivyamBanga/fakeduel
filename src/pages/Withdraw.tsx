import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckIcon } from '@/components/Icons'
import { Card } from '@/components/shell/SectionHeader'
import { formatMoney } from '@/lib/odds'
import { useAccount } from '@/store/account'
import { PaymentMethod } from './Deposit'

export function WithdrawPage() {
  const withdraw = useAccount((s) => s.withdraw)
  const balance = useAccount((s) => s.balance)
  const [text, setText] = useState('')
  const [done, setDone] = useState<number | null>(null)
  const value = Math.max(0, Math.round(parseFloat(text) * 100) / 100 || 0)
  if (done !== null) {
    return (
      <div className="px-4 lg:px-0">
        <Card className="mt-3">
          <div className="flex flex-col items-center text-center p-8">
            <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#128000' }}>
              <CheckIcon size={34} color="#fff" strokeWidth={2.6} />
            </span>
            <div className="text-[22px] font-bold mt-4" style={{ color: 'var(--fd-fg)' }}>
              Withdrawal requested
            </div>
            <div className="text-[15px] mt-1" style={{ color: 'var(--fd-fg-2)' }}>
              {formatMoney(done)} sent to Practice Visa •••• 4242.
            </div>
            <div className="text-[13px] mt-3" style={{ color: 'var(--fd-fg-3)' }}>
              New balance {formatMoney(balance)}
            </div>
            <Link to="/account" className="mt-6 h-[44px] px-8 rounded flex items-center justify-center text-[15px] font-semibold text-white" style={{ background: '#128000' }}>
              Done
            </Link>
          </div>
        </Card>
      </div>
    )
  }
  return (
    <div className="px-4 lg:px-0">
      <h1 className="hidden lg:block text-[20px] font-bold mt-2 mb-3" style={{ color: 'var(--fd-fg)' }}>
        Withdraw
      </h1>
      <Card className="mt-3">
        <div className="p-4">
          <div className="text-[13px]" style={{ color: 'var(--fd-fg-2)' }}>
            Available to withdraw
          </div>
          <div className="text-[26px] font-bold tabular" style={{ color: 'var(--fd-fg)' }}>
            {formatMoney(balance)}
          </div>
          <label className="flex flex-col justify-center h-[56px] px-3 mt-4 rounded border" style={{ borderColor: text ? '#2b90ff' : 'var(--fd-line)', background: 'var(--fd-input-bg)' }}>
            <span className="cond text-[10px] font-bold" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
              AMOUNT
            </span>
            <span className="flex items-center text-[18px] font-semibold" style={{ color: 'var(--fd-fg)' }}>
              $<input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className="w-full bg-transparent outline-none text-[18px] font-semibold ml-0.5" />
            </span>
          </label>
          <div className="flex gap-2 mt-2">
            {[25, 50, 100].map((q) => (
              <button key={q} onClick={() => setText(String(Math.min(q, balance)))} className="flex-1 h-9 rounded-full border text-[13px] font-semibold" style={{ borderColor: 'var(--fd-line)', color: 'var(--fd-fg)' }}>
                ${q}
              </button>
            ))}
            <button onClick={() => setText(String(balance))} className="flex-1 h-9 rounded-full border text-[13px] font-semibold" style={{ borderColor: 'var(--fd-line)', color: 'var(--fd-fg)' }}>
              All
            </button>
          </div>
          <div className="text-[13px] mt-4 mb-2" style={{ color: 'var(--fd-fg-2)' }}>
            Withdraw to
          </div>
          <PaymentMethod />
          <button
            disabled={value < 1 || value > balance}
            onClick={() => {
              if (withdraw(value, 'Practice Visa •••• 4242')) setDone(value)
            }}
            className="w-full h-[50px] rounded mt-4 text-[16px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#128000' }}
          >
            Withdraw {value ? formatMoney(value) : ''}
          </button>
        </div>
      </Card>
    </div>
  )
}
