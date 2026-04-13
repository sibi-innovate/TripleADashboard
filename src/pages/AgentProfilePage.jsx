import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { formatCurrency, formatNumber } from '../utils/formatters'
import Tag from '../components/Tag'
import StatusIndicator from '../components/StatusIndicator'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_ABBRS  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH_IDX = new Date().getMonth()  // 0-indexed

const MDRT_TARGET      = 3_518_400
const FAST_START_CASES = 5
const NINETY_DAYS      = 90 / 365.25

// ACE Campaign 2026
const ACE_FYC_TARGET   = 300_000
const ACE_CASES_TARGET = 24
const ACE_PERS_TARGET  = 85.0

const FYC_TIERS = [
  { min: 350_000, rate: 0.40, label: '₱350K+' },
  { min: 200_000, rate: 0.35, label: '₱200K–349K' },
  { min: 120_000, rate: 0.30, label: '₱120K–199K' },
  { min:  80_000, rate: 0.20, label: '₱80K–119K' },
  { min:  50_000, rate: 0.15, label: '₱50K–79K' },
  { min:  30_000, rate: 0.10, label: '₱30K–49K' },
  { min:       0, rate: 0.00, label: 'Below ₱30K' },
]
const ROOKIE_TIER = { min: 20_000, rate: 0.10, label: '₱20K–29K (Rookie)' }

const CCB_TIERS = [
  { min: 9, rate: 0.20, label: '9+ cases' },
  { min: 7, rate: 0.15, label: '7–8 cases' },
  { min: 5, rate: 0.10, label: '5–6 cases' },
  { min: 3, rate: 0.05, label: '3–4 cases' },
  { min: 0, rate: 0.00, label: '<3 cases' },
]

const QUARTER_MONTHS = {
  Q1: ['JAN','FEB','MAR'],
  Q2: ['APR','MAY','JUN'],
  Q3: ['JUL','AUG','SEP'],
  Q4: ['OCT','NOV','DEC'],
}

