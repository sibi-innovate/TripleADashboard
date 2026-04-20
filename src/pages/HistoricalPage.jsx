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

  return {
    year, totalFyp, totalAnp, totalFyc, totalCases,
    headcount, rookies, seasoned, activeAgents, activityRate,
    monthlyFyp, monthlyAnp, monthlyFyc, monthlyCases,
    topFyp,
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

  // Agent retention: agents in prior year who appear in current year (by code)
  const retention = useMemo(() => {
    if (yearStats.length < 2) return null
    const currentAgents = new Set((allYearsMap[CURRENT_YEAR]?.agents ?? []).map(a => a.code).filter(Boolean))
    const results = []
    for (const s of yearStats) {
      if (s.year === CURRENT_YEAR) continue
      const priorCodes = new Set((allYearsMap[s.year]?.agents ?? []).map(a => a.code).filter(Boolean))
      const retained = [...priorCodes].filter(c => currentAgents.has(c)).length
      const attrited = priorCodes.size - retained
      const retentionRate = priorCodes.size > 0 ? (retained / priorCodes.size) * 100 : 0
      results.push({ year: s.year, total: priorCodes.size, retained, attrited, retentionRate })
    }
    return results
  }, [yearStats, allYearsMap])

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

        {/* ── 6. Agent Retention ───────────────────────────────────────────── */}
        {retention && retention.length > 0 && (
          <Section
            title="Agent Retention"
            subtitle={`How many agents from prior years are still active in ${CURRENT_YEAR}`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {retention.map(r => (
                <Card key={r.year}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">From {r.year}</p>
                      <p className="text-2xl font-black text-gray-800 mt-0.5"
                        style={{ fontFamily: 'DM Mono, monospace' }}>
                        {formatPct(r.retentionRate, 0)}
                      </p>
                      <p className="text-[10px] text-gray-400">retention rate</p>
                    </div>
                    <div className={`text-2xl ${r.retentionRate >= 70 ? '🟢' : r.retentionRate >= 50 ? '🟡' : '🔴'}`} />
                  </div>
                  <div className="h-2 bg-gray-100 rounded overflow-hidden mb-3">
                    <div className="h-full rounded" style={{
                      width: `${r.retentionRate}%`,
                      backgroundColor: r.retentionRate >= 70 ? '#4E9A51' : r.retentionRate >= 50 ? '#C97B1A' : '#D31145',
                    }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Total', value: r.total, color: '#6B7180' },
                      { label: 'Retained', value: r.retained, color: '#4E9A51' },
                      { label: 'Attrited', value: r.attrited, color: '#D31145' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p className="text-[9px] font-bold uppercase text-gray-400">{label}</p>
                        <p className="text-lg font-black" style={{ fontFamily: 'DM Mono, monospace', color }}>{value}</p>
                      </div>
                    ))}
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

      </div>
    </div>
  )
}
