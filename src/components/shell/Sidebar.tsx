import { NavLink } from 'react-router-dom'
import { POPULAR_NAV } from '@/data/sports'
import { SportIcon } from '../Icons'

export const ALL_SPORTS_NAV: { label: string; slug: string; icon: string }[] = [
  { label: 'Athletics', slug: 'athletics', icon: 'athletics' },
  { label: 'Aussie Rules', slug: 'aussie-rules', icon: 'aussie-rules' },
  { label: 'Baseball', slug: 'baseball', icon: 'baseball' },
  { label: 'Basketball', slug: 'basketball', icon: 'basketball' },
  { label: 'Boxing', slug: 'boxing', icon: 'boxing' },
  { label: 'Cricket', slug: 'cricket', icon: 'cricket' },
  { label: 'Darts', slug: 'darts', icon: 'darts' },
  { label: 'Football', slug: 'football', icon: 'football' },
  { label: 'Golf', slug: 'golf', icon: 'golf' },
  { label: 'Handball', slug: 'handball', icon: 'handball' },
  { label: 'Hockey', slug: 'hockey', icon: 'hockey' },
  { label: 'Lacrosse', slug: 'lacrosse', icon: 'lacrosse' },
  { label: 'MMA', slug: 'mma', icon: 'mma' },
  { label: 'Motorsport', slug: 'racing', icon: 'racing' },
  { label: 'Rugby League', slug: 'rugby-league', icon: 'rugby' },
  { label: 'Rugby Union', slug: 'rugby-union', icon: 'rugby' },
  { label: 'Snooker', slug: 'snooker', icon: 'snooker' },
  { label: 'Soccer', slug: 'soccer', icon: 'soccer' },
  { label: 'Table Tennis', slug: 'table-tennis', icon: 'table-tennis' },
  { label: 'Tennis', slug: 'tennis', icon: 'tennis' },
]

const OTHER_LINKS = [
  { label: 'NFL Team Odds', to: '/navigation/nfl?tab=futures' },
  { label: 'NBA Team Odds', to: '/navigation/nba?tab=futures' },
  { label: 'MLB Team Odds', to: '/navigation/mlb?tab=futures' },
  { label: 'NCAAF Team Odds', to: '/navigation/ncaaf?tab=futures' },
  { label: 'Terms and Conditions', to: '/terms' },
  { label: 'Responsible Gaming', to: '/responsible-gaming' },
  { label: 'House Rules', to: '/house-rules' },
  { label: 'Support', to: '/support' },
]

function Item({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <li>
      <NavLink to={to} className="block h-[34px] px-3">
        {({ isActive }) => (
          <span className={`flex items-center h-full rounded px-2 gap-2 ${isActive ? 'font-bold' : ''}`} style={{ background: isActive ? 'var(--fd-surface-3)' : 'transparent' }}>
            <SportIcon id={icon} size={22} />
            <span className="text-[14px] text-fg leading-4">{label}</span>
          </span>
        )}
      </NavLink>
    </li>
  )
}

export function Sidebar() {
  return (
    <aside className="w-[200px] shrink-0 pb-10" style={{ background: 'var(--fd-bg)' }}>
      <h3 className="text-[16px] font-bold text-fg ml-4 mt-7 mb-2">Popular</h3>
      <ul>
        {POPULAR_NAV.map((n) => (
          <Item key={n.id} to={n.to} icon={n.icon} label={n.label} />
        ))}
      </ul>
      <h3 className="text-[16px] font-bold text-fg ml-4 mt-7 mb-2">All Sports</h3>
      <ul>
        {ALL_SPORTS_NAV.map((n) => (
          <Item key={n.slug} to={`/navigation/${n.slug}`} icon={n.icon} label={n.label} />
        ))}
      </ul>
      <h3 className="text-[16px] font-bold text-fg ml-4 mt-7 mb-2">Other Links</h3>
      <ul>
        {OTHER_LINKS.map((n) => (
          <li key={n.label}>
            <NavLink to={n.to} className="flex items-center h-[34px] px-4 text-[14px] text-fg hover:text-link">
              {n.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  )
}
