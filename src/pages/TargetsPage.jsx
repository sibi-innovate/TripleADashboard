import { useState, useMemo, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { formatCurrency, formatNumber } from '../utils/formatters'
import { CURRENT_YEAR, MDRT_GOAL_DEFAULT, MONTH_ABBRS, MONTH_LABELS, CURRENT_MONTH_IDX, QUARTER_MONTHS } from '../constants'

const SPREAD_MONTHS = 11  // Jan–Nov

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
  const { data, isLoaded, targets, loadTargets, targetsLoading } = useData()
  const currentMonthIdx = new Date().getMonth()

  const [monthIdx, setMonthIdx] = useState(CURRENT_MONTH_IDX)

  // Load from Supabase on mount and whenever targets changes
  useEffect(() => { loadTargets?.(CURRENT_YEAR) }, [])

  const annualFyp   = targets?.fyp_annual        || 0
  const annualCases = targets?.cases_annual       || 0
  const annualProd  = targets?.producing_monthly  || 0

  const baseMonthlyFyp   = annualFyp   > 0 ? annualFyp   / 11 : 0
  const baseMonthlyCase  = annualCases > 0 ? annualCases / 11 : 0
  const monthlyProdTarget = annualProd

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
            Agency Goals {CURRENT_YEAR}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track monthly progress toward agency-wide targets
          </p>
        </div>

        {/* ── Agency Ace Award Tracker ── */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-700 mb-1">Agency Ace Award Tracker</h2>
          <p className="text-xs text-gray-400 mb-4">Annual thresholds: FYC ≥ ₱300,000 · Cases ≥ 24 · Persistency ≥ 82.5%</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: 'FYC (YTD)',
                target: 300000,
                actual: MONTH_ABBRS.slice(0, currentMonthIdx + 1).reduce((s, abbr) =>
                  s + agents.reduce((ss, a) => ss + (a.monthly?.[abbr]?.fyc || 0), 0), 0),
                format: v => `₱${v.toLocaleString()}`,
                targetLabel: '₱300,000',
              },
              {
                label: 'Cases (YTD)',
                target: 24,
                actual: monthlyActuals.slice(0, currentMonthIdx + 1).reduce((s, m) => s + m.cases, 0),
                format: v => v.toString(),
                targetLabel: '24 cases',
              },
              {
                label: 'Persistency (Latest)',
                target: 82.5,
                actual: (() => {
                  for (let i = currentMonthIdx; i >= 0; i--) {
                    const abbr = MONTH_ABBRS[i]
                    const vals = agents.map(a => a.monthly?.[abbr]?.persistency).filter(v => v != null && !isNaN(v))
                    if (vals.length > 0) return vals.reduce((s, v) => s + v, 0) / vals.length
                  }
                  return 0
                })(),
                format: v => `${v.toFixed(1)}%`,
                targetLabel: '82.5%',
              },
            ].map(({ label, target, actual, format, targetLabel }) => {
              const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0
              const color = pct >= 100 ? '#4E9A51' : pct >= 80 ? '#C97B1A' : '#D31145'
              return (
                <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                  <p className="text-xl font-extrabold text-gray-800 mb-0.5">{format(actual)}</p>
                  <p className="text-[11px] text-gray-400 mb-3">Target: {targetLabel}</p>
                  <div className="h-2 rounded-full overflow-hidden bg-gray-100">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <p className="text-[11px] mt-1 font-semibold" style={{ color }}>{pct.toFixed(1)}% of target</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Quarterly Bonus Summary ── */}
        {(() => {
          const currentQuarter = ['Q1','Q2','Q3','Q4'].find(q =>
            QUARTER_MONTHS[q].includes(currentMonthIdx)
          ) || 'Q1'
          const qAbbrs = QUARTER_MONTHS[currentQuarter]
            .filter(i => i <= currentMonthIdx)
            .map(i => MONTH_ABBRS[i])

          const totalQFyc = agents.reduce((sum, a) => {
            return sum + qAbbrs.reduce((s2, abbr) => s2 + (a.monthly?.[abbr]?.fyc || 0), 0)
          }, 0)

          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-8 flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-0.5">Quarterly Bonus — {currentQuarter} {CURRENT_YEAR}</p>
                <p className="text-xl font-extrabold text-gray-800">
                  ₱{totalQFyc.toLocaleString()} <span className="text-sm font-normal text-gray-400">quarter-to-date FYC</span>
                </p>
              </div>
              <a
                href="/quarterly-bonus"
                className="text-sm font-semibold text-white bg-[#D31145] px-4 py-2 rounded-lg hover:bg-[#b80e3a] transition-colors"
              >
                View Quarterly Bonus Details →
              </a>
            </div>
          )
        })()}

        {/* ── Individual Advisor Targets ── */}
        {annualFyp > 0 && (() => {
          const abbr          = MONTH_ABBRS[monthIdx]
          const rollingFyp    = computeRollingTargets(annualFyp, monthlyActuals.map(m => m.fyp))
          const monthlyTarget = rollingFyp[monthIdx]
          const totalManpower = agents.length

          const unitMap = new Map()
          agents.forEach(a => {
            const key = a.unitCode || '__UNASSIGNED__'
            if (!unitMap.has(key)) unitMap.set(key, { unitName: a.unitName || key, rookies: [], seasoneds: [] })
            const u = unitMap.get(key)
            if (a.segment === 'Rookie') u.rookies.push(a)
            else u.seasoneds.push(a)
          })

          const rows = []
          unitMap.forEach(({ unitName, rookies, seasoneds }) => {
            const allInUnit    = [...rookies, ...seasoneds]
            const unitShare    = totalManpower > 0 ? allInUnit.length / totalManpower : 0
            const unitTarget   = monthlyTarget * unitShare
            const rookiePool   = unitTarget * 0.40
            const seasonedPool = unitTarget * 0.60
            const rookieTarget   = rookies.length   > 0 ? rookiePool   / rookies.length   : 0
            const seasonedTarget = seasoneds.length > 0 ? seasonedPool / seasoneds.length : 0

            const unitActual = allInUnit.reduce((s, a) => s + (a.monthly?.[abbr]?.fyp || 0), 0)
            rows.push({ type: 'unit', unitName, target: unitTarget, actual: unitActual })

            ;[...rookies, ...seasoneds].forEach(a => {
              const target = a.segment === 'Rookie' ? rookieTarget : seasonedTarget
              const actual = a.monthly?.[abbr]?.fyp || 0
              rows.push({ type: 'advisor', agent: a, target, actual, unitName })
            })
          })

          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <h2 className="text-base font-bold text-gray-700">Individual Advisor Targets</h2>
                <div className="flex gap-1 flex-wrap">
                  {MONTH_LABELS.map((lbl, i) => (
                    <button
                      key={i}
                      onClick={() => setMonthIdx(i)}
                      className="px-2.5 py-1 rounded text-[11px] transition-colors"
                      style={{
                        backgroundColor: monthIdx === i ? '#D31145' : 'transparent',
                        color: monthIdx === i ? '#fff' : '#6B7180',
                        border: `1px solid ${monthIdx === i ? '#D31145' : '#E8E9ED'}`,
                        fontFamily: 'AIA Everest',
                        fontWeight: monthIdx === i ? 700 : 500,
                      }}
                    >
                      {lbl.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Monthly target: {formatCurrency(monthlyTarget, true)} · Rookies 40% pool, Seasoneds 60% pool, split by headcount
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {['Advisor','Unit','Segment','Personal Target','Actual FYP','Achievement %'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const ach = row.target > 0 ? (row.actual / row.target) * 100 : null
                      const achCls = ach === null ? 'text-gray-300' : ach >= 100 ? 'text-green-600 font-bold' : ach >= 80 ? 'text-amber-600 font-bold' : 'text-red-500'
                      if (row.type === 'unit') {
                        return (
                          <tr key={`u-${i}`} className="bg-gray-100 border-t border-gray-200">
                            <td colSpan={2} className="py-2 px-3 font-bold text-gray-700 text-[11px] uppercase tracking-wide">{row.unitName}</td>
                            <td className="py-2 px-3 text-[11px] text-gray-400">Unit Total</td>
                            <td className="py-2 px-3 text-right font-bold text-gray-700">{formatCurrency(row.target, true)}</td>
                            <td className="py-2 px-3 text-right font-bold text-gray-700">{formatCurrency(row.actual, true)}</td>
                            <td className="py-2 px-3 text-right">
                              {ach !== null ? <span className={achCls}>{ach.toFixed(1)}%</span> : '—'}
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={row.agent.code} className="border-b border-gray-50 even:bg-gray-50 hover:bg-gray-50/50">
                          <td className="py-2 px-3 text-gray-700">{row.agent.name}</td>
                          <td className="py-2 px-3 text-gray-500 text-[11px]">{row.unitName}</td>
                          <td className="py-2 px-3">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: row.agent.segment === 'Rookie' ? '#FAE8EE' : '#FFF0EB', color: row.agent.segment === 'Rookie' ? '#D31145' : '#FF754D' }}>
                              {row.agent.segment}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-gray-700 font-medium">{formatCurrency(row.target, true)}</td>
                          <td className="py-2 px-3 text-right text-gray-700 font-medium">{formatCurrency(row.actual, true)}</td>
                          <td className="py-2 px-3 text-right">
                            {ach !== null ? <span className={achCls}>{ach.toFixed(1)}%</span> : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

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
