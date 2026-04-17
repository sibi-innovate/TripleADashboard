// awardHelpers.js — pure computation utilities for award rankings and MDRT/GAMA tracking
import { MONTH_ABBRS, ADVISOR_TIERS, MDRT_GOAL_DEFAULT } from '../constants'

// GAMA qualification tiers for unit manager tracking (annual unit YTD FYP)
export const GAMA_LEADER_TIERS = [
  { key: 'platinum', label: 'GAMA Platinum', min: 24000000 },
  { key: 'gold',     label: 'GAMA Gold',     min: 12000000 },
  { key: 'silver',   label: 'GAMA Silver',   min:  6000000 },
  { key: 'qualifying', label: 'GAMA Qualifying', min: 3000000 },
  { key: 'pre_gama', label: 'Pre-GAMA',      min: 0 },
]

// ─── Helper: get monthly FYP for a single agent
export function getAgentMonthFyp(agent, monthIdx) {
  if (!agent?.monthly) return 0
  return agent.monthly[MONTH_ABBRS[monthIdx]]?.fyp || 0
}

// ─── Helper: get YTD FYP for a single agent (Jan through upToMonthIdx inclusive)
export function getAgentYtdFyp(agent, upToMonthIdx) {
  if (!agent?.monthly) return 0
  return MONTH_ABBRS.slice(0, upToMonthIdx + 1).reduce(
    (sum, abbr) => sum + (agent.monthly[abbr]?.fyp || 0), 0
  )
}

// ─── Rank-based scoring for Top Rookies / Top Overall
// Returns array sorted by combinedScore desc, tied entries broken by monthly FYP desc
export function computeRankScore(agents, monthAbbr) {
  const active = agents.filter(a => a.manpowerInd)
  if (active.length === 0) return []

  // Compute raw metric values
  const withMetrics = active.map(a => ({
    agent: a,
    fyp:   a.monthly?.[monthAbbr]?.fyp   || 0,
    cases: a.monthly?.[monthAbbr]?.cases || 0,
    anp:   a.monthly?.[monthAbbr]?.anp   || 0,
  }))

  // Rank each metric (rank 1 = highest value; ties share the better rank)
  const rankBy = (arr, key) => {
    const sorted = [...arr].sort((a, b) => b[key] - a[key] || b.fyp - a.fyp)
    const rankMap = new Map()
    let rank = 1
    sorted.forEach((item, i) => {
      if (i > 0 && sorted[i][key] !== sorted[i - 1][key]) rank = i + 1
      rankMap.set(item.agent.code, rank)
    })
    return rankMap
  }

  const fypRanks   = rankBy(withMetrics, 'fyp')
  const caseRanks  = rankBy(withMetrics, 'cases')
  const anpRanks   = rankBy(withMetrics, 'anp')

  const scored = withMetrics.map(m => ({
    agent: m.agent,
    fyp:   m.fyp,
    cases: m.cases,
    anp:   m.anp,
    fypRank:  fypRanks.get(m.agent.code),
    caseRank: caseRanks.get(m.agent.code),
    anpRank:  anpRanks.get(m.agent.code),
    combinedScore:
      (1 / fypRanks.get(m.agent.code))   * 0.4 +
      (1 / caseRanks.get(m.agent.code))  * 0.4 +
      (1 / anpRanks.get(m.agent.code))   * 0.2,
  }))

  // Sort by combinedScore desc; tie-break by FYP desc
  return scored.sort((a, b) => b.combinedScore - a.combinedScore || b.fyp - a.fyp)
}

export function getTopRookies(agents, monthAbbr, n = 5) {
  const rookies = agents.filter(a => a.segment === 'Rookie')
  return computeRankScore(rookies, monthAbbr).slice(0, n)
}

export function getTopOverall(agents, monthAbbr, n = 5) {
  return computeRankScore(agents, monthAbbr).slice(0, n)
}

// ─── Most Trusted Advisors (MTA): monthly cases >= 2, sorted by cases desc, tie-break FYP
export function getMostTrustedAdvisors(agents, monthAbbr) {
  return agents
    .filter(a => a.manpowerInd && (a.monthly?.[monthAbbr]?.cases || 0) >= 2)
    .map(a => ({
      agent: a,
      cases: a.monthly[monthAbbr].cases,
      fyp:   a.monthly[monthAbbr]?.fyp || 0,
      fyc:   a.monthly[monthAbbr]?.fyc || 0,
    }))
    .sort((a, b) => b.cases - a.cases || b.fyp - a.fyp)
}

