/** FanDuel-exact catalog dispatch: one builder per sport, plus FanDuel's tab order for each. */
import type { LeagueDef } from '@/data/sports'
import type { Market } from '../types'
import { MLB_TABS, buildBaseball } from './baseball'
import { NBA_TABS, buildBasketball } from './basketball'
import { TAB, type Ctx } from './common'
import { FIGHT_TABS, buildFight } from './fight'
import { NCAAF_TABS, NFL_TABS, buildFootball } from './football'
import { NHL_TABS, buildHockey } from './hockey'
import { SOCCER_TABS, buildSoccer } from './soccer'

export { makeCtx } from './common'

export function buildCatalog(ctx: Ctx): Market[] {
  switch (ctx.league.sport) {
    case 'football':
      return buildFootball(ctx)
    case 'basketball':
      return buildBasketball(ctx)
    case 'hockey':
      return buildHockey(ctx)
    case 'baseball':
      return buildBaseball(ctx)
    case 'soccer':
      return buildSoccer(ctx)
    case 'mma':
    case 'boxing':
      return buildFight(ctx)
    default:
      return []
  }
}

export function catalogTabs(league: LeagueDef): string[] {
  switch (league.sport) {
    case 'football':
      return league.id === 'nfl' ? NFL_TABS : NCAAF_TABS
    case 'basketball':
      return NBA_TABS
    case 'hockey':
      return NHL_TABS
    case 'baseball':
      return MLB_TABS
    case 'soccer':
      return SOCCER_TABS
    case 'mma':
    case 'boxing':
      return FIGHT_TABS
    default:
      return [TAB.POPULAR]
  }
}
