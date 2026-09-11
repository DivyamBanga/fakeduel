import { NavLink } from 'react-router-dom'
import { AccountIcon, AllSportsIcon, CasinoIcon, HomeIcon, MyBetsIcon } from '../Icons'
import { useAccount } from '@/store/account'

const TABS = [
  { label: 'Home', to: '/', Icon: HomeIcon, end: true },
  { label: 'All Sports', to: '/all-sports', Icon: AllSportsIcon, end: false },
  { label: 'My Bets', to: '/my-bets', Icon: MyBetsIcon, end: false },
  { label: 'Casino', to: '/casino', Icon: CasinoIcon, end: false },
  { label: 'Account', to: '/account', Icon: AccountIcon, end: false },
]

export function BottomTabs() {
  const openCount = useAccount((s) => s.bets.filter((b) => b.status === 'open').length)
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom" style={{ background: 'var(--fd-tabbar)', boxShadow: '0 -1px 0 var(--fd-line-2)' }}>
      <ul className="flex items-center justify-evenly h-[62px]">
        {TABS.map((t) => (
          <li key={t.to} className="w-[78px]">
            <NavLink to={t.to} end={t.end} className="flex flex-col items-center justify-center h-[62px]">
              {({ isActive }) => (
                <>
                  <span className="relative" style={{ color: isActive ? 'var(--fd-link)' : 'var(--fd-fg-2)' }}>
                    <t.Icon size={26} strokeWidth={1.5} />
                    {t.label === 'My Bets' && openCount > 0 ? (
                      <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#d22839', color: '#fff' }}>
                        {openCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 text-[10px] leading-3" style={{ color: isActive ? 'var(--fd-link)' : 'var(--fd-fg-2)' }}>
                    {t.label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
