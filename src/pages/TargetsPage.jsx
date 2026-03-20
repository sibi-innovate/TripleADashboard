import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { formatCurrency, formatNumber } from '../utils/formatters'

const MONTH_ABBRS  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const SPREAD_MONTHS = 11  // Jan–Nov

function loadTargets() {
  try { return JSON.parse(localStorage.getItem('amora_targets') || '{}') }
  catch { return {} }
}

/**
 * Compute rolling monthly targets for Jan–Nov (indices 0–10).
 * - annualTarget: the full year target
 * - actuals: array of 12 actual values (index 0=JAN, 11=DEC)
 * - Returns array of 12 values: rolling target per month (DEC = 0 always)
 *
 * Logic:
 *   For each month i in [0..10]:
 *     remainingTarget = annualTarget - sum(actuals[0..i-1])
 *     remainingMonths = 11 - i
 *     target[i] = max(0, remainingTarget / remainingMonths)
 *   target[11] = 0  (December free)
 */
function computeRollingTargets(annualTarget, actuals) {
  const targets = new Array(12).fill(0)
  let cumulativeActual = 0
  for (let i = 0; i < 11; i++) {
    const remainingTarget = annualTarget - cumulativeActual
    const remainingMonths = 11 - i
    targets[i] = Math.max(0, remainingTarget / remainingMonths)
    cumulativeActual += actuals[i] || 0  // 0 for future months with no data
  }
  // targets[11] (December) stays 0
  return targets
}

function getAchCell(actual, target, isFuture) {
  if (isFuture && actual === 0) return { pct: null, label: '—', cls: 'text-gray-300' }
  if (target === 0) return { pct: null, label: '—', cls: 'text-gray-300' }
  const pct = (actual / target) * 100
  if (pct >= 100) return { pct, label: '✓ On Track', cls: 'text-green-600 font-bold' }
  if (pct >= 80)  return { pct, label: 'Nearly',     cls: 'text-amber-600 font-bold' }
  return               { pct, label: 'Behind',      cls: 'text-red-500' }
}

