import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo, RgBadge } from './Logo'
import { ChevronLeft, SearchIcon } from '../Icons'
import { useAccount } from '@/store/account'
import { formatMoney } from '@/lib/odds'

export function MobileHeader({ title, back }: { title?: string; back?: boolean }) {
  const balance = useAccount((s) => s.balance)
  const nav = useNavigate()
  const loc = useLocation()
  const showBack = back ?? (loc.pathname !== '/' && !/^\/(my-bets|account|all-sports|casino|search)$/.test(loc.pathname))
  return (
    <header className="hdr-grad sticky top-0 z-40 flex items-center h-[66px] px-4 text-white">
      {showBack ? (
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="Back" className="mr-1 -ml-1 w-9 h-9 flex items-center justify-center">
          <ChevronLeft size={26} strokeWidth={2} />
        </button>
      ) : null}
      {title && showBack ? (
        <h1 className="text-[18px] font-bold truncate">{title}</h1>
      ) : (
        <Link to="/" className="flex items-center gap-3">
          <Logo compact />
          <span className="w-px h-7 bg-white/40" />
          <RgBadge size={30} />
        </Link>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Link to="/search" aria-label="Search" className="w-9 h-9 flex items-center justify-center">
          <SearchIcon size={22} strokeWidth={2} />
        </Link>
        <Link to="/account" className="h-[34px] px-3 rounded flex items-center text-[14px] font-bold tabular" style={{ background: 'rgba(0,0,0,0.22)' }}>
          {formatMoney(balance)}
        </Link>
        <Link to="/account/deposit" className="h-[34px] px-3 rounded flex items-center text-[14px] font-semibold" style={{ background: '#128000' }}>
          Deposit
        </Link>
      </div>
    </header>
  )
}
