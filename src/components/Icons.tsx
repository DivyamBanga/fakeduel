import type { CSSProperties } from 'react'
import { FaFootballBall, FaBasketballBall, FaBaseballBall, FaHockeyPuck, FaGolfBall, FaFutbol, FaFlagCheckered, FaTableTennis, FaRunning, FaGift, FaHorseHead } from 'react-icons/fa'
import { GiBoxingGlove, GiCricketBat, GiDart, GiRugbyConversion, GiPoolTriangle, GiVolleyballBall, GiAustralia, GiTennisBall } from 'react-icons/gi'
import { IoTennisball } from 'react-icons/io5'
import { useLiveStore } from '@/store/live'

const ESPN_LEAGUE_LOGOS: Record<string, string> = {
  nfl: 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png',
  nba: 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
  mlb: 'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png',
  nhl: 'https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png',
  wnba: 'https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png',
  ufc: 'https://a.espncdn.com/i/teamlogos/leagues/500/ufc.png',
  f1: 'https://a.espncdn.com/i/teamlogos/leagues/500/f1.png',
  lpga: 'https://a.espncdn.com/i/teamlogos/leagues/500/lpga.png',
  epl: 'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png',
  ucl: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
}

export function leagueLogoUrl(id: string): string | undefined {
  return ESPN_LEAGUE_LOGOS[id]
}

interface IconProps {
  id: string
  size?: number
  className?: string
  style?: CSSProperties
}

function Circle({ children, size, bg, color }: { children: React.ReactNode; size: number; bg: string; color: string }) {
  return (
    <span style={{ width: size, height: size, background: bg, color, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: Math.round(size * 0.42), lineHeight: 1, flexShrink: 0 }}>
      {children}
    </span>
  )
}

export function LiveBadge({ size = 24 }: { size?: number }) {
  const n = useLiveStore((s) => s.liveCount)
  return (
    <Circle size={size} bg="#d22839" color="#fff">
      {n > 0 ? (n > 99 ? '99' : n) : ''}
    </Circle>
  )
}

