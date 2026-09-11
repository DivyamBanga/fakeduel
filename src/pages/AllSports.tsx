import { Link } from 'react-router-dom'
import { ChevronRight, SportIcon } from '@/components/Icons'
import { ALL_SPORTS_NAV } from '@/components/shell/Sidebar'
import { Card } from '@/components/shell/SectionHeader'
import { POPULAR_NAV } from '@/data/sports'

function Row({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 h-12 px-4 border-b" style={{ borderColor: 'var(--fd-line-2)' }}>
      <SportIcon id={icon} size={24} />
      <span className="flex-1 text-[15px]" style={{ color: 'var(--fd-fg)' }}>
        {label}
      </span>
      <ChevronRight size={18} color="var(--fd-link)" />
    </Link>
  )
}

export function AllSportsPage() {
  return (
    <div className="px-4 lg:px-0">
      <div className="cond text-[12px] font-bold pt-4 pb-2" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
        POPULAR
      </div>
      <Card>
        {POPULAR_NAV.map((n) => (
          <Row key={n.id} to={n.to} icon={n.icon} label={n.label} />
        ))}
      </Card>
      <div className="cond text-[12px] font-bold pb-2" style={{ color: 'var(--fd-fg-3)', letterSpacing: 1 }}>
        ALL SPORTS A-Z
      </div>
      <Card>
        {ALL_SPORTS_NAV.map((n) => (
          <Row key={n.slug} to={`/navigation/${n.slug}`} icon={n.icon} label={n.label} />
        ))}
      </Card>
    </div>
  )
}
