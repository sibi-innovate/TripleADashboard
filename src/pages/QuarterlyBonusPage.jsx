import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { useData } from '../context/DataContext'
import { formatCurrency, formatNumber } from '../utils/formatters'
import { exportQuarterlyBonus } from '../utils/exportExcel'
import Tag from '../components/Tag'

// ─── Bonus tiers ──────────────────────────────────────────────────────────────

const FYC_TIERS = [
  { min: 350000, rate: 0.40, label: '₱350K+' },
  { min: 200000, rate: 0.35, label: '₱200K–349K' },
  { min: 120000, rate: 0.30, label: '₱120K–199K' },
  { min:  80000, rate: 0.20, label: '₱80K–119K' },
  { min:  50000, rate: 0.15, label: '₱50K–79K' },
  { min:  30000, rate: 0.10, label: '₱30K–49K' },
  { min:      0, rate: 0.00, label: 'Below ₱30K' },
]

// Special Rookie Year-1 tier for 20K–29K range
const ROOKIE_TIER = { min: 20000, rate: 0.10, label: '₱20K–29K (Rookie)' }

const CCB_TIERS = [
  { min: 9, rate: 0.20, label: '9+ cases' },
  { min: 7, rate: 0.15, label: '7–8 cases' },
  { min: 5, rate: 0.10, label: '5–6 cases' },
  { min: 3, rate: 0.05, label: '3–4 cases' },
  { min: 0, rate: 0.00, label: '<3 cases' },
]

const MONTH_ABBRS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

const QUARTER_MONTHS = {
  Q1: [0, 1, 2],
  Q2: [3, 4, 5],
  Q3: [6, 7, 8],
  Q4: [9, 10, 11],
}

// ─── Bonus computation ────────────────────────────────────────────────────────

function getFycTier(fyc, isRookie) {
  if (isRookie && fyc >= 20000 && fyc < 30000) return ROOKIE_TIER
  return FYC_TIERS.find(t => fyc >= t.min) ?? FYC_TIERS[FYC_TIERS.length - 1]
}

function getCcbTier(cases) {
  return CCB_TIERS.find(t => cases >= t.min) ?? CCB_TIERS[CCB_TIERS.length - 1]
}

function getPersMultiplier(pers) {
  if (pers === null) return 1.0   // no data → default 82.5% → full bonus
  if (pers >= 82.5)  return 1.0
  if (pers >= 75.0)  return 0.8
  return 0.0
}

function computeAdvisorBonus(agent, quarter) {
  const isRookie = agent.segment === 'Rookie' && agent.agentYear === 1

  const monthIdxs = QUARTER_MONTHS[quarter]
  const months    = monthIdxs.map(i => agent.monthly?.[MONTH_ABBRS[i]] ?? {})

  const qtlyFyc      = months.reduce((s, m) => s + (m.fyc   || 0), 0)
  const monthlyCases = months.map(m => m.cases || 0)
  const qtlyCases    = monthlyCases.reduce((s, c) => s + c, 0)
  const monthsWithCases = monthlyCases.filter(c => c > 0).length
  const ccbEligible  = monthsWithCases >= 2

  const persRaw        = agent.quarterlyPers?.[quarter] ?? null
  const persMultiplier = getPersMultiplier(persRaw)

  const fycTier = getFycTier(qtlyFyc, isRookie)
  const ccbTier = ccbEligible ? getCcbTier(qtlyCases) : CCB_TIERS[CCB_TIERS.length - 1]

  const fycBonus  = qtlyFyc * fycTier.rate
  const ccbBonus  = ccbEligible ? qtlyFyc * ccbTier.rate : 0
  const totalBonus = (fycBonus + ccbBonus) * persMultiplier

  // Next tier potentials
  // For Rookies in the 20K-29K special window, next tier target is ₱30K
  let nextFycTier
  if (isRookie && qtlyFyc >= 20000 && qtlyFyc < 30000) {
    nextFycTier = FYC_TIERS.find(t => t.min === 30000)  // the ₱30K-49K tier
  } else {
    const fycTierIdx = FYC_TIERS.findIndex(t => qtlyFyc >= t.min)
    nextFycTier = fycTierIdx > 0 ? FYC_TIERS[fycTierIdx - 1] : null
  }

  const ccbTierIdx  = CCB_TIERS.findIndex(t => qtlyCases >= t.min)
  const nextCcbTier = ccbEligible && ccbTierIdx > 0 ? CCB_TIERS[ccbTierIdx - 1] : null

  const potFycBonus  = nextFycTier ? qtlyFyc * nextFycTier.rate : fycBonus
  const potCcbBonus  = nextCcbTier ? qtlyFyc * nextCcbTier.rate : ccbBonus
  const potentialBonus = (potFycBonus + potCcbBonus) * persMultiplier

  const hints = []
  if (nextFycTier) {
    const gap = nextFycTier.min - qtlyFyc
    hints.push(`+₱${gap.toLocaleString()} FYC → ${(nextFycTier.rate * 100).toFixed(0)}% rate`)
  }
  if (nextCcbTier) {
    const need = nextCcbTier.min - qtlyCases
    hints.push(`+${need} case${need !== 1 ? 's' : ''} → ${(nextCcbTier.rate * 100).toFixed(0)}% CCB`)
  }
  if (!ccbEligible && qtlyCases > 0) {
    hints.push('Need cases in 2 months for CCB')
  }

  return {
    qtlyFyc,
    qtlyCases,
    monthlyCases,
    ccbEligible,
    fycTierLabel: fycTier.label,
    fycRate: fycTier.rate,
    ccbRate: ccbTier.rate,
    fycBonus,
    ccbBonus,
    persRaw,
    persMultiplier,
    totalBonus,
    potentialBonus,
    gainIfNext: potentialBonus - totalBonus,
    hints,
    isRookie,
  }
}