/** Sport/league icon used in the sidebar, chips, and icon carousel. */
export function SportIcon({ id, size = 24, className, style }: IconProps) {
  const logo = ESPN_LEAGUE_LOGOS[id]
  const common = { width: size, height: size, style: { flexShrink: 0, ...style }, className }
  if (logo) return <img src={logo} alt="" {...common} style={{ objectFit: 'contain', ...common.style }} loading="lazy" />
  const s = Math.round(size * 0.86)
  switch (id) {
    case 'live':
      return <LiveBadge size={size} />
    case 'rewards':
      return (
        <Circle size={size} bg="#ffdc2e" color="#05285a">
          <FaGift size={Math.round(size * 0.55)} />
        </Circle>
      )
    case 'parlayhub':
      return (
        <span className={className} style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontWeight: 900, fontSize: Math.round(size * 0.5), color: '#64aeff', letterSpacing: -0.5, flexShrink: 0, ...style }}>
          PH
        </span>
      )
    case 'promos':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
          <path d="M3 12V4h8l10 10-8 8L3 12Z" stroke="#41e878" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="7.5" cy="8.5" r="1.5" fill="#41e878" />
        </svg>
      )
    case 'earn':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
          <circle cx="9" cy="8" r="3.5" stroke="#eaf0f6" strokeWidth="1.6" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#eaf0f6" strokeWidth="1.6" />
          <circle cx="18" cy="15" r="4" fill="#128000" />
          <path d="M18 13v4M16 15h4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )
    case 'casino':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
          <rect x="6" y="3" width="12" height="18" rx="2" stroke="#d22839" strokeWidth="1.7" fill="#fff" />
          <path d="M12 8l2.2 3-2.2 3-2.2-3L12 8Z" fill="#d22839" />
        </svg>
      )
    case 'racebook':
      return <FaHorseHead size={s} color="#c98a4a" className={className} style={style} />
    case 'learn':
      return (
        <span className={className} style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: Math.round(size * 0.42), color: '#f87a1e', flexShrink: 0, ...style }}>
          101
        </span>
      )
    case 'freeplay':
      return (
        <span className={className} style={{ width: size, height: size, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: Math.round(size * 0.34), lineHeight: 1, color: '#41e878', fontStyle: 'italic', flexShrink: 0, ...style }}>
          <span>FREE</span>
          <span>PLAY</span>
        </span>
      )
    case 'ncaaf':
    case 'cfl':
    case 'ufl':
    case 'football':
      return <FaFootballBall size={s} color="#b5651d" className={className} style={{ transform: 'rotate(-35deg)', ...style }} />
    case 'ncaab':
    case 'ncaaw':
    case 'basketball':
      return <FaBasketballBall size={s} color="#e8772e" className={className} style={style} />
    case 'baseball':
      return <FaBaseballBall size={s} color="#eaf0f6" className={className} style={style} />
    case 'hockey':
      return <FaHockeyPuck size={s} color="#eaf0f6" className={className} style={style} />
    case 'soccer':
      return <FaFutbol size={s} color="#eaf0f6" className={className} style={style} />
    case 'tennis':
    case 'atp':
    case 'wta':
      return <IoTennisball size={s} color="#c6e838" className={className} style={style} />
    case 'golf':
    case 'pga':
      return <FaGolfBall size={s} color="#eaf0f6" className={className} style={style} />
    case 'mma':
    case 'boxing':
      return <GiBoxingGlove size={s} color="#d22839" className={className} style={style} />
    case 'racing':
    case 'nascar':
    case 'motorsport':
      return <FaFlagCheckered size={s} color="#eaf0f6" className={className} style={style} />
    case 'cricket':
      return <GiCricketBat size={s} color="#eaf0f6" className={className} style={style} />
    case 'darts':
      return <GiDart size={s} color="#eaf0f6" className={className} style={style} />
    case 'rugby':
    case 'rugby-league':
    case 'rugby-union':
      return <GiRugbyConversion size={s} color="#eaf0f6" className={className} style={style} />
    case 'snooker':
      return <GiPoolTriangle size={s} color="#eaf0f6" className={className} style={style} />
    case 'volleyball':
    case 'handball':
      return <GiVolleyballBall size={s} color="#eaf0f6" className={className} style={style} />
    case 'lacrosse':
      return <FaHockeyPuck size={s} color="#eaf0f6" className={className} style={style} />
    case 'aussie-rules':
      return <GiAustralia size={s} color="#eaf0f6" className={className} style={style} />
    case 'table-tennis':
      return <FaTableTennis size={s} color="#eaf0f6" className={className} style={style} />
    case 'athletics':
      return <FaRunning size={s} color="#eaf0f6" className={className} style={style} />
    default:
      return <GiTennisBall size={s} color="#eaf0f6" className={className} style={style} />
  }
}

/* ----------------------------- UI glyphs (thin outline, FanDuel style) ----------------------------- */

type G = { size?: number; className?: string; color?: string; strokeWidth?: number }
const g = (p: G) => ({ width: p.size ?? 24, height: p.size ?? 24, viewBox: '0 0 24 24', fill: 'none', stroke: p.color ?? 'currentColor', strokeWidth: p.strokeWidth ?? 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: p.className })

