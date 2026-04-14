import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import KpiCard from '../components/KpiCard'
import { formatCurrency, formatNumber } from '../utils/formatters'
import { exportMonthlyReport } from '../utils/exportExcel'
import Tag from '../components/Tag'
import { CURRENT_MONTH_IDX } from '../constants'
import { getAgentYtdFyp, getAgentYtdFyc, getAgentYtdCases } from '../utils/calculations'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_ABBRS  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const AVAILABLE_MONTHS = MONTH_ABBRS  // all 12 months — future months will show 0 until data is uploaded

const AREAS    = ['All', 'SCM2 (Davao)', 'SCM3 (Gensan)']
const SEGMENTS = ['All', 'Rookie', 'Seasoned']

const MEDAL = ['🥇', '🥈', '🥉']

const QUARTER_MONTHS = {
  Q1: ['JAN','FEB','MAR'], Q2: ['APR','MAY','JUN'],
  Q3: ['JUL','AUG','SEP'], Q4: ['OCT','NOV','DEC'],
}
function getQuarter(monthAbbr) {
  if (['JAN','FEB','MAR'].includes(monthAbbr)) return 'Q1'
  if (['APR','MAY','JUN'].includes(monthAbbr)) return 'Q2'
  if (['JUL','AUG','SEP'].includes(monthAbbr)) return 'Q3'
  return 'Q4'
}

const SEGMENT_TAG_VARIANT = {
  Rookie:   'rookie',
  Seasoned: 'seasoned',
  Unknown:  'default',
}

