import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import AgentAvatar from '../components/AgentAvatar'
import { formatCurrency, formatNumber } from '../utils/formatters'
import { exportMonthlyReport } from '../utils/exportExcel'
import Tag from '../components/Tag'
import { CURRENT_MONTH_IDX } from '../constants'
import { getAgentYtdFyp, getAgentYtdFyc, getAgentYtdCases } from '../utils/calculations'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_ABBRS  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const AREAS    = ['All', 'SCM2 (Davao)', 'SCM3 (Gensan)']
const SEGMENTS = ['All', 'Rookie', 'Seasoned']

const MEDAL = ['🥇', '🥈', '🥉']

const METRICS = [
  { key: 'fyc',      label: 'FYC',      fmt: v => formatCurrency(v) },
  { key: 'fyp',      label: 'FYP',      fmt: v => formatCurrency(v) },
  { key: 'cases',    label: 'Cases',    fmt: v => formatNumber(v)   },
  { key: 'recruits', label: 'Recruits', fmt: v => `${v} recruit${v !== 1 ? 's' : ''}` },
]

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

const SEGMENT_TAG_VARIANT = { Rookie: 'rookie', Seasoned: 'seasoned', Unknown: 'default' }

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

// ─── Rank context badge ───────────────────────────────────────────────────────

