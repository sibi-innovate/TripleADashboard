import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { formatCurrency, formatNumber } from '../utils/formatters'
import { exportHighlightsReport } from '../utils/exportExcel'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_ABBRS  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const MEDAL = ['🥇','🥈','🥉']

// GAMA annual FYP tiers (AIA Philippines)
const GAMA_TIERS = [
  { name: 'Pre-GAMA',        fyp: 0 },
  { name: 'GAMA Qualifying', fyp: 3_000_000 },
  { name: 'GAMA Silver',     fyp: 6_000_000 },
  { name: 'GAMA Gold',       fyp: 12_000_000 },
  { name: 'GAMA Platinum',   fyp: 24_000_000 },
]

function getCurrentTier(ytdFyp) {
  let tier = GAMA_TIERS[0]
  for (const t of GAMA_TIERS) {
    if (ytdFyp >= t.fyp) tier = t
    else break
  }
  return tier
}

function getNextTier(ytdFyp) {
  for (const t of GAMA_TIERS) {
    if (ytdFyp < t.fyp) return t
  }
  return null // already at max
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function SectionHead({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-extrabold text-aia-darkGray tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function KpiCard({ title, value, sub, color = 'gray' }) {
  const colors = {
    red:   'border-t-[3px] border-aia-red',
    green: 'border-t-[3px] border-green-500',
    blue:  'border-t-[3px] border-blue-500',
    gray:  'border-t-[3px] border-gray-300',
  }
  return (
    <div className={`bg-white rounded-xl shadow-sm px-4 py-3 ${colors[color]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{title}</p>
      <p className="text-xl font-extrabold text-aia-darkGray mt-0.5 leading-tight tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
        active ? 'bg-aia-red text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// Top-N table used for advisors and unit managers
function RankTable({ rows, cols, emptyMsg = 'No data' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-8">#</th>
              {cols.map(c => (
                <th key={c.key} className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] ${c.right ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + 1} className="px-3 py-6 text-center text-xs text-gray-400">{emptyMsg}</td></tr>
            )}
            {rows.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 font-bold text-gray-500 text-base leading-none">
                  {idx < 3 ? MEDAL[idx] : <span className="text-sm text-gray-400">{idx + 1}</span>}
                </td>
                {cols.map(c => (
                  <td key={c.key} className={`px-3 py-2 text-xs ${c.right ? 'text-right tabular-nums font-semibold text-aia-darkGray' : ''}`}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Progress bar for GAMA tracker
function GamaBar({ label, ytdFyp }) {
  const current = getCurrentTier(ytdFyp)
  const next    = getNextTier(ytdFyp)
  const pct     = next
    ? Math.min(100, ((ytdFyp - current.fyp) / (next.fyp - current.fyp)) * 100)
    : 100

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <div className="flex justify-between items-start mb-1.5">
        <div>
          <p className="text-xs font-bold text-aia-darkGray leading-tight">{label}</p>
          <p className="text-[10px] text-gray-400">{current.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-extrabold text-aia-darkGray tabular-nums">{formatCurrency(ytdFyp, true)}</p>
          {next && <p className="text-[10px] text-gray-400">Next: {next.name} ({formatCurrency(next.fyp, true)})</p>}
          {!next && <p className="text-[10px] text-green-600 font-semibold">Max tier achieved!</p>}
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct >= 100 ? '#16a34a' : '#D31145',
          }}
        />
      </div>
      {next && (
        <p className="text-[10px] text-gray-400 mt-1">
          {formatCurrency(Math.max(0, next.fyp - ytdFyp), true)} more to reach {next.name}
          &nbsp;·&nbsp;{pct.toFixed(1)}%
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HighlightsPage() {
  const { data, isLoaded } = useData()

  const [selectedMonth, setSelectedMonth] = useState(MONTH_ABBRS[new Date().getMonth()])
  const [topMetric,     setTopMetric]     = useState('FYC')   // FYC | FYP | Cases
  const [segView,       setSegView]       = useState('Overall') // Overall | By Segment
  const [umMetric,      setUmMetric]      = useState('FYC')   // FYC | FYP | Cases | Recruitment

  const agents = data?.agents ?? []

  // ── Month-keyed data
  const monthData = useMemo(() =>
    agents.map(a => ({ ...a, m: a.monthly?.[selectedMonth] ?? {} })),
    [agents, selectedMonth]
  )

  // ── YTD helper: sum JAN → selectedMonth
  const ytdMonths = useMemo(() => {
    const idx = MONTH_ABBRS.indexOf(selectedMonth)
    return MONTH_ABBRS.slice(0, idx + 1)
  }, [selectedMonth])

  const ytdFyp = (agent) => ytdMonths.reduce((s, mo) => s + (agent.monthly?.[mo]?.fyp || 0), 0)
  const ytdFyc = (agent) => ytdMonths.reduce((s, mo) => s + (agent.monthly?.[mo]?.fyc || 0), 0)

  // ── Producing this month
  const producing = useMemo(() => monthData.filter(a => a.m.producing), [monthData])

  // ── Totals
  const totalProducing = producing.length
  const totalCases     = monthData.reduce((s, a) => s + (a.m.cases || 0), 0)
  const totalFyp       = monthData.reduce((s, a) => s + (a.m.fyp  || 0), 0)
  const totalFyc       = monthData.reduce((s, a) => s + (a.m.fyc  || 0), 0)
  const caseRate       = totalProducing > 0 ? totalCases / totalProducing : 0
  const avgCaseSize    = totalCases > 0 ? totalFyp / totalCases : 0

  // ── Top 10 advisors by metric
  const sortedByFyc   = useMemo(() => [...monthData].sort((a,b) => (b.m.fyc  ||0)-(a.m.fyc  ||0)), [monthData])
  const sortedByFyp   = useMemo(() => [...monthData].sort((a,b) => (b.m.fyp  ||0)-(a.m.fyp  ||0)), [monthData])
  const sortedByCases = useMemo(() => [...monthData].sort((a,b) => (b.m.cases||0)-(a.m.cases||0)), [monthData])

  const activeSort = topMetric === 'FYC' ? sortedByFyc : topMetric === 'FYP' ? sortedByFyp : sortedByCases
  const valueKey   = topMetric === 'FYC' ? 'fyc' : topMetric === 'FYP' ? 'fyp' : 'cases'
  const fmtTop     = topMetric === 'Cases' ? formatNumber : v => formatCurrency(v, true)

  function top10(sorted) {
    const has = sorted.filter(a => (a.m[valueKey] || 0) > 0)
    return {
      overall:  has.slice(0, 10),
      rookie:   has.filter(a => a.segment === 'Rookie').slice(0, 10),
      seasoned: has.filter(a => a.segment === 'Seasoned').slice(0, 10),
    }
  }
  const t10 = useMemo(() => top10(activeSort), [activeSort, valueKey])

  // ── Top 5 Unit Managers
  const unitAgg = useMemo(() => {
    const map = new Map()
    for (const a of monthData) {
      const k = a.unitCode || '__NONE__'
      if (!map.has(k)) map.set(k, { unitCode: a.unitCode, unitName: a.unitName || '—', agents: [] })
      map.get(k).agents.push(a)
    }
    return [...map.values()]
      .filter(u => u.unitName && u.unitName !== '—')
      .map(u => ({
        ...u,
        totalFyc:       u.agents.reduce((s, a) => s + (a.m.fyc   || 0), 0),
        totalFyp:       u.agents.reduce((s, a) => s + (a.m.fyp   || 0), 0),
        totalCases:     u.agents.reduce((s, a) => s + (a.m.cases || 0), 0),
        producing:      u.agents.filter(a => a.m.producing).length,
        newRecruits:    u.agents.filter(a => a.m.isNewRecruit).length,
        ytdFyp:         u.agents.reduce((s, a) => s + ytdFyp(a), 0),
      }))
  }, [monthData, ytdMonths])

  const top5Units = useMemo(() => {
    const sorted = [...unitAgg]
    if (umMetric === 'FYC')         sorted.sort((a,b) => b.totalFyc - a.totalFyc)
    else if (umMetric === 'FYP')    sorted.sort((a,b) => b.totalFyp - a.totalFyp)
    else if (umMetric === 'Cases')  sorted.sort((a,b) => b.totalCases - a.totalCases)
    else                             sorted.sort((a,b) => b.newRecruits - a.newRecruits)
    return sorted.slice(0, 5)
  }, [unitAgg, umMetric])

  // ── New recruits this month
  const newRecruits = useMemo(() => monthData.filter(a => a.m.isNewRecruit), [monthData])

  // ── Consistent monthly producers (producing in ≥3 months up to selected)
  const consistentProducers = useMemo(() => {
    return agents
      .map(a => {
        const streak = ytdMonths.filter(mo => a.monthly?.[mo]?.producing).length
        return { ...a, m: a.monthly?.[selectedMonth] ?? {}, streak }
      })
      .filter(a => a.streak >= 3)
      .sort((a,b) => b.streak - a.streak)
  }, [agents, ytdMonths, selectedMonth])

  // ── Most Trusted Advisors (FYC ≥ 10,000 for month)
  const mostTrusted = useMemo(() =>
    monthData
      .filter(a => (a.m.fyc || 0) >= 10_000)
      .sort((a,b) => (b.m.fyc||0) - (a.m.fyc||0)),
    [monthData]
  )

  // ── Agency YTD FYP for GAMA
  const agencyYtdFyp = useMemo(() =>
    agents.reduce((s, a) => s + ytdFyp(a), 0),
    [agents, ytdMonths]
  )

  // ── All producing advisors list
  const allProducing = useMemo(() =>
    [...producing].sort((a,b) => (b.m.fyc||0) - (a.m.fyc||0)),
    [producing]
  )

  const monthLabel = MONTH_LABELS[MONTH_ABBRS.indexOf(selectedMonth)]

  // ── Export
  const handleExport = () => exportHighlightsReport({
    monthLabel,
    selectedMonth,
    ytdMonths,
    allProducing,
    top10Fyc: {
      overall:  [...monthData].sort((a,b)=>(b.m.fyc||0)-(a.m.fyc||0)).filter(a=>(a.m.fyc||0)>0).slice(0,10),
      rookie:   [...monthData].filter(a=>a.segment==='Rookie').sort((a,b)=>(b.m.fyc||0)-(a.m.fyc||0)).filter(a=>(a.m.fyc||0)>0).slice(0,10),
      seasoned: [...monthData].filter(a=>a.segment==='Seasoned').sort((a,b)=>(b.m.fyc||0)-(a.m.fyc||0)).filter(a=>(a.m.fyc||0)>0).slice(0,10),
    },
    top10Fyp: {
      overall:  [...monthData].sort((a,b)=>(b.m.fyp||0)-(a.m.fyp||0)).filter(a=>(a.m.fyp||0)>0).slice(0,10),
      rookie:   [...monthData].filter(a=>a.segment==='Rookie').sort((a,b)=>(b.m.fyp||0)-(a.m.fyp||0)).filter(a=>(a.m.fyp||0)>0).slice(0,10),
      seasoned: [...monthData].filter(a=>a.segment==='Seasoned').sort((a,b)=>(b.m.fyp||0)-(a.m.fyp||0)).filter(a=>(a.m.fyp||0)>0).slice(0,10),
    },
    top10Cases: {
      overall:  [...monthData].sort((a,b)=>(b.m.cases||0)-(a.m.cases||0)).filter(a=>(a.m.cases||0)>0).slice(0,10),
      rookie:   [...monthData].filter(a=>a.segment==='Rookie').sort((a,b)=>(b.m.cases||0)-(a.m.cases||0)).filter(a=>(a.m.cases||0)>0).slice(0,10),
      seasoned: [...monthData].filter(a=>a.segment==='Seasoned').sort((a,b)=>(b.m.cases||0)-(a.m.cases||0)).filter(a=>(a.m.cases||0)>0).slice(0,10),
    },
    top5Units: [...unitAgg].sort((a,b)=>b.totalFyc-a.totalFyc).slice(0,5),
    newRecruits,
    consistentProducers,
    mostTrusted,
    kpis: { totalProducing, totalCases, totalFyp, totalFyc, caseRate, avgCaseSize },
    unitAgg,
    agencyYtdFyp,
  })

  // ── Advisor columns for rank tables
  const advisorCols = [
    {
      key: 'name', label: 'Advisor',
      render: row => (
        <div>
          <div className="font-semibold text-aia-darkGray text-xs leading-tight">
            {row.code
              ? <Link to={`/agent/${row.code}`} className="hover:text-aia-red hover:underline">{row.name}</Link>
              : row.name}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">{row.segment} · {row.unitName}</div>
        </div>
      ),
    },
    {
      key: valueKey, label: topMetric, right: true,
      render: row => fmtTop(row.m[valueKey] || 0),
    },
  ]

  return (
    <div className="min-h-screen bg-aia-gray">
      <div className="max-w-screen-xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col gap-6">

        {/* ── Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-aia-darkGray tracking-tight">Monthly Highlights</h1>
            <p className="text-sm text-gray-500 mt-0.5 font-medium">{monthLabel} 2026 — Agency Report</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Month pills */}
            <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 flex-wrap">
              {MONTH_ABBRS.map(abbr => (
                <button
                  key={abbr}
                  onClick={() => setSelectedMonth(abbr)}
                  className={[
                    'px-3 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
                    selectedMonth === abbr ? 'bg-aia-red text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {MONTH_LABELS[MONTH_ABBRS.indexOf(abbr)].slice(0,3)}
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Excel
            </button>
          </div>
        </div>

        {/* ── KPI Cards */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard title="Producing Advisors" value={formatNumber(totalProducing)} color="green" />
            <KpiCard title="Total Cases"        value={formatNumber(totalCases)}     color="blue" />
            <KpiCard title="Total FYP"          value={formatCurrency(totalFyp, true)} color="red" />
            <KpiCard title="Total FYC"          value={formatCurrency(totalFyc, true)} color="red" />
            <KpiCard title="Case Rate"          value={caseRate.toFixed(2)} sub="Cases / Producing Advisor" color="gray" />
            <KpiCard title="Avg Case Size"      value={formatCurrency(avgCaseSize, true)} sub="FYP / Case" color="gray" />
          </div>
        </section>

        {/* ── Top 10 Advisors */}
        <section>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h2 className="text-base font-extrabold text-aia-darkGray">Top 10 Advisors</h2>
            <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
              {['FYC','FYP','Cases'].map(m => (
                <FilterBtn key={m} active={topMetric === m} onClick={() => setTopMetric(m)}>{m}</FilterBtn>
              ))}
            </div>
            <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
              {['Overall','By Segment'].map(v => (
                <button key={v} onClick={() => setSegView(v)}
                  className={[
                    'px-4 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
                    segView === v ? 'bg-aia-darkGray text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
                  ].join(' ')}
                >{v}</button>
              ))}
            </div>
          </div>

          {segView === 'Overall' ? (
            <RankTable rows={t10.overall} cols={advisorCols} emptyMsg="No data for this month" />
          ) : (
            <div className="flex gap-4 flex-col sm:flex-row">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Rookie</p>
                <RankTable rows={t10.rookie} cols={advisorCols} emptyMsg="No rookie data" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Seasoned</p>
                <RankTable rows={t10.seasoned} cols={advisorCols} emptyMsg="No seasoned data" />
              </div>
            </div>
          )}
        </section>

        {/* ── Top 5 Unit Managers */}
        <section>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h2 className="text-base font-extrabold text-aia-darkGray">Top 5 Unit Managers</h2>
            <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
              {['FYC','FYP','Cases','Recruitment'].map(m => (
                <FilterBtn key={m} active={umMetric === m} onClick={() => setUmMetric(m)}>{m}</FilterBtn>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-8">#</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Unit Manager</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">FYC</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">FYP</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Cases</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Producing</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">New Recruits</th>
                  </tr>
                </thead>
                <tbody>
                  {top5Units.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-400">No unit data</td></tr>
                  )}
                  {top5Units.map((u, idx) => (
                    <tr key={u.unitCode ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-bold text-gray-500 text-base leading-none">
                        {idx < 3 ? MEDAL[idx] : <span className="text-sm text-gray-400">{idx+1}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-xs text-aia-darkGray leading-tight">{u.unitName}</div>
                        <div className="text-[10px] text-gray-400">{u.agents.length} advisors</div>
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-aia-darkGray">{formatCurrency(u.totalFyc, true)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-aia-darkGray">{formatCurrency(u.totalFyp, true)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-aia-darkGray">{formatNumber(u.totalCases)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-500">{u.producing}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-500">{u.newRecruits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Most Trusted Advisors (FYC ≥ ₱10k) */}
        <section>
          <SectionHead
            title="Most Trusted Advisors"
            subtitle={`Advisors with FYC ≥ ₱10,000 this month — ${mostTrusted.length} advisor${mostTrusted.length !== 1 ? 's' : ''}`}
          />
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-8">#</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Advisor</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">FYC</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">FYP</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {mostTrusted.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-400">No advisors with FYC ≥ ₱10,000 this month</td></tr>
                  )}
                  {mostTrusted.map((a, idx) => (
                    <tr key={a.code ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-bold text-gray-500 text-base leading-none">
                        {idx < 3 ? MEDAL[idx] : <span className="text-sm text-gray-400">{idx+1}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-xs text-aia-darkGray leading-tight">
                          {a.code
                            ? <Link to={`/agent/${a.code}`} className="hover:text-aia-red hover:underline">{a.name}</Link>
                            : a.name}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{a.segment} · {a.unitName}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums font-bold text-aia-red">{formatCurrency(a.m.fyc||0, true)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-aia-darkGray">{formatCurrency(a.m.fyp||0, true)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-600">{formatNumber(a.m.cases||0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Consistent Monthly Producers */}
        <section>
          <SectionHead
            title="Consistent Monthly Producers"
            subtitle={`Advisors who produced in 3+ months (Jan – ${monthLabel}) — ${consistentProducers.length} advisor${consistentProducers.length !== 1 ? 's' : ''}`}
          />
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Advisor</th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Months Produced</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">YTD FYP</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">YTD FYC</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Active Months</th>
                  </tr>
                </thead>
                <tbody>
                  {consistentProducers.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-400">No consistent producers yet</td></tr>
                  )}
                  {consistentProducers.map((a, idx) => {
                    const activeMonths = ytdMonths.filter(mo => a.monthly?.[mo]?.producing)
                    return (
                      <tr key={a.code ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-xs text-aia-darkGray leading-tight">
                            {a.code
                              ? <Link to={`/agent/${a.code}`} className="hover:text-aia-red hover:underline">{a.name}</Link>
                              : a.name}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{a.segment} · {a.unitName}</div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {a.streak} / {ytdMonths.length}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-aia-darkGray">{formatCurrency(ytdFyp(a), true)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-aia-darkGray">{formatCurrency(ytdFyc(a), true)}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-0.5 flex-wrap">
                            {ytdMonths.map(mo => (
                              <span key={mo} className={[
                                'text-[9px] font-bold px-1 py-0.5 rounded',
                                activeMonths.includes(mo)
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-300',
                              ].join(' ')}>
                                {mo.slice(0,1)}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── All Producing Advisors */}
        <section>
          <SectionHead
            title="All Producing Advisors"
            subtitle={`${allProducing.length} advisor${allProducing.length !== 1 ? 's' : ''} with production in ${monthLabel}`}
          />
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-8">#</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Advisor</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Unit</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">FYC</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">FYP</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {allProducing.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">No producing advisors this month</td></tr>
                  )}
                  {allProducing.map((a, idx) => (
                    <tr key={a.code ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-xs text-gray-400 font-medium">{idx+1}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-xs text-aia-darkGray leading-tight">
                          {a.code
                            ? <Link to={`/agent/${a.code}`} className="hover:text-aia-red hover:underline">{a.name}</Link>
                            : a.name}
                        </div>
                        <div className="text-[10px] text-gray-400">{a.segment}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{a.unitName || '—'}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-aia-darkGray">{formatCurrency(a.m.fyc||0, true)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-600">{formatCurrency(a.m.fyp||0, true)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-600">{formatNumber(a.m.cases||0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── New Recruits */}
        <section>
          <SectionHead
            title="New Recruits"
            subtitle={`${newRecruits.length} recruit${newRecruits.length !== 1 ? 's' : ''} joined in ${monthLabel}`}
          />
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-8">#</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Recruit Name</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Recruiter</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Unit</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Segment</th>
                  </tr>
                </thead>
                <tbody>
                  {newRecruits.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-400">No new recruits this month</td></tr>
                  )}
                  {newRecruits.map((a, idx) => (
                    <tr key={a.code ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-xs text-gray-400 font-medium">{idx+1}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-xs text-aia-darkGray leading-tight">
                          {a.code
                            ? <Link to={`/agent/${a.code}`} className="hover:text-aia-red hover:underline">{a.name}</Link>
                            : a.name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{a.recruiterName || '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{a.unitName || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={[
                          'text-[10px] font-bold px-2 py-0.5 rounded-full',
                          a.segment === 'Rookie' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700',
                        ].join(' ')}>
                          {a.segment}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── GAMA FYP Tracker */}
        <section>
          <SectionHead
            title="GAMA FYP Tracker"
            subtitle={`YTD FYP (Jan – ${monthLabel}) vs annual tier targets`}
          />
          <div className="flex flex-col gap-3">
            {/* Agency overall */}
            <GamaBar label="Agency Overall" ytdFyp={agencyYtdFyp} />

            {/* Per unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...unitAgg]
                .sort((a,b) => b.ytdFyp - a.ytdFyp)
                .map((u, idx) => (
                  <GamaBar key={u.unitCode ?? idx} label={u.unitName} ytdFyp={u.ytdFyp} />
                ))
              }
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