// ─── FYC progress helper ──────────────────────────────────────────────────────

/**
 * Returns progress toward the next FYC tier.
 * - Returns null if at max tier (>= 350K) or below minimum qualifying tier.
 *   For Rookies (Year 1), qualifying floor is ₱20K; for others it's ₱30K.
 * - pct: 0–100 percentage toward next tier threshold
 * - nextMin: the threshold value of the next tier
 * - nextLabel: label of the next tier
 */
function getFycProgress(qtlyFyc, isRookie) {
  if (qtlyFyc >= 350000) return null  // max tier

  const floor = isRookie ? 20000 : 30000
  if (qtlyFyc < floor) return null    // not qualifying

  // For Rookies between 20K–30K, show progress toward 30K
  if (isRookie && qtlyFyc < 30000) {
    const pct = Math.min(100, ((qtlyFyc - 20000) / (30000 - 20000)) * 100)
    return { pct, nextMin: 30000, nextLabel: '₱30K–49K' }
  }

  // Standard tier logic (same as before for 30K+)
  const currentTierIdx = FYC_TIERS.findIndex(t => qtlyFyc >= t.min)
  if (currentTierIdx <= 0) return null  // already at top or not found

  const currentTier = FYC_TIERS[currentTierIdx]
  const nextTier    = FYC_TIERS[currentTierIdx - 1]  // one step up (lower index = higher tier)

  const pct = Math.min(
    100,
    ((qtlyFyc - currentTier.min) / (nextTier.min - currentTier.min)) * 100
  )

  return { pct, nextMin: nextTier.min, nextLabel: nextTier.label }
}

// ─── Component ────────────────────────────────────────────────────────────────

const AREAS = ['All', 'SCM2 (Davao)', 'SCM3 (Gensan)']
const SEGMENTS = ['All', 'Rookie', 'Seasoned']

