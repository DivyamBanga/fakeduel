export type OddsFormat = 'american' | 'decimal' | 'fractional'
export type EventState = 'pre' | 'in' | 'post'

export interface Team {
  id: string
  abbreviation: string
  name: string
  displayName: string
  shortDisplayName: string
  location?: string
  logo?: string
  color?: string
  altColor?: string
  record?: string
}

export interface Competitor {
  team: Team
  homeAway: 'home' | 'away'
  score: number
  winner?: boolean
  linescores?: number[]
}

export interface EventStatus {
  state: EventState
  completed: boolean
  period: number
  clock: string
  detail: string
  shortDetail: string
  name: string
}

export interface GameSituation {
  possessionTeamId?: string
  downDistanceText?: string
  lastPlay?: string
  isRedZone?: boolean
  balls?: number
  strikes?: number
  outs?: number
  onFirst?: boolean
  onSecond?: boolean
  onThird?: boolean
}

export interface GameLines {
  provider: string
  synthesized: boolean
  spread?: number
  homeSpreadOdds?: number
  awaySpreadOdds?: number
  homeML?: number
  awayML?: number
  drawML?: number
  total?: number
  overOdds?: number
  underOdds?: number
}

export interface GameEvent {
  id: string
  leagueId: string
  sport: string
  name: string
  shortName: string
  date: string
  status: EventStatus
  home: Competitor
  away: Competitor
  neutralSite?: boolean
  venue?: string
  broadcast?: string
  lines?: GameLines
  situation?: GameSituation
  weekText?: string
  isAthleteEvent?: boolean
  groupName?: string
  probables?: { teamId: string; athleteId: string; name: string }[]
}

export type MarketGroup = 'popular' | 'game' | 'props' | 'td' | 'team' | 'periods' | 'alt' | 'specials' | 'futures'
export type MarketKind =
  | 'moneyline' | 'spread' | 'total' | 'three_way' | 'draw_no_bet'
  | 'prop_ou' | 'prop_ladder' | 'prop_yesno' | 'scorer' | 'team_total'
  | 'period_ml' | 'period_spread' | 'period_total' | 'alt_spread' | 'alt_total'
  | 'btts' | 'overtime' | 'winning_margin' | 'futures'
  | 'double_chance' | 'correct_score' | 'card' | 'double_double'

export type GradingKind =
  | 'moneyline' | 'spread' | 'total' | 'team_total' | 'draw' | 'draw_no_bet'
  | 'player_stat' | 'player_ladder' | 'td_scorer' | 'first_td' | 'last_td' | 'multi_td'
  | 'period_ml' | 'period_spread' | 'period_total' | 'btts' | 'overtime' | 'futures' | 'winning_margin'
  | 'double_chance' | 'correct_score' | 'card' | 'double_double' | 'manual'

export type Side = 'home' | 'away' | 'draw' | 'over' | 'under' | 'yes' | 'no'

export interface Grading {
  kind: GradingKind
  side?: Side
  teamId?: string
  line?: number
  period?: string
  statKey?: string
  playerId?: string
  count?: number
  futureId?: string
  rangeLow?: number
  rangeHigh?: number
  playerName?: string
  homeGoals?: number
  awayGoals?: number
  dc?: 'home_draw' | 'away_draw' | 'home_away'
}

export interface Selection {
  id: string
  marketId: string
  eventId: string
  leagueId: string
  label: string
  sub?: string
  line?: number
  odds: number
  grading: Grading
  playerId?: string
  teamId?: string
  suspended?: boolean
}

export interface Market {
  id: string
  eventId: string
  leagueId: string
  name: string
  group: MarketGroup
  kind: MarketKind
  selections: Selection[]
  playerId?: string
  playerName?: string
  playerTeamId?: string
  playerPosition?: string
  headshot?: string
  line?: number
  sgp: boolean
  layout: 'two-col' | 'three-col' | 'list' | 'ladder' | 'grid'
  sortOrder?: number
  category?: string
  priced?: 'fanduel' | 'model'
}

export type BetType = 'single' | 'parlay' | 'sgp' | 'sgp_plus' | 'round_robin' | 'teaser'
export type BetStatus = 'open' | 'won' | 'lost' | 'push' | 'void' | 'cashed_out'

export interface BetLeg {
  selectionId: string
  marketId: string
  eventId: string
  leagueId: string
  sport: string
  eventName: string
  startTime: string
  marketName: string
  selectionLabel: string
  odds: number
  line?: number
  grading: Grading
  status: BetStatus
  resultText?: string
  live?: boolean
  homeAbbr?: string
  awayAbbr?: string
  homeName?: string
  awayName?: string
  score?: string
  playerId?: string
  teamId?: string
  isSgp?: boolean
}

export interface Bet {
  id: string
  placedAt: string
  type: BetType
  legs: BetLeg[]
  stake: number
  odds: number
  toWin: number
  potentialPayout: number
  status: BetStatus
  settledAt?: string
  payout?: number
  boostPct?: number
  noSweat?: boolean
  bonusBet?: boolean
  cashOutValue?: number
  cashedOutAt?: string
  teaserPoints?: number
  rrSize?: number
  rrCombos?: number
  rrCombosWon?: number
  title: string
  rewardsPoints?: number
  betId: string
  live?: boolean
  eventId?: string
  sgpGroups?: string[][]
}

export type TransactionType = 'deposit' | 'withdrawal' | 'bet' | 'payout' | 'cashout' | 'refund' | 'bonus' | 'adjustment'

export interface Transaction {
  id: string
  at: string
  type: TransactionType
  amount: number
  balanceAfter: number
  description: string
  betId?: string
}

export type TokenKind = 'profit_boost' | 'no_sweat' | 'bonus_bet'
export interface PromoToken {
  id: string
  kind: TokenKind
  pct?: number
  amount?: number
  maxWager?: number
  maxBonus?: number
  minLegs?: number
  minOdds?: number
  appliesTo: 'any' | 'parlay' | 'sgp' | 'live' | 'sport'
  leagueId?: string
  expiresAt: string
  title: string
  description: string
  used?: boolean
  usedAt?: string
  betId?: string
}

export interface Future {
  id: string
  leagueId: string
  sport: string
  name: string
  entries: FutureEntry[]
}

export interface FutureEntry {
  id: string
  label: string
  odds: number
  teamId?: string
  athleteId?: string
  logo?: string
}

export interface AthleteInfo {
  id: string
  name: string
  shortName?: string
  position?: string
  jersey?: string
  headshot?: string
  teamId?: string
  status?: string
}