// ─── Most Productive Advisors (MPA): monthly FYC > 20000, sorted by FYC desc, tie-break FYP
export function getMostProductiveAdvisors(agents, monthAbbr) {
  return agents
    .filter(a => a.manpowerInd && (a.monthly?.[monthAbbr]?.fyc || 0) > 20000)
    .map(a => ({
      agent: a,
      fyc:   a.monthly[monthAbbr].fyc,
      fyp:   a.monthly[monthAbbr]?.fyp || 0,
      cases: a.monthly[monthAbbr]?.cases || 0,
    }))
    .sort((a, b) => b.fyc - a.fyc || b.fyp - a.fyp)
}

// ─── Consistent Monthly Producers
// gapFreeOnly=true: produced every month Jan through upToMonthIdx (no gaps)
// gapFreeOnly=false: all producers sorted by producingMonths count desc
export function getConsistentProducers(agents, upToMonthIdx, gapFreeOnly = true) {
  const abbrs = MONTH_ABBRS.slice(0, upToMonthIdx + 1)
  const totalMonths = abbrs.length

  const result = agents
    .filter(a => a.manpowerInd)
    .map(a => {
      const producingMonths = abbrs.filter(
        abbr => (a.monthly?.[abbr]?.cases || 0) > 0
      ).length
      return { agent: a, producingMonths, totalMonths }
    })
    .filter(r => r.producingMonths > 0)

  if (gapFreeOnly) {
    return result
      .filter(r => r.producingMonths === r.totalMonths)
      .sort((a, b) => b.producingMonths - a.producingMonths ||
        (b.agent.monthly?.[MONTH_ABBRS[upToMonthIdx]]?.fyp || 0) -
        (a.agent.monthly?.[MONTH_ABBRS[upToMonthIdx]]?.fyp || 0))
  }
  return result.sort((a, b) => b.producingMonths - a.producingMonths ||
    (b.agent.monthly?.[MONTH_ABBRS[upToMonthIdx]]?.fyp || 0) -
    (a.agent.monthly?.[MONTH_ABBRS[upToMonthIdx]]?.fyp || 0))
}

// ─── Agency Builders: per recruiter, count new recruits in the month
export function getAgencyBuilders(agents, monthAbbr) {
  const recruiterMap = new Map()

  agents.forEach(a => {
    if (!a.manpowerInd || !a.monthly?.[monthAbbr]?.isNewRecruit) return
    const rCode = a.recruiterCode || '__UNKNOWN__'
    const rName = a.recruiterName || 'Unknown'
    if (!recruiterMap.has(rCode)) {
      recruiterMap.set(rCode, { recruiterCode: rCode, recruiterName: rName, count: 0, recruits: [] })
    }
    const entry = recruiterMap.get(rCode)
    entry.count++
    entry.recruits.push(a.name)
  })

  return Array.from(recruiterMap.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      // tie-break: recruiter's own FYP for the month
      const aFyp = agents.find(ag => ag.code === a.recruiterCode)?.monthly?.[monthAbbr]?.fyp || 0
      const bFyp = agents.find(ag => ag.code === b.recruiterCode)?.monthly?.[monthAbbr]?.fyp || 0
      return bFyp - aFyp
    })
}

// ─── Unit Awards: top units by FYP, recruitment, producing advisors, and case count
export function getUnitAwards(agents, monthAbbr) {
  const unitMap = new Map()

  agents.filter(a => a.manpowerInd).forEach(a => {
    const key = a.unitCode || '__UNASSIGNED__'
    if (!unitMap.has(key)) {
      unitMap.set(key, {
        unitCode:  a.unitCode,
        unitName:  a.unitName || a.unitCode || 'Unassigned',
        fyp:       0,
        newRecruits: 0,
        producing: 0,
        cases:     0,
      })
    }
    const u = unitMap.get(key)
    u.fyp         += a.monthly?.[monthAbbr]?.fyp   || 0
    u.cases       += a.monthly?.[monthAbbr]?.cases || 0
    if (a.monthly?.[monthAbbr]?.producing)     u.producing++
    if (a.monthly?.[monthAbbr]?.isNewRecruit)  u.newRecruits++
  })

  const units = Array.from(unitMap.values())

  // Only include units that actually have a non-zero value in the metric being awarded
  const topByFyp         = [...units].filter(u => u.fyp         > 0).sort((a, b) => b.fyp         - a.fyp         || b.cases - a.cases).slice(0, 3)
  const topByRecruitment = [...units].filter(u => u.newRecruits > 0).sort((a, b) => b.newRecruits  - a.newRecruits  || b.fyp   - a.fyp).slice(0, 3)
  const topByProducing   = [...units].filter(u => u.producing   > 0).sort((a, b) => b.producing    - a.producing    || b.fyp   - a.fyp).slice(0, 3)
  const topByCases       = [...units].filter(u => u.cases       > 0).sort((a, b) => b.cases        - a.cases        || b.fyp   - a.fyp).slice(0, 3)

  return { topByFyp, topByRecruitment, topByProducing, topByCases }
}

