import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import SectionHeader from '../components/SectionHeader'
import ProgressBar from '../components/ProgressBar'
import MonthlyBarChart from '../components/MonthlyBarChart'
import DataTable from '../components/DataTable'
import { MONTH_ABBRS, CURRENT_MONTH_IDX } from '../constants'
import {
  getAgentYtdFyp, getAgentYtdFyc, getAgentYtdCases, getAdvisorTier,
  formatPeso, formatPct, daysSinceAppt,
} from '../utils/calculations'

const UNIT_TABS = [
  { key: 'performance', label: 'Performance' },
  { key: 'members',     label: 'Members' },
  { key: 'activation',  label: 'Activation' },
]

// ─── Performance Tab ──────────────────────────────────────────────────────────

function PerformanceTab({ unitAgents, targets }) {
  const [metric, setMetric] = useState('FYP')

  const ytdFyp   = unitAgents.reduce((s, a) => s + getAgentYtdFyp(a, CURRENT_MONTH_IDX), 0)
  const ytdCases = unitAgents.reduce((s, a) => s + getAgentYtdCases(a, CURRENT_MONTH_IDX), 0)
  const producing = unitAgents.filter(a => getAgentYtdCases(a, CURRENT_MONTH_IDX) > 0).length
  const manpower  = unitAgents.filter(a => a.manpowerInd || unitAgents.some(x => x.code === a.code && getAgentYtdFyp(x, CURRENT_MONTH_IDX) > 0)).length
  const actRatio  = manpower > 0 ? (producing / manpower) * 100 : 0

  // Chart data: sum per month
  const chartData = useMemo(() => {
    return MONTH_ABBRS.map(abbr => {
      if (metric === 'FYP') return unitAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyp || 0), 0)
      if (metric === 'FYC') return unitAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyc || 0), 0)
      if (metric === 'Cases') return unitAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.cases || 0), 0)
      if (metric === 'Producing') return unitAgents.filter(a => (a.monthly?.[abbr]?.cases || 0) > 0).length
      return 0
    })
  }, [unitAgents, metric])

  // Unit's proportional target (# agents / total agency agents × annual target)
  const agencyFypTarget = targets?.fyp_annual || 0
  const mdrtGoal = targets?.mdrt_goal || 0

  // MAPA
  const rookies  = unitAgents.filter(a => a.segment === 'Rookie')
  const seasoned = unitAgents.filter(a => a.segment === 'Seasoned')
  const rProd = rookies.filter(a => getAgentYtdCases(a, CURRENT_MONTH_IDX) > 0).length
  const sProd = seasoned.filter(a => getAgentYtdCases(a, CURRENT_MONTH_IDX) > 0).length
  const rCases = rookies.reduce((s, a) => s + getAgentYtdCases(a, CURRENT_MONTH_IDX), 0)
  const sCases = seasoned.reduce((s, a) => s + getAgentYtdCases(a, CURRENT_MONTH_IDX), 0)

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <section>
        <SectionHeader title="Unit KPIs" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {[
            { label: 'FYP YTD',     value: formatPeso(ytdFyp) },
            { label: 'Cases YTD',   value: String(ytdCases) },
            { label: 'Producing',   value: String(producing) },
            { label: 'Activity %',  value: formatPct(actRatio) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>{label}</p>
              <p className="text-xl font-bold mt-1" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Monthly Trend */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <SectionHeader title="Monthly Trend" />
          <div className="flex gap-1">
            {['FYP', 'FYC', 'Cases', 'Producing'].map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className="px-2.5 py-1 rounded text-[10px] transition-colors"
                style={{
                  fontFamily: 'AIA Everest', fontWeight: metric === m ? 700 : 500,
                  backgroundColor: metric === m ? '#D31145' : 'transparent',
                  color: metric === m ? '#fff' : 'var(--char-60,#6B7180)',
                  border: `1px solid ${metric === m ? '#D31145' : 'var(--border,#E8E9ED)'}`,
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 mt-3" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
          <MonthlyBarChart data={chartData} currentMonthIdx={CURRENT_MONTH_IDX} metric={metric} height={140} />
        </div>
      </section>

      {/* MAPA */}
      <section>
        <SectionHeader title="MAPA Breakdown" />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>Activity Ratio</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] font-bold" style={{ color: '#D31145', fontFamily: 'AIA Everest' }}>Rookie</p>
                <p className="text-base font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
                  {rookies.length > 0 ? formatPct((rProd / rookies.length) * 100) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold" style={{ color: 'var(--blue,#1F78AD)', fontFamily: 'AIA Everest' }}>Seasoned</p>
                <p className="text-base font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
                  {seasoned.length > 0 ? formatPct((sProd / seasoned.length) * 100) : '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>Productivity</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] font-bold" style={{ color: '#D31145', fontFamily: 'AIA Everest' }}>Rookie</p>
                <p className="text-base font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
                  {rProd > 0 ? (rCases / rProd).toFixed(1) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold" style={{ color: 'var(--blue,#1F78AD)', fontFamily: 'AIA Everest' }}>Seasoned</p>
                <p className="text-base font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
                  {sProd > 0 ? (sCases / sProd).toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ unitAgents, targets, navigate }) {
  const [segFilter, setSegFilter] = useState('All')
  const mdrtGoal = targets?.mdrt_goal || 0

  const displayed = segFilter === 'All' ? unitAgents : unitAgents.filter(a => a.segment === segFilter)

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (v, row) => (
        <button
          onClick={() => navigate(`/agent/${row.code}`)}
          className="text-left text-xs font-bold text-[#D31145] hover:underline"
          style={{ fontFamily: 'AIA Everest' }}
        >
          {v}
        </button>
      ),
      sortable: true,
    },
    {
      key: 'segment',
      header: 'Segment',
      render: v => (
        <span className="text-[10px] rounded-full px-2 py-0.5"
          style={{
            fontFamily: 'AIA Everest', fontWeight: 600,
            backgroundColor: v === 'Seasoned' ? 'var(--blue-10,#E8F2F9)' : 'var(--red-10,#FAE8EE)',
            color: v === 'Seasoned' ? 'var(--blue,#1F78AD)' : '#D31145',
          }}>
          {v}
        </span>
      ),
      sortable: true,
    },
    {
      key: '_ytdFyp',
      header: 'FYP YTD',
      render: (_, row) => (
        <span className="text-xs font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
          {formatPeso(getAgentYtdFyp(row, CURRENT_MONTH_IDX))}
        </span>
      ),
      sortValue: row => getAgentYtdFyp(row, CURRENT_MONTH_IDX),
      sortable: true,
    },
    {
      key: '_ytdCases',
      header: 'Cases YTD',
      render: (_, row) => (
        <span className="text-xs font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
          {getAgentYtdCases(row, CURRENT_MONTH_IDX)}
        </span>
      ),
      sortValue: row => getAgentYtdCases(row, CURRENT_MONTH_IDX),
      sortable: true,
    },
    {
      key: '_tier',
      header: 'Tier',
      render: (_, row) => {
        const tier = mdrtGoal > 0 ? getAdvisorTier(getAgentYtdFyp(row, CURRENT_MONTH_IDX), mdrtGoal) : null
        return tier ? (
          <span className="text-[10px] font-semibold" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
            {tier.abbr}
          </span>
        ) : null
      },
      sortable: false,
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Segment filter */}
      <div className="flex gap-2">
        {['All', 'Rookie', 'Seasoned'].map(seg => (
          <button
            key={seg}
            onClick={() => setSegFilter(seg)}
            className="px-3 py-1.5 rounded text-xs transition-colors"
            style={{
              fontFamily: 'AIA Everest', fontWeight: segFilter === seg ? 700 : 500,
              backgroundColor: segFilter === seg ? '#D31145' : '#fff',
              color: segFilter === seg ? '#fff' : 'var(--char-60,#6B7180)',
              border: `1px solid ${segFilter === seg ? '#D31145' : 'var(--border,#E8E9ED)'}`,
            }}
          >
            {seg}
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={displayed}
        defaultSort={{ key: '_ytdFyp', dir: 'desc' }}
        pageSize={20}
        onRowClick={row => navigate(`/agent/${row.code}`)}
      />
    </div>
  )
}

// ─── Activation Tab ───────────────────────────────────────────────────────────

function ActivationTab({ unitAgents }) {
  // Recruits: agents appointed within last 90 days
  const now = Date.now()
  const recruits = unitAgents.filter(a => {
    const days = daysSinceAppt(a.apptDate)
    return days !== null && days <= 90
  })

  const fastStart = recruits.filter(a => getAgentYtdCases(a, CURRENT_MONTH_IDX) >= 5).length
  const activated = recruits.filter(a => getAgentYtdCases(a, CURRENT_MONTH_IDX) > 0).length
  const activationRate = recruits.length > 0 ? (activated / recruits.length) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Recruits (90d)', value: String(recruits.length) },
          { label: 'Fast Start', value: String(fastStart) },
          { label: 'Activation Rate', value: formatPct(activationRate) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-4 text-center" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
            <p className="text-xl font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>{value}</p>
            <p className="text-[10px] mt-0.5" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>{label}</p>
          </div>
        ))}
      </div>

      {recruits.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm font-bold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>No new recruits in last 90 days</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recruits.map(a => {
            const cases = getAgentYtdCases(a, CURRENT_MONTH_IDX)
            const status = cases >= 5 ? 'Fast Start' : cases > 0 ? 'Activated' : 'Not Yet'
            const days = daysSinceAppt(a.apptDate)
            return (
              <div
                key={a.code}
                className="bg-white rounded-xl p-4 flex items-center gap-3"
                style={{ border: '1px solid var(--border,#E8E9ED)' }}
              >
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: '#D31145', fontFamily: 'AIA Everest' }}>
                  {(a.name?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/agent/${a.code}`}
                    className="text-xs font-bold truncate block hover:underline"
                    style={{ fontFamily: 'AIA Everest', color: '#D31145' }}
                  >
                    {a.name}
                  </Link>
                  <p className="text-[10px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
                    {days} days · {cases} case{cases !== 1 ? 's' : ''}
                  </p>
                </div>
                <span
                  className="text-[10px] font-bold rounded px-2 py-1 flex-shrink-0"
                  style={{
                    fontFamily: 'AIA Everest',
                    backgroundColor: status === 'Fast Start' ? 'var(--green-10,#EAF4EB)' : status === 'Activated' ? 'var(--blue-10,#E8F2F9)' : 'var(--char-10,#F2F3F5)',
                    color: status === 'Fast Start' ? 'var(--green,#4E9A51)' : status === 'Activated' ? 'var(--blue,#1F78AD)' : 'var(--char-60,#6B7180)',
                  }}
                >
                  {status}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function UnitProfilePage() {
  const { unitCode } = useParams()
  const navigate = useNavigate()
  const { data, isLoaded, targets } = useData()
  const [activeTab, setActiveTab] = useState('performance')

  const unit       = (data?.units || []).find(u => u.unitCode === unitCode)
  const unitAgents = useMemo(() => (data?.agents || []).filter(a =>
    (a.unitCode === unitCode) || (a.unitName === unit?.unitName) || (a.unit === unit?.unitName)
  ), [data, unitCode, unit])

  if (!isLoaded) return null
  if (!unit && unitAgents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--surface,#F7F8FA)' }}>
        <div className="text-center">
          <p className="text-sm font-bold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>Unit not found</p>
          <button onClick={() => navigate('/units')} className="mt-3 text-xs text-[#D31145]" style={{ fontFamily: 'AIA Everest' }}>
            Back to units
          </button>
        </div>
      </div>
    )
  }

  const unitName    = unit?.unitName || unitCode
  const managerName = unit?.managerName || unitAgents.find(a => a.isManager)?.name || '—'
  const area        = unit?.area || unitAgents[0]?.area || '—'

  return (
    <div className="min-h-screen pb-4" style={{ backgroundColor: 'var(--surface,#F7F8FA)' }}>
      {/* Hero */}
      <div className="bg-white" style={{ borderBottom: '1px solid var(--border,#E8E9ED)' }}>
        <div className="max-w-screen-xl mx-auto px-4 pt-5 pb-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs mb-4"
            style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 3L5 7l4 4" />
            </svg>
            Back
          </button>

          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
              style={{ backgroundColor: '#D31145', fontFamily: 'AIA Everest' }}
            >
              {unitName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-extrabold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{unitName}</h1>
              <p className="text-[11px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
                Manager: {managerName}
              </p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] font-semibold rounded-full px-2.5 py-0.5"
                  style={{ fontFamily: 'AIA Everest', backgroundColor: 'var(--char-10,#F2F3F5)', color: '#1C1C28' }}>
                  {unitAgents.length} members
                </span>
                <span className="text-[10px] font-semibold rounded-full px-2.5 py-0.5"
                  style={{ fontFamily: 'AIA Everest', backgroundColor: 'var(--char-10,#F2F3F5)', color: '#1C1C28' }}>
                  {area}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-0 -mb-px">
            {UNIT_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2.5 text-xs transition-colors"
                style={{
                  fontFamily: 'AIA Everest',
                  fontWeight: activeTab === tab.key ? 700 : 500,
                  color: activeTab === tab.key ? '#D31145' : 'var(--char-60,#6B7180)',
                  borderBottom: activeTab === tab.key ? '2px solid #D31145' : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-5">
        {activeTab === 'performance' && <PerformanceTab unitAgents={unitAgents} targets={targets} />}
        {activeTab === 'members'     && <MembersTab unitAgents={unitAgents} targets={targets} navigate={navigate} />}
        {activeTab === 'activation'  && <ActivationTab unitAgents={unitAgents} />}
      </div>
    </div>
  )
}
