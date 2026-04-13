import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { formatCurrency, formatNumber } from '../utils/formatters'
import KpiCard from '../components/KpiCard'
import Tag from '../components/Tag'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_ABBRS  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_MONTH_IDX = new Date().getMonth()
const CURRENT_YEAR      = new Date().getFullYear()

const MDRT_TARGET      = 3518400
const FAST_START_CASES = 5
const NINETY_DAYS      = 90 / 365.25

const FYC_TIERS = [
  { min: 350000, rate: 0.40, label: '₱350K+' },
  { min: 200000, rate: 0.35, label: '₱200K–349K' },
  { min: 120000, rate: 0.30, label: '₱120K–199K' },
  { min:  80000, rate: 0.20, label: '₱80K–119K' },
  { min:  50000, rate: 0.15, label: '₱50K–79K' },
  { min:  30000, rate: 0.10, label: '₱30K–49K' },
  { min:      0, rate: 0.00, label: 'Below ₱30K' },
]

// Tier colors for badges
const TIER_COLORS = {
  '₱350K+':       'bg-yellow-100 text-yellow-800 border border-yellow-300',
  '₱200K–349K':   'bg-orange-100 text-orange-800 border border-orange-300',
  '₱120K–199K':   'bg-red-100 text-red-800 border border-red-300',
  '₱80K–119K':    'bg-purple-100 text-purple-800 border border-purple-300',
  '₱50K–79K':     'bg-blue-100 text-blue-800 border border-blue-300',
  '₱30K–49K':     'bg-green-100 text-green-800 border border-green-300',
  'Below ₱30K':   'bg-gray-100 text-gray-600 border border-gray-200',
}

const MEDAL = ['🥇', '🥈', '🥉']

// ─── Helper functions ─────────────────────────────────────────────────────────

function getYtdFyp(agent) {
  return MONTH_ABBRS.slice(0, CURRENT_MONTH_IDX + 1)
    .reduce((s, abbr) => s + (agent.monthly?.[abbr]?.fyp || 0), 0)
}

function getCumulativeCases(agent) {
  if (!agent.apptDate || agent.apptDate < 19000101) return agent.casesTotal ?? 0
  const apptYear     = Math.floor(agent.apptDate / 10000)
  const apptMonthIdx = Math.floor((agent.apptDate % 10000) / 100) - 1
  const startIdx     = apptYear < CURRENT_YEAR ? 0 : apptMonthIdx
  let total = 0
  for (let i = startIdx; i <= CURRENT_MONTH_IDX; i++) {
    total += agent.monthly?.[MONTH_ABBRS[i]]?.cases || 0
  }
  return total
}

function getCurrentQuarter() {
  const m = new Date().getMonth()
  if (m < 3) return 'Q1'
  if (m < 6) return 'Q2'
  if (m < 9) return 'Q3'
  return 'Q4'
}

function getQuarterMonths(quarter) {
  const map = {
    Q1: ['JAN','FEB','MAR'],
    Q2: ['APR','MAY','JUN'],
    Q3: ['JUL','AUG','SEP'],
    Q4: ['OCT','NOV','DEC'],
  }
  return map[quarter] ?? []
}

function getFycTier(fyc) {
  return FYC_TIERS.find(t => fyc >= t.min) ?? FYC_TIERS[FYC_TIERS.length - 1]
}

function daysSinceAppt(apptDate) {
  if (!apptDate || apptDate < 19000101) return null
  const y = Math.floor(apptDate / 10000)
  const m = Math.floor((apptDate % 10000) / 100) - 1
  const d = apptDate % 100
  const appt = new Date(y, m, d)
  const now  = new Date()
  return Math.floor((now - appt) / (1000 * 60 * 60 * 24))
}

