import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from '../Icons'

export function SectionHeader({ title, right, to, collapsible, open, onToggle, icon, size = 'md' }: { title: React.ReactNode; right?: React.ReactNode; to?: string; collapsible?: boolean; open?: boolean; onToggle?: () => void; icon?: React.ReactNode; size?: 'md' | 'sm' }) {
  const inner = (
    <div className="flex items-center justify-between h-11 px-4 border-b" style={{ background: 'var(--fd-surface)', borderColor: 'var(--fd-line)' }}>
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <h2 className={`${size === 'md' ? 'text-[16px]' : 'text-[14px]'} font-bold truncate`} style={{ color: 'var(--fd-fg-2)' }}>
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        {to ? (
          <Link to={to} className="flex items-center text-[14px]" style={{ color: 'var(--fd-link)' }}>
            {typeof right === 'string' ? null : null}
            <ChevronRight size={16} />
          </Link>
        ) : null}
        {collapsible ? (
          <button onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'} style={{ color: 'var(--fd-link)' }}>
            <ChevronDown size={18} className={open ? 'rotate-180' : ''} strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  )
  return inner
}

export function MoreLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-0.5 text-[14px]" style={{ color: 'var(--fd-link)' }}>
      {label}
      <ChevronRight size={16} />
    </Link>
  )
}

export function Card({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`rounded-md overflow-hidden mb-3 ${className}`} style={{ background: 'var(--fd-surface)', ...style }}>
      {children}
    </section>
  )
}

export function EmptyState({ title, body, art }: { title: string; body?: string; art?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {art ?? (
        <div className="w-[120px] h-[120px] rounded-full flex items-center justify-center mb-5" style={{ background: 'var(--fd-surface-2)' }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--fd-fg-3)" strokeWidth="1.2">
            <rect x="5" y="3" width="14" height="18" rx="1.5" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
        </div>
      )}
      <div className="text-[18px] font-semibold" style={{ color: 'var(--fd-fg-2)' }}>
        {title}
      </div>
      {body ? (
        <div className="text-[14px] mt-2" style={{ color: 'var(--fd-fg-3)' }}>
          {body}
        </div>
      ) : null}
    </div>
  )
}