const TOP3_ROW = [
  'border-l-4 border-yellow-400 bg-yellow-50/40',
  'border-l-4 border-gray-300 bg-gray-50/60',
  'border-l-4 border-amber-600/60 bg-amber-50/30',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function HighlightTable({ title, rows, valueKey, valueLabel, formatFn }) {
  return (
    <div className="flex-1 min-w-0">
      {title && <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</p>}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-8">#</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Advisor</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, idx) => (
              <tr key={a.code ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 even:bg-gray-50'}>
                <td className="px-3 py-2 font-bold text-gray-500 text-base leading-none">
                  {idx < 3 ? MEDAL[idx] : <span className="text-sm text-gray-400">{idx + 1}</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold text-aia-darkGray text-xs leading-tight">
                    {a.code
                      ? <Link to={`/agent/${a.code}`} className="hover:text-aia-red hover:underline underline-offset-2 transition-colors">{a.name}</Link>
                      : a.name
                    }
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{a.segment} · {a.unitName}</div>
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-aia-darkGray text-xs">
                  {formatFn(a.m[valueKey] || 0)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-400">No data for this month</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { data, isLoaded } = useData()

  const [subTab,          setSubTab]          = useState('Advisors')
  const [selectedMonth,   setSelectedMonth]   = useState(MONTH_ABBRS[new Date().getMonth()])
  const [ytdMode,         setYtdMode]         = useState(false)
  const [highlightMetric, setHighlightMetric] = useState('FYC')
  const [segView,         setSegView]         = useState('Overall')
  const [area,            setArea]            = useState('All')
  const [segment,         setSegment]         = useState('All')
  const [sortKey,         setSortKey]         = useState('fyc')
  const [search,          setSearch]          = useState('')
  const [unitFilter,      setUnitFilter]      = useState('All Units')
  const [leaderSort,      setLeaderSort]      = useState('fyc')

  const agents = data?.agents ?? []

  const unitOptions = useMemo(() => {
    const names = [...new Set(agents.map(a => a.unitName).filter(Boolean))].sort()
    return ['All Units', ...names]
  }, [agents])

  // ── Month-keyed agent data (monthly or YTD)
  const monthData = useMemo(() => {
    const monthIdx = MONTH_ABBRS.indexOf(selectedMonth)
    return agents.map(a => {
      if (ytdMode) {
        const ytdFyp   = getAgentYtdFyp(a, monthIdx)
        const ytdFyc   = getAgentYtdFyc(a, monthIdx)
        const ytdCases = getAgentYtdCases(a, monthIdx)
        return { ...a, m: { fyp: ytdFyp, fyc: ytdFyc, cases: ytdCases, anp: ytdFyp } }
      }
      return { ...a, m: a.monthly?.[selectedMonth] ?? {} }
    })
  }, [agents, selectedMonth, ytdMode])

  // ── Filtered agents (for Advisors tab)
  const filtered = useMemo(() => {
    let list = [...monthData]
    if (area !== 'All')        list = list.filter(a => a.area === area)
    if (segment !== 'All')     list = list.filter(a => a.segment === segment)
    if (unitFilter !== 'All Units') list = list.filter(a => a.unitName === unitFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a => a.name?.toLowerCase().includes(q))
    }
    return list
  }, [monthData, area, segment, unitFilter, search])

  // ── Sorted lists for top performers
  const sortedByFyc   = useMemo(() => [...filtered].sort((a,b) => (b.m.fyc   ||0)-(a.m.fyc   ||0)), [filtered])
  const sortedByFyp   = useMemo(() => [...filtered].sort((a,b) => (b.m.fyp   ||0)-(a.m.fyp   ||0)), [filtered])
  const sortedByCases = useMemo(() => [...filtered].sort((a,b) => (b.m.cases ||0)-(a.m.cases ||0)), [filtered])

  // ── Full rankings table (sortable by month field)
  const ranked = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      const va = a.m[sortKey] || 0
      const vb = b.m[sortKey] || 0
      return vb - va
    })
    return list.slice(0, 50)
  }, [filtered, sortKey])

  // ── New recruits
  const newRecruits = useMemo(() => monthData.filter(a => a.m.isNewRecruit), [monthData])

  const topRecruiters = useMemo(() => {
    const map = new Map()
    for (const a of newRecruits) {
      const rName = a.recruiterName || 'Unknown'
      const rCode = a.recruiterCode || rName
      if (!map.has(rCode)) map.set(rCode, { name: rName, count: 0 })
      map.get(rCode).count++
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [newRecruits])

  // ── Agency leaders (aggregated from filtered month data)
  const agencyLeaders = useMemo(() => {
    const map = new Map()
    for (const agent of monthData) {
      const key = agent.unitCode || '__UNASSIGNED__'
      if (!map.has(key)) map.set(key, { unitCode: agent.unitCode, unitName: agent.unitName, ua: [] })
      map.get(key).ua.push(agent)
    }
    const qMonths = QUARTER_MONTHS[getQuarter(selectedMonth)]
    return [...map.values()]
      .filter(u => u.unitName)
      .map(({ unitCode, unitName, ua }) => ({
        unitCode,
        unitName,
        headcount:       ua.length,
        totalAnp:        ua.reduce((s, a) => s + (a.m.anp   ||0), 0),
        totalFyc:        ua.reduce((s, a) => s + (a.m.fyc   ||0), 0),
        totalFyp:        ua.reduce((s, a) => s + (a.m.fyp   ||0), 0),
        totalCases:      ua.reduce((s, a) => s + (a.m.cases ||0), 0),
        producingCount:  ua.filter(a => a.m.producing).length,
        newRecruitsCount: ua.filter(a => a.agentYears != null && a.agentYears <= 90/365.25).length,
        ppbCount:        ua.filter(a => {
          const qtlyFyc = qMonths.reduce((s, abbr) => s + (a.monthly?.[abbr]?.fyc || 0), 0)
          return qtlyFyc >= 30000
        }).length,
      }))
      .sort((a, b) => {
        const key = leaderSort
        return (b[key === 'fyc' ? 'totalFyc' : key === 'anp' ? 'totalAnp' : key === 'fyp' ? 'totalFyp' : 'totalCases']) -
               (a[key === 'fyc' ? 'totalFyc' : key === 'anp' ? 'totalAnp' : key === 'fyp' ? 'totalFyp' : 'totalCases'])
      })
  }, [monthData, leaderSort, selectedMonth])

  // ── KPIs for selected month
  const totalManpower  = filtered.reduce((s, a) => s + (a.m.manpower ||0), 0)
  const producingCount = filtered.filter(a => a.m.producing).length
  const totalAnp       = filtered.reduce((s, a) => s + (a.m.anp   ||0), 0)
  const totalFyc       = filtered.reduce((s, a) => s + (a.m.fyc   ||0), 0)
  const totalFyp       = filtered.reduce((s, a) => s + (a.m.fyp   ||0), 0)
  const totalCases     = filtered.reduce((s, a) => s + (a.m.cases ||0), 0)
  const persVals       = filtered.map(a => a.m.persistency).filter(v => v != null && v > 0)
  const avgPers        = persVals.length ? persVals.reduce((s, v) => s + v, 0) / persVals.length : null

  const activeSort = highlightMetric === 'FYC' ? sortedByFyc : highlightMetric === 'FYP' ? sortedByFyp : sortedByCases
  const valueKey   = highlightMetric === 'FYC' ? 'fyc' : highlightMetric === 'FYP' ? 'fyp' : 'cases'
  const formatFn   = highlightMetric === 'Cases' ? formatNumber : v => formatCurrency(v, true)
  const monthLabel = MONTH_LABELS[MONTH_ABBRS.indexOf(selectedMonth)]

  function getTop10(sorted) {
    return {
      overall:  sorted.slice(0, 10),
      rookie:   sorted.filter(a => a.segment === 'Rookie').slice(0, 10),
      seasoned: sorted.filter(a => a.segment === 'Seasoned').slice(0, 10),
    }
  }
  const top10 = getTop10(activeSort)

  const handleExport = () => exportMonthlyReport({
    monthLabel,
    kpis: {
      Manpower: totalManpower,
      'Producing Advisors': producingCount,
      'ANP (PHP)': totalAnp,
      'FYC (PHP)': totalFyc,
      'FYP (PHP)': totalFyp,
      Cases: totalCases,
      'Avg Persistency %': avgPers != null ? Number(avgPers.toFixed(1)) : null,
    },
    top10Fyc: {
      overall:  sortedByFyc.slice(0,10).map(a=>({...a,_exportValue:a.m.fyc||0})),
      rookie:   sortedByFyc.filter(a=>a.segment==='Rookie').slice(0,10).map(a=>({...a,_exportValue:a.m.fyc||0})),
      seasoned: sortedByFyc.filter(a=>a.segment==='Seasoned').slice(0,10).map(a=>({...a,_exportValue:a.m.fyc||0})),
    },
    top10Fyp: {
      overall:  sortedByFyp.slice(0,10).map(a=>({...a,_exportValue:a.m.fyp||0})),
      rookie:   sortedByFyp.filter(a=>a.segment==='Rookie').slice(0,10).map(a=>({...a,_exportValue:a.m.fyp||0})),
      seasoned: sortedByFyp.filter(a=>a.segment==='Seasoned').slice(0,10).map(a=>({...a,_exportValue:a.m.fyp||0})),
    },
    top10Cases: {
      overall:  sortedByCases.slice(0,10).map(a=>({...a,_exportValue:a.m.cases||0})),
      rookie:   sortedByCases.filter(a=>a.segment==='Rookie').slice(0,10).map(a=>({...a,_exportValue:a.m.cases||0})),
      seasoned: sortedByCases.filter(a=>a.segment==='Seasoned').slice(0,10).map(a=>({...a,_exportValue:a.m.cases||0})),
    },
    newRecruits,
    topRecruiters,
  })

  return (
    <div className="min-h-screen bg-aia-gray">
      <div className="max-w-screen-xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col gap-5">

        {/* ── Header + month selector + sub-tabs */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-aia-darkGray tracking-tight">Leaderboard</h1>
              <p className="text-sm text-gray-500 mt-0.5 font-medium">{monthLabel} 2026</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* YTD / Monthly toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <button
                  onClick={() => setYtdMode(false)}
                  className={`px-3 py-1.5 text-sm font-semibold transition-colors ${!ytdMode ? 'bg-aia-red text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                >Monthly</button>
                <button
                  onClick={() => setYtdMode(true)}
                  className={`px-3 py-1.5 text-sm font-semibold border-l border-gray-200 transition-colors ${ytdMode ? 'bg-aia-red text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                >YTD</button>
              </div>
              {/* Month pills */}
              <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 flex-wrap">
                {AVAILABLE_MONTHS.map(abbr => (
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

          {/* Sub-tabs */}
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 self-start">
            {['Advisors', 'Agency Leaders'].map(t => (
              <button
                key={t}
                onClick={() => setSubTab(t)}
                className={[
                  'px-5 py-2 rounded-md text-sm font-bold transition-colors duration-150',
                  subTab === t ? 'bg-aia-darkGray text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Filters row (shared) */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            {AREAS.map(a => (
              <FilterBtn key={a} active={area === a} onClick={() => setArea(a)}>
                {a === 'SCM2 (Davao)' ? 'Davao' : a === 'SCM3 (Gensan)' ? 'Gensan' : a}
              </FilterBtn>
            ))}
          </div>
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            {SEGMENTS.map(s => (
              <FilterBtn key={s} active={segment === s} onClick={() => setSegment(s)}>{s}</FilterBtn>
            ))}
          </div>

          {subTab === 'Advisors' && (
            <>
              <div className="relative">
                <select
                  value={unitFilter}
                  onChange={e => setUnitFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 bg-white shadow-sm
                    focus:outline-none focus:ring-2 focus:ring-aia-red/40 focus:border-aia-red text-aia-darkGray font-medium cursor-pointer"
                >
                  {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
                </svg>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search advisor..."
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-white shadow-sm
                    focus:outline-none focus:ring-2 focus:ring-aia-red/40 focus:border-aia-red
                    placeholder:text-gray-400 text-aia-darkGray" />
              </div>
            </>
          )}
        </div>

        {/* ═══════════════ ADVISORS SUB-TAB ═══════════════ */}
        {subTab === 'Advisors' && (
          <>
            {/* Monthly KPI cards */}
            <section>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <KpiCard title="Manpower"    value={formatNumber(totalManpower)}                   color="blue" />
                <KpiCard title="Producing"   value={formatNumber(producingCount)}                  color="green"
                  subtitle={totalManpower > 0 ? `${Math.round(producingCount/totalManpower*100)}%` : undefined} />
                <KpiCard title="ANP"         value={formatCurrency(totalAnp, true)}                color="red" />
                <KpiCard title="FYC"         value={formatCurrency(totalFyc, true)}                color="red" />
                <KpiCard title="FYP"         value={formatCurrency(totalFyp, true)}                color="red" />
                <KpiCard title="Cases"       value={formatNumber(totalCases)}                      color="gray" />
                <KpiCard title="Avg Pers."   value={avgPers != null ? `${avgPers.toFixed(1)}%` : '—'} color="gray" />
              </div>
            </section>

            {/* Top Performers */}
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-aia-darkGray">Top Performers</h2>
                <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                  {['FYC','FYP','Cases'].map(tab => (
                    <FilterBtn key={tab} active={highlightMetric === tab} onClick={() => setHighlightMetric(tab)}>{tab}</FilterBtn>
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
                <HighlightTable rows={top10.overall} valueKey={valueKey} valueLabel={highlightMetric} formatFn={formatFn} />
              ) : (
                <div className="flex gap-4 flex-col sm:flex-row">
                  <HighlightTable title="Rookie"   rows={top10.rookie}   valueKey={valueKey} valueLabel={highlightMetric} formatFn={formatFn} />
                  <HighlightTable title="Seasoned" rows={top10.seasoned} valueKey={valueKey} valueLabel={highlightMetric} formatFn={formatFn} />
                </div>
              )}
            </section>

            {/* Full Rankings table */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-extrabold text-aia-darkGray">All Rankings</h2>
                <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                  {[{k:'anp',l:'ANP'},{k:'fyc',l:'FYC'},{k:'fyp',l:'FYP'},{k:'cases',l:'Cases'}].map(opt => (
                    <FilterBtn key={opt.k} active={sortKey === opt.k} onClick={() => setSortKey(opt.k)}>{opt.l}</FilterBtn>
                  ))}
                </div>
                <span className="text-xs text-gray-400 font-medium ml-1">
                  {ranked.length} advisor{ranked.length !== 1 ? 's' : ''}{ranked.length === 50 ? ' (top 50)' : ''}
                </span>
              </div>

              <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-14">Rank</th>
                        <th className="sticky left-0 z-20 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[180px] border-r border-[#b80e3a]">Advisor</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[90px]">Area</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[130px]">Unit</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[100px]">ANP</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[100px]">FYC</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[90px]">FYP</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-20">Cases</th>
                        <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[110px]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((agent, idx) => {
                        const rank   = idx + 1
                        const isTop3 = rank <= 3
                        const rowCls = [
                          'transition-colors duration-100',
                          isTop3 ? TOP3_ROW[idx] : 'even:bg-gray-50',
                          !isTop3 && 'hover:bg-red-50/30',
                        ].filter(Boolean).join(' ')
                        return (
                          <tr key={agent.code ?? idx} className={`group ${rowCls}`}>
                            <td className="px-4 py-2.5 font-bold text-aia-darkGray tabular-nums">
                              {isTop3 ? <span className="text-lg leading-none">{MEDAL[idx]}</span> : <span className="text-gray-500">{rank}</span>}
                            </td>
                            <td className={`sticky left-0 z-10 px-4 py-2.5 border-r border-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.04)] ${isTop3 ? ['bg-yellow-50/40','bg-gray-50/60','bg-amber-50/30'][idx] : 'bg-white group-even:bg-gray-50'}`}>
                              <div className="font-semibold text-aia-darkGray leading-snug text-sm">
                                {agent.code
                                  ? <Link to={`/agent/${agent.code}`} className="hover:text-aia-red hover:underline underline-offset-2 transition-colors">{agent.name ?? '—'}</Link>
                                  : (agent.name ?? '—')
                                }
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {agent.agentYear != null && (
                                  <Tag variant={SEGMENT_TAG_VARIANT[agent.segment] ?? 'default'}>
                                    Yr {agent.agentYear}
                                  </Tag>
                                )}
                                {agent.segment && agent.segment !== 'Unknown' && (
                                  <span className="text-xs text-gray-400">{agent.segment}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-xs font-semibold">
                              <span className={agent.area?.includes('SCM2') ? 'text-aia-red' : 'text-blue-600'}>
                                {agent.area === 'SCM2 (Davao)' ? 'Davao' : agent.area === 'SCM3 (Gensan)' ? 'Gensan' : agent.area ?? '—'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 text-xs leading-snug">{agent.unitName ?? '—'}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-aia-darkGray text-sm">
                              {formatCurrency(agent.m.anp || 0)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 text-sm">
                              {formatCurrency(agent.m.fyc || 0)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 text-sm">
                              {formatCurrency(agent.m.fyp || 0, true)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-700 text-sm">
                              {agent.m.cases ?? '—'}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {agent.m.producing ? (
                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Producing
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />Non-producing
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {ranked.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm font-medium">
                            No advisors match your current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* New Recruits */}
            <section className="flex flex-col gap-3">
              <h2 className="text-base font-extrabold text-aia-darkGray flex items-center gap-2">
                New Recruits
                {newRecruits.length > 0 && (
                  <span className="text-sm font-semibold text-aia-red bg-red-50 px-2 py-0.5 rounded-full">
                    {newRecruits.length}
                  </span>
                )}
              </h2>

              {newRecruits.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-8 text-center text-sm text-gray-400">
                  No new recruits for {monthLabel}.
                </div>
              ) : (
                <>
                  {topRecruiters.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Top Recruiters</p>
                      <div className="flex gap-3 flex-wrap">
                        {topRecruiters.slice(0, 5).map((r, idx) => (
                          <div key={r.name} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 min-w-[160px]">
                            <span className="text-2xl leading-none">{idx < 3 ? MEDAL[idx] : ''}</span>
                            <div>
                              <div className="font-bold text-aia-darkGray text-sm">{r.name}</div>
                              <div className="text-xs text-gray-400">{r.count} recruit{r.count !== 1 ? 's' : ''}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">New Advisor</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Segment</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Area</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Unit</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Recruiter</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newRecruits.map((a, idx) => (
                          <tr key={a.code ?? idx} className="even:bg-gray-50">
                            <td className="px-4 py-2.5 font-semibold text-aia-darkGray">
                            {a.code
                              ? <Link to={`/agent/${a.code}`} className="hover:text-aia-red hover:underline underline-offset-2 transition-colors">{a.name}</Link>
                              : a.name
                            }
                          </td>
                            <td className="px-4 py-2.5">
                              <Tag variant={a.segment === 'Rookie' ? 'rookie' : 'seasoned'}>
                                {a.segment}
                              </Tag>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{a.area?.includes('SCM2') ? 'Davao' : 'Gensan'}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{a.unitName || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{a.recruiterName || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* ═══════════════ AGENCY LEADERS SUB-TAB ═══════════════ */}
        {subTab === 'Agency Leaders' && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-extrabold text-aia-darkGray">Unit Manager Rankings</h2>
              <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                {[{k:'fyc',l:'FYC'},{k:'anp',l:'ANP'},{k:'fyp',l:'FYP'},{k:'cases',l:'Cases'}].map(opt => (
                  <FilterBtn key={opt.k} active={leaderSort === opt.k} onClick={() => setLeaderSort(opt.k)}>{opt.l}</FilterBtn>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-14">Rank</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[200px]">Unit Manager</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-24">Headcount</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[100px]">ANP</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[100px]">FYC</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[90px]">FYP</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-20">Cases</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-24">Producing</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-28">New Recruits</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-32">PPB Qualifiers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agencyLeaders.map((u, idx) => {
                      const isTop3 = idx < 3
                      const rowCls = [
                        isTop3 ? TOP3_ROW[idx] : 'even:bg-gray-50',
                      ].join(' ')
                      return (
                        <tr key={u.unitCode ?? idx} className={rowCls}>
                          <td className="px-4 py-2.5 font-bold text-aia-darkGray">
                            {isTop3 ? <span className="text-lg">{MEDAL[idx]}</span> : <span className="text-gray-500">{idx + 1}</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-aia-darkGray text-sm">{u.unitName}</div>
                            <div className="text-xs text-gray-400">{u.unitCode}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 font-semibold">{u.headcount}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-aia-darkGray">{formatCurrency(u.totalAnp)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{formatCurrency(u.totalFyc)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{formatCurrency(u.totalFyp, true)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-700">{u.totalCases}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-sm font-bold text-green-600">{u.producingCount}</span>
                            <span className="text-xs text-gray-400 ml-1">/ {u.headcount}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-700">
                            {u.newRecruitsCount}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-700"
                              title="FYC ≥ ₱30K this quarter">
                            {u.ppbCount}
                          </td>
                        </tr>
                      )
                    })}
                    {agencyLeaders.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm font-medium">
                          No unit data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