function RankBadge({ rank, totalAll, totalSegment, segment, segmentFilter }) {
  // If a segment filter is active, show rank within that segment
  if (segmentFilter !== 'All') {
    return (
      <span className="text-[10px] font-semibold whitespace-nowrap"
        style={{ color: rank <= 3 ? '#D31145' : 'var(--char-60,#6B7180)' }}>
        #{rank} of {segmentFilter === 'Rookie' ? totalSegment.rookie : totalSegment.seasoned} {segmentFilter}s
      </span>
    )
  }
  // Overall: show both overall rank AND rank within segment
  const segTotal = segment === 'Rookie' ? totalSegment.rookie : totalSegment.seasoned
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] font-semibold whitespace-nowrap"
        style={{ color: rank <= 3 ? '#D31145' : 'var(--char-60,#6B7180)' }}>
        #{rank} of {totalAll} agency-wide
      </span>
      {segment && segment !== 'Unknown' && (
        <span className="text-[9px] whitespace-nowrap" style={{ color: 'var(--char-60,#6B7180)' }}>
          #{rank} of {segTotal} {segment}s
        </span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { data, isLoaded } = useData()

  const [subTab,        setSubTab]        = useState('Advisors')
  const [selectedMonth, setSelectedMonth] = useState(MONTH_ABBRS[new Date().getMonth()])
  const [ytdMode,       setYtdMode]       = useState(false)
  const [metricKey,     setMetricKey]     = useState('fyc')
  const [area,          setArea]          = useState('All')
  const [segment,       setSegment]       = useState('All')
  const [unitFilter,    setUnitFilter]    = useState('All Units')
  const [search,        setSearch]        = useState('')
  const [leaderSort,    setLeaderSort]    = useState('fyc')

  const agents = data?.agents ?? []

  const unitOptions = useMemo(() => {
    const names = [...new Set(agents.map(a => a.unitName).filter(Boolean))].sort()
    return ['All Units', ...names]
  }, [agents])

  const monthIdx = MONTH_ABBRS.indexOf(selectedMonth)

  // ── Recruiter → recruit count map (for selected month)
  const recruiterCountMap = useMemo(() => {
    const map = new Map()
    for (const a of agents) {
      const isNew = ytdMode
        ? MONTH_ABBRS.slice(0, monthIdx + 1).some(abbr => a.monthly?.[abbr]?.isNewRecruit)
        : a.monthly?.[selectedMonth]?.isNewRecruit
      if (isNew) {
        const rCode = a.recruiterCode || a.recruiterName || null
        if (rCode) map.set(rCode, (map.get(rCode) || 0) + 1)
      }
    }
    return map
  }, [agents, selectedMonth, ytdMode, monthIdx])

  // ── Month-keyed agent data (monthly or YTD) + recruits count
  const monthData = useMemo(() => {
    return agents.map(a => {
      const base = ytdMode
        ? { fyp: getAgentYtdFyp(a, monthIdx), fyc: getAgentYtdFyc(a, monthIdx), cases: getAgentYtdCases(a, monthIdx), anp: getAgentYtdFyp(a, monthIdx) }
        : (a.monthly?.[selectedMonth] ?? {})
      const recruits = recruiterCountMap.get(a.code) || recruiterCountMap.get(a.name) || 0
      return { ...a, m: { ...base, recruits } }
    })
  }, [agents, selectedMonth, ytdMode, monthIdx, recruiterCountMap])

  // ── TOTAL pools for rank context (all agents, no filter)
  const totalPools = useMemo(() => {
    const sorted = [...monthData].filter(a => (a.m[metricKey] || 0) > 0)
      .sort((a, b) => (b.m[metricKey] || 0) - (a.m[metricKey] || 0))
    const rookies  = sorted.filter(a => a.segment === 'Rookie')
    const seasoned = sorted.filter(a => a.segment === 'Seasoned')
    // Build rank maps (by agent code)
    const overallRank  = new Map(sorted.map((a, i) => [a.code, i + 1]))
    const rookieRank   = new Map(rookies.map((a, i)  => [a.code, i + 1]))
    const seasonedRank = new Map(seasoned.map((a, i) => [a.code, i + 1]))
    return {
      all:     sorted.length,
      rookie:  rookies.length,
      seasoned: seasoned.length,
      overallRank,
      rookieRank,
      seasonedRank,
    }
  }, [monthData, metricKey])

  // ── Filtered + sorted top 30
  const top30 = useMemo(() => {
    let list = [...monthData]
    if (area !== 'All')        list = list.filter(a => a.area === area)
    if (segment !== 'All')     list = list.filter(a => a.segment === segment)
    if (unitFilter !== 'All Units') list = list.filter(a => a.unitName === unitFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a => a.name?.toLowerCase().includes(q))
    }
    list.sort((a, b) => (b.m[metricKey] || 0) - (a.m[metricKey] || 0))
    return list.filter(a => (a.m[metricKey] || 0) > 0).slice(0, 30)
  }, [monthData, area, segment, unitFilter, search, metricKey])

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

  // ── Agency leaders
  const agencyLeaders = useMemo(() => {
    let list = [...monthData]
    if (area !== 'All') list = list.filter(a => a.area === area)
    const map = new Map()
    for (const agent of list) {
      const key = agent.unitCode || '__UNASSIGNED__'
      if (!map.has(key)) map.set(key, { unitCode: agent.unitCode, unitName: agent.unitName, ua: [] })
      map.get(key).ua.push(agent)
    }
    const qMonths = QUARTER_MONTHS[getQuarter(selectedMonth)]
    return [...map.values()]
      .filter(u => u.unitName)
      .map(({ unitCode, unitName, ua }) => ({
        unitCode, unitName,
        headcount:       ua.length,
        totalAnp:        ua.reduce((s, a) => s + (a.m.anp   || 0), 0),
        totalFyc:        ua.reduce((s, a) => s + (a.m.fyc   || 0), 0),
        totalFyp:        ua.reduce((s, a) => s + (a.m.fyp   || 0), 0),
        totalCases:      ua.reduce((s, a) => s + (a.m.cases || 0), 0),
        producingCount:  ua.filter(a => (a.m.cases || 0) > 0).length,
        newRecruitsCount: ua.filter(a => a.agentYears != null && a.agentYears <= 90/365.25).length,
        ppbCount: ua.filter(a => qMonths.reduce((s, abbr) => s + (a.monthly?.[abbr]?.fyc || 0), 0) >= 30000).length,
      }))
      .sort((a, b) => {
        const v = leaderSort
        return (b[v === 'fyc' ? 'totalFyc' : v === 'anp' ? 'totalAnp' : v === 'fyp' ? 'totalFyp' : 'totalCases']) -
               (a[v === 'fyc' ? 'totalFyc' : v === 'anp' ? 'totalAnp' : v === 'fyp' ? 'totalFyp' : 'totalCases'])
      })
  }, [monthData, area, leaderSort, selectedMonth])

  const monthLabel = MONTH_LABELS[MONTH_ABBRS.indexOf(selectedMonth)]
  const activeMeta = METRICS.find(m => m.key === metricKey) || METRICS[0]

  const handleExport = () => {
    const sorted = [...monthData].sort((a,b) => (b.m.fyc||0)-(a.m.fyc||0))
    exportMonthlyReport({
      monthLabel,
      kpis: {},
      top10Fyc:   { overall: sorted.slice(0,10).map(a=>({...a,_exportValue:a.m.fyc||0})), rookie:[], seasoned:[] },
      top10Fyp:   { overall: [...monthData].sort((a,b)=>(b.m.fyp||0)-(a.m.fyp||0)).slice(0,10).map(a=>({...a,_exportValue:a.m.fyp||0})), rookie:[], seasoned:[] },
      top10Cases: { overall: [...monthData].sort((a,b)=>(b.m.cases||0)-(a.m.cases||0)).slice(0,10).map(a=>({...a,_exportValue:a.m.cases||0})), rookie:[], seasoned:[] },
      newRecruits,
      topRecruiters,
    })
  }

  if (!isLoaded) return null

  return (
    <div className="min-h-screen bg-aia-gray">
      <div className="max-w-screen-xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col gap-5">

        {/* ── Header */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-aia-darkGray tracking-tight">Leaderboard</h1>
              <p className="text-sm text-gray-500 mt-0.5 font-medium">{monthLabel} {new Date().getFullYear()}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <button onClick={() => setYtdMode(false)}
                  className={`px-3 py-1.5 text-sm font-semibold transition-colors ${!ytdMode ? 'bg-aia-red text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                  Monthly
                </button>
                <button onClick={() => setYtdMode(true)}
                  className={`px-3 py-1.5 text-sm font-semibold border-l border-gray-200 transition-colors ${ytdMode ? 'bg-aia-red text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                  YTD
                </button>
              </div>
              <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 flex-wrap">
                {MONTH_ABBRS.map(abbr => (
                  <button key={abbr} onClick={() => setSelectedMonth(abbr)}
                    className={['px-2.5 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
                      selectedMonth === abbr ? 'bg-aia-red text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
                    ].join(' ')}>
                    {MONTH_LABELS[MONTH_ABBRS.indexOf(abbr)].slice(0,3)}
                  </button>
                ))}
              </div>
              <button onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap">
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
              <button key={t} onClick={() => setSubTab(t)}
                className={['px-5 py-2 rounded-md text-sm font-bold transition-colors duration-150',
                  subTab === t ? 'bg-aia-darkGray text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
                ].join(' ')}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Shared filters */}
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
                <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-aia-red/40 text-aia-darkGray font-medium cursor-pointer">
                  {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
                </svg>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search advisor..."
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-aia-red/40 placeholder:text-gray-400 text-aia-darkGray" />
              </div>
            </>
          )}
        </div>

        {/* ═══════════════ ADVISORS ═══════════════ */}
        {subTab === 'Advisors' && (
          <>
            {/* Metric toggle + context */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Rank by</span>
                <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                  {METRICS.map(m => (
                    <FilterBtn key={m.key} active={metricKey === m.key} onClick={() => setMetricKey(m.key)}>
                      {m.label}
                    </FilterBtn>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Top {top30.length} of {totalPools.all} advisors agency-wide
                {segment !== 'All' && ` · ${totalPools[segment.toLowerCase()]} ${segment}s`}
              </p>
            </div>

            {/* Top 30 table */}
            <section>
              <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-14">Rank</th>
                        <th className="sticky left-0 z-20 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[200px] border-r border-[#b80e3a] shadow-[2px_0_6px_rgba(0,0,0,0.15)]">Advisor</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[80px]">Area</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[120px]">Unit</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[130px]">
                          {activeMeta.label} {ytdMode ? 'YTD' : monthLabel.slice(0,3)}
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[140px]">Agency Rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top30.map((agent, idx) => {
                        const rank   = idx + 1
                        const isTop3 = rank <= 3
                        const overallRk = totalPools.overallRank.get(agent.code) || rank
                        const segRk = agent.segment === 'Rookie'
                          ? totalPools.rookieRank.get(agent.code)
                          : totalPools.seasonedRank.get(agent.code)
                        const rowCls = [
                          'transition-colors duration-100',
                          isTop3 ? TOP3_ROW[idx] : 'even:bg-gray-50 hover:bg-red-50/20',
                        ].filter(Boolean).join(' ')
                        return (
                          <tr key={agent.code ?? idx} className={`group ${rowCls}`}>
                            {/* Rank */}
                            <td className="px-4 py-3 font-bold text-aia-darkGray tabular-nums">
                              {isTop3
                                ? <span className="text-xl leading-none">{MEDAL[idx]}</span>
                                : <span className="text-gray-500">{rank}</span>}
                            </td>

                            {/* Advisor — sticky (fully opaque so scrolled cols don't bleed through) */}
                            <td className={`sticky left-0 z-10 px-4 py-3 border-r border-gray-100 shadow-[2px_0_6px_rgba(0,0,0,0.08)] ${isTop3 ? ['bg-yellow-50','bg-gray-100','bg-amber-50'][idx] : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                              <div className="flex items-center gap-2.5">
                                <AgentAvatar agentCode={agent.code} name={agent.name} size={32} className="!rounded-full flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="font-semibold text-aia-darkGray leading-snug text-sm truncate">
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
                                      <span className="text-[10px] text-gray-400">{agent.segment}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Area */}
                            <td className="px-4 py-3 text-xs font-semibold">
                              <span className={agent.area?.includes('SCM2') ? 'text-aia-red' : 'text-blue-600'}>
                                {agent.area === 'SCM2 (Davao)' ? 'Davao' : agent.area === 'SCM3 (Gensan)' ? 'Gensan' : agent.area ?? '—'}
                              </span>
                            </td>

                            {/* Unit */}
                            <td className="px-4 py-3 text-gray-600 text-xs leading-snug max-w-[120px] truncate">
                              {agent.unitName ?? '—'}
                            </td>

                            {/* Metric value */}
                            <td className="px-4 py-3 text-right font-bold tabular-nums text-aia-darkGray">
                              {activeMeta.fmt(agent.m[metricKey] || 0)}
                            </td>

                            {/* Agency rank context */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-[11px] font-bold"
                                  style={{ color: overallRk <= 3 ? '#D31145' : overallRk <= 10 ? '#C97B1A' : '#6B7180' }}>
                                  #{overallRk} of {totalPools.all}
                                </span>
                                {agent.segment && agent.segment !== 'Unknown' && segRk != null && (
                                  <span className="text-[10px] text-gray-400">
                                    #{segRk} of {agent.segment === 'Rookie' ? totalPools.rookie : totalPools.seasoned} {agent.segment}s
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {top30.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm font-medium">
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
                                : a.name}
                            </td>
                            <td className="px-4 py-2.5">
                              <Tag variant={a.segment === 'Rookie' ? 'rookie' : 'seasoned'}>{a.segment}</Tag>
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

        {/* ═══════════════ AGENCY LEADERS ═══════════════ */}
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
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[120px]">ANP</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[120px]">FYC</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[120px]">FYP</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-20">Cases</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-24">Producing</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-28">Recruits</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-28">PPB Qual.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agencyLeaders.map((u, idx) => {
                      const isTop3 = idx < 3
                      return (
                        <tr key={u.unitCode ?? idx} className={isTop3 ? TOP3_ROW[idx] : 'even:bg-gray-50'}>
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
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{formatCurrency(u.totalFyp)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-700">{u.totalCases}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-sm font-bold text-green-600">{u.producingCount}</span>
                            <span className="text-xs text-gray-400 ml-1">/ {u.headcount}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-700">{u.newRecruitsCount}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-700" title="FYC ≥ ₱30K this quarter">{u.ppbCount}</td>
                        </tr>
                      )
                    })}
                    {agencyLeaders.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm font-medium">No unit data available.</td>
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