// ─── Path to MDRT: all manpower agents with their tier and balance
export function getPathToMdrt(agents, upToMonthIdx, mdrtGoal = MDRT_GOAL_DEFAULT) {
  // Tier thresholds: the FYP % needed to ENTER the next tier
  const NEXT_TIER_PCT = {
    sa:           0.30,
    la:           0.50,
    pa:           0.70,
    mdrt_aspirant: 1.00,
    mdrt_achiever: null, // already at top
    newly_coded:  0.30,
  }

  return agents
    .filter(a => a.manpowerInd)
    .map(a => {
      const ytdFyp = getAgentYtdFyp(a, upToMonthIdx)
      const pct    = mdrtGoal > 0 ? ytdFyp / mdrtGoal : 0
      const tier   = ADVISOR_TIERS.find(t => {
        if (t.minPct === null) return false
        if (t.maxPct === null) return pct >= t.minPct
        return pct >= t.minPct && pct < t.maxPct
      }) ?? ADVISOR_TIERS.find(t => t.key === 'sa')

      const nextPct       = NEXT_TIER_PCT[tier.key]
      const balanceToNext = nextPct != null
        ? Math.max(0, nextPct * mdrtGoal - ytdFyp)
        : 0

      return { agent: a, tier, ytdFyp, pct, balanceToNext }
    })
    .sort((a, b) => b.pct - a.pct)
}

// ─── Leader GAMA Progress: group agents by unit, compute YTD unit FYP
export function getLeaderGamaProgress(agents, upToMonthIdx) {
  const unitMap = new Map()
  const abbrs   = MONTH_ABBRS.slice(0, upToMonthIdx + 1)

  agents.filter(a => a.manpowerInd).forEach(a => {
    const key = a.unitCode || '__UNASSIGNED__'
    if (!unitMap.has(key)) {
      unitMap.set(key, { unitCode: a.unitCode, unitName: a.unitName || key, ytdFyp: 0 })
    }
    const u = unitMap.get(key)
    abbrs.forEach(abbr => { u.ytdFyp += a.monthly?.[abbr]?.fyp || 0 })
  })

  return Array.from(unitMap.values())
    .map(u => {
      const tier     = GAMA_LEADER_TIERS.find(t => u.ytdFyp >= t.min) ?? GAMA_LEADER_TIERS[GAMA_LEADER_TIERS.length - 1]
      const tierIdx  = GAMA_LEADER_TIERS.indexOf(tier)
      const nextTier = tierIdx > 0 ? GAMA_LEADER_TIERS[tierIdx - 1] : null
      const balance  = nextTier ? Math.max(0, nextTier.min - u.ytdFyp) : 0
      return { ...u, tier, nextTier, balance }
    })
    .sort((a, b) => b.ytdFyp - a.ytdFyp)
}

// ─── Agency GAMA Status: total agency YTD FYP vs tiers
export function getAgencyGamaStatus(agents, upToMonthIdx) {
  const abbrs  = MONTH_ABBRS.slice(0, upToMonthIdx + 1)
  const totalFyp = agents
    .filter(a => a.manpowerInd)
    .reduce((sum, a) => {
      abbrs.forEach(abbr => { sum += a.monthly?.[abbr]?.fyp || 0 })
      return sum
    }, 0)

  const tier     = GAMA_LEADER_TIERS.find(t => totalFyp >= t.min) ?? GAMA_LEADER_TIERS[GAMA_LEADER_TIERS.length - 1]
  const tierIdx  = GAMA_LEADER_TIERS.indexOf(tier)
  const nextTier = tierIdx > 0 ? GAMA_LEADER_TIERS[tierIdx - 1] : null
  const balance  = nextTier ? Math.max(0, nextTier.min - totalFyp) : 0

  return { totalFyp, tier, nextTier, balance }
}
