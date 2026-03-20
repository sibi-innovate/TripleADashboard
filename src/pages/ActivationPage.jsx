import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { formatCurrency } from '../utils/formatters'
import Tag from '../components/Tag'
import StatusIndicator from '../components/StatusIndicator'

const FAST_START_MIN_CASES = 5

// ─── Helper functions ─────────────────────────────────────────────────────────

const NINETY_DAYS      = 90 / 365.25
const MONTH_ABBRS      = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const CURRENT_YEAR     = new Date().getFullYear()
const CURRENT_MONTH_IDX = new Date().getMonth() // 0–11

function daysSinceAppt(apptDateInt) {
  if (!apptDateInt || apptDateInt < 19000101) return null
  const y  = Math.floor(apptDateInt / 10000)
  const mo = Math.floor((apptDateInt % 10000) / 100) - 1
  const d  = apptDateInt % 100
  return Math.floor((Date.now() - new Date(y, mo, d).getTime()) / 86400000)
}

// Sums cases / FYP / FYC from the rookie's appointment month through today,
// so the KPI reflects the full 90-day window rather than just the current month.
function getCumulativeStats(agent) {
  if (!agent.apptDate || agent.apptDate < 19000101) {
    return { cases: agent.casesTotal ?? 0, fyp: agent.fypTotal ?? 0, fyc: agent.fycMtd ?? 0 }
  }
  const apptYear     = Math.floor(agent.apptDate / 10000)
  const apptMonthIdx = Math.floor((agent.apptDate % 10000) / 100) - 1  // 0–11
  // If appointed before this year, start from January of this year
  const startIdx = apptYear < CURRENT_YEAR ? 0 : apptMonthIdx
  let cases = 0, fyp = 0, fyc = 0
  for (let i = startIdx; i <= CURRENT_MONTH_IDX; i++) {
    const m = agent.monthly?.[MONTH_ABBRS[i]] ?? {}
    cases += m.cases || 0
    fyp   += m.fyp   || 0
    fyc   += m.fyc   || 0
  }
  return { cases, fyp, fyc }
}

