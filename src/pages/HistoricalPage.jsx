// HistoricalPage — multi-year agency performance analysis
// Shows trends across all uploaded historical years + current year.

import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { CURRENT_YEAR, MONTH_ABBRS, MONTH_SHORT } from '../constants'
import { formatPeso, formatPct } from '../utils/calculations'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n }

/** Aggregate one year's parsed data into summary stats */
function buildYearStats(yearData, year) {
  if (!yearData?.agents) return null
  const agents = yearData.agents

  const totalFyp   = agents.reduce((s, a) => s + MONTH_ABBRS.reduce((ms, abbr) => ms + (a.monthly?.[abbr]?.fyp   || 0), 0), 0)
  const totalAnp   = agents.reduce((s, a) => s + MONTH_ABBRS.reduce((ms, abbr) => ms + (a.monthly?.[abbr]?.anp   || 0), 0), 0)
  const totalFyc   = agents.reduce((s, a) => s + MONTH_ABBRS.reduce((ms, abbr) => ms + (a.monthly?.[abbr]?.fyc   || 0), 0), 0)
  const totalCases = agents.reduce((s, a) => s + MONTH_ABBRS.reduce((ms, abbr) => ms + (a.monthly?.[abbr]?.cases || 0), 0), 0)

  const headcount  = agents.length
  const rookies    = agents.filter(a => a.segment === 'Rookie').length
  const seasoned   = agents.filter(a => a.segment === 'Seasoned').length

  // Agents who produced at least once
  const activeAgents = agents.filter(a =>
    MONTH_ABBRS.some(abbr => (a.monthly?.[abbr]?.cases || 0) > 0)
  ).length
  const activityRate = headcount > 0 ? (activeAgents / headcount) * 100 : 0

  // Monthly breakdowns
  const monthlyFyp   = MONTH_ABBRS.map((abbr, i) => ({ month: MONTH_SHORT[i], value: agents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyp   || 0), 0) }))
  const monthlyAnp   = MONTH_ABBRS.map((abbr, i) => ({ month: MONTH_SHORT[i], value: agents.reduce((s, a) => s + (a.monthly?.[abbr]?.anp   || 0), 0) }))
  const monthlyFyc   = MONTH_ABBRS.map((abbr, i) => ({ month: MONTH_SHORT[i], value: agents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyc   || 0), 0) }))
  const monthlyCases = MONTH_ABBRS.map((abbr, i) => ({ month: MONTH_SHORT[i], value: agents.reduce((s, a) => s + (a.monthly?.[abbr]?.cases || 0), 0) }))

  // Top performers by FYP (full year)
  const topFyp = agents
    .map(a => ({
      code: a.code, name: a.name, segment: a.segment,
      fyp: MONTH_ABBRS.reduce((s, abbr) => s + (a.monthly?.[abbr]?.fyp || 0), 0),
      fyc: MONTH_ABBRS.reduce((s, abbr) => s + (a.monthly?.[abbr]?.fyc || 0), 0),
    }))
    .sort((a, b) => b.fyp - a.fyp)
    .slice(0, 10)

  // ── Attrition analytics (requires manpowerTimeline field on each agent) ──────

  // Detect effective last month: last month where ANY agent has manpower=1.
  // This prevents partial-year files (e.g. 2025 data through November) from
  // marking every active agent as "attrited in December" just because Dec is blank.
  let effectiveLastMonthIdx = 0
  for (let i = 11; i >= 0; i--) {
    if (agents.some(a => a.manpowerTimeline?.flags[i] === true)) {
      effectiveLastMonthIdx = i
      break
    }
  }
  const isPartialYear = effectiveLastMonthIdx < 11

  // Monthly exit counts — only exits that happened BEFORE the effective last month
  // are real attrition; blanks at/after that month are just missing data.
  const attritionMonthCounts = MONTH_ABBRS.map((abbr, i) => ({
    month: MONTH_SHORT[i],
    value: agents.filter(a =>
      a.manpowerTimeline?.exitMonthIdx === i &&
      a.manpowerTimeline.exitMonthIdx <= effectiveLastMonthIdx
    ).length,
  }))

  // New recruit cohort (agents with isNewRecruitYtd=1 who have monthly data)
  const recruitCohort = agents.filter(a => a.isNewRecruitYtd && a.manpowerTimeline != null)

  // Attrited = last active month is strictly before the effective last month
  const cohortLeft = recruitCohort.filter(
    a => a.manpowerTimeline.lastActiveIdx < effectiveLastMonthIdx
  )
  // Survived = still active in the effective last month
  const cohortEndedYear = recruitCohort.filter(
    a => a.manpowerTimeline.lastActiveIdx === effectiveLastMonthIdx
  ).length

  // Average active months for recruits who left (join → last active, inclusive)
  const cohortAvgTenure = cohortLeft.length > 0
    ? +(cohortLeft.reduce((s, a) =>
        s + (a.manpowerTimeline.lastActiveIdx - a.manpowerTimeline.joinMonthIdx + 1), 0
      ) / cohortLeft.length).toFixed(1)
    : null

  // Cohort survival curve: % of eligible recruits still active N months after joining.
  // "Eligible" = those whose join month + N is still within the effective last month.
  const cohortSurvivalCurve = Array.from({ length: effectiveLastMonthIdx + 1 }, (_, n) => {
    const eligible = recruitCohort.filter(
      a => a.manpowerTimeline.joinMonthIdx + n <= effectiveLastMonthIdx
    )
    if (eligible.length < 3) return null
    const survived = eligible.filter(
      a => a.manpowerTimeline.flags[a.manpowerTimeline.joinMonthIdx + n] === true
    )
    return {
      monthsIn:  n + 1,
      survived:  survived.length,
      eligible:  eligible.length,
      pct:       (survived.length / eligible.length) * 100,
    }
  }).filter(Boolean)

  // Time-to-attrite buckets: months from join to last active (for recruits who left)
  const attritionGroups = [
    { label: '1 mo',    check: m => m === 1 },
    { label: '2–3 mo',  check: m => m >= 2 && m <= 3 },
    { label: '4–6 mo',  check: m => m >= 4 && m <= 6 },
    { label: '7+ mo',   check: m => m >= 7 },
  ].map(({ label, check }) => ({
    label,
    count: cohortLeft.filter(a => {
      const m = a.manpowerTimeline.lastActiveIdx - a.manpowerTimeline.joinMonthIdx + 1
      return check(m)
    }).length,
  }))

  return {
    year, totalFyp, totalAnp, totalFyc, totalCases,
    headcount, rookies, seasoned, activeAgents, activityRate,
    monthlyFyp, monthlyAnp, monthlyFyc, monthlyCases,
    topFyp,
    // Attrition analytics
    attritionMonthCounts,
    cohortTotal:       recruitCohort.length,
    cohortLeft:        cohortLeft.length,
    cohortEndedYear,
    cohortAvgTenure,
    cohortSurvivalCurve,
    attritionGroups,
    effectiveLastMonthIdx,
    effectiveLastMonth:  MONTH_SHORT[effectiveLastMonthIdx],
    isPartialYear,
  }
}