function getCurrentQuarter() {
  const m = new Date().getMonth()
  if (m < 3) return 'Q1'
  if (m < 6) return 'Q2'
  if (m < 9) return 'Q3'
  return 'Q4'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatApptDate(apptDateInt) {
  if (!apptDateInt || apptDateInt < 19000101) return '—'
  const s = String(apptDateInt)
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
}

function daysSinceAppt(apptDateInt) {
  if (!apptDateInt || apptDateInt < 19000101) return null
  const s = String(apptDateInt)
  const d = new Date(Number(s.slice(0,4)), Number(s.slice(4,6))-1, Number(s.slice(6,8)))
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function getFycTier(fyc, isRookie) {
  if (isRookie && fyc >= 20_000 && fyc < 30_000) return ROOKIE_TIER
  return FYC_TIERS.find(t => fyc >= t.min) ?? FYC_TIERS[FYC_TIERS.length - 1]
}

function getCcbTier(cases) {
  return CCB_TIERS.find(t => cases >= t.min) ?? CCB_TIERS[CCB_TIERS.length - 1]
}

function getPersMultiplier(pers) {
  if (pers === null) return 1.0
  if (pers >= 82.5)  return 1.0
  if (pers >= 75.0)  return 0.8
  return 0.0
}

function computeBonus(agent, quarter) {
  const isRookie = agent.segment === 'Rookie' && agent.agentYear === 1
  const months   = QUARTER_MONTHS[quarter].map(abbr => agent.monthly?.[abbr] ?? {})

  const qtlyFyc      = months.reduce((s, m) => s + (m.fyc   || 0), 0)
  const monthlyCases = months.map(m => m.cases || 0)
  const qtlyCases    = monthlyCases.reduce((s, c) => s + c, 0)
  const monthsWithCases = monthlyCases.filter(c => c > 0).length
  const ccbEligible  = monthsWithCases >= 2

  const persRaw        = agent.quarterlyPers?.[quarter] ?? null
  const persMultiplier = getPersMultiplier(persRaw)

  const fycTier = getFycTier(qtlyFyc, isRookie)
  const ccbTier = ccbEligible ? getCcbTier(qtlyCases) : CCB_TIERS[CCB_TIERS.length - 1]

  const fycBonus   = qtlyFyc * fycTier.rate
  const ccbBonus   = ccbEligible ? qtlyFyc * ccbTier.rate : 0
  const totalBonus = (fycBonus + ccbBonus) * persMultiplier

  // Next tiers
  let nextFycTier
  if (isRookie && qtlyFyc >= 20_000 && qtlyFyc < 30_000) {
    nextFycTier = FYC_TIERS.find(t => t.min === 30_000)
  } else {
    const idx = FYC_TIERS.findIndex(t => qtlyFyc >= t.min)
    nextFycTier = idx > 0 ? FYC_TIERS[idx - 1] : null
  }
  const ccbTierIdx  = CCB_TIERS.findIndex(t => qtlyCases >= t.min)
  const nextCcbTier = ccbEligible && ccbTierIdx > 0 ? CCB_TIERS[ccbTierIdx - 1] : null

  return {
    qtlyFyc, qtlyCases, monthlyCases, ccbEligible,
    fycTier, ccbTier, nextFycTier, nextCcbTier,
    fycBonus, ccbBonus, totalBonus,
    persRaw, persMultiplier,
    monthsWithCases,
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressBar({ pct, colorClass = 'bg-[#88B943]', className = '' }) {
  const clamped = Math.min(1, Math.max(0, pct))
  return (
    <div className={`w-full h-2 bg-gray-100 rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
        style={{ width: `${(clamped * 100).toFixed(1)}%` }}
      />
    </div>
  )
}

function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow px-5 py-4 ${className}`}>
      <h2 className="text-sm font-bold uppercase tracking-widest text-[#D31145] mb-3">
        {title}
      </h2>
      {children}
    </div>
  )
}

function SmallKpi({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl px-4 py-3 border ${highlight ? 'border-[#D31145]/30 bg-[#D31145]/5' : 'border-gray-100 bg-gray-50'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`text-xl font-extrabold leading-tight mt-0.5 tabular-nums ${highlight ? 'text-[#D31145]' : 'text-[#333D47]'}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function persColor(pct) {
  if (pct == null)  return 'bg-gray-100 text-gray-400 border-transparent'
  if (pct >= 82.5)  return 'bg-[#88B943]/15 text-[#5a8a28] border-[#88B943]/30'
  if (pct >= 75)    return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-[#D31145]/10 text-[#D31145] border-[#D31145]/20'
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AgentProfilePage() {
  const { code }           = useParams()
  const navigate           = useNavigate()
  const { data, isLoaded } = useData()

  const [selectedMonth,   setSelectedMonth]   = useState(MONTH_ABBRS[CURRENT_MONTH_IDX])
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter())

  const agent = data?.agents?.find(a => a.code === code)

  if (!isLoaded) { navigate('/'); return null }

  if (!agent) {
    return (
      <div className="min-h-screen bg-aia-gray flex items-center justify-center">
        <div className="bg-white rounded-xl shadow px-8 py-10 text-center max-w-sm">
          <p className="text-gray-500 text-sm mb-4">
            No advisor found with code <span className="font-mono font-semibold">{code}</span>.
          </p>
          <button onClick={() => navigate(-1)}
            className="px-4 py-2 bg-[#D31145] text-white text-sm font-semibold rounded-lg hover:bg-[#b80e3a] transition-colors">
            ← Back
          </button>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Derived values
  // ------------------------------------------------------------------

  const isRookie   = agent.segment === 'Rookie'
  const monthData  = agent.monthly?.[selectedMonth] ?? {}

  // Months active (producing months from JAN to current month)
  const ytdMonths      = MONTH_ABBRS.slice(0, CURRENT_MONTH_IDX + 1)
  const monthsActive   = ytdMonths.filter(mo => agent.monthly?.[mo]?.producing).length
  const monthsElapsed  = ytdMonths.length

  // YTD totals (JAN → current month)
  const ytdFyc   = ytdMonths.reduce((s, mo) => s + (agent.monthly?.[mo]?.fyc   || 0), 0)
  const ytdFyp   = ytdMonths.reduce((s, mo) => s + (agent.monthly?.[mo]?.fyp   || 0), 0)
  const ytdCases = ytdMonths.reduce((s, mo) => s + (agent.monthly?.[mo]?.cases || 0), 0)

  // Average FYC per month (YTD FYC / months elapsed since Jan 1)
  const avgFycPerMonth = monthsElapsed > 0 ? ytdFyc / monthsElapsed : 0

  // YTD persistency — average of available monthly values
  const persList = ytdMonths.map(mo => agent.monthly?.[mo]?.persistency).filter(v => v != null)
  const ytdPersAvg = persList.length > 0 ? persList.reduce((s,v) => s+v, 0) / persList.length : null

  // ACE Campaign progress
  const aceFycPct   = Math.min(1, ytdFyc / ACE_FYC_TARGET)
  const aceCasesPct = Math.min(1, ytdCases / ACE_CASES_TARGET)
  const acePersPct  = ytdPersAvg != null ? Math.min(1, ytdPersAvg / ACE_PERS_TARGET) : 0
  const aceQualified = ytdFyc >= ACE_FYC_TARGET && ytdCases >= ACE_CASES_TARGET && (ytdPersAvg ?? 0) >= ACE_PERS_TARGET

  // Quarter bonus
  const bonus = computeBonus(agent, selectedQuarter)

  // MDRT
  const mdrtPct     = MDRT_TARGET > 0 ? ytdFyp / MDRT_TARGET : 0
  const mdrtReached = ytdFyp >= MDRT_TARGET

  // 90-Day
  const show90Day         = agent.agentYears == null || agent.agentYears <= NINETY_DAYS
  const days90            = daysSinceAppt(agent.apptDate)
  const cumulativeCases90 = ytdCases
  const fastStart         = cumulativeCases90 >= FAST_START_CASES

  // Chart data
  const rawChartMonths = MONTH_ABBRS.slice(0, CURRENT_MONTH_IDX + 1)
  let lastDataIdx = -1
  for (let i = rawChartMonths.length - 1; i >= 0; i--) {
    const m = agent.monthly?.[rawChartMonths[i]]
    if (m && (m.fyp || m.fyc || m.cases)) { lastDataIdx = i; break }
  }
  const chartMonths = lastDataIdx >= 0 ? rawChartMonths.slice(0, lastDataIdx + 1) : rawChartMonths
  const chartData = chartMonths.map(abbr => {
    const m = agent.monthly?.[abbr] || {}
    return {
      month: MONTH_SHORT[MONTH_ABBRS.indexOf(abbr)],
      FYP:   m.fyp   || 0,
      FYC:   m.fyc   || 0,
      Cases: (m.cases || 0) * 1000,
    }
  })

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-aia-gray">
      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-5">

        {/* ── 1. HEADER */}
        <div className="bg-white rounded-xl shadow px-5 py-4">
          <button onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#D31145] hover:text-[#b80e3a] transition-colors mb-3">
            ← Back
          </button>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-[#333D47] tracking-tight leading-tight">{agent.name}</h1>
            <Tag variant={isRookie ? 'rookie' : 'seasoned'}>{agent.segment ?? 'Unknown'}</Tag>
            {agent.isProducing
              ? <StatusIndicator status="positive" label="Producing" />
              : <StatusIndicator status="neutral"  label="Non-Producing" />
            }
          </div>
          <p className="text-xs font-mono text-gray-400 mb-2">{agent.code}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            {agent.area     && <span><span className="font-semibold text-gray-700">Area:</span> {agent.area}</span>}
            {agent.unitName && <span><span className="font-semibold text-gray-700">Unit:</span> {agent.unitName}</span>}
            <span><span className="font-semibold text-gray-700">Agent Year:</span> {agent.agentYear ?? '—'}</span>
            <span><span className="font-semibold text-gray-700">Appointed:</span> {formatApptDate(agent.apptDate)}</span>
            {agent.recruiterName && (
              <span>
                <span className="font-semibold text-gray-700">Recruited by:</span> {agent.recruiterName}
                {agent.recruiterCode && <span className="text-gray-400 ml-1 font-mono">({agent.recruiterCode})</span>}
              </span>
            )}
          </div>
        </div>

        {/* ── 2. MONTH SELECTOR + MONTHS ACTIVE */}
        <div className="bg-white rounded-xl shadow px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">View Month</p>
              <div className="flex flex-wrap gap-1">
                {MONTH_ABBRS.slice(0, CURRENT_MONTH_IDX + 1).map(abbr => {
                  const hasProd = agent.monthly?.[abbr]?.producing
                  return (
                    <button
                      key={abbr}
                      onClick={() => setSelectedMonth(abbr)}
                      className={[
                        'px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors border',
                        selectedMonth === abbr
                          ? 'bg-[#D31145] text-white border-[#D31145]'
                          : hasProd
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'text-gray-400 border-gray-200 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {MONTH_SHORT[MONTH_ABBRS.indexOf(abbr)].slice(0,3)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Months Active</p>
                <p className="text-2xl font-extrabold text-[#333D47]">
                  {monthsActive}
                  <span className="text-sm text-gray-400 font-medium"> / {monthsElapsed}</span>
                </p>
                <p className="text-[10px] text-gray-400">
                  {monthsElapsed > 0 ? `${Math.round(monthsActive / monthsElapsed * 100)}% activity rate` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. MONTHLY QUICK STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SmallKpi
            label={`FYC — ${MONTH_SHORT[MONTH_ABBRS.indexOf(selectedMonth)]}`}
            value={formatCurrency(monthData.fyc || 0, true)}
            highlight={!!monthData.fyc}
          />
          <SmallKpi
            label={`FYP — ${MONTH_SHORT[MONTH_ABBRS.indexOf(selectedMonth)]}`}
            value={formatCurrency(monthData.fyp || 0, true)}
          />
          <SmallKpi
            label={`Cases — ${MONTH_SHORT[MONTH_ABBRS.indexOf(selectedMonth)]}`}
            value={formatNumber(monthData.cases || 0)}
          />
          <SmallKpi
            label={`Producing — ${MONTH_SHORT[MONTH_ABBRS.indexOf(selectedMonth)]}`}
            value={monthData.producing ? 'Yes' : 'No'}
            highlight={!!monthData.producing}
          />
        </div>

        {/* ── 4. YTD SUMMARY + AVERAGE FYC */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SmallKpi label="YTD FYC"             value={formatCurrency(ytdFyc, true)} />
          <SmallKpi label="YTD FYP"             value={formatCurrency(ytdFyp, true)} />
          <SmallKpi label="YTD Cases"           value={formatNumber(ytdCases)} />
          <SmallKpi
            label="Avg FYC / Month"
            value={formatCurrency(avgFycPerMonth, true)}
            sub={`Total ÷ ${monthsElapsed} months`}
          />
        </div>

        {/* ── 5. ACE CAMPAIGN 2026 */}
        <SectionCard title={`2026 Agency ACE Campaign${aceQualified ? ' ✅' : ''}`}>
          <p className="text-xs text-gray-400 mb-4">Jan 1 – Dec 31, 2026 · Targets: ₱300K FYC · 24 Cases · 85% Persistency</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

            {/* FYC */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-gray-600">FYC</span>
                <span className="tabular-nums text-gray-500">
                  {formatCurrency(ytdFyc, true)} / {formatCurrency(ACE_FYC_TARGET, true)}
                </span>
              </div>
              <ProgressBar
                pct={aceFycPct}
                colorClass={ytdFyc >= ACE_FYC_TARGET ? 'bg-[#88B943]' : 'bg-[#D31145]'}
                className="mb-1"
              />
              {ytdFyc >= ACE_FYC_TARGET
                ? <p className="text-[11px] text-[#5a8a28] font-bold">✅ Qualified</p>
                : <p className="text-[11px] text-gray-400">{formatCurrency(ACE_FYC_TARGET - ytdFyc, true)} remaining · {(aceFycPct*100).toFixed(1)}%</p>
              }
            </div>

            {/* Cases */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-gray-600">Policy Count</span>
                <span className="tabular-nums text-gray-500">{ytdCases} / {ACE_CASES_TARGET}</span>
              </div>
              <ProgressBar
                pct={aceCasesPct}
                colorClass={ytdCases >= ACE_CASES_TARGET ? 'bg-[#88B943]' : 'bg-[#D31145]'}
                className="mb-1"
              />
              {ytdCases >= ACE_CASES_TARGET
                ? <p className="text-[11px] text-[#5a8a28] font-bold">✅ Qualified</p>
                : <p className="text-[11px] text-gray-400">{ACE_CASES_TARGET - ytdCases} more cases · {(aceCasesPct*100).toFixed(1)}%</p>
              }
            </div>

            {/* Persistency */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-gray-600">Persistency</span>
                <span className="tabular-nums text-gray-500">
                  {ytdPersAvg != null ? `${ytdPersAvg.toFixed(1)}%` : '—'} / {ACE_PERS_TARGET}%
                </span>
              </div>
              <ProgressBar
                pct={acePersPct}
                colorClass={(ytdPersAvg ?? 0) >= ACE_PERS_TARGET ? 'bg-[#88B943]' : 'bg-amber-400'}
                className="mb-1"
              />
              {ytdPersAvg == null
                ? <p className="text-[11px] text-gray-400">No persistency data</p>
                : (ytdPersAvg >= ACE_PERS_TARGET)
                ? <p className="text-[11px] text-[#5a8a28] font-bold">✅ Qualified</p>
                : <p className="text-[11px] text-gray-400">Need {(ACE_PERS_TARGET - ytdPersAvg).toFixed(1)}% more · avg of monthly</p>
              }
            </div>

          </div>

          {aceQualified && (
            <div className="mt-4 px-4 py-3 bg-[#88B943]/10 border border-[#88B943]/30 rounded-xl text-center">
              <p className="text-sm font-extrabold text-[#5a8a28]">🏆 ACE Campaign Qualified!</p>
              <p className="text-xs text-[#5a8a28]/70 mt-0.5">All three targets met for 2026</p>
            </div>
          )}
        </SectionCard>

        {/* ── 6. QUARTER BONUS */}
        <SectionCard title="Quarter Bonus Progress">
          {/* Quarter selector */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 self-start inline-flex">
            {['Q1','Q2','Q3','Q4'].map(q => (
              <button
                key={q}
                onClick={() => setSelectedQuarter(q)}
                className={[
                  'px-4 py-1.5 rounded-md text-sm font-bold transition-colors',
                  selectedQuarter === q ? 'bg-[#D31145] text-white shadow-sm' : 'text-gray-500 hover:bg-white',
                ].join(' ')}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Quarter months breakdown */}
          <div className="flex gap-2 mb-4">
            {QUARTER_MONTHS[selectedQuarter].map((abbr, i) => (
              <div key={abbr} className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-center border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase">{abbr}</p>
                <p className="text-sm font-extrabold text-[#333D47] tabular-nums">
                  {formatCurrency(agent.monthly?.[abbr]?.fyc || 0, true)}
                </p>
                <p className="text-[10px] text-gray-400">{agent.monthly?.[abbr]?.cases || 0} cases</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* FYC Bonus */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1F78AD] mb-3">FYC Bonus</p>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Quarter FYC</span>
                <span className="font-bold tabular-nums">{formatCurrency(bonus.qtlyFyc, true)}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Tier</span>
                <span className="font-bold text-[#1F78AD]">{bonus.fycTier.label}</span>
              </div>
              <div className="flex justify-between text-xs mb-3">
                <span className="text-gray-500">Rate</span>
                <span className="font-bold">{(bonus.fycTier.rate*100).toFixed(0)}%</span>
              </div>
              <div className="border-t border-gray-200 pt-3 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-600">FYC Bonus</span>
                  <span className="font-extrabold text-[#333D47] tabular-nums">{formatCurrency(bonus.fycBonus, true)}</span>
                </div>
              </div>
              {bonus.nextFycTier ? (
                <>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Progress to {bonus.nextFycTier.label}</span>
                    <span>{formatCurrency(bonus.nextFycTier.min - bonus.qtlyFyc, true)} away</span>
                  </div>
                  <ProgressBar
                    pct={(bonus.qtlyFyc - bonus.fycTier.min) / (bonus.nextFycTier.min - bonus.fycTier.min)}
                    colorClass="bg-[#1F78AD]"
                  />
                </>
              ) : (
                <p className="text-[11px] text-[#88B943] font-bold">✅ Highest FYC tier</p>
              )}
            </div>

            {/* Case Count Bonus (CCB) */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-bold uppercase tracking-widest text-[#88B943] mb-3">Case Count Bonus (CCB)</p>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Quarter Cases</span>
                <span className="font-bold tabular-nums">{bonus.qtlyCases}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Months with Cases</span>
                <span className={`font-bold ${bonus.ccbEligible ? 'text-[#88B943]' : 'text-amber-600'}`}>
                  {bonus.monthsWithCases} / 3
                  {!bonus.ccbEligible && ' (need 2+)'}
                </span>
              </div>
              <div className="flex justify-between text-xs mb-3">
                <span className="text-gray-500">CCB Rate</span>
                <span className="font-bold">{(bonus.ccbTier.rate*100).toFixed(0)}%</span>
              </div>
              <div className="border-t border-gray-200 pt-3 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-600">CCB Bonus</span>
                  <span className="font-extrabold text-[#333D47] tabular-nums">{formatCurrency(bonus.ccbBonus, true)}</span>
                </div>
              </div>
              {bonus.ccbEligible && bonus.nextCcbTier ? (
                <>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Progress to {bonus.nextCcbTier.label}</span>
                    <span>{bonus.nextCcbTier.min - bonus.qtlyCases} more cases</span>
                  </div>
                  <ProgressBar
                    pct={(bonus.qtlyCases - bonus.ccbTier.min) / (bonus.nextCcbTier.min - bonus.ccbTier.min)}
                    colorClass="bg-[#88B943]"
                  />
                </>
              ) : !bonus.ccbEligible ? (
                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                  Need cases in at least 2 months to unlock CCB
                </p>
              ) : (
                <p className="text-[11px] text-[#88B943] font-bold">✅ Highest CCB tier</p>
              )}
            </div>
          </div>

          {/* Total bonus + persistency multiplier */}
          <div className="mt-4 flex flex-wrap gap-3 items-center justify-between bg-[#333D47]/5 rounded-xl px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Total {selectedQuarter} Bonus</p>
              <p className="text-2xl font-extrabold text-[#333D47] tabular-nums">{formatCurrency(bonus.totalBonus, true)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Persistency Multiplier</p>
              <p className={`text-lg font-extrabold tabular-nums ${bonus.persMultiplier === 1 ? 'text-[#88B943]' : bonus.persMultiplier === 0.8 ? 'text-amber-600' : 'text-[#D31145]'}`}>
                {(bonus.persMultiplier * 100).toFixed(0)}%
                {bonus.persRaw != null && <span className="text-xs font-normal text-gray-400 ml-1">({bonus.persRaw.toFixed(1)}% pers)</span>}
              </p>
            </div>
          </div>

          {isRookie && (
            <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Year-1 Rookie: An additional tier applies — ₱20K–₱29K FYC qualifies at 10% bonus rate.
            </p>
          )}
        </SectionCard>

        {/* ── 7. MDRT PROGRESS */}
        <SectionCard title="MDRT Progress">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">YTD FYP</p>
              <p className="text-xl font-extrabold text-[#333D47]">{formatCurrency(ytdFyp)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">MDRT Target</p>
              <p className="text-xl font-extrabold text-[#333D47]">{formatCurrency(MDRT_TARGET)}</p>
            </div>
          </div>
          <ProgressBar
            pct={mdrtPct}
            colorClass={mdrtReached ? 'bg-[#88B943]' : mdrtPct >= 0.5 ? 'bg-amber-400' : 'bg-[#D31145]'}
            className="mb-2"
          />
          <div className="flex items-center justify-between text-xs">
            <span className={mdrtReached ? 'text-[#5a8a28] font-bold' : mdrtPct >= 0.5 ? 'text-amber-600 font-semibold' : 'text-[#D31145] font-semibold'}>
              {mdrtReached ? '✅ MDRT Qualified!' : `Gap: ${formatCurrency(MDRT_TARGET - ytdFyp)} remaining`}
            </span>
            <span className="text-gray-400 font-semibold tabular-nums">{(mdrtPct*100).toFixed(1)}% of target</span>
          </div>
        </SectionCard>

        {/* ── 8. PERSISTENCY */}
        <SectionCard title="Persistency">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Monthly</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {MONTH_ABBRS.map((abbr) => {
              const v = agent.monthly?.[abbr]?.persistency ?? null
              return (
                <div
                  key={abbr}
                  className={`inline-flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[10px] font-semibold min-w-[44px] border ${persColor(v)}`}
                >
                  <span className="uppercase tracking-wider opacity-70">{abbr}</span>
                  <span className="text-xs font-bold mt-0.5">{v != null ? `${v.toFixed(1)}%` : '—'}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Quarterly</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['Q1','Q2','Q3','Q4'].map(q => {
              const pct = agent.quarterlyPers?.[q] ?? null
              return (
                <div key={q} className={`flex flex-col items-center px-3 py-3 rounded-xl border text-center ${persColor(pct)}`}>
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{q}</span>
                  <span className="text-lg font-extrabold">{pct != null ? `${pct.toFixed(1)}%` : '—'}</span>
                </div>
              )
            })}
          </div>
          {ytdPersAvg != null && (
            <div className="mt-3 text-xs text-gray-400 text-right">
              YTD avg persistency: <span className={`font-bold ${ytdPersAvg >= 82.5 ? 'text-[#5a8a28]' : ytdPersAvg >= 75 ? 'text-amber-600' : 'text-[#D31145]'}`}>{ytdPersAvg.toFixed(1)}%</span>
            </div>
          )}
        </SectionCard>

        {/* ── 9. MONTHLY PRODUCTION CHART */}
        <SectionCard title="Monthly Production Chart">
          {chartData.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No monthly data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%" barGap={2}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#848A90' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#848A90' }} axisLine={false} tickLine={false} width={54}
                  tickFormatter={v => v >= 1_000_000 ? `₱${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `₱${(v/1000).toFixed(0)}K` : v}
                />
                <Tooltip
                  formatter={(value, name) => name === 'Cases' ? [(value/1000).toFixed(0), 'Cases'] : [formatCurrency(value, true), name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#E5E7EB' }}
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={v => v === 'Cases' ? 'Cases (×1000)' : v} />
                <Bar dataKey="FYP"   fill="#D31145" radius={[3,3,0,0]} />
                <Bar dataKey="FYC"   fill="#1F78AD" radius={[3,3,0,0]} />
                <Bar dataKey="Cases" fill="#88B943" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* ── 10. 90-DAY (new agents only) */}
        {show90Day && (
          <SectionCard title="90 Day Ascent Status">
            <div className="flex flex-wrap items-start gap-6 mb-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Days Since Appointment</p>
                <p className="text-xl font-extrabold text-[#333D47]">{days90 != null ? `${days90} days` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Cumulative Cases (YTD)</p>
                <p className="text-xl font-extrabold text-[#333D47]">{cumulativeCases90}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Fast Start Status</p>
                <p className={`text-sm font-extrabold ${fastStart ? 'text-[#88B943]' : 'text-gray-400'}`}>
                  {fastStart ? '⭐ FAST START Qualifier' : 'Not Yet'}
                </p>
              </div>
            </div>
            <div className="mb-1 flex justify-between text-xs text-gray-400">
              <span>Cases toward Fast Start</span>
              <span>{Math.min(cumulativeCases90, FAST_START_CASES)} / {FAST_START_CASES}</span>
            </div>
            <ProgressBar
              pct={cumulativeCases90 / FAST_START_CASES}
              colorClass={fastStart ? 'bg-[#88B943]' : 'bg-[#D31145]'}
            />
            {!fastStart && (
              <p className="mt-2 text-xs text-gray-400">
                {FAST_START_CASES - cumulativeCases90} more {FAST_START_CASES - cumulativeCases90 === 1 ? 'case' : 'cases'} needed to qualify.
              </p>
            )}
          </SectionCard>
        )}

      </div>
    </div>
  )
}