function getConsecutiveStreak(agent, upToMonthAbbr) {
  const upToIdx = MONTH_ABBRS.indexOf(upToMonthAbbr)
  if (upToIdx < 0) return 0
  let streak = 0
  for (let i = upToIdx; i >= 0; i--) {
    const mo = MONTH_ABBRS[i]
    const isProducing = (agent.monthly?.[mo]?.producing) || ((agent.monthly?.[mo]?.cases ?? 0) > 0)
    if (isProducing) streak++
    else break
  }
  return streak
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow px-6 py-5 mb-6 print-card ${className}`}>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="text-sm font-bold uppercase tracking-widest text-[#D31145] mb-3">
      {children}
    </p>
  )
}

// agents are pre-sorted and pre-filtered by parent (already have _val set, sliced to 3)
function PodiumCard({ title, agents, formatFn }) {
  return (
    <div className="flex-1 min-w-[200px]">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</p>
      <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
        {agents.length === 0 ? (
          <div className="px-4 py-5 text-center text-xs text-gray-400">No data this month</div>
        ) : (
          agents.map((agent, idx) => (
            <div
              key={agent.code ?? idx}
              className={`flex items-center gap-3 px-4 py-3 ${idx < agents.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <span className="text-xl leading-none w-7 flex-shrink-0">{MEDAL[idx]}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#333D47] text-sm truncate">
                  {agent.code
                    ? <Link to={`/agent/${agent.code}`} className="hover:text-[#D31145] hover:underline underline-offset-2 transition-colors">{agent.name}</Link>
                    : agent.name
                  }
                </div>
                <div className="text-[10px] text-gray-400 truncate">{agent.unitName || '—'}</div>
              </div>
              <div className="text-sm font-bold text-[#333D47] tabular-nums flex-shrink-0">
                {formatFn(agent._val)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BulletinPage() {
  const { data, isLoaded } = useData()

  const [selectedMonth, setSelectedMonth] = useState(MONTH_ABBRS[CURRENT_MONTH_IDX])

  // All hooks must run before early return
  const rawAgents = useMemo(
    () => (data?.agents ?? []).filter(a => a.manpowerInd),
    [data]
  )

  const uploadDate = data?.uploadDate ?? null

  // Available months: JAN through current
  const availableMonths = MONTH_ABBRS.slice(0, CURRENT_MONTH_IDX + 1)

  const selectedMonthLabel = MONTH_LABELS[MONTH_ABBRS.indexOf(selectedMonth)]
  const currentQuarter     = getCurrentQuarter()
  const quarterMonths      = getQuarterMonths(currentQuarter)

  // ── Section 1: Top 3 per metric ─────────────────────────────────────────────
  const topFyp = useMemo(() =>
    rawAgents
      .map(a => ({ ...a, _val: a.monthly?.[selectedMonth]?.fyp || 0 }))
      .filter(a => a._val > 0)
      .sort((a, b) => b._val - a._val)
      .slice(0, 3),
    [rawAgents, selectedMonth]
  )

  const topFyc = useMemo(() =>
    rawAgents
      .map(a => ({ ...a, _val: a.monthly?.[selectedMonth]?.fyc || 0 }))
      .filter(a => a._val > 0)
      .sort((a, b) => b._val - a._val)
      .slice(0, 3),
    [rawAgents, selectedMonth]
  )

  const topAnp = useMemo(() =>
    rawAgents
      .map(a => ({ ...a, _val: a.monthly?.[selectedMonth]?.anp || 0 }))
      .filter(a => a._val > 0)
      .sort((a, b) => b._val - a._val)
      .slice(0, 3),
    [rawAgents, selectedMonth]
  )

  const topCases = useMemo(() =>
    rawAgents
      .map(a => ({ ...a, _val: a.monthly?.[selectedMonth]?.cases || 0 }))
      .filter(a => a._val > 0)
      .sort((a, b) => b._val - a._val)
      .slice(0, 3),
    [rawAgents, selectedMonth]
  )

  // ── Section 2: FAST START Qualifiers ────────────────────────────────────────
  const fastStartQualifiers = useMemo(() =>
    rawAgents.filter(a => {
      if (!a.agentYears) return false
      if (a.agentYears > NINETY_DAYS) return false
      return getCumulativeCases(a) >= FAST_START_CASES
    }),
    [rawAgents]
  )

  // ── Section 3: MDRT Tracker ──────────────────────────────────────────────────
  const onPaceThreshold = MDRT_TARGET * (CURRENT_MONTH_IDX / 12) * 0.8

  const mdrtQualified = useMemo(() =>
    rawAgents
      .map(a => ({ ...a, _ytdFyp: getYtdFyp(a) }))
      .filter(a => a._ytdFyp >= MDRT_TARGET)
      .sort((a, b) => b._ytdFyp - a._ytdFyp),
    [rawAgents]
  )

  const mdrtOnPace = useMemo(() =>
    rawAgents
      .map(a => ({ ...a, _ytdFyp: getYtdFyp(a) }))
      .filter(a => a._ytdFyp >= onPaceThreshold && a._ytdFyp < MDRT_TARGET)
      .sort((a, b) => b._ytdFyp - a._ytdFyp),
    [rawAgents, onPaceThreshold]
  )

  // ── Section 4: Tier Movements ────────────────────────────────────────────────
  const tierAgents = useMemo(() => {
    return rawAgents
      .map(a => {
        const qFyc = quarterMonths.reduce((s, mo) => s + (a.monthly?.[mo]?.fyc || 0), 0)
        const tier = getFycTier(qFyc)
        return { ...a, _qFyc: qFyc, _tier: tier }
      })
      .filter(a => a._tier.rate > 0)
      .sort((a, b) => b._qFyc - a._qFyc)
  }, [rawAgents, quarterMonths])

  // Group by tier label
  const tierGroups = useMemo(() => {
    const groups = new Map()
    for (const a of tierAgents) {
      const label = a._tier.label
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label).push(a)
    }
    // Return in FYC_TIERS order (highest first), skipping "Below ₱30K"
    return FYC_TIERS
      .filter(t => t.rate > 0 && groups.has(t.label))
      .map(t => ({ ...t, agents: groups.get(t.label) }))
  }, [tierAgents])

  // ── Section 5: Consistent Monthly Producers ──────────────────────────────────
  const consistentProducers = useMemo(() =>
    rawAgents
      .map(a => ({ ...a, _streak: getConsecutiveStreak(a, selectedMonth) }))
      .filter(a => a._streak >= 2)
      .sort((a, b) => b._streak - a._streak || (b.monthly?.[selectedMonth]?.fyc ?? 0) - (a.monthly?.[selectedMonth]?.fyc ?? 0)),
    [rawAgents, selectedMonth]
  )

  // ── Section 6: Agency Snapshot KPIs ──────────────────────────────────────────
  const snapshotKpis = useMemo(() => {
    const producing    = rawAgents.filter(a => a.monthly?.[selectedMonth]?.producing).length
    const totalCases   = rawAgents.reduce((s, a) => s + (a.monthly?.[selectedMonth]?.cases || 0), 0)
    const totalFyp     = rawAgents.reduce((s, a) => s + (a.monthly?.[selectedMonth]?.fyp   || 0), 0)
    const totalFyc     = rawAgents.reduce((s, a) => s + (a.monthly?.[selectedMonth]?.fyc   || 0), 0)
    const totalAnp     = rawAgents.reduce((s, a) => s + (a.monthly?.[selectedMonth]?.anp   || 0), 0)
    const arVals       = rawAgents.map(a => a.activityRatio).filter(v => v != null && v > 0)
    const avgAr        = arVals.length ? arVals.reduce((s, v) => s + v, 0) / arVals.length : null
    return { producing, totalCases, totalFyp, totalFyc, totalAnp, avgAr }
  }, [rawAgents, selectedMonth])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>

      <div className="min-h-screen bg-aia-gray">
        <div className="max-w-screen-xl mx-auto px-4 py-8">

          {/* ── Header ────────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-[#333D47] tracking-tight leading-tight">
                Monthly Production Bulletin
              </h1>
              <p className="text-lg font-semibold text-[#D31145] mt-1">
                {selectedMonthLabel} {CURRENT_YEAR}
              </p>
              {uploadDate && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Data as of {uploadDate}
                </p>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap no-print">
              {/* Month selector */}
              <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 flex-wrap">
                {availableMonths.map((abbr) => (
                  <button
                    key={abbr}
                    onClick={() => setSelectedMonth(abbr)}
                    className={[
                      'px-3 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
                      selectedMonth === abbr
                        ? 'bg-[#D31145] text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100',
                    ].join(' ')}
                  >
                    {abbr}
                  </button>
                ))}
              </div>

              {/* Print button */}
              <button
                onClick={() => window.print()}
                className="bg-[#D31145] text-white px-4 py-2 rounded font-semibold text-sm hover:bg-[#b80e37] transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            </div>
          </div>

          {/* ── Section 1: Top 3 Performers ────────────────────────────────────── */}
          <SectionCard>
            <SectionTitle>Top 3 Performers — {selectedMonthLabel}</SectionTitle>
            <div className="flex flex-wrap gap-4">
              <PodiumCard
                title="Top FYP Producers"
                agents={topFyp}
                formatFn={v => formatCurrency(v, true)}
              />
              <PodiumCard
                title="Top FYC Producers"
                agents={topFyc}
                formatFn={v => formatCurrency(v, true)}
              />
              <PodiumCard
                title="Top ANP Producers"
                agents={topAnp}
                formatFn={v => formatCurrency(v, true)}
              />
              <PodiumCard
                title="Top Cases"
                agents={topCases}
                formatFn={v => formatNumber(v)}
              />
            </div>
          </SectionCard>

          {/* ── Section 2: FAST START Qualifiers ────────────────────────────────── */}
          <SectionCard>
            <SectionTitle>FAST START Qualifiers</SectionTitle>
            <p className="text-xs text-gray-400 mb-4">
              New recruits with ≥{FAST_START_CASES} cases in their first 90 days
            </p>
            {fastStartQualifiers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No new FAST START qualifiers this period.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {fastStartQualifiers.map((agent, idx) => {
                  const days     = daysSinceAppt(agent.apptDate)
                  const cumCases = getCumulativeCases(agent)
                  return (
                    <div
                      key={agent.code ?? idx}
                      className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-lg leading-none">⭐</span>
                        <Tag variant="new">Fast Start</Tag>
                      </div>
                      <div className="font-bold text-[#333D47] text-sm leading-snug mt-1">
                        {agent.code
                          ? <Link to={`/agent/${agent.code}`} className="hover:text-[#D31145] hover:underline underline-offset-2 transition-colors">{agent.name}</Link>
                          : agent.name
                        }
                      </div>
                      <div className="text-[10px] text-gray-500">{agent.unitName || '—'}</div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="text-[11px] text-gray-600">
                          <span className="font-bold text-[#D31145] text-sm">{cumCases}</span>
                          <span className="ml-1">cases</span>
                        </div>
                        {days !== null && (
                          <div className="text-[11px] text-gray-400">
                            {days}d since appt
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* ── Section 3: MDRT Tracker ──────────────────────────────────────────── */}
          <SectionCard>
            <SectionTitle>MDRT Tracker</SectionTitle>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-gray-400">
                Target: {formatCurrency(MDRT_TARGET)} YTD FYP
              </span>
              <Tag variant="default">
                {MONTH_LABELS[CURRENT_MONTH_IDX]} {CURRENT_YEAR}
              </Tag>
            </div>

            <div className="flex flex-col gap-5">
              {/* Qualified */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Qualified ✅
                  {mdrtQualified.length > 0 && (
                    <span className="ml-2 bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-semibold normal-case tracking-normal">
                      {mdrtQualified.length}
                    </span>
                  )}
                </p>
                {mdrtQualified.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3 px-1">
                    Keep pushing — qualifications are being built. You've got this!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {mdrtQualified.map((agent, idx) => {
                      const pct = ((agent._ytdFyp / MDRT_TARGET) * 100).toFixed(1)
                      return (
                        <div
                          key={agent.code ?? idx}
                          className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3"
                        >
                          <span className="text-xl leading-none">🏆</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-[#333D47] text-sm truncate">
                              {agent.code
                                ? <Link to={`/agent/${agent.code}`} className="hover:text-[#D31145] hover:underline underline-offset-2 transition-colors">{agent.name}</Link>
                                : agent.name
                              }
                            </div>
                            <div className="text-[10px] text-gray-500 truncate">{agent.unitName || '—'}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-green-700 tabular-nums">
                              {formatCurrency(agent._ytdFyp, true)}
                            </div>
                            <div className="text-[10px] text-green-500 font-semibold">{pct}%</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* On Pace */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  On Pace 🔥
                  {mdrtOnPace.length > 0 && (
                    <span className="ml-2 bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px] font-semibold normal-case tracking-normal">
                      {mdrtOnPace.length}
                    </span>
                  )}
                </p>
                {mdrtOnPace.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3 px-1">
                    No advisors currently on pace. Encourage your team to accelerate!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {mdrtOnPace.map((agent, idx) => {
                      const pct = ((agent._ytdFyp / MDRT_TARGET) * 100).toFixed(1)
                      return (
                        <div
                          key={agent.code ?? idx}
                          className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3"
                        >
                          <span className="text-xl leading-none">🔥</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-[#333D47] text-sm truncate">
                              {agent.code
                                ? <Link to={`/agent/${agent.code}`} className="hover:text-[#D31145] hover:underline underline-offset-2 transition-colors">{agent.name}</Link>
                                : agent.name
                              }
                            </div>
                            <div className="text-[10px] text-gray-500 truncate">{agent.unitName || '—'}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-orange-700 tabular-nums">
                              {formatCurrency(agent._ytdFyp, true)}
                            </div>
                            <div className="text-[10px] text-orange-500 font-semibold">{pct}%</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* ── Section 4: Bonus Qualifiers ─────────────────────────────────────────── */}
          <SectionCard>
            <SectionTitle>Bonus Qualifiers</SectionTitle>
            <p className="text-xs text-gray-400 mb-4">
              {currentQuarter} {CURRENT_YEAR} — FYC Bonus Tier based on quarterly FYC
            </p>

            {tierGroups.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No agents have reached a qualifying tier this quarter.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#D31145] text-white text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                      <th className="py-2.5 px-3 text-left rounded-tl">Advisor</th>
                      <th className="py-2.5 px-3 text-left">Unit</th>
                      <th className="py-2.5 px-3 text-left">Tier</th>
                      <th className="py-2.5 px-3 text-right">Qtly FYC</th>
                      <th className="py-2.5 px-3 text-right rounded-tr">Est. Bonus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tierGroups.map(group =>
                      group.agents.map((agent, idx) => {
                        const estBonus = agent._qFyc * group.rate
                        const isFirstInGroup = idx === 0
                        return (
                          <tr
                            key={agent.code ?? `${group.label}-${idx}`}
                            className={`border-b border-gray-50 ${isFirstInGroup && group !== tierGroups[0] ? 'border-t-2 border-t-gray-100' : ''}`}
                          >
                            <td className="py-2 px-3 font-semibold text-[#333D47] text-xs whitespace-nowrap">
                              {agent.code
                                ? <Link to={`/agent/${agent.code}`} className="hover:text-[#D31145] hover:underline underline-offset-2 transition-colors">{agent.name}</Link>
                                : agent.name
                              }
                            </td>
                            <td className="py-2 px-3 text-[10px] text-gray-400 whitespace-nowrap max-w-[160px] truncate">
                              {agent.unitName || '—'}
                            </td>
                            <td className="py-2 px-3">
                              {isFirstInGroup && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${TIER_COLORS[group.label] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                                  {group.label} · {(group.rate * 100).toFixed(0)}%
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums text-xs font-semibold text-[#333D47]">
                              {formatCurrency(agent._qFyc, true)}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums text-xs font-bold text-[#D31145]">
                              {formatCurrency(estBonus, true)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* ── Section 5: Consistent Monthly Producers ──────────────────────────── */}
          <SectionCard>
            <SectionTitle>Consistent Monthly Producers</SectionTitle>
            <p className="text-xs text-gray-400 mb-4">
              Advisors on a consecutive producing streak through {selectedMonthLabel}
            </p>
            {consistentProducers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No advisors with a multi-month producing streak this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#D31145] text-white text-[10px] font-bold uppercase tracking-widest">
                      <th className="py-2.5 px-3 text-left rounded-tl">Advisor</th>
                      <th className="py-2.5 px-3 text-left">Unit</th>
                      <th className="py-2.5 px-3 text-center">Streak</th>
                      <th className="py-2.5 px-3 text-right">FYC ({selectedMonth})</th>
                      <th className="py-2.5 px-3 text-right rounded-tr">Cases ({selectedMonth})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consistentProducers.map((agent, idx) => {
                      const monthFyc   = agent.monthly?.[selectedMonth]?.fyc ?? 0
                      const monthCases = agent.monthly?.[selectedMonth]?.cases ?? 0
                      const streakColor =
                        agent._streak >= 9 ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                        agent._streak >= 6 ? 'bg-orange-100 text-orange-700 border border-orange-300' :
                        agent._streak >= 3 ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                                             'bg-gray-100 text-gray-600 border border-gray-200'
                      const streakIcon =
                        agent._streak >= 9 ? '🔥' :
                        agent._streak >= 6 ? '⚡' :
                        agent._streak >= 3 ? '📈' : '✅'
                      return (
                        <tr key={agent.code ?? idx} className={idx % 2 === 0 ? '' : 'bg-gray-50/50'}>
                          <td className="py-2 px-3 font-semibold text-[#333D47] text-xs">
                            {agent.code
                              ? <Link to={`/agent/${agent.code}`} className="hover:text-[#D31145] hover:underline underline-offset-2 transition-colors">{agent.name}</Link>
                              : agent.name
                            }
                          </td>
                          <td className="py-2 px-3 text-[10px] text-gray-400 truncate max-w-[140px]">
                            {agent.unitName || '—'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${streakColor}`}>
                              {streakIcon} {agent._streak} mo
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-xs font-semibold text-[#333D47]">
                            {monthFyc > 0 ? formatCurrency(monthFyc, true) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-xs text-gray-600">
                            {monthCases > 0 ? monthCases : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* ── Section 6: Agency Snapshot ───────────────────────────────────────── */}
          <SectionCard>
            <SectionTitle>Agency Snapshot — {selectedMonthLabel}</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                title="Producing Advisors"
                value={formatNumber(snapshotKpis.producing)}
                color="green"
                icon="👥"
              />
              <KpiCard
                title="Total Cases"
                value={formatNumber(snapshotKpis.totalCases)}
                color="gray"
                icon="📋"
              />
              <KpiCard
                title="Total FYP"
                value={formatCurrency(snapshotKpis.totalFyp, true)}
                color="red"
                icon="💰"
              />
              <KpiCard
                title="Total FYC"
                value={formatCurrency(snapshotKpis.totalFyc, true)}
                color="red"
                icon="💵"
              />
              <KpiCard
                title="Total ANP"
                value={formatCurrency(snapshotKpis.totalAnp, true)}
                color="blue"
                icon="📈"
              />
              <KpiCard
                title="Avg Activity Ratio"
                value={snapshotKpis.avgAr != null ? `${snapshotKpis.avgAr.toFixed(1)}%` : '—'}
                color="gray"
                icon="⚡"
              />
            </div>
          </SectionCard>

        </div>
      </div>
    </>
  )
}
