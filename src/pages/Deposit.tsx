import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckIcon } from '@/components/Icons'
import { Card } from '@/components/shell/SectionHeader'
import { formatMoney } from '@/lib/odds'
import { useAccount } from '@/store/account'

const AMOUNTS = [25, 50, 100, 250, 500, 1000]

export function PaymentMethod() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-md border" style={{ borderColor: 'var(--fd-line)', background: 'var(--fd-surface-2)' }}>
      <span className="w-12 h-8 rounded flex items-center justify-center text-[11px] font-black italic text-white" style={{ background: 'linear-gradient(135deg,#1a1f71,#2b90ff)' }}>
        VISA
      </span>
      <div className="flex-1">
        <div className="text-[14px] font-semibold" style={{ color: 'var(--fd-fg)' }}>
          Practice Visa •••• 4242
        </div>
        <div className="text-[12px]" style={{ color: 'var(--fd-fg-3)' }}>
          Play-money card · never charged
        </div>
      </div>
      <CheckIcon size={18} color="#41e878" />
    </div>
  )
}

export function DepositPage() {
  const deposit = useAccount((s) => s.deposit)
  const balance = useAccount((s) => s.balance)
  const nav = useNavigate()
  const [amount, setAmount] = useState(100)
  const [custom, setCustom] = useState('')
  const [done, setDone] = useState<number | null>(null)
  const value = custom ? Math.max(0, Math.round(parseFloat(custom) * 100) / 100 || 0) : amount
  if (done !== null) {
    return (
      <div className="px-4 lg:px-0">
        <Card className="mt-3">
          <div className="flex flex-col items-center text-center p-8">
            <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#128000' }}>
              <CheckIcon size={34} color="#fff" strokeWidth={2.6} />
            </span>
            <div className="text-[22px] font-bold mt-4" style={{ color: 'var(--fd-fg)' }}>
              Deposit successful
            </div>
            <div className="text-[15px] mt-1" style={{ color: 'var(--fd-fg-2)' }}>
              {formatMoney(done)} has been added to your balance.
            </div>
            <div className="text-[13px] mt-3" style={{ color: 'var(--fd-fg-3)' }}>
              New balance {formatMoney(balance)}
            </div>
            <div className="grid grid-cols-2 gap-2 w-full mt-6">
              <Link to="/account" className="h-[44px] rounded border flex items-center justify-center text-[15px]" style={{ borderColor: '#ced4db', color: 'var(--fd-fg)' }}>
                Done
              </Link>
              <button onClick={() => nav('/')} className="h-[44px] rounded flex items-center justify-center text-[15px] font-semibold text-white" style={{ background: '#128000' }}>
                Bet now
              </button>
            </div>
          </div>
        </Card>
      </div>
    )
  }
  return (
    <div className="px-4 lg:px-0">
      <h1 className="hidden lg:block text-[20px] font-bold mt-2 mb-3" style={{ color: 'var(--fd-fg)' }}>
        Deposit
      </h1>
      <Card className="mt-3">
        <div className="p-4">
          <div className="text-[13px] mb-2" style={{ color: 'var(--fd-fg-2)' }}>
            Select amount
          </div>
          <div className="grid grid-cols-3 gap-2">
            {AMOUNTS.map((a) => {
              const active = !custom && amount === a
              return (
                <button key={a} onClick={() => { setAmount(a); setCustom('') }} className="h-[46px] rounded border text-[16px] font-bold" style={{ borderColor: active ? '#2b90ff' : 'var(--fd-line)', background: active ? '#2b90ff' : 'var(--fd-surface-2)', color: active ? '#fff' : 'var(--fd-fg)' }}>
                  ${a}
                </button>
              )
            })}
          </div>
          <label className="flex flex-col justify-center h-[56px] px-3 mt-3 rounded border" style={{ borderColor: custom ? '#2b90ff' : 'var(--fd-line)', background: 'var(--fd-input-bg)' }}>
            <span className="cond text-[10px] font-bold" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
              OTHER AMOUNT
            </span>
            <span className="flex items-center text-[18px] font-semibold" style={{ color: 'var(--fd-fg)' }}>
              $<input inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className="w-full bg-transparent outline-none text-[18px] font-semibold ml-0.5" />
            </span>
          </label>
          <div className="text-[13px] mt-4 mb-2" style={{ color: 'var(--fd-fg-2)' }}>
            Payment method
          </div>
          <PaymentMethod />
          <div className="flex items-center justify-between text-[13px] mt-4" style={{ color: 'var(--fd-fg-2)' }}>
            <span>Current balance</span>
            <span className="tabular">{formatMoney(balance)}</span>
          </div>
          <div className="flex items-center justify-between text-[15px] font-bold mt-1" style={{ color: 'var(--fd-fg)' }}>
            <span>Deposit amount</span>
            <span className="tabular">{formatMoney(value)}</span>
          </div>
          <button
            disabled={value < 5 || value > 100000}
            onClick={() => {
              deposit(value, 'Practice Visa •••• 4242')
              setDone(value)
            }}
            className="w-full h-[50px] rounded mt-4 text-[16px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#128000' }}
          >
            Deposit {formatMoney(value)}
          </button>
          <div className="text-[11px] text-center mt-3" style={{ color: 'var(--fd-fg-3)' }}>
            Minimum $5 · Maximum $100,000 per deposit · This is practice money and has no cash value.
          </div>
        </div>
      </Card>
    </div>
  )
}
