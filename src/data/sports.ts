export interface LeagueDef {
  id: string
  sport: string
  espnSport: string
  espnLeague: string
  name: string
  longName: string
  slug: string
  icon: string
  groups?: string
  daysAhead: number
  hasDraw?: boolean
  athleteEvent?: boolean
  teaserSport?: 'football' | 'basketball'
  periods?: 'quarters' | 'halves' | 'periods' | 'innings' | 'none'
  competitionTabs?: boolean
}

export interface SportDef {
  id: string
  name: string
  icon: string
  leagues: string[]
}

const L = (l: Omit<LeagueDef, 'slug'> & { slug?: string }): LeagueDef => ({ slug: l.id, ...l })

export const LEAGUES: LeagueDef[] = [
  L({ id: 'nfl', sport: 'football', espnSport: 'football', espnLeague: 'nfl', name: 'NFL', longName: 'NFL', icon: 'nfl', daysAhead: 8, teaserSport: 'football', periods: 'quarters' }),
  L({ id: 'ncaaf', sport: 'football', espnSport: 'football', espnLeague: 'college-football', name: 'NCAAF', longName: 'College Football', icon: 'ncaaf', groups: '80', daysAhead: 8, teaserSport: 'football', periods: 'quarters' }),
  L({ id: 'cfl', sport: 'football', espnSport: 'football', espnLeague: 'cfl', name: 'CFL', longName: 'CFL', icon: 'cfl', daysAhead: 8, teaserSport: 'football', periods: 'quarters' }),
  L({ id: 'ufl', sport: 'football', espnSport: 'football', espnLeague: 'ufl', name: 'UFL', longName: 'UFL', icon: 'football', daysAhead: 8, teaserSport: 'football', periods: 'quarters' }),
  L({ id: 'nba', sport: 'basketball', espnSport: 'basketball', espnLeague: 'nba', name: 'NBA', longName: 'NBA', icon: 'nba', daysAhead: 4, teaserSport: 'basketball', periods: 'quarters' }),
  L({ id: 'wnba', sport: 'basketball', espnSport: 'basketball', espnLeague: 'wnba', name: 'WNBA', longName: 'WNBA', icon: 'wnba', daysAhead: 4, teaserSport: 'basketball', periods: 'quarters' }),
  L({ id: 'ncaab', sport: 'basketball', espnSport: 'basketball', espnLeague: 'mens-college-basketball', name: 'NCAAB', longName: "Men's College Basketball", icon: 'ncaab', groups: '50', daysAhead: 3, teaserSport: 'basketball', periods: 'halves' }),
  L({ id: 'ncaaw', sport: 'basketball', espnSport: 'basketball', espnLeague: 'womens-college-basketball', name: 'NCAAW', longName: "Women's College Basketball", icon: 'ncaaw', groups: '50', daysAhead: 3, teaserSport: 'basketball', periods: 'quarters' }),
  L({ id: 'mlb', sport: 'baseball', espnSport: 'baseball', espnLeague: 'mlb', name: 'MLB', longName: 'MLB', icon: 'mlb', daysAhead: 3, periods: 'innings' }),
  L({ id: 'nhl', sport: 'hockey', espnSport: 'hockey', espnLeague: 'nhl', name: 'NHL', longName: 'NHL', icon: 'nhl', daysAhead: 4, periods: 'periods' }),
  L({ id: 'epl', sport: 'soccer', espnSport: 'soccer', espnLeague: 'eng.1', name: 'Premier League', longName: 'English Premier League', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'laliga', sport: 'soccer', espnSport: 'soccer', espnLeague: 'esp.1', name: 'La Liga', longName: 'Spanish La Liga', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'seriea', sport: 'soccer', espnSport: 'soccer', espnLeague: 'ita.1', name: 'Serie A', longName: 'Italian Serie A', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'bundesliga', sport: 'soccer', espnSport: 'soccer', espnLeague: 'ger.1', name: 'Bundesliga', longName: 'German Bundesliga', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'ligue1', sport: 'soccer', espnSport: 'soccer', espnLeague: 'fra.1', name: 'Ligue 1', longName: 'French Ligue 1', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'mls', sport: 'soccer', espnSport: 'soccer', espnLeague: 'usa.1', name: 'MLS', longName: 'Major League Soccer', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'ucl', sport: 'soccer', espnSport: 'soccer', espnLeague: 'uefa.champions', name: 'Champions League', longName: 'UEFA Champions League', icon: 'soccer', daysAhead: 10, hasDraw: true, periods: 'halves' }),
  L({ id: 'uel', sport: 'soccer', espnSport: 'soccer', espnLeague: 'uefa.europa', name: 'Europa League', longName: 'UEFA Europa League', icon: 'soccer', daysAhead: 10, hasDraw: true, periods: 'halves' }),
  L({ id: 'ligamx', sport: 'soccer', espnSport: 'soccer', espnLeague: 'mex.1', name: 'Liga MX', longName: 'Mexican Liga MX', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'eredivisie', sport: 'soccer', espnSport: 'soccer', espnLeague: 'ned.1', name: 'Eredivisie', longName: 'Dutch Eredivisie', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'primeira', sport: 'soccer', espnSport: 'soccer', espnLeague: 'por.1', name: 'Primeira Liga', longName: 'Portuguese Primeira Liga', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'championship', sport: 'soccer', espnSport: 'soccer', espnLeague: 'eng.2', name: 'EFL Championship', longName: 'English Championship', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'facup', sport: 'soccer', espnSport: 'soccer', espnLeague: 'eng.fa', name: 'FA Cup', longName: 'English FA Cup', icon: 'soccer', daysAhead: 10, hasDraw: true, periods: 'halves' }),
  L({ id: 'nwsl', sport: 'soccer', espnSport: 'soccer', espnLeague: 'usa.nwsl', name: 'NWSL', longName: 'NWSL', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'saudi', sport: 'soccer', espnSport: 'soccer', espnLeague: 'ksa.1', name: 'Saudi Pro League', longName: 'Saudi Pro League', icon: 'soccer', daysAhead: 8, hasDraw: true, periods: 'halves' }),
  L({ id: 'ufc', sport: 'mma', espnSport: 'mma', espnLeague: 'ufc', name: 'UFC', longName: 'UFC', icon: 'ufc', daysAhead: 14, athleteEvent: true, periods: 'none' }),
  L({ id: 'atp', sport: 'tennis', espnSport: 'tennis', espnLeague: 'atp', name: 'ATP', longName: 'ATP Tour', icon: 'tennis', daysAhead: 3, athleteEvent: true, periods: 'none' }),
  L({ id: 'wta', sport: 'tennis', espnSport: 'tennis', espnLeague: 'wta', name: 'WTA', longName: 'WTA Tour', icon: 'tennis', daysAhead: 3, athleteEvent: true, periods: 'none' }),
  L({ id: 'pga', sport: 'golf', espnSport: 'golf', espnLeague: 'pga', name: 'PGA Tour', longName: 'PGA Tour', icon: 'golf', daysAhead: 7, athleteEvent: true, periods: 'none' }),
  L({ id: 'lpga', sport: 'golf', espnSport: 'golf', espnLeague: 'lpga', name: 'LPGA', longName: 'LPGA Tour', icon: 'golf', daysAhead: 7, athleteEvent: true, periods: 'none' }),
  L({ id: 'f1', sport: 'racing', espnSport: 'racing', espnLeague: 'f1', name: 'Formula 1', longName: 'Formula 1', icon: 'racing', daysAhead: 10, athleteEvent: true, periods: 'none' }),
  L({ id: 'nascar', sport: 'racing', espnSport: 'racing', espnLeague: 'nascar-premier', name: 'NASCAR', longName: 'NASCAR Cup Series', icon: 'racing', daysAhead: 10, athleteEvent: true, periods: 'none' }),
]

