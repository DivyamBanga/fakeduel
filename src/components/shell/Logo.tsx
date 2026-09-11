export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <path d="M8 4h24l-3.2 8.4H17.5v4.4h9.9l-3 7.9h-6.9v11.3L8 39.5V4Z" fill="#fff" />
      <path d="M21.2 25.5 33.5 13.6l-2.9 7.6-9.4 9.2v-4.9Z" fill="#fff" opacity="0.85" />
    </svg>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 select-none" aria-label="FakeDuel Sportsbook">
      <LogoMark size={compact ? 30 : 36} />
      <span className="flex flex-col leading-none text-white">
        <span className="font-extrabold tracking-[0.02em]" style={{ fontSize: compact ? 17 : 19, letterSpacing: 0.3 }}>
          FAKEDUEL
        </span>
        <span className="font-semibold" style={{ fontSize: compact ? 9.5 : 10.5, letterSpacing: 2.2, marginTop: 2 }}>
          SPORTSBOOK
        </span>
      </span>
    </span>
  )
}

export function RgBadge({ size = 24 }: { size?: number }) {
  return (
    <span
      title="Responsible Gaming"
      className="inline-flex items-center justify-center rounded-full font-black shrink-0"
      style={{ width: size, height: size, background: '#0a3d0a', color: '#41e878', border: '1.5px solid #41e878', fontSize: Math.round(size * 0.42), letterSpacing: -0.5 }}
    >
      RG
    </span>
  )
}