function getBucket(days) {
  if (days === null) return null
  if (days <= 30)  return { label: '0–30 days',  cls: 'bg-blue-100 text-blue-700' }
  if (days <= 60)  return { label: '31–60 days', cls: 'bg-purple-100 text-purple-700' }
  return                  { label: '61–90 days', cls: 'bg-amber-100 text-amber-700' }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActivationPage() {
  const { data, isLoaded } = useData()
  const navigate = useNavigate()
  const [areaFilter, setAreaFilter] = useState('All')

  const allAgents = useMemo(() =>
    (data?.agents ?? []).filter(a => a.manpowerInd),
    [data]
  )

  const newRecruits = useMemo(() =>
    allAgents
      .filter(a => a.agentYears != null && a.agentYears <= NINETY_DAYS)
      .map(a => {
        const cum = getCumulativeStats(a)
        return { ...a, days: daysSinceAppt(a.apptDate), cumCases: cum.cases, cumFyp: cum.fyp, cumFyc: cum.fyc }
      })
      .filter(a => areaFilter === 'All' || a.area === areaFilter)
      .sort((a, b) => (a.days ?? 999) - (b.days ?? 999)),
    [allAgents, areaFilter]
  )

  const fastStartCount    = newRecruits.filter(a => a.cumCases >= FAST_START_MIN_CASES).length
  const activatedCount    = newRecruits.filter(a => a.cumCases > 0 && a.cumCases < FAST_START_MIN_CASES).length
  const notActivatedCount = newRecruits.filter(a => a.cumCases === 0).length

  const recruiterStats = useMemo(() => {
    const map = new Map()
    for (const a of newRecruits) {
      const key = a.recruiterCode || a.recruiterName || 'Unknown'
      if (!map.has(key)) {
        map.set(key, {
          name: a.recruiterName || a.recruiterCode || 'Unknown',
          recruits: 0,
          activatedCount: 0,
          fastStartCount: 0,
        })
      }
      const r = map.get(key)
      r.recruits++
      if (a.cumCases > 0) r.activatedCount++
      if (a.cumCases >= FAST_START_MIN_CASES) r.fastStartCount++
    }
    return Array.from(map.values())
      .map(r => ({ ...r, rate: r.recruits > 0 ? Math.round((r.activatedCount / r.recruits) * 100) : 0 }))
      .sort((a, b) => b.recruits - a.recruits)
  }, [newRecruits])

  if (!isLoaded) { navigate('/'); return null }

  return (
    <div className="bg-aia-gray min-h-screen">
      <div className="max-w-screen-xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── Page header */}
        <div>
          <h1 className="text-2xl font-extrabold text-aia-darkGray tracking-tight">
            90 Day Ascent
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            The first 90 days define a rookie's career. Track progress and celebrate{' '}
            <span className="text-amber-600 font-semibold">⭐ FAST START Qualifiers</span>{' '}
            (≥{FAST_START_MIN_CASES} cases in 90 days).
          </p>
        </div>

        {/* ── Section 1: Summary KPI Cards */}
        <div className="flex gap-4 flex-wrap">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 min-w-[180px]">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              New Recruits (Last 90 days)
            </div>
            <div className="text-xl font-extrabold text-aia-darkGray tabular-nums mt-1">
              {newRecruits.length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm px-5 py-3 min-w-[180px] bg-amber-50">
            <div className="text-xs text-amber-600 font-medium uppercase tracking-wide">
              ⭐ FAST START Qualifiers
            </div>
            <div className="text-xl font-extrabold text-amber-600 tabular-nums mt-1">
              {fastStartCount}
            </div>
            <div className="text-xs text-amber-500 mt-0.5">≥{FAST_START_MIN_CASES} cases in 90 days</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 min-w-[180px]">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Activated (1–{FAST_START_MIN_CASES - 1} cases)
            </div>
            <div className="text-xl font-extrabold text-green-600 tabular-nums mt-1">
              {activatedCount}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 min-w-[180px]">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Not Yet Activated
            </div>
            <div className="text-xl font-extrabold text-red-600 tabular-nums mt-1">
              {notActivatedCount}
            </div>
          </div>
        </div>

        {/* ── Section 2: Area filter + New Recruits Table */}
        <div className="flex flex-col gap-3">

          {/* Area filter pills */}
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 w-fit">
            {['All', 'SCM2 (Davao)', 'SCM3 (Gensan)'].map(a => (
              <button
                key={a}
                onClick={() => setAreaFilter(a)}
                className={['px-3 py-1.5 rounded-md text-sm font-semibold transition-colors',
                  areaFilter === a ? 'bg-aia-red text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                ].join(' ')}
              >
                {a === 'SCM2 (Davao)' ? 'Davao' : a === 'SCM3 (Gensan)' ? 'Gensan' : a}
              </button>
            ))}
          </div>

          {/* New Recruits Table */}
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[160px]">Name</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[80px]">Area</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[120px]">Unit</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[110px]">Days Since Appt</th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[100px]">Bucket</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[140px]">Recruiter</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[80px]">Cases (Total)</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[110px]">FYP (Total)</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[110px]">FYC (Total)</th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[160px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {newRecruits.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                        No new recruits in the last 90 days.
                      </td>
                    </tr>
                  ) : (
                    newRecruits.map((a, idx) => {
                      const bucket = a.days !== null ? getBucket(a.days) : null
                      const isFastStart = a.cumCases >= FAST_START_MIN_CASES
                      const isActivated = a.cumCases > 0
                      const areaShort = a.area === 'SCM2 (Davao)' ? 'Davao' : a.area === 'SCM3 (Gensan)' ? 'Gensan' : a.area

                      return (
                        <tr key={a.code ?? idx} className="even:bg-gray-50">
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-aia-darkGray text-xs">{a.name}</div>
                            <div className="text-xs text-gray-400 leading-tight">{a.code}</div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{areaShort}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{a.unitName}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs font-medium text-aia-darkGray">
                            {a.days !== null ? a.days : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {bucket
                              ? <span className={bucket.cls + ' text-xs font-bold px-2 py-0.5 rounded-full'}>{bucket.label}</span>
                              : <span className="text-gray-400 text-xs">—</span>
                            }
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{a.recruiterName || a.recruiterCode || '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs font-medium text-aia-darkGray">
                            {a.cumCases}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs font-medium text-aia-darkGray">
                            {formatCurrency(a.cumFyp)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs font-medium text-aia-darkGray">
                            {formatCurrency(a.cumFyc)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {isFastStart
                              ? <StatusIndicator status="positive" label="⭐ FAST START" />
                              : isActivated
                                ? <StatusIndicator status="info" label="Activated" />
                                : <StatusIndicator status="warning" label="Not Yet" />
                            }
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Section 3: Recruiter Accountability */}
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-aia-darkGray tracking-tight">
              Recruiter Accountability
            </h2>
            <p className="text-sm text-gray-500 mt-0.5 font-medium">
              Who recruited the new recruits and their activation rates
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[180px]">Recruiter</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[100px]"># Recruits</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[110px]"># Activated</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[130px]">⭐ FAST START</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[120px]">Activation Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {recruiterStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                        No new recruits to display.
                      </td>
                    </tr>
                  ) : (
                    recruiterStats.map((r, idx) => {
                      const rateClass = r.rate >= 80
                        ? 'text-green-600 font-bold'
                        : r.rate >= 50
                          ? 'text-amber-600 font-bold'
                          : 'text-red-600 font-bold'

                      return (
                        <tr key={r.name} className="even:bg-gray-50">
                          <td className="px-3 py-2.5 font-semibold text-aia-darkGray text-xs">{r.name}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs font-medium text-aia-darkGray">
                            {r.recruits}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs font-medium text-aia-darkGray">
                            {r.activatedCount}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs font-medium text-amber-600">
                            {r.fastStartCount > 0 ? `⭐ ${r.fastStartCount}` : '—'}
                          </td>
                          <td className={`px-3 py-2.5 text-right tabular-nums text-xs ${rateClass}`}>
                            {r.rate}%
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
