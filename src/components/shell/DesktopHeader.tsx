import { Link, NavLink, useLocation } from 'react-router-dom'
import { Logo, RgBadge } from './Logo'
import { ExternalIcon, SearchIcon } from '../Icons'
import { useAccount } from '@/store/account'
import { formatMoney } from '@/lib/odds'

const TOP_TABS = [
  { label: 'SPORTSBOOK', to: '/', external: false },
  { label: 'CASINO', to: '/casino', external: true },
  { label: 'FANTASY', to: '/fantasy', external: true },
  { label: 'RACEBOOK', to: '/racing', external: true },
  { label: 'TV+', to: '/tv', external: true },
]

export function DesktopHeader() {
  const balance = useAccount((s) => s.balance)
  const loc = useLocation()
  const isSportsbook = !/^\/(casino|fantasy|racing|tv)/.test(loc.pathname)
  return (
    <header className="sticky top-0 z-40">
      <div className="flex items-stretch h-9" style={{ background: '#2b90ff' }}>
        <div className="flex items-stretch pl-9">
          {TOP_TABS.map((t) => {
            const active = t.label === 'SPORTSBOOK' ? isSportsbook : loc.pathname.startsWith(t.to)
            return (
              <Link key={t.label} to={t.to} className="flex items-center gap-1.5 px-6 text-[13px] font-bold text-white tracking-[0.04em]" style={{ background: active ? 'rgba(0,0,0,0.18)' : 'transparent' }}>
                {t.label}
                {t.external ? <ExternalIcon size={13} strokeWidth={1.8} /> : null}
              </Link>
            )
          })}
        </div>
        <div className="ml-auto flex items-center gap-2 pr-5 text-[12px] text-white">
          <span>
            Practice sportsbook with play money. Gambling problem? Call <b>1-800-Gambler</b>
          </span>
          <RgBadge size={22} />
        </div>
      </div>
      <div className="hdr-grad flex items-center h-[66px] pl-9 pr-5">
        <Link to="/" className="mr-6 flex items-center">
          <Logo />
        </Link>
        <nav className="flex items-stretch h-full">
          {[
            { label: 'Home', to: '/', end: true },
            { label: 'My Bets', to: '/my-bets', end: false },
            { label: 'Promotions', to: '/promotions', end: false },
          ].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `flex items-center px-4 min-w-[80px] justify-center text-[16px] text-white border-b-2 ${isActive ? 'font-bold border-[#ced4db]' : 'border-transparent'}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link to="/search" aria-label="Search" className="w-8 h-8 rounded-full border border-white/90 flex items-center justify-center text-white hover:bg-white/10">
            <SearchIcon size={16} strokeWidth={2} />
          </Link>
          <Link to="/account" className="flex items-center gap-2 h-[34px] px-3 rounded text-white text-[14px] font-bold" style={{ background: 'rgba(0,0,0,0.22)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M16 12h5" />
              <circle cx="16.5" cy="12.5" r="1" fill="currentColor" />
            </svg>
            <span className="tabular">{formatMoney(balance)}</span>
          </Link>
          <Link to="/account/deposit" className="h-[34px] min-w-[95px] px-4 rounded text-white text-[14px] font-semibold flex items-center justify-center" style={{ background: '#128000' }}>
            Deposit
          </Link>
          <Link to="/account" aria-label="Account" className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white" style={{ background: 'rgba(255,255,255,0.14)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="12" cy="8.5" r="4" />
              <path d="M4.5 20.5c.6-3.9 3.7-6.5 7.5-6.5s6.9 2.6 7.5 6.5" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  )
}
