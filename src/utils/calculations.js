import {
  MONTH_ABBRS,
  FYC_TIERS,
  ROOKIE_TIER,
  CCB_TIERS,
  PERSISTENCY_TIERS,
  ADVISOR_TIERS,
  MDRT_GOAL_DEFAULT,
  QUARTERS,
} from '../constants.js'

// ─── YTD AGGREGATIONS ──────────────────────────────────────────────────────────

/**
 * Get YTD FYP for an agent up to (and including) the given month index (0-based).
 * Uses agent.monthly[ABBR].fyp for each month.
 */
export function getAgentYtdFyp(agent, upToMonthIdx) {
  let total = 0
  for (let i = 0; i <= upToMonthIdx; i++) {
    total += agent.monthly?.[MONTH_ABBRS[i]]?.fyp || 0
  }
  return total
}

/**
 * Get YTD FYC for an agent up to (and including) the given month index (0-based).
 */
export function getAgentYtdFyc(agent, upToMonthIdx) {
  let total = 0
  for (let i = 0; i <= upToMonthIdx; i++) {
    total += agent.monthly?.[MONTH_ABBRS[i]]?.fyc || 0
  }
  return total
}

/**
 * Get YTD ANP for an agent up to (and including) the given month index (0-based).
 */
export function getAgentYtdAnp(agent, upToMonthIdx) {
  let total = 0
  for (let i = 0; i <= upToMonthIdx; i++) {
    total += agent.monthly?.[MONTH_ABBRS[i]]?.anp || 0
  }
  return total
}

/**
 * Get YTD cases for an agent up to (and including) the given month index (0-based).
 */
export function getAgentYtdCases(agent, upToMonthIdx) {
  let total = 0
  for (let i = 0; i <= upToMonthIdx; i++) {
    total += agent.monthly?.[MONTH_ABBRS[i]]?.cases || 0
  }
  return total
}

/**
 * Get YTD producing months count (months where cases > 0) up to monthIdx.
 */
export function getAgentYtdProducingMonths(agent, upToMonthIdx) {
  let count = 0
  for (let i = 0; i <= upToMonthIdx; i++) {
    if ((agent.monthly?.[MONTH_ABBRS[i]]?.cases || 0) > 0) count++
  }
  return count
}

// ─── QUARTERLY CALCULATIONS ────────────────────────────────────────────────────

/**
 * Get quarterly FYC for a quarter number (1-4).
 * Returns sum of FYC for the 3 months in that quarter.
 */
export function getQuarterlyFyc(agent, quarter) {
  const abbrs = QUARTERS[quarter] ?? []
  return abbrs.reduce((sum, abbr) => sum + (agent.monthly?.[abbr]?.fyc || 0), 0)
}

/**
 * Get quarterly cases for a quarter number (1-4).
 */
export function getQuarterlyCases(agent, quarter) {
  const abbrs = QUARTERS[quarter] ?? []
  return abbrs.reduce((sum, abbr) => sum + (agent.monthly?.[abbr]?.cases || 0), 0)
}

/**
 * Get which months in the quarter the agent produced (for CCB 2-month rule).
 * Returns count of months with cases > 0 in the quarter.
 */
export function getQuarterActiveMonths(agent, quarter) {
  const abbrs = QUARTERS[quarter] ?? []
  return abbrs.filter(abbr => (agent.monthly?.[abbr]?.cases || 0) > 0).length
}

// ─── BONUS CALCULATIONS ────────────────────────────────────────────────────────

/**
 * Get FYC bonus tier for a given quarterly FYC amount.
 * For rookies (isRookie === true), the ₱20K-₱29K tier also qualifies.
 * Returns { rate, label, min }
 */
export function getFycTier(qtlyFyc, isRookie = false) {
  if (isRookie && qtlyFyc >= ROOKIE_TIER.min && qtlyFyc < 30000) return ROOKIE_TIER
  return FYC_TIERS.find(t => qtlyFyc >= t.min) ?? FYC_TIERS[FYC_TIERS.length - 1]
}

/**
 * Get CCB (Case Count Bonus) tier for a given case count.
 * Only applies if agent produced in ≥2 months of the quarter.
 * Returns { rate, label, min }
 */
export function getCcbTier(cases, activeMonths) {
  if (activeMonths < 2) return CCB_TIERS[CCB_TIERS.length - 1]
  return CCB_TIERS.find(t => cases >= t.min) ?? CCB_TIERS[CCB_TIERS.length - 1]
}

/**
 * Get persistency multiplier for a given persistency %.
 * Returns { multiplier }
 */
