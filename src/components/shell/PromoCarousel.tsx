import { Link } from 'react-router-dom'

export interface PromoCard {
  id: string
  eyebrow?: string
  headline: string
  sub?: string
  gradient: string
  cta: string
  to: string
  art?: 'boost' | 'shield' | 'sgp' | 'rewards' | 'live' | 'nfl'
}

export const DEFAULT_PROMOS: PromoCard[] = [
  { id: 'boost', eyebrow: 'FOR YOU', headline: '30% PROFIT BOOST', sub: 'ON ANY BET · UP TO $50 WAGER', gradient: 'linear-gradient(120deg,#0a2262 0%,#1493ff 100%)', cta: 'Bet Now', to: '/promotions', art: 'boost' },
  { id: 'nosweat', eyebrow: 'NEW', headline: 'NO SWEAT BET', sub: 'UP TO $50 BACK IN BONUS BETS IF YOU LOSE', gradient: 'linear-gradient(120deg,#05285a 0%,#005fc8 100%)', cta: 'Bet Now', to: '/promotions', art: 'shield' },
  { id: 'sgp', eyebrow: 'SAME GAME PARLAY', headline: 'BUILD YOUR SGP', sub: 'COMBINE PLAYER PROPS, SPREADS & TOTALS', gradient: 'linear-gradient(120deg,#0d0d0d 0%,#0a2262 100%)', cta: 'Parlay Hub', to: '/parlay-hub', art: 'sgp' },
  { id: 'rewards', eyebrow: 'REWARDS CLUB', headline: 'YOUR BETS. YOUR REWARDS.', sub: 'EARN POINTS ON EVERY WAGER', gradient: 'linear-gradient(120deg,#1a0b3d 0%,#005fc8 100%)', cta: 'Rewards', to: '/rewards', art: 'rewards' },
  { id: 'live', eyebrow: 'LIVE BETTING', headline: 'BET AS IT HAPPENS', sub: 'ODDS UPDATE WITH EVERY PLAY', gradient: 'linear-gradient(120deg,#3a0a12 0%,#d22839 100%)', cta: 'Live Now', to: '/live', art: 'live' },
]

function Art({ kind }: { kind?: PromoCard['art'] }) {
  const common = 'absolute right-3 top-2 opacity-90'
  switch (kind) {
    case 'boost':
      return (
        <svg className={common} width="64" height="64" viewBox="0 0 24 24" fill="#ffdc2e">
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
        </svg>
      )
    case 'shield':
      return (
        <svg className={common} width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ffdc2e" strokeWidth="1.5">
          <path d="M12 3 4 6v6c0 4.5 3.4 7.9 8 9 4.6-1.1 8-4.5 8-9V6l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    case 'sgp':
      return (
        <span className={`${common} font-black italic`} style={{ color: '#ffdc2e', fontSize: 34, fontFamily: 'var(--font-cond)' }}>
          SGP
        </span>
      )
    case 'rewards':
      return (
        <svg className={common} width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ffdc2e" strokeWidth="1.5">
          <rect x="3" y="8" width="18" height="13" rx="1.5" />
          <path d="M3 12h18M12 8v13M12 8c-2-3-5-3-5-1s3 1 5 1Zm0 0c2-3 5-3 5-1s-3 1-5 1Z" />
        </svg>
      )
    case 'live':
      return (
        <span className={`${common} flex items-center gap-1 font-black`} style={{ color: '#fff', fontSize: 22 }}>
          <span className="live-dot w-3 h-3 rounded-full" style={{ background: '#fff' }} /> LIVE
        </span>
      )
    default:
      return null
  }
}

export function PromoCarousel({ promos = DEFAULT_PROMOS, cardWidth = 315 }: { promos?: PromoCard[]; cardWidth?: number }) {
  return (
    <div className="no-scrollbar overflow-x-auto">
      <div className="flex gap-2 px-4 lg:px-0 py-3 min-w-max">
        {promos.map((p) => (
          <div key={p.id} className="rounded-md overflow-hidden shrink-0 border" style={{ width: cardWidth, borderColor: 'var(--fd-line)', background: '#04143a' }}>
            <Link to={p.to} className="relative block h-[108px] px-4 py-3 text-white" style={{ backgroundImage: p.gradient }}>
              <Art kind={p.art} />
              {p.eyebrow ? (
                <div className="cond text-[11px] font-bold opacity-90" style={{ color: '#ffdc2e' }}>
                  {p.eyebrow}
                </div>
              ) : null}
              <div className="cond font-extrabold leading-[1.05] mt-1 pr-16" style={{ fontSize: 26 }}>
                {p.headline}
              </div>
              {p.sub ? <div className="cond text-[11px] font-semibold mt-1.5 opacity-95 pr-16">{p.sub}</div> : null}
            </Link>
            <div className="flex gap-2 p-2">
              <Link to={p.to} className="flex-1 h-[34px] rounded border flex items-center justify-center text-[14px] text-white" style={{ borderColor: '#ced4db' }}>
                More info
              </Link>
              <Link to={p.to} className="flex-1 h-[34px] rounded flex items-center justify-center text-[14px] text-white font-semibold" style={{ background: '#128000' }}>
                {p.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
