import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { formatCurrency } from '../utils/formatters'
import KpiCard from '../components/KpiCard'
import Tag from '../components/Tag'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_ABBRS  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CURRENT_MONTH_IDX = new Date().getMonth() // 0-indexed

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionTitle({ children }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
      {children}
    </p>
  )
}

function StatBox({ label, value, sub, colorClass = 'bg-gray-50 text-gray-700' }) {
  return (
    <div className={`rounded-xl p-4 text-center ${colorClass}`}>
      <p className="text-3xl font-extrabold leading-none">{value}</p>
      {sub && <p className="text-xs font-medium mt-1 opacity-70">{sub}</p>}
      <p className="text-xs font-semibold mt-1 opacity-60">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function UnitProfilePage() {
  const { unitCode } = useParams()
  const { data } = useData()

  const [selectedMonthIdx, setSelectedMonthIdx] = useState(CURRENT_MONTH_IDX)

  // Find unit from data
  const unit = useMemo(
    () => (data?.units ?? []).find(u => u.unitCode === unitCode),
    [data, unitCode]
  )

  // Licensed advisors only
  const agents = useMemo(
    () => (unit?.agents ?? []).filter(a => a.manpowerInd),
    [unit]
  )

  // Monthly aggregates for all 12 months
  const monthlyData = useMemo(() => {
    return MONTH_ABBRS.map((abbr, i) => ({
      abbr,
      label: MONTH_LABELS[i],
      fyc:      agents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyc      ?? 0), 0),
      fyp:      agents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyp      ?? 0), 0),
      cases:    agents.reduce((s, a) => s + (a.monthly?.[abbr]?.cases    ?? 0), 0),
      producing: agents.filter(a => a.monthly?.[abbr]?.producing).length,
      recruits:  agents.filter(a => a.monthly?.[abbr]?.isNewRecruit).length,
    }))
  }, [agents])

  // Active months (any agent had production)
  const activeMonths = useMemo(
    () => monthlyData.map(m => m.fyc > 0 || m.cases > 0),
    [monthlyData]
  )

  // YTD (Jan through current month)
  const ytd = useMemo(() => {
    const months = monthlyData.slice(0, CURRENT_MONTH_IDX + 1)
    return {
      fyc:      months.reduce((s, m) => s + m.fyc, 0),
      fyp:      months.reduce((s, m) => s + m.fyp, 0),
      cases:    months.reduce((s, m) => s + m.cases, 0),
      recruits: months.reduce((s, m) => s + m.recruits, 0),
      producing: agents.filter(a =>
        months.some(m => a.monthly?.[m.abbr]?.producing)
      ).length,
    }
  }, [monthlyData, agents])

  // MTD (current month)
  const mtd = monthlyData[CURRENT_MONTH_IDX]

  // Selected month
  const selectedMonth = monthlyData[selectedMonthIdx]

  // Average activity ratio
  const avgActivityRatio = useMemo(() => {
    const withRatio = agents.filter(a => (a.activityRatio ?? 0) > 0)
    if (!withRatio.length) return null
    return withRatio.reduce((s, a) => s + a.activityRatio, 0) / withRatio.length
  }, [agents])

  // Segment breakdown
  const rookies  = agents.filter(a => a.segment === 'Rookie')
  const seasoned = agents.filter(a => a.segment === 'Seasoned')

  // Chart data: Jan through current month
  const chartData = monthlyData.slice(0, CURRENT_MONTH_IDX + 1)

  // Advisors sorted by FYC MTD desc
  const agentsSorted = useMemo(
    () => [...agents].sort((a, b) => (b.fycMtd ?? 0) - (a.fycMtd ?? 0)),
    [agents]
  )

  // Not found
  if (!unit) {
    return (
      <div className="min-h-screen bg-aia-gray flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 font-semibold">Unit not found.</p>
          <Link to="/units" className="mt-2 text-sm text-aia-red hover:underline">
            ← Back to Units
          </Link>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-aia-gray">
      <div className="max-w-screen-xl mx-auto px-4 py-8">

        {/* ── Breadcrumb + Header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Link to="/units" className="hover:text-aia-red transition-colors font-medium">
              Units
            </Link>
            <span>›</span>
            <span className="text-gray-700 font-semibold">
              {unit.unitName || unit.unitCode}
            </span>
          </div>

          {/* Header band */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#D31145] to-[#a80d37] px-6 py-5">
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                {unit.unitName || unit.unitCode}
              </h1>
              <p className="text-red-200 text-xs font-medium mt-1">
                Unit Code: {unit.unitCode} · {agents.length} Licensed Advisors ·{' '}
                {rookies.length} Rookies · {seasoned.length} Seasoned
              </p>
            </div>
            {/* Quick MTD stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
              {[
                { label: 'FYC MTD', value: formatCurrency(mtd.fyc, true) },
                { label: 'Cases MTD', value: mtd.cases },
                { label: 'Producing', value: `${mtd.producing} / ${agents.length}` },
                { label: 'New Recruits MTD', value: mtd.recruits },
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-3 text-center">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="text-lg font-bold text-gray-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Month Selector ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <SectionTitle>Month View</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {MONTH_ABBRS.map((abbr, idx) => (
              <button
                key={abbr}
                onClick={() => setSelectedMonthIdx(idx)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-150',
                  selectedMonthIdx === idx
                    ? 'bg-aia-red text-white border-aia-red'
                    : activeMonths[idx]
                    ? 'bg-green-50 text-green-700 border-green-200 hover:border-green-400'
                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300',
                ].join(' ')}
              >
                {MONTH_LABELS[idx]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Selected Month KPIs ── */}
        <div className="mb-6">
          <SectionTitle>{MONTH_LABELS[selectedMonthIdx]} Performance</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard title="FYC" value={formatCurrency(selectedMonth.fyc, true)} color="red" />
            <KpiCard title="FYP" value={formatCurrency(selectedMonth.fyp, true)} color="blue" />
            <KpiCard title="Cases" value={selectedMonth.cases} color="green" />
            <KpiCard title="Producing" value={`${selectedMonth.producing} / ${agents.length}`} color="gray" />
            <KpiCard title="New Recruits" value={selectedMonth.recruits} color="green" />
          </div>
        </div>

        {/* ── YTD KPIs ── */}
        <div className="mb-6">
          <SectionTitle>
            YTD Summary — {MONTH_LABELS[0]} to {MONTH_LABELS[CURRENT_MONTH_IDX]}
          </SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard title="FYC YTD" value={formatCurrency(ytd.fyc, true)} color="red" />
            <KpiCard title="FYP YTD" value={formatCurrency(ytd.fyp, true)} color="blue" />
            <KpiCard title="Cases YTD" value={ytd.cases} color="green" />
            <KpiCard title="Producing YTD" value={ytd.producing} color="gray" />
            <KpiCard title="New Recruits YTD" value={ytd.recruits} color="green" />
          </div>
        </div>

        {/* ── Breakdown + Chart ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Unit Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <SectionTitle>Unit Breakdown</SectionTitle>

            {/* Rookie vs Seasoned */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatBox
                label="Rookies"
                value={rookies.length}
                sub={`${rookies.filter(a => a.isProducing).length} producing`}
                colorClass="bg-blue-50 text-blue-700"
              />
              <StatBox
                label="Seasoned"
                value={seasoned.length}
                sub={`${seasoned.filter(a => a.isProducing).length} producing`}
                colorClass="bg-purple-50 text-purple-700"
              />
            </div>

            {/* Area breakdown */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatBox
                label="Davao (SCM2)"
                value={agents.filter(a => a.area === 'SCM2 (Davao)').length}
                colorClass="bg-red-50 text-aia-red"
              />
              <StatBox
                label="Gensan (SCM3)"
                value={agents.filter(a => a.area === 'SCM3 (Gensan)').length}
                colorClass="bg-sky-50 text-sky-700"
              />
            </div>

            {/* Activity Ratio */}
            {avgActivityRatio !== null && (
              <div className="mt-2 p-3 bg-amber-50 rounded-xl text-center">
                <p className="text-2xl font-extrabold text-amber-700">
                  {avgActivityRatio.toFixed(1)}%
                </p>
                <p className="text-xs font-semibold text-amber-500 mt-1">Avg Activity Ratio</p>
              </div>
            )}
          </div>

          {/* FYC Month-on-Month Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <SectionTitle>FYC Month-on-Month</SectionTitle>
            {chartData.every(m => m.fyc === 0) ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                No FYC data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={v => v >= 1_000_000
                      ? `₱${(v / 1_000_000).toFixed(1)}M`
                      : `₱${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10 }}
                    width={54}
                  />
                  <Tooltip
                    formatter={v => [formatCurrency(v, true), 'FYC']}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="fyc" fill="#D31145" radius={[4, 4, 0, 0]} name="FYC" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Cases Month-on-Month (secondary chart) ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <SectionTitle>Cases Month-on-Month</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
              <Tooltip formatter={v => [v, 'Cases']} labelStyle={{ fontWeight: 600 }} />
              <Bar dataKey="cases" fill="#88B943" radius={[4, 4, 0, 0]} name="Cases" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Advisors List ── */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700">
              Advisors ({agents.length})
            </h3>
          </div>

          {agents.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              No licensed advisors found in this unit.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] whitespace-nowrap border-r border-[#b80e3a]">
                      Name
                    </th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] whitespace-nowrap">Yr</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] whitespace-nowrap">Segment</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] whitespace-nowrap">FYC MTD</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] whitespace-nowrap">FYP MTD</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] whitespace-nowrap">Cases</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] whitespace-nowrap">Status</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] whitespace-nowrap">Activity Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {agentsSorted.map((agent, idx) => (
                    <tr
                      key={agent.code ?? idx}
                      className="group even:bg-gray-50 border-b border-gray-100 hover:bg-red-50/40 transition-colors duration-75"
                    >
                      <td className="sticky left-0 z-10 px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap bg-white group-even:bg-gray-50 border-r border-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                        {agent.code
                          ? (
                            <Link
                              to={`/agent/${agent.code}`}
                              className="hover:text-aia-red hover:underline underline-offset-2 transition-colors"
                            >
                              {agent.name || '—'}
                            </Link>
                          )
                          : (agent.name || '—')
                        }
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600 tabular-nums">
                        {agent.agentYear ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Tag variant={
                          agent.segment === 'Rookie' ? 'rookie'
                          : agent.segment === 'Seasoned' ? 'seasoned'
                          : 'default'
                        }>
                          {agent.segment || '—'}
                        </Tag>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-800 whitespace-nowrap">
                        {formatCurrency(agent.fycMtd, true)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-800 whitespace-nowrap">
                        {formatCurrency(agent.fypTotal, true)}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-700 tabular-nums">
                        {agent.casesTotal ?? 0}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {agent.isProducing
                          ? (
                            <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              Active
                            </span>
                          )
                          : (
                            <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              Inactive
                            </span>
                          )
                        }
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">
                        {(agent.activityRatio ?? 0) > 0
                          ? `${agent.activityRatio.toFixed(1)}%`
                          : '—'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="mt-4 text-xs text-gray-400 text-right">
          {data?.uploadDate
            ? `Data as of ${new Date(data.uploadDate).toLocaleDateString('en-PH', {
                year: 'numeric', month: 'short', day: 'numeric',
              })}`
            : ''}
        </p>
      </div>
    </div>
  )
}