export default function QuarterlyBonusPage() {
  const { data, isLoaded } = useData()

  const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`

  const [quarter,    setQuarter]    = useState(currentQuarter)
  const [areaFilter, setAreaFilter] = useState('All')
  const [segFilter,  setSegFilter]  = useState('All')
  const [search,     setSearch]     = useState('')
  const [showOnly,   setShowOnly]   = useState('All')

  const agents = (data?.agents ?? []).filter(a => a.manpowerInd)

  const bonusRows = useMemo(() => {
    return agents
      .map(agent => ({ ...agent, bonus: computeAdvisorBonus(agent, quarter) }))
      .filter(a => {
        if (areaFilter !== 'All' && a.area !== areaFilter) return false
        if (segFilter  !== 'All' && a.segment !== segFilter) return false
        if (showOnly === 'Qualifying') {
          const isRookieQualifying = a.segment === 'Rookie' && a.agentYear === 1 && a.bonus.qtlyFyc >= 20000
          if (a.bonus.qtlyFyc < 30000 && !isRookieQualifying) return false
        }
        if (search.trim()) {
          const q = search.trim().toLowerCase()
          if (!a.name?.toLowerCase().includes(q)) return false
        }
        return true
      })
      .sort((a, b) => b.bonus.totalBonus - a.bonus.totalBonus)
  }, [agents, quarter, areaFilter, segFilter, showOnly, search])

  const totalBonusPool  = bonusRows.reduce((s, a) => s + a.bonus.totalBonus, 0)
  const qualifyingCount = bonusRows.filter(a => a.bonus.totalBonus > 0).length

  // Qualifying count for FYC Tier Breakdown (includes Rookie 20K–30K window)
  const fycQualifyingCount = bonusRows.filter(a =>
    a.bonus.totalBonus > 0 || (a.segment === 'Rookie' && a.agentYear === 1 && a.bonus.qtlyFyc >= 20000)
  ).length
  const fycQualifyingPct = bonusRows.length > 0 ? Math.round((fycQualifyingCount / bonusRows.length) * 100) : 0

  return (
    <div className="min-h-screen bg-aia-gray">
      <div className="max-w-screen-xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex flex-col gap-6">

        {/* ── Page header */}
        <div>
          <h1 className="text-2xl font-extrabold text-aia-darkGray tracking-tight">Quarter Bonuses</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            FYC bonus + Case Count Bonus × Persistency multiplier
          </p>
        </div>

        {/* ── Sticky tier reference tables */}
        <div className="sticky top-14 z-30 bg-aia-gray pb-2 pt-1 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">FYC Bonus Tiers</p>
              <div className="grid grid-cols-7 gap-0.5">
                {FYC_TIERS.slice().reverse().filter(t => t.rate > 0).map(t => (
                  <div key={t.min} className="flex flex-col items-center bg-red-50 rounded-lg px-1 py-1.5 text-center">
                    <span className="text-[9px] text-gray-500 leading-tight font-medium">{t.label.replace('₱','').replace('K','K')}</span>
                    <span className="text-xs font-extrabold text-aia-red mt-0.5">{(t.rate*100).toFixed(0)}%</span>
                  </div>
                ))}
                <div className="flex flex-col items-center bg-gray-50 rounded-lg px-1 py-1.5 text-center">
                  <span className="text-[9px] text-gray-400 leading-tight font-medium">{'<₱30K'}</span>
                  <span className="text-xs font-bold text-gray-300 mt-0.5">—</span>
                </div>
              </div>
              <p className="text-[9px] text-blue-600 font-semibold mt-1.5">
                ★ Year-1 Rookies: ₱20K–₱29K also qualifies at 10% bonus rate
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Case Count Bonus Tiers</p>
              <div className="grid grid-cols-5 gap-0.5">
                {CCB_TIERS.slice().reverse().filter(t => t.rate > 0).map(t => (
                  <div key={t.min} className="flex flex-col items-center bg-orange-50 rounded-lg px-1 py-1.5 text-center">
                    <span className="text-[9px] text-gray-500 leading-tight font-medium">{t.label}</span>
                    <span className="text-xs font-extrabold text-orange-600 mt-0.5">{(t.rate*100).toFixed(0)}%</span>
                  </div>
                ))}
                <div className="flex flex-col items-center bg-gray-50 rounded-lg px-1 py-1.5 text-center">
                  <span className="text-[9px] text-gray-400 leading-tight font-medium">{'<3 cases'}</span>
                  <span className="text-xs font-bold text-gray-300 mt-0.5">—</span>
                </div>
              </div>
              <p className="text-[9px] text-gray-400 mt-1.5">* Cases in ≥2 months required</p>
            </div>
          </div>
        </div>

        {/* ── FYC Tier Breakdown chart (moved above quarter selector) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#848A90] mb-1">
            FYC Tier Breakdown — How Many Advisors Per Tier
          </p>
          <p className="text-xs text-gray-500 mb-4">
            {fycQualifyingCount} of {bonusRows.length} advisors qualifying ({fycQualifyingPct}%)
          </p>
          <div className="flex flex-col gap-2">
            {FYC_TIERS.slice().reverse().map(tier => {
              const count = bonusRows.filter(a => {
                const fyc = a.bonus.qtlyFyc
                const nextTierIdx = FYC_TIERS.findIndex(t => t.min === tier.min)
                const nextTier = nextTierIdx > 0 ? FYC_TIERS[nextTierIdx - 1] : null
                return fyc >= tier.min && (nextTier == null || fyc < nextTier.min)
              }).length
              const pct = bonusRows.length > 0 ? (count / bonusRows.length) * 100 : 0
              return (
                <div key={tier.min} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-[#848A90] font-medium text-right flex-shrink-0">{tier.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                        backgroundColor: tier.rate > 0 ? '#D31145' : '#D6D8DA',
                      }}
                    />
                  </div>
                  <div className="w-16 flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs font-bold text-[#333D47] tabular-nums">{count}</span>
                    {tier.rate > 0 && (
                      <span className="text-[10px] font-bold text-[#D31145]">{(tier.rate * 100).toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Quarter selector + Filters */}
        <div className="flex flex-wrap gap-3 items-center">

          {/* Quarter tabs */}
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            {['Q1','Q2','Q3','Q4'].map(q => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={[
                  'px-4 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
                  quarter === q ? 'bg-aia-red text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
                ].join(' ')}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Area filter */}
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            {AREAS.map(a => (
              <button
                key={a}
                onClick={() => setAreaFilter(a)}
                className={[
                  'px-3 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
                  areaFilter === a ? 'bg-aia-red text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
                ].join(' ')}
              >
                {a === 'SCM2 (Davao)' ? 'Davao' : a === 'SCM3 (Gensan)' ? 'Gensan' : a}
              </button>
            ))}
          </div>

          {/* Segment filter */}
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            {SEGMENTS.map(s => (
              <button
                key={s}
                onClick={() => setSegFilter(s)}
                className={[
                  'px-3 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
                  segFilter === s ? 'bg-aia-red text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Qualifying only toggle */}
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            {['All','Qualifying'].map(v => (
              <button
                key={v}
                onClick={() => setShowOnly(v)}
                className={[
                  'px-3 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
                  showOnly === v ? 'bg-aia-darkGray text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
                ].join(' ')}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
            </svg>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search advisor..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-white shadow-sm
                focus:outline-none focus:ring-2 focus:ring-aia-red/40 focus:border-aia-red
                placeholder:text-gray-400 text-aia-darkGray"
            />
          </div>

          {/* Download Excel */}
          <button
            onClick={() => exportQuarterlyBonus(bonusRows, quarter)}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Excel
          </button>
        </div>

        {/* ── Summary KPI cards */}
        <div className="flex gap-4 flex-wrap">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 min-w-[160px]">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Bonus Pool</div>
            <div className="text-xl font-extrabold text-green-600 tabular-nums mt-1">
              {formatCurrency(totalBonusPool, true)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 min-w-[160px]">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Qualifying Advisors</div>
            <div className="text-xl font-extrabold text-aia-darkGray tabular-nums mt-1">
              {formatNumber(qualifyingCount)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 min-w-[160px]">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Showing</div>
            <div className="text-xl font-extrabold text-aia-darkGray tabular-nums mt-1">
              {bonusRows.length} advisors
            </div>
          </div>
        </div>

        {/* ── Bonus table */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[160px]">Advisor</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Segment</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[90px]">Qtly FYC</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[100px]">FYC Tier</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[80px]">Cases</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[60px]">CCB</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[90px]">Persistency</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[90px]">Bonus</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[160px]">Reach Next Level</th>
                </tr>
              </thead>
              <tbody>
                {bonusRows.map((a, idx) => {
                  const b = a.bonus
                  const isQ = b.totalBonus > 0
                  const isRookie = b.isRookie
                  const notQualifying = b.qtlyFyc < 30000 && !(isRookie && b.qtlyFyc >= 20000)
                  return (
                    <tr key={a.code ?? idx}
                        className="even:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-aia-darkGray text-xs">{a.name}</div>
                        <div className="text-xs text-gray-400 leading-tight">{a.unitName}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Tag variant={a.segment === 'Rookie' ? 'rookie' : 'seasoned'}>
                          {a.segment}
                        </Tag>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs font-medium text-aia-darkGray">
                        {formatCurrency(b.qtlyFyc, true)}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-600">{b.fycTierLabel}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                        <div className="font-semibold text-aia-darkGray">{b.qtlyCases}</div>
                        <div className="text-gray-400 text-[10px]">{b.monthlyCases.join(' · ')}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs">
                        {b.ccbEligible
                          ? <span className="text-green-600 font-bold">{(b.ccbRate * 100).toFixed(0)}%</span>
                          : <span className="text-gray-300 font-semibold">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                        <div className="text-aia-darkGray font-medium">
                          {b.persRaw != null ? `${b.persRaw.toFixed(1)}%` : 'Default'}
                        </div>
                        <div className="text-gray-400 text-[10px]">{(b.persMultiplier * 100).toFixed(0)}%×</div>
                      </td>
                      <td className={[
                        'px-3 py-2.5 text-right font-extrabold tabular-nums text-sm',
                        isQ ? 'text-green-600' : 'text-gray-300',
                      ].join(' ')}>
                        {isQ ? formatCurrency(b.totalBonus, true) : '—'}
                        {/* Rate breakdown sub-row */}
                        <div className="text-[9px] text-gray-400 mt-0.5 font-normal">
                          {(b.fycRate * 100).toFixed(0)}% FYC
                          {b.ccbEligible && b.ccbRate > 0 ? ` + ${(b.ccbRate * 100).toFixed(0)}% CCB` : ''}
                          {b.persMultiplier < 1 ? ` × ${(b.persMultiplier * 100).toFixed(0)}%` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 min-w-[170px]">
                        {(() => {
                          // Max tier
                          if (b.qtlyFyc >= 350000) {
                            return (
                              <div className="text-green-600 font-bold text-xs">Max Tier ✓</div>
                            )
                          }

                          // Below qualifying threshold (not a qualifying Rookie either)
                          if (notQualifying) {
                            return (
                              <div className="text-xs text-gray-400">
                                {b.hints.length > 0
                                  ? b.hints.map((h, i) => <div key={i} className="leading-snug">{h}</div>)
                                  : <span>Not qualifying</span>}
                              </div>
                            )
                          }

                          // Between tiers — show progress bar
                          const prog = getFycProgress(b.qtlyFyc, isRookie)
                          if (!prog) return null

                          const { pct } = prog
                          const barColor = pct >= 80
                            ? 'bg-green-500'
                            : pct >= 50
                              ? 'bg-amber-400'
                              : 'bg-red-400'

                          return (
                            <div className="flex flex-col gap-1">
                              {/* Progress bar */}
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-semibold text-gray-500 tabular-nums w-8 text-right flex-shrink-0">
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                              {/* Hints */}
                              <div className="text-xs text-amber-600">
                                {b.hints.map((h, i) => (
                                  <div key={i} className="leading-snug">{h}</div>
                                ))}
                                {b.gainIfNext > 100 && (
                                  <div className="font-bold text-amber-700 mt-0.5">
                                    +{formatCurrency(b.gainIfNext, true)} more
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })}
                {bonusRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">
                      No advisors match current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Visual: Bonus distribution chart */}
        {bonusRows.filter(a => a.bonus.totalBonus > 0).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#848A90] mb-4">
              Bonus Distribution — Top Advisors
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={bonusRows
                  .filter(a => a.bonus.totalBonus > 0)
                  .slice(0, 15)
                  .map(a => ({
                    name: a.name?.split(' ').slice(-1)[0] ?? a.code,
                    bonus: Math.round(a.bonus.totalBonus),
                    segment: a.segment,
                  }))}
                margin={{ top: 4, right: 8, bottom: 24, left: 0 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#848A90' }} axisLine={false} tickLine={false}
                  interval={0} angle={-35} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: '#848A90' }} axisLine={false} tickLine={false}
                  tickFormatter={v => formatCurrency(v, true)} width={60} />
                <Tooltip
                  formatter={(v) => [formatCurrency(v, true), 'Bonus']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="bonus" radius={[4, 4, 0, 0]}>
                  {bonusRows
                    .filter(a => a.bonus.totalBonus > 0)
                    .slice(0, 15)
                    .map((a, i) => (
                      <Cell
                        key={i}
                        fill={a.segment === 'Rookie' ? '#D31145' : '#FF754D'}
                      />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-sm bg-[#D31145] inline-block" />Rookie
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-sm bg-[#FF754D] inline-block" />Seasoned
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