export function getPersistencyMultiplier(persistencyPct) {
  if (persistencyPct === null || persistencyPct === undefined) {
    // No data → default (82.5%+ → full bonus)
    return { multiplier: 1.0 }
  }
  const tier = PERSISTENCY_TIERS.find(t => persistencyPct >= t.min)
  return { multiplier: tier?.multiplier ?? 0.0 }
}

/**
 * Calculate total quarterly bonus for an agent.
 * Returns { fycBonus, ccbBonus, persistencyMultiplier, totalBonus, fycTier, ccbTier }
 */
export function calculateQuarterlyBonus(agent, quarter) {
  const isRookie = agent.segment === 'Rookie' && agent.agentYear === 1

  const qtlyFyc    = getQuarterlyFyc(agent, quarter)
  const qtlyCases  = getQuarterlyCases(agent, quarter)
  const activeMonths = getQuarterActiveMonths(agent, quarter)

  const persRaw   = agent.quarterlyPers?.[quarter] ?? null
  const { multiplier: persistencyMultiplier } = getPersistencyMultiplier(persRaw)

  const fycTier = getFycTier(qtlyFyc, isRookie)
  const ccbTier = getCcbTier(qtlyCases, activeMonths)

  const fycBonus  = qtlyFyc * fycTier.rate
  const ccbBonus  = activeMonths >= 2 ? qtlyFyc * ccbTier.rate : 0
  const totalBonus = (fycBonus + ccbBonus) * persistencyMultiplier

  return {
    fycBonus,
    ccbBonus,
    persistencyMultiplier,
    totalBonus,
    fycTier,
    ccbTier,
    qtlyFyc,
    qtlyCases,
    activeMonths,
    persRaw,
    isRookie,
  }
}

/**
 * Get the FYC amount needed to reach the next bonus tier.
 * Returns { nextTierLabel, amountNeeded } or null if already at max tier.
 */
export function getFycNextTierGap(qtlyFyc, isRookie = false) {
  // Already at max tier
  if (qtlyFyc >= FYC_TIERS[0].min) return null

  // Rookie in the 20K–29K special window → next target is ₱30K
  if (isRookie && qtlyFyc >= ROOKIE_TIER.min && qtlyFyc < 30000) {
    const nextTier = FYC_TIERS.find(t => t.min === 30000)
    if (nextTier) return { nextTierLabel: nextTier.label, amountNeeded: nextTier.min - qtlyFyc }
  }

  // Standard: find current tier index, then go one step up (lower index = higher tier)
  const currentTierIdx = FYC_TIERS.findIndex(t => qtlyFyc >= t.min)
  const nextTier = currentTierIdx > 0 ? FYC_TIERS[currentTierIdx - 1] : null

  if (!nextTier) return null
  return { nextTierLabel: nextTier.label, amountNeeded: nextTier.min - qtlyFyc }
}

// ─── ADVISOR TIER ──────────────────────────────────────────────────────────────

/**
 * Get advisor MDRT tier based on YTD FYP vs annual MDRT goal.
 * mdrtGoal: fetched from agency_targets, defaults to MDRT_GOAL_DEFAULT.
 * Returns one of the ADVISOR_TIERS objects.
 */
export function getAdvisorTier(ytdFyp, mdrtGoal = MDRT_GOAL_DEFAULT) {
  const pct = ytdFyp / mdrtGoal

  // Check achiever first (>= 100%)
  const achiever = ADVISOR_TIERS.find(t => t.key === 'mdrt_achiever')
  if (pct >= 1.0) return achiever

  // Walk through tiers with both minPct and maxPct defined
  for (const tier of ADVISOR_TIERS) {
    if (tier.minPct === null) continue
    if (tier.maxPct === null) continue
    if (pct >= tier.minPct && pct < tier.maxPct) return tier
  }

  // Below SA (0%) → Standard Advisor floor
  return ADVISOR_TIERS.find(t => t.key === 'sa') ?? ADVISOR_TIERS[0]
}

// ─── PROPENSITY SCORE ──────────────────────────────────────────────────────────

/**
 * Calculate a propensity score (0-100) for an agent likely to produce this month.
 * Only meaningful for agents who have NOT yet produced in currentMonthIdx.
 *
 * Scoring:
 * - Produced last month (+30)
 * - Consecutive producing months × 5, max 25 (+0 to +25)
 * - Within next FYC bonus tier by ≤₱20K (+20)
 * - Avg case size in top 25% of allAgents (+15)
 * - Seasoned segment (+10)
 */