// ─── Simple bar chart (multi-year comparison) ─────────────────────────────────
// bars: [{ year, value }], sorted desc by year (newest first visually last)

function YearBarChart({ stats, valueKey, label, format }) {
  const max = Math.max(...stats.map(s => s[valueKey] || 0), 1)
  const YEAR_COLORS = ['#D31145', '#1F78AD', '#4E9A51', '#C97B1A', '#8B0A2F', '#0D4F7C', '#2C6E2F', '#8B5B0A']
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">{label}</p>
      <div className="flex flex-col gap-2">
        {[...stats].sort((a, b) => a.year - b.year).map((s, i) => {
          const pct = Math.max((s[valueKey] / max) * 100, s[valueKey] > 0 ? 2 : 0)
          return (
            <div key={s.year} className="flex items-center gap-2">
              <span className="text-[11px] font-bold w-10 flex-shrink-0 text-right tabular-nums"
                style={{ color: YEAR_COLORS[i % YEAR_COLORS.length] }}>
                {s.year}
              </span>
              <div className="flex-1 relative h-6 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: YEAR_COLORS[i % YEAR_COLORS.length] }}
                />
              </div>
              <span className="text-[11px] font-bold tabular-nums w-28 text-right"
                style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
                {format(s[valueKey] || 0)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Seasonality chart ────────────────────────────────────────────────────────
// Shows each year's monthly pattern on the same Jan-Dec axis, overlaid.

function SeasonalityChart({ yearStats, valueKey, format }) {
  const YEAR_COLORS = ['#D31145', '#1F78AD', '#4E9A51', '#C97B1A', '#8B0A2F', '#0D4F7C', '#2C6E2F', '#8B5B0A']
  const monthlyKey = valueKey === 'totalFyp' ? 'monthlyFyp'
    : valueKey === 'totalAnp' ? 'monthlyAnp'
    : valueKey === 'totalFyc' ? 'monthlyFyc'
    : 'monthlyCases'

  const allValues = yearStats.flatMap(s => (s[monthlyKey] || []).map(m => m.value))
  const max = Math.max(...allValues, 1)

  const CHART_H = 80

  return (
    <div>
      {/* Chart */}
      <div className="flex items-end gap-0.5 overflow-hidden" style={{ height: CHART_H }}>
        {MONTH_ABBRS.map((abbr, mi) => (
          <div key={abbr} className="flex-1 flex flex-col items-center justify-end gap-0.5" style={{ height: CHART_H }}>
            <div className="w-full flex flex-col-reverse items-center gap-0.5 overflow-hidden" style={{ height: CHART_H - 14 }}>
              {[...yearStats].sort((a, b) => a.year - b.year).map((s, yi) => {
                const val = s[monthlyKey]?.[mi]?.value || 0
                const h = Math.max(val > 0 ? (val / max) * (CHART_H - 14) : 0, val > 0 ? 2 : 0)
                return (
                  <div
                    key={s.year}
                    title={`${s.year} ${abbr}: ${format(val)}`}
                    className="w-full rounded-t-sm flex-shrink-0"
                    style={{
                      height: h,
                      backgroundColor: YEAR_COLORS[yi % YEAR_COLORS.length],
                      opacity: 0.85,
                    }}
                  />
                )
              })}
            </div>
            <span className="text-[8px] font-medium text-gray-400">{MONTH_SHORT[mi]}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap mt-3">
        {[...yearStats].sort((a, b) => a.year - b.year).map((s, yi) => (
          <span key={s.year} className="flex items-center gap-1 text-[10px] text-gray-600">
            <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: YEAR_COLORS[yi % YEAR_COLORS.length] }} />
            {s.year}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Attrition seasonality chart ─────────────────────────────────────────────
// Shows which months agents exit, overlaid across years.

function AttritionSeasonalityChart({ yearStats }) {
  const YEAR_COLORS = ['#D31145', '#1F78AD', '#4E9A51', '#C97B1A', '#8B0A2F', '#0D4F7C', '#2C6E2F', '#8B5B0A']
  const allVals = yearStats.flatMap(s => (s.attritionMonthCounts || []).map(m => m.value))
  const max = Math.max(...allVals, 1)
  const CHART_H = 80
  const sorted = [...yearStats].sort((a, b) => a.year - b.year)

  // Average per month across all years, for the callout
  const avgByMonth = MONTH_SHORT.map((label, mi) => ({
    label,
    avg: yearStats.reduce((sum, s) => sum + (s.attritionMonthCounts?.[mi]?.value || 0), 0) / yearStats.length,
  }))
  const worstMonth = avgByMonth.reduce((a, b) => b.avg > a.avg ? b : a)
  const bestMonth  = avgByMonth.reduce((a, b) => b.avg < a.avg ? b : a)

  return (
    <div>
      <div className="flex items-end gap-0.5 overflow-hidden" style={{ height: CHART_H }}>
        {MONTH_SHORT.map((label, mi) => (
          <div key={mi} className="flex-1 flex flex-col items-center justify-end" style={{ height: CHART_H }}>
            <div className="w-full flex flex-col-reverse items-center gap-0.5 overflow-hidden"
              style={{ height: CHART_H - 14 }}>
              {sorted.map((s, yi) => {
                const val = s.attritionMonthCounts?.[mi]?.value || 0
                const h = Math.max(val > 0 ? (val / max) * (CHART_H - 14) : 0, val > 0 ? 2 : 0)
                return (
                  <div
                    key={s.year}
                    title={`${s.year} ${label}: ${val} attrited`}
                    className="w-full rounded-t-sm flex-shrink-0"
                    style={{ height: h, backgroundColor: YEAR_COLORS[yi % YEAR_COLORS.length], opacity: 0.85 }}
                  />
                )
              })}
            </div>
            <span className="text-[8px] font-medium text-gray-400">{label}</span>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex gap-3 flex-wrap mt-3">
        {sorted.map((s, yi) => {
          const total = s.attritionMonthCounts?.reduce((t, m) => t + m.value, 0) || 0
          return (
            <span key={s.year} className="flex items-center gap-1 text-[10px] text-gray-600">
              <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: YEAR_COLORS[yi % YEAR_COLORS.length] }} />
              {s.year}{s.isPartialYear ? ` (thru ${s.effectiveLastMonth})` : ''} — {total} exits
            </span>
          )
        })}
      </div>
      {/* Callout */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-600">
        <span>⚠️ <strong>Most departures:</strong> {worstMonth.label} (avg {worstMonth.avg.toFixed(1)}/yr)</span>
        <span>✅ <strong>Fewest departures:</strong> {bestMonth.label} (avg {bestMonth.avg.toFixed(1)}/yr)</span>
      </div>
    </div>
  )
}

// ─── KPI delta pill ───────────────────────────────────────────────────────────

function DeltaPill({ current, prior }) {
  if (!prior || prior === 0) return null
  const delta = ((current - prior) / prior) * 100
  const up = delta >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, subtitle, children }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-extrabold text-gray-800">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HistoricalPage() {
  const { data, allHistoricalData, isLoaded } = useData()
  const [metricKey, setMetricKey] = useState('totalFyp')

  // Compile all available years into one map { year: parsedData }
  const allYearsMap = useMemo(() => {
    const m = {}
    if (data) m[CURRENT_YEAR] = data
    for (const [yr, d] of Object.entries(allHistoricalData ?? {})) {
      m[Number(yr)] = d
    }
    return m
  }, [data, allHistoricalData])

  const yearKeys = useMemo(() =>
    Object.keys(allYearsMap).map(Number).sort((a, b) => b - a),
    [allYearsMap]
  )

  // Compute stats for every available year
  const yearStats = useMemo(() =>
    yearKeys.map(y => buildYearStats(allYearsMap[y], y)).filter(Boolean),
    [allYearsMap, yearKeys]
  )

  const METRIC_OPTIONS = [
    { key: 'totalFyp',   label: 'FYP',      format: v => formatPeso(v, 0) },
    { key: 'totalAnp',   label: 'ANP',      format: v => formatPeso(v, 0) },
    { key: 'totalFyc',   label: 'FYC',      format: v => formatPeso(v, 0) },
    { key: 'totalCases', label: 'Cases',    format: v => String(Math.round(v)) },
    { key: 'headcount',  label: 'Headcount',format: v => String(Math.round(v)) },
  ]
  const activeMeta = METRIC_OPTIONS.find(m => m.key === metricKey) || METRIC_OPTIONS[0]

  // Consistent top performers: agents appearing in top 10 FYP for 2+ years
  const consistentTopPerformers = useMemo(() => {
    const appearsInTop = new Map() // code → { name, segment, years: [year], fypByYear: {year: val} }
    for (const s of yearStats) {
      s.topFyp.forEach(a => {
        if (!a.code) return
        if (!appearsInTop.has(a.code)) {
          appearsInTop.set(a.code, { code: a.code, name: a.name, segment: a.segment, years: [], fypByYear: {} })
        }
        const entry = appearsInTop.get(a.code)
        entry.years.push(s.year)
        entry.fypByYear[s.year] = a.fyp
      })
    }
    return [...appearsInTop.values()]
      .filter(a => a.years.length >= 2)
      .sort((a, b) => b.years.length - a.years.length || Math.max(...Object.values(b.fypByYear)) - Math.max(...Object.values(a.fypByYear)))
      .slice(0, 15)
  }, [yearStats])

  // Agent retention: year-over-year, using ManpowerCnt and NEW_RECRUIT_YTD columns.
  // For each consecutive year pair (e.g. 2024→2025):
  //   - Prior ending manpower = agents with manpowerInd=true in prior year
  //   - New recruits          = agents with isNewRecruitYtd=true in current year
  //   - Ending manpower       = agents with manpowerInd=true in current year
  //   - Starting manpower     = ending - new recruits (= agents carried over from prior)
  //   - Attrited              = agents with manpowerInd=1 in prior year who have manpowerInd=0 in current year
  //   - Retained              = prior ending - attrited
  //   - Retention rate        = retained / prior ending × 100
  const retention = useMemo(() => {
    if (yearKeys.length < 2) return null
    const sortedYears = [...yearKeys].sort((a, b) => a - b)
    const results = []

    for (let i = 1; i < sortedYears.length; i++) {
      const fromYear = sortedYears[i - 1]
      const toYear   = sortedYears[i]
      const priorAgents   = allYearsMap[fromYear]?.agents ?? []
      const currentAgents = allYearsMap[toYear]?.agents   ?? []

      // Prior year ending manpower = ManpowerCnt=1 in prior year
      const priorEnding = priorAgents.filter(a => a.manpowerInd).length

      // Current year values directly from columns
      const endingManpower = currentAgents.filter(a => a.manpowerInd).length
      const newRecruits    = currentAgents.filter(a => a.isNewRecruitYtd).length

      // Arithmetic derivation — avoids cross-file agent-code matching which
      // can drift if codes are inconsistent between years.
      // retained  = ending − new recruits  (agents who carried over from prior year)
      // attrited  = prior ending − retained (agents who left during the year)
      const retained  = endingManpower - newRecruits
      const attrited  = priorEnding - retained
      const retentionRate = priorEnding > 0
        ? (retained / priorEnding) * 100
        : 0

      results.push({
        fromYear, toYear,
        priorEnding,
        newRecruits,
        endingManpower,
        attrited,
        retained,
        retentionRate,
      })
    }
    return results.reverse() // most recent pair first
  }, [yearKeys, allYearsMap])

  // Best month for each metric (most consistent high performers)
  const monthStrength = useMemo(() => {
    if (yearStats.length === 0) return []
    const monthlyKey = metricKey === 'totalFyp' ? 'monthlyFyp'
      : metricKey === 'totalAnp' ? 'monthlyAnp'
      : metricKey === 'totalFyc' ? 'monthlyFyc'
      : 'monthlyCases'

    // Average each month's value across all years
    return MONTH_ABBRS.map((abbr, mi) => {
      const vals = yearStats.map(s => s[monthlyKey]?.[mi]?.value || 0).filter(v => v > 0)
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      return { month: MONTH_SHORT[mi], abbr, avg }
    })
  }, [yearStats, metricKey])

  if (!isLoaded) return null

  if (yearStats.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-700 mb-2">No Historical Data Yet</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Upload prior-year performance reports in <strong>Settings → Historical Data</strong> to unlock multi-year analysis.
          </p>
        </div>
      </div>
    )
  }

  const newestStat = yearStats[0]
  const secondStat = yearStats[1]

  return (
    <div className="min-h-screen bg-gray-50 pb-16" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="max-w-screen-xl mx-auto px-4 pt-6 flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Historical Analysis</h1>
            <p className="text-sm text-gray-500 mt-1">
              {yearStats.length} year{yearStats.length !== 1 ? 's' : ''} of data ·{' '}
              {yearStats.map(s => s.year).sort((a, b) => a - b).join(', ')}
            </p>
          </div>
          {/* Metric selector */}
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            {METRIC_OPTIONS.map(m => (
              <button
                key={m.key}
                onClick={() => setMetricKey(m.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150 ${metricKey === m.key ? 'bg-[#D31145] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 1. Year-on-Year KPI cards ─────────────────────────────────────── */}
        <Section
          title="Year-on-Year Performance"
          subtitle="Full-year totals for each metric across all uploaded years"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {yearStats.map((s, i) => {
              const prior = yearStats[i + 1]
              return (
                <Card key={s.year}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl font-black text-gray-800"
                      style={{ fontFamily: 'DM Mono, monospace' }}>{s.year}</span>
                    {prior && <DeltaPill current={s.totalFyp} prior={prior.totalFyp} />}
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                    {[
                      { label: 'FYP', value: formatPeso(s.totalFyp, 0) },
                      { label: 'ANP', value: formatPeso(s.totalAnp, 0) },
                      { label: 'FYC', value: formatPeso(s.totalFyc, 0) },
                      { label: 'Cases', value: String(Math.round(s.totalCases)) },
                      { label: 'Headcount', value: String(s.headcount) },
                      { label: 'Activity', value: formatPct(s.activityRate) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                        <p className="text-sm font-bold text-gray-800 tabular-nums"
                          style={{ fontFamily: 'DM Mono, monospace' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#D31145] inline-block" />{s.rookies} Rookies
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#1F78AD] inline-block" />{s.seasoned} Seasoned
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        </Section>

        {/* ── 2. Metric trend bar chart ─────────────────────────────────────── */}
        <Section
          title={`${activeMeta.label} Trend`}
          subtitle="Full-year totals compared across all available years"
        >
          <Card>
            <YearBarChart
              stats={yearStats}
              valueKey={metricKey}
              label={activeMeta.label}
              format={activeMeta.format}
            />
          </Card>
        </Section>

        {/* ── 3. Seasonality ───────────────────────────────────────────────── */}
        <Section
          title="Monthly Seasonality"
          subtitle={`Which months consistently peak for ${activeMeta.label} — all years overlaid`}
        >
          <Card>
            <SeasonalityChart
              yearStats={yearStats}
              valueKey={metricKey}
              format={activeMeta.format}
            />
            {/* Best/worst month callout */}
            {monthStrength.length > 0 && (() => {
              const sorted = [...monthStrength].sort((a, b) => b.avg - a.avg)
              const best = sorted[0]
              const worst = sorted[sorted.length - 1]
              return (
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-600">
                  <span>
                    📈 <strong>Strongest month:</strong> {best.month} (avg {activeMeta.format(Math.round(best.avg))})
                  </span>
                  <span>
                    📉 <strong>Weakest month:</strong> {worst.month} (avg {activeMeta.format(Math.round(worst.avg))})
                  </span>
                </div>
              )
            })()}
          </Card>
        </Section>

        {/* ── 4. Headcount & Activity Rate ─────────────────────────────────── */}
        <Section
          title="Agency Growth & Activity"
          subtitle="Headcount, Rookies vs Seasoned split, and percentage of agents who produced"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Headcount bars */}
            <Card>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Headcount</p>
              {[...yearStats].sort((a, b) => a.year - b.year).map((s, i) => {
                const maxHC = Math.max(...yearStats.map(s => s.headcount), 1)
                const pct = (s.headcount / maxHC) * 100
                const rookiePct = s.headcount > 0 ? (s.rookies / s.headcount) * 100 : 0
                const seasonedPct = s.headcount > 0 ? (s.seasoned / s.headcount) * 100 : 0
                return (
                  <div key={s.year} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-600">{s.year}</span>
                      <span className="text-xs font-bold tabular-nums text-gray-800"
                        style={{ fontFamily: 'DM Mono, monospace' }}>
                        {s.headcount} agents
                      </span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded overflow-hidden flex">
                      <div className="h-full bg-[#D31145]" style={{ width: `${rookiePct}%` }} title={`Rookies: ${s.rookies}`} />
                      <div className="h-full bg-[#1F78AD]" style={{ width: `${seasonedPct}%` }} title={`Seasoned: ${s.seasoned}`} />
                    </div>
                    <div className="flex gap-3 mt-1 text-[9px] text-gray-400">
                      <span className="text-[#D31145] font-semibold">{s.rookies} Rookie</span>
                      <span className="text-[#1F78AD] font-semibold">{s.seasoned} Seasoned</span>
                    </div>
                  </div>
                )
              })}
            </Card>

            {/* Activity rate */}
            <Card>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Activity Rate</p>
              <p className="text-[10px] text-gray-400 mb-3">% of agents who produced at least one case that year</p>
              {[...yearStats].sort((a, b) => a.year - b.year).map(s => (
                <div key={s.year} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-600">{s.year}</span>
                    <span className="text-xs font-bold tabular-nums"
                      style={{ fontFamily: 'DM Mono, monospace',
                        color: s.activityRate >= 70 ? '#4E9A51' : s.activityRate >= 50 ? '#C97B1A' : '#D31145' }}>
                      {formatPct(s.activityRate)} ({s.activeAgents}/{s.headcount})
                    </span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full rounded transition-all duration-500"
                      style={{
                        width: `${s.activityRate}%`,
                        backgroundColor: s.activityRate >= 70 ? '#4E9A51' : s.activityRate >= 50 ? '#C97B1A' : '#D31145',
                      }} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </Section>

        {/* ── 5. Consistent Top Performers ─────────────────────────────────── */}
        {consistentTopPerformers.length > 0 && (
          <Section
            title="Consistent Top Performers"
            subtitle="Advisors who appeared in the top 10 FYP producers in 2 or more years"
          >
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 pb-2 pr-4 w-40">Advisor</th>
                    <th className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 pb-2 px-2">Top-10 Years</th>
                    {[...yearStats].sort((a, b) => a.year - b.year).map(s => (
                      <th key={s.year} className="text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 pb-2 px-3">
                        {s.year} FYP
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consistentTopPerformers.map((p, i) => (
                    <tr key={p.code || i} className="border-t border-gray-50">
                      <td className="py-2 pr-4">
                        <p className="font-semibold text-gray-800 text-xs">{p.name}</p>
                        <p className="text-[10px] text-gray-400">{p.segment}</p>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#D31145]/10 text-[#D31145]">
                          {p.years.length}× top 10
                        </span>
                      </td>
                      {[...yearStats].sort((a, b) => a.year - b.year).map(s => (
                        <td key={s.year} className="py-2 px-3 text-right tabular-nums text-xs font-semibold text-gray-700"
                          style={{ fontFamily: 'DM Mono, monospace' }}>
                          {p.fypByYear[s.year] ? formatPeso(p.fypByYear[s.year], 0) : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>
        )}

        {/* ── 6. Agent Retention (year-over-year) ──────────────────────────── */}
        {retention && retention.length > 0 && (
          <Section
            title="Agent Retention"
            subtitle="Year-over-year manpower movement — attrition tracked via ManpowerCnt, recruits via NEW_RECRUIT_YTD"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {retention.map(r => (
                <Card key={`${r.fromYear}-${r.toYear}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {r.fromYear} → {r.toYear}
                      </p>
                      <p className="text-2xl font-black text-gray-800 mt-0.5"
                        style={{ fontFamily: 'DM Mono, monospace' }}>
                        {formatPct(r.retentionRate)}
                      </p>
                      <p className="text-[10px] text-gray-400">retention rate</p>
                    </div>
                    <span className="text-xl">
                      {r.retentionRate >= 70 ? '🟢' : r.retentionRate >= 50 ? '🟡' : '🔴'}
                    </span>
                  </div>

                  {/* Retention bar */}
                  <div className="h-2 bg-gray-100 rounded overflow-hidden mb-4">
                    <div className="h-full rounded transition-all duration-500" style={{
                      width: `${Math.min(r.retentionRate, 100)}%`,
                      backgroundColor: r.retentionRate >= 70 ? '#4E9A51' : r.retentionRate >= 50 ? '#C97B1A' : '#D31145',
                    }} />
                  </div>

                  {/* Manpower funnel */}
                  <div className="space-y-2 text-xs">
                    {/* Starting row */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block bg-gray-400" />
                        Starting manpower
                      </span>
                      <span className="font-bold tabular-nums text-gray-700"
                        style={{ fontFamily: 'DM Mono, monospace' }}>{r.priorEnding}</span>
                    </div>
                    {/* Attrition */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block bg-[#D31145]" />
                        Attrited
                      </span>
                      <span className="font-bold tabular-nums text-[#D31145]"
                        style={{ fontFamily: 'DM Mono, monospace' }}>−{r.attrited}</span>
                    </div>
                    {/* Retained */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block bg-[#4E9A51]" />
                        Retained
                      </span>
                      <span className="font-bold tabular-nums text-[#4E9A51]"
                        style={{ fontFamily: 'DM Mono, monospace' }}>{r.retained}</span>
                    </div>
                    {/* New recruits */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block bg-[#1F78AD]" />
                        New recruits
                      </span>
                      <span className="font-bold tabular-nums text-[#1F78AD]"
                        style={{ fontFamily: 'DM Mono, monospace' }}>+{r.newRecruits}</span>
                    </div>
                    {/* Divider + ending */}
                    <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
                      <span className="font-semibold text-gray-600">Ending manpower</span>
                      <span className="font-black tabular-nums text-gray-800"
                        style={{ fontFamily: 'DM Mono, monospace' }}>{r.endingManpower}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {/* ── 7. Avg Case Size trend ────────────────────────────────────────── */}
        <Section
          title="Average Case Size"
          subtitle="Total FYP ÷ total cases — a proxy for the quality of business written each year"
        >
          <Card>
            <div className="flex flex-col gap-3">
              {[...yearStats].sort((a, b) => a.year - b.year).map((s, i) => {
                const avgCase = s.totalCases > 0 ? s.totalFyp / s.totalCases : 0
                const allAvg = yearStats.map(x => x.totalCases > 0 ? x.totalFyp / x.totalCases : 0)
                const maxAvg = Math.max(...allAvg, 1)
                const YEAR_COLORS = ['#D31145', '#1F78AD', '#4E9A51', '#C97B1A', '#8B0A2F', '#0D4F7C']
                return (
                  <div key={s.year} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold w-10 text-right"
                      style={{ fontFamily: 'DM Mono, monospace', color: YEAR_COLORS[i % YEAR_COLORS.length] }}>
                      {s.year}
                    </span>
                    <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full rounded"
                        style={{ width: `${(avgCase / maxAvg) * 100}%`, backgroundColor: YEAR_COLORS[i % YEAR_COLORS.length] }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums text-gray-700 w-28 text-right"
                      style={{ fontFamily: 'DM Mono, monospace' }}>
                      {avgCase > 0 ? formatPeso(avgCase, 0) : '—'}
                    </span>
                    <span className="text-[10px] text-gray-400 w-16">{s.totalCases} cases</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </Section>

        {/* ── 8. Attrition Deep-Dive ───────────────────────────────────────── */}
        {yearStats.some(s => s.attritionMonthCounts?.some(m => m.value > 0)) && (
          <Section
            title="Attrition Deep-Dive"
            subtitle="Monthly exit patterns, new recruit cohort survival, and time-to-attrite — historical years only"
          >
            <div className="flex flex-col gap-4">

              {/* Card A — When agents exit */}
              <Card>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                  Monthly Attrition Pattern
                </p>
                <p className="text-[10px] text-gray-400 mb-4">
                  Exit month = first blank after an agent's final active run — which months lose the most people
                </p>
                <AttritionSeasonalityChart yearStats={yearStats} />
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Card B — New recruit cohort survival */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                    New Recruit Cohort Survival
                  </p>
                  <p className="text-[10px] text-gray-400 mb-4">
                    Of each year's new recruits, how many were still active by December
                  </p>

                  {[...yearStats].sort((a, b) => a.year - b.year)
                    .filter(s => s.cohortTotal > 0)
                    .map(s => {
                      const survPct = (s.cohortEndedYear / s.cohortTotal) * 100
                      const attrPct = (s.cohortLeft     / s.cohortTotal) * 100
                      return (
                        <div key={s.year} className="mb-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-700">
                              {s.year} recruits
                              {s.isPartialYear && (
                                <span className="ml-1 text-[9px] font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                  through {s.effectiveLastMonth}
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-gray-400 tabular-nums"
                              style={{ fontFamily: 'DM Mono, monospace' }}>
                              {s.cohortTotal} total
                            </span>
                          </div>
                          <div className="h-4 bg-gray-100 rounded overflow-hidden flex">
                            <div className="h-full bg-[#4E9A51]" style={{ width: `${survPct}%` }}
                              title={`Active through ${s.effectiveLastMonth}: ${s.cohortEndedYear}`} />
                            <div className="h-full bg-[#D31145]" style={{ width: `${attrPct}%` }}
                              title={`Left during year: ${s.cohortLeft}`} />
                          </div>
                          <div className="flex gap-3 mt-1 flex-wrap">
                            <span className="text-[9px] font-semibold text-[#4E9A51]">
                              {s.cohortEndedYear} active through {s.effectiveLastMonth} ({survPct.toFixed(0)}%)
                            </span>
                            <span className="text-[9px] font-semibold text-[#D31145]">
                              {s.cohortLeft} left ({attrPct.toFixed(0)}%)
                            </span>
                            {s.cohortAvgTenure && (
                              <span className="text-[9px] text-gray-400">
                                avg {s.cohortAvgTenure} mo before leaving
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  }

                  {/* Survival curve — most recent year with enough data */}
                  {(() => {
                    const latest = [...yearStats]
                      .sort((a, b) => b.year - a.year)
                      .find(s => s.cohortSurvivalCurve?.length > 0)
                    if (!latest) return null
                    return (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                          {latest.year} survival curve
                          <span className="font-normal text-gray-400 ml-1 normal-case">
                            (% still active N months after joining
                            {latest.isPartialYear ? `, data through ${latest.effectiveLastMonth}` : ''})
                          </span>
                        </p>
                        {latest.cohortSurvivalCurve.map(pt => (
                          <div key={pt.monthsIn} className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] text-gray-400 w-14 flex-shrink-0 text-right">
                              mo {pt.monthsIn}
                            </span>
                            <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                              <div className="h-full rounded transition-all duration-500"
                                style={{
                                  width: `${pt.pct}%`,
                                  backgroundColor: pt.pct >= 70 ? '#4E9A51' : pt.pct >= 50 ? '#C97B1A' : '#D31145',
                                }} />
                            </div>
                            <span className="text-[10px] font-bold tabular-nums w-10 text-right"
                              style={{
                                fontFamily: 'DM Mono, monospace',
                                color: pt.pct >= 70 ? '#4E9A51' : pt.pct >= 50 ? '#C97B1A' : '#D31145',
                              }}>
                              {pt.pct.toFixed(0)}%
                            </span>
                            <span className="text-[9px] text-gray-400 w-14">
                              {pt.survived}/{pt.eligible}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </Card>

                {/* Card C — How long before leaving */}
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                    How Long Before Leaving
                  </p>
                  <p className="text-[10px] text-gray-400 mb-4">
                    For new recruits who left during the year — months from join to departure
                  </p>

                  {[...yearStats].sort((a, b) => a.year - b.year)
                    .filter(s => s.cohortLeft > 0)
                    .map(s => {
                      const total = s.cohortLeft
                      const GROUP_COLORS = ['#D31145', '#C97B1A', '#1F78AD', '#4E9A51']
                      return (
                        <div key={s.year} className="mb-5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-700">
                              {s.year}
                              {s.isPartialYear && (
                                <span className="ml-1 text-[9px] font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                  through {s.effectiveLastMonth}
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-gray-400">{total} who left</span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded overflow-hidden flex mb-2">
                            {s.attritionGroups.map((g, gi) => {
                              const pct = total > 0 ? (g.count / total) * 100 : 0
                              return (
                                <div key={g.label} className="h-full"
                                  style={{ width: `${pct}%`, backgroundColor: GROUP_COLORS[gi] }}
                                  title={`${g.label}: ${g.count} (${pct.toFixed(0)}%)`}
                                />
                              )
                            })}
                          </div>
                          <div className="flex gap-3 flex-wrap">
                            {s.attritionGroups.map((g, gi) => {
                              const pct = total > 0 ? (g.count / total) * 100 : 0
                              return (
                                <span key={g.label}
                                  className="flex items-center gap-1 text-[10px] font-semibold"
                                  style={{ color: GROUP_COLORS[gi] }}>
                                  <span className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: GROUP_COLORS[gi] }} />
                                  {g.label}: {g.count} ({pct.toFixed(0)}%)
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })
                  }

                  {(() => {
                    const totals = [0, 0, 0, 0]
                    yearStats.forEach(s =>
                      s.attritionGroups?.forEach((g, gi) => { totals[gi] += g.count })
                    )
                    const labels = ['1 mo', '2–3 mo', '4–6 mo', '7+ mo']
                    const maxIdx = totals.indexOf(Math.max(...totals))
                    if (totals[maxIdx] === 0) return null
                    return (
                      <div className="mt-2 pt-3 border-t border-gray-100 text-xs text-gray-600">
                        ⚡ Most recruits who leave do so within{' '}
                        <strong>{labels[maxIdx]}</strong> of joining
                        <span className="text-gray-400"> ({totals[maxIdx]} across all years)</span>
                      </div>
                    )
                  })()}
                </Card>

              </div>
            </div>
          </Section>
        )}

      </div>
    </div>
  )
}