export const LEAGUE_BY_ID: Record<string, LeagueDef> = Object.fromEntries(LEAGUES.map((l) => [l.id, l]))

export const SPORTS: SportDef[] = [
  { id: 'football', name: 'Football', icon: 'football', leagues: ['nfl', 'ncaaf', 'cfl', 'ufl'] },
  { id: 'basketball', name: 'Basketball', icon: 'basketball', leagues: ['nba', 'wnba', 'ncaab', 'ncaaw'] },
  { id: 'baseball', name: 'Baseball', icon: 'baseball', leagues: ['mlb'] },
  { id: 'hockey', name: 'Hockey', icon: 'hockey', leagues: ['nhl'] },
  { id: 'soccer', name: 'Soccer', icon: 'soccer', leagues: ['epl', 'ucl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'mls', 'uel', 'ligamx', 'eredivisie', 'primeira', 'championship', 'facup', 'nwsl', 'saudi'] },
  { id: 'mma', name: 'MMA', icon: 'ufc', leagues: ['ufc'] },
  { id: 'tennis', name: 'Tennis', icon: 'tennis', leagues: ['atp', 'wta'] },
  { id: 'golf', name: 'Golf', icon: 'golf', leagues: ['pga', 'lpga'] },
  { id: 'racing', name: 'Motor Racing', icon: 'racing', leagues: ['f1', 'nascar'] },
]

export const SPORT_BY_ID: Record<string, SportDef> = Object.fromEntries(SPORTS.map((s) => [s.id, s]))

/** Sidebar "Popular" order, mirroring the real sportsbook. */
export const POPULAR_NAV: { id: string; label: string; icon: string; to: string }[] = [
  { id: 'live', label: 'Live now', icon: 'live', to: '/live' },
  { id: 'rewards', label: 'Rewards', icon: 'rewards', to: '/rewards' },
  { id: 'nfl', label: 'NFL', icon: 'nfl', to: '/navigation/nfl' },
  { id: 'ncaaf', label: 'NCAAF', icon: 'ncaaf', to: '/navigation/ncaaf' },
  { id: 'mlb', label: 'MLB', icon: 'mlb', to: '/navigation/mlb' },
  { id: 'nba', label: 'NBA', icon: 'nba', to: '/navigation/nba' },
  { id: 'nhl', label: 'NHL', icon: 'nhl', to: '/navigation/nhl' },
  { id: 'ncaab', label: 'NCAAB', icon: 'ncaab', to: '/navigation/ncaab' },
  { id: 'soccer', label: 'Soccer', icon: 'soccer', to: '/navigation/soccer' },
  { id: 'tennis', label: 'Tennis', icon: 'tennis', to: '/navigation/tennis' },
  { id: 'wnba', label: 'WNBA', icon: 'wnba', to: '/navigation/wnba' },
  { id: 'pga', label: 'PGA Tour', icon: 'golf', to: '/navigation/pga' },
  { id: 'ufc', label: 'UFC', icon: 'ufc', to: '/navigation/ufc' },
  { id: 'ncaaw', label: 'NCAAW', icon: 'ncaaw', to: '/navigation/ncaaw' },
  { id: 'parlay-hub', label: 'Parlay Hub', icon: 'parlayhub', to: '/parlay-hub' },
  { id: 'promos', label: 'Promotions', icon: 'promos', to: '/promotions' },
  { id: 'casino', label: 'Casino', icon: 'casino', to: '/casino' },
  { id: 'racing', label: 'Racing', icon: 'racebook', to: '/racing' },
  { id: 'learn', label: 'Learn to Bet', icon: 'learn', to: '/learn' },
]

/** Home page sport chip tabs order. */
export const HOME_CHIPS = ['nfl', 'mlb', 'nba', 'nhl', 'wnba', 'soccer', 'ncaaf', 'ufc']

/** Mobile icon carousel order. */
export const MOBILE_ICON_ROW: { id: string; label: string; icon: string; to: string }[] = [
  { id: 'live', label: 'Live now', icon: 'live', to: '/live' },
  { id: 'rewards', label: 'Rewards', icon: 'rewards', to: '/rewards' },
  { id: 'nfl', label: 'NFL', icon: 'nfl', to: '/navigation/nfl' },
  { id: 'ncaaf', label: 'NCAAF', icon: 'ncaaf', to: '/navigation/ncaaf' },
  { id: 'mlb', label: 'MLB', icon: 'mlb', to: '/navigation/mlb' },
  { id: 'nba', label: 'NBA', icon: 'nba', to: '/navigation/nba' },
  { id: 'nhl', label: 'NHL', icon: 'nhl', to: '/navigation/nhl' },
  { id: 'ncaab', label: 'NCAAB', icon: 'ncaab', to: '/navigation/ncaab' },
  { id: 'soccer', label: 'Soccer', icon: 'soccer', to: '/navigation/soccer' },
  { id: 'tennis', label: 'Tennis', icon: 'tennis', to: '/navigation/tennis' },
  { id: 'wnba', label: 'WNBA', icon: 'wnba', to: '/navigation/wnba' },
  { id: 'pga', label: 'PGA Tour', icon: 'golf', to: '/navigation/pga' },
  { id: 'ufc', label: 'UFC', icon: 'ufc', to: '/navigation/ufc' },
  { id: 'ncaaw', label: 'NCAAW', icon: 'ncaaw', to: '/navigation/ncaaw' },
  { id: 'parlay-hub', label: 'Parlay Hub', icon: 'parlayhub', to: '/parlay-hub' },
  { id: 'promos', label: 'Promos', icon: 'promos', to: '/promotions' },
  { id: 'casino', label: 'Casino', icon: 'casino', to: '/casino' },
  { id: 'racing', label: 'Racing', icon: 'racebook', to: '/racing' },
]

/** Navigation slug (used in /navigation/:slug) → league ids or a sport id. */
export function resolveNavSlug(slug: string): { kind: 'league'; league: LeagueDef } | { kind: 'sport'; sport: SportDef } | null {
  if (LEAGUE_BY_ID[slug]) return { kind: 'league', league: LEAGUE_BY_ID[slug] }
  if (SPORT_BY_ID[slug]) return { kind: 'sport', sport: SPORT_BY_ID[slug] }
  return null
}

export function leaguesForSport(sportId: string): LeagueDef[] {
  return (SPORT_BY_ID[sportId]?.leagues ?? []).map((id) => LEAGUE_BY_ID[id])
}
