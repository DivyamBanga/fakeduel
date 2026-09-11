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
    <header className="hdr-grad sticky top-0 z-40 flex items-center h-[66px] pl-3 pr-3 text-white">
      {showBack ? (
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="Back" className="mr-0.5 -ml-1 w-8 h-9 flex items-center justify-center shrink-0">
          <ChevronLeft size={26} strokeWidth={2} />
        </button>
      ) : null}
      {title && showBack ? (
        <h1 className="text-[18px] font-bold truncate">{title}</h1>
      ) : (
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <Logo compact />
          <span className="w-px h-7 bg-white/40 shrink-0" />
          <RgBadge size={28} />
        </Link>
      )}
      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <Link to="/search" aria-label="Search" className="w-9 h-9 flex items-center justify-center">
          <SearchIcon size={22} strokeWidth={2} />
        </Link>
        <div className="h-[34px] pl-3 pr-1 rounded flex items-center gap-2 text-[14px] font-bold tabular" style={{ background: 'rgba(0,0,0,0.22)' }}>
          <Link to="/account">{formatMoney(balance)}</Link>
          <Link to="/account/deposit" aria-label="Deposit" className="w-[26px] h-[26px] rounded flex items-center justify-center" style={{ background: '#128000' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  )
}