export const HomeIcon = (p: G) => (
  <svg {...g(p)}>
    <path d="M3.5 11.5 12 4l8.5 7.5" />
    <path d="M5.5 10v10h13V10" />
    <path d="M10 20v-6h4v6" />
  </svg>
)
export const AllSportsIcon = (p: G) => (
  <svg {...g(p)}>
    <path d="M4 6h9M4 11h6M4 16h5" />
    <circle cx="15.5" cy="14.5" r="3.8" />
    <path d="m18.3 17.3 2.7 2.7" />
  </svg>
)
export const MyBetsIcon = (p: G) => (
  <svg {...g(p)}>
    <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
    <path d="M9 8h6M9 11.5h6M9 15h4" />
  </svg>
)
export const CasinoIcon = (p: G) => (
  <svg {...g(p)}>
    <rect x="7" y="3.5" width="10" height="17" rx="1.8" />
    <path d="M12 8.5c1 1.6 2 2.4 2 3.5a2 2 0 1 1-4 0c0-1.1 1-1.9 2-3.5Z" />
  </svg>
)
export const AccountIcon = (p: G) => (
  <svg {...g(p)}>
    <circle cx="12" cy="8.5" r="4" />
    <path d="M4.5 20.5c.6-3.9 3.7-6.5 7.5-6.5s6.9 2.6 7.5 6.5" />
  </svg>
)
export const SearchIcon = (p: G) => (
  <svg {...g(p)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </svg>
)
export const ChevronDown = (p: G) => (
  <svg {...g(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const ChevronRight = (p: G) => (
  <svg {...g(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)
export const ChevronLeft = (p: G) => (
  <svg {...g(p)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
)
export const CloseIcon = (p: G) => (
  <svg {...g(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const TrashIcon = (p: G) => (
  <svg {...g(p)}>
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)
export const InfoIcon = (p: G) => (
  <svg {...g(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8v.5" />
  </svg>
)
export const MinusCircle = (p: G) => (
  <svg {...g(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12h7" />
  </svg>
)
export const PlusCircle = (p: G) => (
  <svg {...g(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12h7M12 8.5v7" />
  </svg>
)
export const CheckIcon = (p: G) => (
  <svg {...g({ ...p, strokeWidth: p.strokeWidth ?? 2.2 })}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)
export const BoltIcon = (p: G) => (
  <svg {...g(p)} fill={p.color ?? 'currentColor'} stroke="none">
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </svg>
)
export const FireIcon = (p: G) => (
  <svg {...g(p)} fill={p.color ?? 'currentColor'} stroke="none">
    <path d="M12 2c1 4 4 5.5 4 9.5A4 4 0 0 1 12 15a4 4 0 0 1-4-3.5c0-1.6.7-2.7 1.5-3.5.2 1.2.8 2 1.5 2C11 7 9.5 5.5 12 2Z" />
    <path d="M12 22c-3.9 0-6.5-2.6-6.5-6 0-2 .9-3.6 2.2-4.8.3 1.3 1.2 2.3 2.3 2.8-.4-2.4 1-4.5 3-5.6-.3 2.5 1.6 3.6 2.6 5.1.9 1.4 1.4 2.6 1.4 3.5 0 3-2.6 5-5 5Z" />
  </svg>
)
export const GearIcon = (p: G) => (
  <svg {...g(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
)
export const BellIcon = (p: G) => (
  <svg {...g(p)}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
)
export const ExternalIcon = (p: G) => (
  <svg {...g(p)}>
    <path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6" />
  </svg>
)
export const ShareIcon = (p: G) => (
  <svg {...g(p)}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" />
  </svg>
)
export const CopyIcon = (p: G) => (
  <svg {...g(p)}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
)
export const LockIcon = (p: G) => (
  <svg {...g(p)}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
)

/** FanDuel-style "SGP" pill. */
export function SgpBadge({ plus = false, small = false }: { plus?: boolean; small?: boolean }) {
  return (
    <span
      className="inline-flex items-center shrink-0 font-black italic tracking-tight rounded-[3px] border"
      style={{ color: '#ffdc2e', borderColor: '#ffdc2e', background: '#0a2262', fontSize: small ? 9 : 10, lineHeight: 1, padding: small ? '2px 4px' : '3px 5px', height: small ? 14 : 16, fontFamily: 'var(--font-cond)', letterSpacing: 0.5 }}
    >
      SGP{plus ? <span className="ml-0.5 not-italic">+</span> : null}
    </span>
  )
}

/** Small yellow "LIVE" tag. */
export function LiveTag({ text = 'LIVE' }: { text?: string }) {
  return (
    <span className="cond inline-flex items-center rounded-[3px] px-1 font-bold" style={{ background: '#d22839', color: '#fff', fontSize: 10, height: 16, letterSpacing: 0.6 }}>
      {text}
    </span>
  )
}
