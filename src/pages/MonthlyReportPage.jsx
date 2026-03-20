import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import KpiCard from '../components/KpiCard'
import { formatCurrency, formatNumber } from '../utils/formatters'
import { exportMonthlyReport } from '../utils/exportExcel'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_ABBRS  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_NUMS   = ['01','02','03','04','05','06','07','08','09','10','11','12']

const currentMonthIdx = new Date().getMonth() // 0-based
const AVAILABLE_MONTHS = MONTH_ABBRS.slice(0, currentMonthIdx + 1).map((abbr, i) => ({
  abbr,
  label: MONTH_LABELS[i],
  num: MONTH_NUMS[i],
}))

const MEDAL = ['🥇', '🥈', '🥉']

// ─── Sub-components ───────────────────────────────────────────────────────────

function HighlightTable({ title, rows, valueKey, valueLabel, formatFn }) {
  return (
    <div className="flex-1 min-w-0">
      {title && (
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</p>
      )}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-aia-red text-white text-xs">
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Advisor</th>
              <th className="px-3 py-2 text-right">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, idx) => (
              <tr key={a.code ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-3 py-2 font-bold text-gray-500 text-base leading-none">
                  {idx < 3 ? MEDAL[idx] : <span className="text-sm text-gray-400">{idx + 1}</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold text-aia-darkGray text-xs leading-tight">{a.name}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{a.segment} · {a.unitName}</div>
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-aia-darkGray text-xs">
                  {formatFn(a.m[valueKey] || 0)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-400">
                  No data for this month
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MonthlyReportPage() {
  const { data, isLoaded } = useData()
  const navigate = useNavigate()

  const [selectedMonth, setSelectedMonth] = useState(
    AVAILABLE_MONTHS[AVAILABLE_MONTHS.length - 1].abbr
  )
  const [highlightTab,  setHighlightTab]  = useState('FYC')
  const [segmentView,   setSegmentView]   = useState('Overall')

  // ── All hooks before early return ──
  const agents = data?.agents ?? []

  const monthData = useMemo(() =>
    agents.map(a => ({ ...a, m: a.monthly?.[selectedMonth] ?? {} })),
    [agents, selectedMonth]
  )

  const sortedByFyc   = useMemo(() => [...monthData].sort((a, b) => (b.m.fyc   || 0) - (a.m.fyc   || 0)), [monthData])
  const sortedByFyp   = useMemo(() => [...monthData].sort((a, b) => (b.m.fyp   || 0) - (a.m.fyp   || 0)), [monthData])
  const sortedByCases = useMemo(() => [...monthData].sort((a, b) => (b.m.cases || 0) - (a.m.cases || 0)), [monthData])

  const newRecruits = useMemo(() => monthData.filter(a => a.m.isNewRecruit), [monthData])

  const topRecruiters = useMemo(() => {
    const map = new Map()
    for (const a of newRecruits) {
      const rName = a.recruiterName || 'Unknown'
      const rCode = a.recruiterCode || rName
      if (!map.has(rCode)) map.set(rCode, { name: rName, count: 0, recruits: [] })
      const r = map.get(rCode)
      r.count++
      r.recruits.push(a.name)
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [newRecruits])

  // ── Early return after all hooks ──
  if (!isLoaded) { navigate('/'); return null }

  // ── KPI computations ──
  const totalManpower  = monthData.reduce((s, a) => s + (a.m.manpower || 0), 0)
  const producingCount = monthData.filter(a => a.m.producing).length
  const totalAnp       = monthData.reduce((s, a) => s + (a.m.anp   || 0), 0)
  const totalFyc       = monthData.reduce((s, a) => s + (a.m.fyc   || 0), 0)
  const totalFyp       = monthData.reduce((s, a) => s + (a.m.fyp   || 0), 0)
  const totalCases     = monthData.reduce((s, a) => s + (a.m.cases || 0), 0)
  const persVals       = monthData.map(a => a.m.persistency).filter(v => v != null && v > 0)
  const avgPers        = persVals.length ? persVals.reduce((s, v) => s + v, 0) / persVals.length : null

  // ── Top 10 helpers ──
  function getTop10(sorted) {
    return {
      overall:  sorted.slice(0, 10),
      rookie:   sorted.filter(a => a.segment === 'Rookie').slice(0, 10),
      seasoned: sorted.filter(a => a.segment === 'Seasoned').slice(0, 10),
    }
  }

  const activeSort = highlightTab === 'FYC' ? sortedByFyc
                   : highlightTab === 'FYP' ? sortedByFyp
                   : sortedByCases
  const top10 = getTop10(activeSort)

  const valueKey   = highlightTab === 'FYC' ? 'fyc' : highlightTab === 'FYP' ? 'fyp' : 'cases'
  const formatFn   = highlightTab === 'Cases' ? formatNumber : v => formatCurrency(v, true)

  const monthLabel = MONTH_LABELS[MONTH_ABBRS.indexOf(selectedMonth)]

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
      overall:  sortedByFyc.slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyc || 0 })),
      rookie:   sortedByFyc.filter(a => a.segment === 'Rookie').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyc || 0 })),
      seasoned: sortedByFyc.filter(a => a.segment === 'Seasoned').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyc || 0 })),
    },
    top10Fyp: {
      overall:  sortedByFyp.slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyp || 0 })),
      rookie:   sortedByFyp.filter(a => a.segment === 'Rookie').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyp || 0 })),
      seasoned: sortedByFyp.filter(a => a.segment === 'Seasoned').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyp || 0 })),
    },
    top10Cases: {
      overall:  sortedByCases.slice(0, 10).map(a => ({ ...a, _exportValue: a.m.cases || 0 })),
      rookie:   sortedByCases.filter(a => a.segment === 'Rookie').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.cases || 0 })),
      seasoned: sortedByCases.filter(a => a.segment === 'Seasoned').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.cases || 0 })),
    },
    newRecruits,
    topRecruiters,
  })

  return (
    <div className="min-h-screen bg-aia-gray">
      <div className="max-w-screen-xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex flex-col gap-6">

        {/* ── Page header + month selector */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-aia-darkGray tracking-tight">
              Monthly Report
            </h1>
            <p className="text-sm text-gray-500 mt-1 font-medium">{monthLabel} 2026</p>
          </div>

          {/* Month pill selector + Download */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 flex-wrap">
              {AVAILABLE_MONTHS.map(({ abbr, label }) => (
                <button
                  key={abbr}
                  onClick={() => setSelectedMonth(abbr)}
                  className={[
                    'px-3 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
                    selectedMonth === abbr
                      ? 'bg-aia-red text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {label.slice(0, 3)}
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

        {/* ── KPI cards */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard title="Manpower"           value={formatNumber(totalManpower)}               color="blue" />
            <KpiCard title="Producing Advisors" value={formatNumber(producingCount)}              color="green"
              subtitle={totalManpower > 0 ? `${Math.round(producingCount / totalManpower * 100)}% of headcount` : undefined} />
            <KpiCard title="ANP"                value={formatCurrency(totalAnp,   true)}          color="red" />
            <KpiCard title="FYC"                value={formatCurrency(totalFyc,   true)}          color="red" />
            <KpiCard title="FYP"                value={formatCurrency(totalFyp,   true)}          color="red" />
            <KpiCard title="Cases"              value={formatNumber(totalCases)}                  color="gray" />
            <KpiCard title="Avg Persistency"
              value={avgPers != null ? `${avgPers.toFixed(1)}%` : '—'}
              color="gray" />
          </div>
        </section>

        {/* ── Highlights */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-extrabold text-aia-darkGray">Top Performers</h2>

            {/* Metric tabs */}
            <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
              {['FYC', 'FYP', 'Cases'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setHighlightTab(tab)}
                  className={[
                    'px-4 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
                    highlightTab === tab
                      ? 'bg-aia-red text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Overall / By Segment */}
            <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
              {['Overall', 'By Segment'].map(v => (
                <button
                  key={v}
                  onClick={() => setSegmentView(v)}
                  className={[
                    'px-4 py-1.5 rounded-md text-sm font-semibold transition-colors duration-150',
                    segmentView === v
                      ? 'bg-aia-darkGray text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {segmentView === 'Overall' ? (
            <HighlightTable
              rows={top10.overall}
              valueKey={valueKey}
              valueLabel={highlightTab}
              formatFn={formatFn}
            />
          ) : (
            <div className="flex gap-4 flex-col sm:flex-row">
              <HighlightTable title="Rookie" rows={top10.rookie}
                valueKey={valueKey} valueLabel={highlightTab} formatFn={formatFn} />
              <HighlightTable title="Seasoned" rows={top10.seasoned}
                valueKey={valueKey} valueLabel={highlightTab} formatFn={formatFn} />
            </div>
          )}
        </section>

        {/* ── New Recruits */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold text-aia-darkGray flex items-center gap-2">
            New Recruits
            {newRecruits.length > 0 && (
              <span className="text-sm font-semibold text-aia-red bg-red-50 px-2 py-0.5 rounded-full">
                {newRecruits.length}
              </span>
            )}
          </h2>

          {newRecruits.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-10 text-center text-sm text-gray-400">
              No new recruits for {monthLabel}.
            </div>
          ) : (
            <>
              {/* Top Recruiters podium */}
              {topRecruiters.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Top Recruiters
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    {topRecruiters.slice(0, 5).map((r, idx) => (
                      <div
                        key={r.name}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 min-w-[180px]"
                      >
                        <span className="text-2xl leading-none">
                          {idx < 3 ? MEDAL[idx] : ''}
                        </span>
                        <div>
                          <div className="font-bold text-aia-darkGray text-sm">{r.name}</div>
                          <div className="text-xs text-gray-400">
                            {r.count} recruit{r.count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recruits table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-bold uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left">New Advisor</th>
                      <th className="px-4 py-2.5 text-left">Segment</th>
                      <th className="px-4 py-2.5 text-left">Area</th>
                      <th className="px-4 py-2.5 text-left">Unit</th>
                      <th className="px-4 py-2.5 text-left">Recruiter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newRecruits.map((a, idx) => (
                      <tr key={a.code ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-2.5 font-semibold text-aia-darkGray">{a.name}</td>
                        <td className="px-4 py-2.5">
                          <span className={[
                            'text-xs font-bold px-1.5 py-0.5 rounded',
                            a.segment === 'Rookie' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600',
                          ].join(' ')}>
                            {a.segment}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {a.area?.includes('SCM2') ? 'Davao' : 'Gensan'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 leading-snug">{a.unitName || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{a.recruiterName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

      </div>
    </div>
  )
}
