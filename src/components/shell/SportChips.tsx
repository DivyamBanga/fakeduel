export interface Chip {
  id: string
  label: string
}

export function SportChips({ chips, active, onSelect, sticky = true }: { chips: Chip[]; active: string; onSelect: (id: string) => void; sticky?: boolean }) {
  return (
    <div className={`${sticky ? 'sticky z-30' : ''} no-scrollbar overflow-x-auto`} style={{ background: 'var(--fd-surface)', top: sticky ? 'var(--chips-top, 0px)' : undefined }}>
      <div className="flex items-center gap-1 h-11 px-2 min-w-max">
        {chips.map((c) => {
          const isActive = c.id === active
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="h-8 px-4 rounded-full text-[15px] font-medium whitespace-nowrap"
              style={{ background: isActive ? '#2b90ff' : 'transparent', color: isActive ? '#fff' : 'var(--fd-link)' }}
            >
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Underlined text tabs (Games · Super Bowl · Player Props …). */
export function TextTabs({ tabs, active, onSelect, size = 16 }: { tabs: { id: string; label: string; badge?: React.ReactNode }[]; active: string; onSelect: (id: string) => void; size?: number }) {
  return (
    <div className="no-scrollbar overflow-x-auto border-b" style={{ borderColor: 'var(--fd-line-2)', background: 'var(--fd-bg)' }}>
      <div className="flex items-stretch h-11 min-w-max">
        {tabs.map((t, i) => {
          const isActive = t.id === active
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 ${i === 0 ? 'pl-4 pr-3' : 'px-3'}`}
              style={{ color: 'var(--fd-link)', fontSize: size, fontWeight: isActive ? 700 : 400, borderColor: isActive ? '#2b90ff' : 'transparent' }}
            >
              {t.label}
              {t.badge}
            </button>
          )
        })}
      </div>
    </div>
  )
}
