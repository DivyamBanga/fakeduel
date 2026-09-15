/** FanDuel UFC / boxing fight catalog: moneyline, method of victory, rounds, distance. */
import { priceFromProb } from '../odds'
import type { Market } from '../types'
import { TAB, add, mkm, yesNo, type Ctx } from './common'

export const FIGHT_TABS = [TAB.POPULAR, TAB.METHOD, TAB.ROUNDS]

export function buildFight(ctx: Ctx): Market[] {
  const { ev, lines, league } = ctx
  const out: Market[] = []
  if (lines.homeML === undefined || lines.awayML === undefined) return out
  const a = ev.away
  const h = ev.home
  const ia = 1 / (1 + Math.abs(lines.awayML) / 100) * (lines.awayML < 0 ? Math.abs(lines.awayML) / 100 + 1 : 1)
  const ih = 1 / (1 + Math.abs(lines.homeML) / 100) * (lines.homeML < 0 ? Math.abs(lines.homeML) / 100 + 1 : 1)
  const pA = ia / (ia + ih)
  const pH = 1 - pA
  const boxing = league.id === 'boxing'
  const rounds = boxing ? 12 : 3
  const ml = mkm(ctx, 'ml', 'Moneyline', { tabs: [TAB.POPULAR], group: 'game', kind: 'moneyline', sort: 1, fdType: boxing ? 'HEAD_TO_HEAD' : 'MONEY_LINE' })
  add(ml, 'away', a.team.displayName, lines.awayML, { kind: 'moneyline', side: 'away', teamId: a.team.id }, { teamId: a.team.id })
  add(ml, 'home', h.team.displayName, lines.homeML, { kind: 'moneyline', side: 'home', teamId: h.team.id }, { teamId: h.team.id })
  out.push(ml)
  // finish rates: MMA ≈ 55% finishes, boxing ≈ 45%
  const pFinish = boxing ? 0.45 : 0.56
  const mov = mkm(ctx, 'method', 'Method of Victory', { tabs: [TAB.POPULAR, TAB.METHOD], group: 'specials', kind: 'special', layout: 'list', sort: 2, category: 'Method of Victory', fdType: 'METHOD_OF_VICTORY' })
  for (const [c, p] of [[a, pA], [h, pH]] as const) {
    const koShare = boxing ? 1 : 0.6
    add(mov, `${c.team.id}|KO`, `${c.team.displayName} by KO/TKO${boxing ? '' : '/DQ'}`, priceFromProb(p * pFinish * koShare, 0.09), { kind: 'method', teamId: c.team.id, label: 'KO' }, { teamId: c.team.id })
    if (!boxing) add(mov, `${c.team.id}|SUB`, `${c.team.displayName} by Submission`, priceFromProb(p * pFinish * 0.4, 0.09), { kind: 'method', teamId: c.team.id, label: 'SUB' }, { teamId: c.team.id })
    add(mov, `${c.team.id}|DEC`, `${c.team.displayName} by Decision${boxing ? ' or Technical Decision' : ''}`, priceFromProb(p * (1 - pFinish), 0.09), { kind: 'method', teamId: c.team.id, label: 'DEC' }, { teamId: c.team.id })
  }
  add(mov, 'draw', boxing ? 'Draw or Technical Draw' : 'Draw or No Contest', priceFromProb(0.02, 0.09), { kind: 'method', label: 'DRAW' })
  mov.selections.sort((x, y) => x.odds - y.odds)
  out.push(mov)
  out.push(yesNo(ctx, 'distance', 'Fight To Go The Distance', 1 - pFinish, 0.06, { tabs: [TAB.POPULAR, TAB.ROUNDS], group: 'specials', sort: 3, category: 'Round Betting', fdType: 'FIGHT_TO_GO_THE_DISTANCE' }, { kind: 'distance' }))
  const line = boxing ? 8.5 : 2.5
  const pOver = boxing ? 1 - pFinish * 0.6 : 1 - pFinish * 0.72
  const tr = mkm(ctx, 'rounds', 'Total Rounds', { tabs: [TAB.POPULAR, TAB.ROUNDS], group: 'specials', kind: 'prop_ou', sort: 4, category: 'Round Betting', line, fdType: 'TOTAL_ROUNDS' })
  add(tr, 'over', `Over ${line}`, priceFromProb(pOver, 0.06), { kind: 'rounds', side: 'over', line }, { line })
  add(tr, 'under', `Under ${line}`, priceFromProb(1 - pOver, 0.06), { kind: 'rounds', side: 'under', line }, { line })
  out.push(tr)
  const rb = mkm(ctx, 'round_betting', 'Round Betting', { tabs: [TAB.ROUNDS], group: 'specials', kind: 'special', layout: 'grid', sort: 5, category: 'Round Betting', fdType: 'ROUND_BETTING' })
  const step = boxing ? 3 : 1
  for (const [c, p] of [[a, pA], [h, pH]] as const) {
    for (let r = 1; r <= rounds; r += step) {
      const hi = Math.min(rounds, r + step - 1)
      const share = (pFinish / rounds) * (hi - r + 1) * (r === 1 ? 1.25 : 1)
      add(rb, `${c.team.id}|${r}`, `${c.team.displayName} in Round${step > 1 ? `s ${r}-${hi}` : ` ${r}`}`, priceFromProb(p * share, 0.1), { kind: 'rounds', teamId: c.team.id, rangeLow: r, rangeHigh: hi, label: 'win' }, { teamId: c.team.id })
    }
    add(rb, `${c.team.id}|dec`, `${c.team.displayName} by Decision`, priceFromProb(p * (1 - pFinish), 0.1), { kind: 'method', teamId: c.team.id, label: 'DEC' }, { teamId: c.team.id })
  }
  out.push(rb)
  return out
}