export default function TargetsPage() {
  const { data, isLoaded } = useData()
  const navigate = useNavigate()
  const currentMonthIdx = new Date().getMonth()

  const stored = loadTargets()
  const [fypTarget,  setFypTarget]  = useState(String(stored.fyp   || ''))
  const [caseTarget, setCaseTarget] = useState(String(stored.cases || ''))
  const [prodTarget, setProdTarget] = useState(String(stored.prod  || ''))
  const [saved, setSaved] = useState(false)

  const annualFyp   = Number(fypTarget)   || 0
  const annualCases = Number(caseTarget)  || 0
  const annualProd  = Number(prodTarget)  || 0

  const baseMonthlyFyp   = annualFyp   > 0 ? annualFyp   / 11 : 0
  const baseMonthlyCase  = annualCases > 0 ? annualCases / 11 : 0
  const monthlyProdTarget = annualProd  // this IS already the monthly target

  const agents = useMemo(() =>
    (data?.agents ?? []).filter(a => a.manpowerInd),
    [data]
  )

  const monthlyActuals = useMemo(() =>
    MONTH_ABBRS.map((abbr, i) => ({
      abbr,
      label: MONTH_LABELS[i],
      idx: i,
      fyp:   agents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyp   || 0), 0),
      cases: agents.reduce((s, a) => s + (a.monthly?.[abbr]?.cases || 0), 0),
      prod:  agents.filter(a => a.monthly?.[abbr]?.producing === true).length,
    })),
    [agents]
  )

  const unitBreakdown = useMemo(() => {
    const totalManpower = agents.length
    if (totalManpower === 0) return []
    const unitMap = new Map()
    for (const a of agents) {
      const key = a.unitCode || '__UNASSIGNED__'
      if (!unitMap.has(key)) unitMap.set(key, { unitName: a.unitName || a.unitCode || '?', agents: [] })
      unitMap.get(key).agents.push(a)
    }
    return Array.from(unitMap.values())
      .map(u => {
        const share = u.agents.length / totalManpower
        const ytdFyp = u.agents.reduce((s, a) => {
          for (let i = 0; i <= currentMonthIdx; i++) {
            s += a.monthly?.[MONTH_ABBRS[i]]?.fyp || 0
          }
          return s
        }, 0)
        return {
          unitName:    u.unitName,
          headcount:   u.agents.length,
          share,
          allocated:   annualFyp * share,
          ytdFyp,
          achievement: annualFyp > 0 ? (ytdFyp / (annualFyp * share)) * 100 : null,
        }
      })
      .sort((a, b) => b.allocated - a.allocated)
  }, [agents, annualFyp, currentMonthIdx])

  function saveTargets() {
    localStorage.setItem('amora_targets', JSON.stringify({
      fyp:   Number(fypTarget)   || 0,
      cases: Number(caseTarget)  || 0,
      prod:  Number(prodTarget)  || 0,
    }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!isLoaded) { navigate('/'); return null }

  const fypActuals  = monthlyActuals.map(m => m.fyp)
  const caseActuals = monthlyActuals.map(m => m.cases)

  const rollingFypTargets  = computeRollingTargets(annualFyp,   fypActuals)
  const rollingCaseTargets = computeRollingTargets(annualCases, caseActuals)

  return (
    <div
      className="min-h-screen bg-gray-50 pb-16"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="max-w-screen-xl mx-auto px-5 pt-8">

        {/* ── Header ── */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">
            Agency Targets 2026
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Set year-end goals and track monthly progress
          </p>
        </div>

        {/* ── Section 1: Target Settings Card ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-base font-bold text-gray-700 mb-1">Target Settings</h2>
          <p className="text-xs text-gray-400 mb-5">
            Targets are spread over 11 months (Jan–Nov). Unmet monthly balance rolls over to the next month.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
            {/* FYP Target */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Year-End FYP Target (₱)
              </label>
              <input
                type="number"
                value={fypTarget}
                onChange={e => setFypTarget(e.target.value)}
                placeholder="e.g. 10000000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
              />
              {annualFyp > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Monthly base: {formatCurrency(baseMonthlyFyp, true)}
                </p>
              )}
            </div>

            {/* Case Count Target */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Year-End Case Count Target
              </label>
              <input
                type="number"
                value={caseTarget}
                onChange={e => setCaseTarget(e.target.value)}
                placeholder="e.g. 500"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
              />
              {annualCases > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Monthly base: {formatNumber(Math.round(baseMonthlyCase))} cases
                </p>
              )}
            </div>

            {/* Producing Advisors Target */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Monthly Producing Advisors Target
              </label>
              <input
                type="number"
                value={prodTarget}
                onChange={e => setProdTarget(e.target.value)}
                placeholder="e.g. 60"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
              />
              {annualProd > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Monthly target: {formatNumber(annualProd)} advisors
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={saveTargets}
              className="bg-[#D31145] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#b80e3a] transition-colors duration-150"
            >
              Save Targets
            </button>
            {saved && (
              <span className="text-green-600 text-sm font-semibold">Saved ✓</span>
            )}
          </div>
        </div>

        {/* ── Section 2: Monthly Progress Tables ── */}

        {/* FYP Monthly Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-bold text-gray-700 mb-1">FYP Monthly Progress</h2>
          <p className="text-xs text-gray-400 mb-4">
            Annual target: {annualFyp > 0 ? formatCurrency(annualFyp) : 'Not set'}
            {annualFyp > 0 && ` · Monthly base (Jan–Nov): ${formatCurrency(baseMonthlyFyp, true)}`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] pr-4">Month</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Target</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Actual</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Achievement %</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Status</th>
                </tr>
              </thead>
              <tbody>
                {monthlyActuals.map(m => {
                  const isDec = m.idx === 11
                  const isFuture = m.idx > currentMonthIdx
                  const target = rollingFypTargets[m.idx]  // 0 for December (no target)
                  const ach = isDec
                    ? null
                    : getAchCell(m.fyp, target, isFuture)
                  const isCurrentMonth = m.idx === currentMonthIdx
                  return (
                    <tr
                      key={m.abbr}
                      className={`border-b border-gray-50 even:bg-gray-50 ${isCurrentMonth ? '!bg-red-50/40' : ''}`}
                    >
                      <td className="py-2 pr-4 font-medium text-gray-700">
                        {m.label}
                        {isCurrentMonth && (
                          <span className="ml-2 text-[10px] font-bold text-[#D31145] uppercase tracking-wide">Current</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {isDec ? <span className="text-gray-300">—</span> : (
                          <>
                            <div className="text-gray-700 font-medium">{formatCurrency(rollingFypTargets[m.idx], true)}</div>
                            {Math.abs(rollingFypTargets[m.idx] - baseMonthlyFyp) > 100 && (
                              <div className="text-[10px] text-gray-400">
                                base: {formatCurrency(baseMonthlyFyp, true)}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-700 font-medium">
                        {(isFuture && m.fyp === 0) ? '—' : formatCurrency(m.fyp, true)}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {isDec || ach === null
                          ? <span className="text-gray-300">—</span>
                          : ach.pct !== null
                            ? <span className={ach.cls}>{ach.pct.toFixed(1)}%</span>
                            : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="py-2 pl-4 text-center">
                        {isDec || ach === null
                          ? <span className="text-gray-300">—</span>
                          : <span className={ach.cls}>{ach.label}</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cases Monthly Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-bold text-gray-700 mb-1">Case Count Monthly Progress</h2>
          <p className="text-xs text-gray-400 mb-4">
            Annual target: {annualCases > 0 ? formatNumber(annualCases) + ' cases' : 'Not set'}
            {annualCases > 0 && ` · Monthly base (Jan–Nov): ${formatNumber(Math.round(baseMonthlyCase))} cases`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] pr-4">Month</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Target</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Actual</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Achievement %</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Status</th>
                </tr>
              </thead>
              <tbody>
                {monthlyActuals.map(m => {
                  const isDec = m.idx === 11
                  const isFuture = m.idx > currentMonthIdx
                  const target = rollingCaseTargets[m.idx]  // 0 for December (no target)
                  const ach = isDec
                    ? null
                    : getAchCell(m.cases, target, isFuture)
                  const isCurrentMonth = m.idx === currentMonthIdx
                  return (
                    <tr
                      key={m.abbr}
                      className={`border-b border-gray-50 even:bg-gray-50 ${isCurrentMonth ? '!bg-red-50/40' : ''}`}
                    >
                      <td className="py-2 pr-4 font-medium text-gray-700">
                        {m.label}
                        {isCurrentMonth && (
                          <span className="ml-2 text-[10px] font-bold text-[#D31145] uppercase tracking-wide">Current</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-500">
                        {isDec ? '—' : formatNumber(Math.round(target))}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-700 font-medium">
                        {(isFuture && m.cases === 0) ? '—' : formatNumber(m.cases)}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {isDec || ach === null
                          ? <span className="text-gray-300">—</span>
                          : ach.pct !== null
                            ? <span className={ach.cls}>{ach.pct.toFixed(1)}%</span>
                            : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="py-2 pl-4 text-center">
                        {isDec || ach === null
                          ? <span className="text-gray-300">—</span>
                          : <span className={ach.cls}>{ach.label}</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Producing Advisors Monthly Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-base font-bold text-gray-700 mb-1">Producing Advisors Monthly Progress</h2>
          <p className="text-xs text-gray-400 mb-4">
            Monthly target: {annualProd > 0 ? formatNumber(annualProd) + ' advisors' : 'Not set'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] pr-4">Month</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Target</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Actual</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Achievement %</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Status</th>
                </tr>
              </thead>
              <tbody>
                {monthlyActuals.map(m => {
                  const isDec = m.idx === 11
                  const isFuture = m.idx > currentMonthIdx
                  const target = isDec ? 0 : monthlyProdTarget
                  const ach = isDec
                    ? null
                    : getAchCell(m.prod, monthlyProdTarget, isFuture)
                  const isCurrentMonth = m.idx === currentMonthIdx
                  return (
                    <tr
                      key={m.abbr}
                      className={`border-b border-gray-50 even:bg-gray-50 ${isCurrentMonth ? '!bg-red-50/40' : ''}`}
                    >
                      <td className="py-2 pr-4 font-medium text-gray-700">
                        {m.label}
                        {isCurrentMonth && (
                          <span className="ml-2 text-[10px] font-bold text-[#D31145] uppercase tracking-wide">Current</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-500">
                        {isDec ? '—' : (monthlyProdTarget > 0 ? formatNumber(monthlyProdTarget) : '—')}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-700 font-medium">
                        {(isFuture && m.prod === 0) ? '—' : formatNumber(m.prod)}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {isDec || ach === null
                          ? <span className="text-gray-300">—</span>
                          : ach.pct !== null
                            ? <span className={ach.cls}>{ach.pct.toFixed(1)}%</span>
                            : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="py-2 pl-4 text-center">
                        {isDec || ach === null
                          ? <span className="text-gray-300">—</span>
                          : <span className={ach.cls}>{ach.label}</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 3: Unit Breakdown ── */}
        {annualFyp > 0 && unitBreakdown.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
            <h2 className="text-base font-bold text-gray-700 mb-1">
              Unit Breakdown — FYP Target Allocation
            </h2>
            <p className="text-xs text-gray-400 mb-4">Based on manpower share</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] pr-4">Unit Name</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Advisors</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Share %</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Allocated FYP Target</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">YTD FYP Actual</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Achievement %</th>
                  </tr>
                </thead>
                <tbody>
                  {unitBreakdown.map(u => {
                    const achCls =
                      u.achievement === null
                        ? 'text-gray-300'
                        : u.achievement >= 100
                          ? 'text-green-600 font-bold'
                          : u.achievement >= 80
                            ? 'text-amber-600 font-bold'
                            : 'text-red-500'
                    return (
                      <tr key={u.unitName} className="border-b border-gray-50 even:bg-gray-50 hover:bg-gray-50/50">
                        <td className="py-2 pr-4 font-medium text-gray-700">{u.unitName}</td>
                        <td className="py-2 px-4 text-right text-gray-600">{u.headcount}</td>
                        <td className="py-2 px-4 text-right text-gray-600">
                          {(u.share * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 px-4 text-right text-gray-700 font-medium">
                          {formatCurrency(u.allocated, true)}
                        </td>
                        <td className="py-2 px-4 text-right text-gray-700 font-medium">
                          {formatCurrency(u.ytdFyp, true)}
                        </td>
                        <td className="py-2 pl-4 text-right">
                          {u.achievement !== null
                            ? <span className={achCls}>{u.achievement.toFixed(1)}%</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