export function getPropensityScore(agent, currentMonthIdx, allAgents, mdrtGoal = MDRT_GOAL_DEFAULT) {
  let score = 0

  // ── Produced last month (+30)
  if (currentMonthIdx > 0) {
    const lastMonthAbbr = MONTH_ABBRS[currentMonthIdx - 1]
    const lastCases = agent.monthly?.[lastMonthAbbr]?.cases || 0
    if (lastCases > 0) score += 30
  }

  // ── Consecutive producing months × 5, max 25
  let consecutive = 0
  for (let i = currentMonthIdx - 1; i >= 0; i--) {
    const abbr = MONTH_ABBRS[i]
    if ((agent.monthly?.[abbr]?.cases || 0) > 0) {
      consecutive++
    } else {
      break
    }
  }
  score += Math.min(25, consecutive * 5)

  // ── Within next FYC bonus tier by ≤₱20K (+20)
  // Determine current quarter from currentMonthIdx
  const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4']
  const currentQuarterKey = quarterKeys[Math.floor(currentMonthIdx / 3)]
  const isRookie = agent.segment === 'Rookie' && agent.agentYear === 1

  // Sum FYC for months already completed in the current quarter (excluding currentMonthIdx)
  const quarterAbbrs = QUARTERS[currentQuarterKey] ?? []
  const qtlyFycSoFar = quarterAbbrs.reduce((sum, abbr, idx) => {
    const monthAbsIdx = quarterKeys.indexOf(currentQuarterKey) * 3 + idx
    if (monthAbsIdx < currentMonthIdx) {
      return sum + (agent.monthly?.[abbr]?.fyc || 0)
    }
    return sum
  }, 0)

  const nextTierGap = getFycNextTierGap(qtlyFycSoFar, isRookie)
  if (nextTierGap && nextTierGap.amountNeeded <= 20000) score += 20

  // ── Avg case size in top 25% of allAgents (+15)
  const ytdCases = getAgentYtdCases(agent, currentMonthIdx - 1)
  const ytdFyp   = getAgentYtdFyp(agent, currentMonthIdx - 1)
  const agentAvgCaseSize = ytdCases > 0 ? ytdFyp / ytdCases : 0

  const allAvgCaseSizes = allAgents
    .filter(a => {
      const c = getAgentYtdCases(a, currentMonthIdx - 1)
      return c > 0
    })
    .map(a => {
      const c = getAgentYtdCases(a, currentMonthIdx - 1)
      const f = getAgentYtdFyp(a, currentMonthIdx - 1)
      return f / c
    })
    .sort((a, b) => a - b)

  if (allAvgCaseSizes.length > 0) {
    const p75Idx = Math.floor(allAvgCaseSizes.length * 0.75)
    const p75Value = allAvgCaseSizes[p75Idx]
    if (agentAvgCaseSize >= p75Value) score += 15
  }

  // ── Seasoned segment (+10)
  if (agent.segment === 'Seasoned') score += 10

  return Math.min(100, score)
}

// ─── ACTIVATION / RECRUITMENT ──────────────────────────────────────────────────

/**
 * Get days since an agent's appointment date.
 * apptDate: integer in YYYYMMDD format (e.g. 20250115) or ISO date string or Date object.
 */
export function daysSinceAppt(apptDate) {
  if (!apptDate) return null

  let d
  if (typeof apptDate === 'number') {
    // Integer YYYYMMDD format (as used in existing pages)
    if (apptDate < 19000101) return null
    const y  = Math.floor(apptDate / 10000)
    const mo = Math.floor((apptDate % 10000) / 100) - 1
    const day = apptDate % 100
    d = new Date(y, mo, day)
  } else if (apptDate instanceof Date) {
    d = apptDate
  } else {
    // ISO string
    d = new Date(apptDate)
  }

  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

/**
 * Get activation bucket for a recruit (0-30, 31-60, 61-90).
 * Returns { label, range } or null if days is null.
 */
export function getActivationBucket(daysSince) {
  if (daysSince === null || daysSince === undefined) return null
  if (daysSince <= 30)  return { label: '0–30 days',  range: '0-30' }
  if (daysSince <= 60)  return { label: '31–60 days', range: '31-60' }
  return                       { label: '61–90 days', range: '61-90' }
}

/**
 * Get activation status for a recruit based on their case count.
 * Returns 'fast_start' | 'activated' | 'not_yet'
 */
export function getActivationStatus(cases) {
  if (cases >= 5) return 'fast_start'
  if (cases > 0)  return 'activated'
  return 'not_yet'
}

// ─── FORMATTING HELPERS ────────────────────────────────────────────────────────

/**
 * Format currency in Philippine Peso — full value with 1 decimal place.
 * e.g. 1234567.8 → '₱1,234,567.8'   12345 → '₱12,345.0'
 * Pass decimals=0 for whole-number display.
 */
export function formatPeso(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '₱0.0'
  const n   = Number(value)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const parts = abs.toFixed(decimals).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}₱${parts.join('.')}`
}

/**
 * Format a percentage to 1 decimal place with % sign.
 */
export function formatPct(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '0%'
  return `${Number(value).toFixed(decimals)}%`
}
