import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import PeriodControl from '../components/PeriodControl'
import SectionHeader from '../components/SectionHeader'
import ProgressBar from '../components/ProgressBar'
import KpiCard from '../components/KpiCard'
import MonthlyBarChart from '../components/MonthlyBarChart'
import AgentAvatar from '../components/AgentAvatar'
import {
  MONTH_ABBRS, MONTH_LABELS, CURRENT_MONTH_IDX,
} from '../constants'
import {
  getAgentYtdFyp, getAgentYtdFyc, getAgentYtdAnp, getAgentYtdCases,
  getAgentYtdProducingMonths, getPropensityScore, formatPeso, formatPct,
} from '../utils/calculations'

const METRIC_OPTIONS = ['FYP', 'ANP', 'FYC', 'Cases', 'Producing Advisors']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthFyp(agent, monthIdx) {
  return agent.monthly?.[MONTH_ABBRS[monthIdx]]?.fyp || 0
}
function getMonthAnp(agent, monthIdx) {
  return agent.monthly?.[MONTH_ABBRS[monthIdx]]?.anp || 0
}
function getMonthFyc(agent, monthIdx) {
  return agent.monthly?.[MONTH_ABBRS[monthIdx]]?.fyc || 0
}
function getMonthCases(agent, monthIdx) {
  return agent.monthly?.[MONTH_ABBRS[monthIdx]]?.cases || 0
}
function getMonthProducing(agent, monthIdx) {
  return (agent.monthly?.[MONTH_ABBRS[monthIdx]]?.cases || 0) > 0
}

function agentFyp(agent, mode, monthIdx) {
  return mode === 'ytd' ? getAgentYtdFyp(agent, monthIdx) : getMonthFyp(agent, monthIdx)
}
function agentAnp(agent, mode, monthIdx) {
  return mode === 'ytd' ? getAgentYtdAnp(agent, monthIdx) : getMonthAnp(agent, monthIdx)
}
function agentFyc(agent, mode, monthIdx) {
  return mode === 'ytd' ? getAgentYtdFyc(agent, monthIdx) : getMonthFyc(agent, monthIdx)
}
function agentCases(agent, mode, monthIdx) {
  return mode === 'ytd' ? getAgentYtdCases(agent, monthIdx) : getMonthCases(agent, monthIdx)
}
function agentProducing(agent, mode, monthIdx) {
  if (mode === 'ytd') return getAgentYtdCases(agent, monthIdx) > 0
  return getMonthProducing(agent, monthIdx)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThermometerCard({ title, actual, target, format = 'currency' }) {
  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0
  const fmt = v => format === 'currency' ? formatPeso(v) : String(Math.round(v))
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2"
        style={{ fontFamily: 'AIA Everest', fontWeight: 600, color: 'var(--char-60,#6B7180)' }}>
        {title}
      </p>
      <div className="flex items-end justify-between mb-2">
        <span className="text-lg font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
          {fmt(actual)}
        </span>
        <span className="text-[10px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
          / {fmt(target)} target
        </span>
      </div>
      <ProgressBar value={pct} color={pct >= 100 ? 'var(--green,#4E9A51)' : '#D31145'} height={6} />
      <p className="text-[10px] mt-1.5 font-bold"
        style={{ fontFamily: 'DM Mono, monospace', color: pct >= 100 ? 'var(--green,#4E9A51)' : '#D31145' }}>
        {pct.toFixed(1)}%
      </p>
    </div>
  )
}

function AlertStrip({ count, onClick }) {
  if (count === 0) return null
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-opacity hover:opacity-90"
      style={{ backgroundColor: 'var(--amber-10,#FDF3E3)', border: '1px solid var(--amber,#C97B1A)' }}
    >
      <div className="flex items-center gap-2.5">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--amber,#C97B1A)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2L14 13H2L8 2z" />
          <line x1="8" y1="7" x2="8" y2="9.5" />
          <circle cx="8" cy="11.5" r="0.5" fill="var(--amber,#C97B1A)" stroke="none" />
        </svg>
        <span className="text-sm font-bold" style={{ fontFamily: 'AIA Everest', color: 'var(--amber,#C97B1A)' }}>
          {count} advisor{count !== 1 ? 's' : ''} in Fast Start window
        </span>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--amber,#C97B1A)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3l4 4-4 4" />
      </svg>
    </button>
  )
}

function TopContributorRow({ rank, agent, fyp }) {
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border,#E8E9ED)' }}>
      <span className="w-5 text-center text-xs font-bold flex-shrink-0"
        style={{ fontFamily: 'DM Mono, monospace', color: rank <= 3 ? '#D31145' : 'var(--char-60,#6B7180)' }}>
        {rank}
      </span>
      <AgentAvatar agentCode={agent.code} name={agent.name} size={32} className="!rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{agent.name}</p>
        <p className="text-[10px] truncate" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
          {agent.unitName || agent.unit || '—'} · {agent.segment}
        </p>
      </div>
      <span className="text-xs font-bold flex-shrink-0" style={{ fontFamily: 'DM Mono, monospace', color: '#D31145' }}>
        {formatPeso(fyp)}
      </span>
    </div>
  )
}

function getPropensityRemarks(agent, score, monthIdx, allAgents) {
  const remarks = []
  if (monthIdx > 0) {
    const lastCases = agent.monthly?.[MONTH_ABBRS[monthIdx - 1]]?.cases || 0
    if (lastCases > 0) remarks.push('Produced last month')
  }
  let consecutive = 0
  for (let i = monthIdx - 1; i >= 0; i--) {
    if ((agent.monthly?.[MONTH_ABBRS[i]]?.cases || 0) > 0) consecutive++
    else break
  }
  if (consecutive >= 2) remarks.push(`${consecutive} consecutive months`)
  if (agent.segment === 'Seasoned') remarks.push('Seasoned advisor')
  else if (agent.segment === 'Rookie') remarks.push('Rookie advisor')
  // Near bonus tier
  if (score >= 60 && score - (remarks.length * 10) <= 20) remarks.push('Near bonus tier')
  return remarks
}

function PropensityRow({ agent, score, monthIdx = CURRENT_MONTH_IDX, allAgents = [], compact = false }) {
  const remarks = getPropensityRemarks(agent, score, monthIdx, allAgents)
  const scoreColor = score >= 80 ? '#D31145' : score >= 60 ? 'var(--amber,#C97B1A)' : 'var(--char-60,#6B7180)'

  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border,#E8E9ED)' }}>
      <AgentAvatar agentCode={agent.code} name={agent.name} size={32} className="!rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{agent.name}</p>
        <p className="text-[10px] truncate" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
          {remarks.length > 0 ? remarks.join(' · ') : agent.unitName || '—'}
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <span className="text-xs font-bold" style={{ fontFamily: 'DM Mono, monospace', color: scoreColor }}>
          {score}
        </span>
        <p className="text-[9px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>score</p>
      </div>
    </div>
  )
}

function PropensityModal({ list, monthIdx, allAgents, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'rgba(28,28,40,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="mt-auto w-full max-w-lg mx-auto rounded-t-2xl flex flex-col"
        style={{ backgroundColor: 'var(--surface,#F7F8FA)', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border,#E8E9ED)' }} />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border,#E8E9ED)' }}>
          <div>
            <h2 className="text-sm font-bold" style={{ fontFamily: 'AIA Everest', fontWeight: 800, color: '#1C1C28' }}>
              To Activate
            </h2>
            <p className="text-[10px] mt-0.5" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
              {list.length} advisors not yet producing · ranked by propensity
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--border,#E8E9ED)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6B7180" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
            </svg>
          </button>
        </div>
        {/* Score legend */}
        <div className="flex gap-3 px-5 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border,#E8E9ED)' }}>
          <span className="flex items-center gap-1 text-[10px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
            <span className="inline-block w-2 h-2 rounded-full bg-[#D31145]" /> 80+ High
          </span>
          <span className="flex items-center gap-1 text-[10px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--amber,#C97B1A)' }} /> 60–79 Medium
          </span>
          <span className="flex items-center gap-1 text-[10px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--char-30,#B0B3BC)' }} /> &lt;60 Low
          </span>
        </div>
        {/* List */}
        <div className="overflow-y-auto flex-1 px-5 pb-6">
          {list.map(({ agent, score }, i) => (
            <PropensityRow key={agent.code || i} agent={agent} score={score} monthIdx={monthIdx} allAgents={allAgents} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Agency Rank Card ─────────────────────────────────────────────────────────
// Computes Amora's rank among agencies from the parsed Agency sheet.
// Falls back to the manually-entered rank in targets if no Excel data.

const SCOPE_LABELS = { nationwide: 'Nationwide', territory: 'Territory', region: 'Region' }

function AgencyRankCard({ data, targets, period }) {
  const [scope, setScope] = useState('nationwide')

  const agencyRankData = data?.agencyRankData ?? []
  const { mode, monthIdx } = period

  // Find Amora's row (case-insensitive match on "AMORA" or "DAVAO-AMORA")
  const amoraRow = agencyRankData.find(a =>
    a.name.toUpperCase().includes('DAVAO-AMORA') ||
    a.name.toUpperCase().includes('DAVAO AMORA') ||
    a.name.toUpperCase().includes('AMORA')
  )

  // ── Compute rank from Excel data ──────────────────────────────────────────
  let computedRank = null, computedTotal = null
  let scopeLabel = 'agencies nationwide'
  if (amoraRow && agencyRankData.length > 0) {
    // Filter pool by scope
    let pool = agencyRankData
    if (scope === 'territory' && amoraRow.territory) {
      pool = pool.filter(a => a.territory === amoraRow.territory)
      scopeLabel = `agencies in ${amoraRow.territory}`
    } else if (scope === 'region' && amoraRow.region) {
      pool = pool.filter(a => a.region === amoraRow.region)
      scopeLabel = `agencies in ${amoraRow.region}`
    }

    // Value per agency for the current period
    const getValue = agency => {
      if (mode === 'ytd') return agency.anpYtd || 0
      return agency.monthly?.[MONTH_ABBRS[monthIdx]]?.anp || 0
    }

    const sorted = [...pool].filter(a => getValue(a) > 0).sort((a, b) => getValue(b) - getValue(a))
    const rankIdx = sorted.findIndex(a => a.name === amoraRow.name)
    if (rankIdx >= 0) {
      computedRank  = rankIdx + 1
      computedTotal = sorted.length
    }
  }

  // ── Decide what to show ───────────────────────────────────────────────────
  // Prefer computed rank; fall back to manually-entered rank in targets
  const displayRank  = computedRank  ?? (targets?.agency_rank  > 0 ? targets.agency_rank  : null)
  const displayTotal = computedTotal ?? (targets?.total_agencies > 0 ? targets.total_agencies : null)

  // Show nothing if no rank data at all
  if (!displayRank) return null

  const isComputed = computedRank != null

  return (
    <div
      className="rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
      style={{ background: 'linear-gradient(135deg,#D31145 0%,#8B0A2F 100%)', color: '#fff' }}
    >
      {/* Rank number */}
      <div className="flex items-center gap-3 flex-1">
        <div className="text-5xl font-black leading-none flex-shrink-0"
          style={{ fontFamily: 'DM Mono, monospace' }}>
          #{displayRank}
        </div>
        <div>
          <p className="text-sm font-extrabold" style={{ fontFamily: 'AIA Everest' }}>
            Agency Rank — AIA Philippines
          </p>
          {displayTotal > 0 && (
            <p className="text-xs mt-0.5" style={{ fontFamily: 'AIA Everest', opacity: 0.85 }}>
              Out of {displayTotal} {scopeLabel}
            </p>
          )}
          {!isComputed && (
            <p className="text-[10px] mt-1" style={{ fontFamily: 'AIA Everest', opacity: 0.6 }}>
              Manually entered · update in Settings
            </p>
          )}
        </div>
      </div>

      {/* Toggles — only show if we have real Excel data */}
      {isComputed && agencyRankData.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(SCOPE_LABELS).map(([key, label]) => {
            // Only show territory/region if Amora has that field
            if (key === 'territory' && !amoraRow?.territory) return null
            if (key === 'region'    && !amoraRow?.region)    return null
            return (
              <button
                key={key}
                onClick={() => setScope(key)}
                className="px-2.5 py-1 rounded-md text-xs font-bold transition-all"
                style={{
                  fontFamily: 'AIA Everest',
                  background: scope === key ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                  color: scope === key ? '#D31145' : '#fff',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MapaCard({ label, rookieVal, seasonedVal, format = 'number' }) {
  const fmt = v => {
    if (v === null || v === undefined || isNaN(v)) return '—'
    if (format === 'currency') return formatPeso(v)
    if (format === 'percent') return formatPct(v)
    return Math.round(v).toLocaleString()
  }
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-3"
        style={{ fontFamily: 'AIA Everest', fontWeight: 600, color: 'var(--char-60,#6B7180)' }}>{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase mb-0.5"
            style={{ fontFamily: 'AIA Everest', color: '#D31145' }}>Rookie</p>
          <p className="text-base font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
            {fmt(rookieVal)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase mb-0.5"
            style={{ fontFamily: 'AIA Everest', color: 'var(--blue,#1F78AD)' }}>Seasoned</p>
          <p className="text-base font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
            {fmt(seasonedVal)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const navigate = useNavigate()
  const { data, isLoaded, targets, loadTargets } = useData()

  const [period, setPeriod] = useState({ mode: 'monthly', monthIdx: CURRENT_MONTH_IDX })
  const [area, setArea] = useState('all')
  const [segmentFilter, setSegmentFilter] = useState('All')
  const [trendMetric, setTrendMetric] = useState('FYP')
  const [showPropensityModal, setShowPropensityModal] = useState(false)

  // Load targets on mount
  useEffect(() => { loadTargets?.() }, [])

  const { mode, monthIdx } = period

  // All agents filtered by area + segment
  const filteredAgents = useMemo(() => {
    let agents = data?.agents || []
    if (area !== 'all') agents = agents.filter(a => a.area?.startsWith(area))
    if (segmentFilter !== 'All') agents = agents.filter(a => a.segment === segmentFilter)
    return agents
  }, [data, area, segmentFilter])

  // Agency KPIs for selected period
  const kpis = useMemo(() => {
    const totalFyp  = filteredAgents.reduce((s, a) => s + agentFyp(a, mode, monthIdx), 0)
    const totalAnp  = filteredAgents.reduce((s, a) => s + agentAnp(a, mode, monthIdx), 0)
    const totalFyc  = filteredAgents.reduce((s, a) => s + agentFyc(a, mode, monthIdx), 0)
    const totalCases = filteredAgents.reduce((s, a) => s + agentCases(a, mode, monthIdx), 0)
    const producing = filteredAgents.filter(a => agentProducing(a, mode, monthIdx)).length
    const manpower  = filteredAgents.filter(a =>
      mode === 'ytd'
        ? getAgentYtdCases(a, monthIdx) > 0 || (a.manpowerInd ?? false)
        : (a.monthly?.[MONTH_ABBRS[monthIdx]]?.manpower > 0 || a.manpowerInd)
    ).length
    const actRatio  = manpower > 0 ? (producing / manpower) * 100 : 0
    const casesAh   = mode === 'monthly' ? (filteredAgents.reduce((s, a) => s + (Number(a.casesAh) || 0), 0)) : 0

    return { totalFyp, totalAnp, totalFyc, totalCases, producing, manpower, actRatio, casesAh }
  }, [filteredAgents, mode, monthIdx])

  // Previous period KPIs for trends
  const prevKpis = useMemo(() => {
    const prevMonthIdx = mode === 'ytd' ? Math.max(0, monthIdx - 1) : Math.max(0, monthIdx - 1)
    if (monthIdx === 0) return null
    const anp = filteredAgents.reduce((s, a) => s + agentAnp(a, mode, prevMonthIdx), 0)
    const fyc = filteredAgents.reduce((s, a) => s + agentFyc(a, mode, prevMonthIdx), 0)
    const producing = filteredAgents.filter(a => agentProducing(a, mode, prevMonthIdx)).length
    const manpower  = filteredAgents.filter(a => (a.monthly?.[MONTH_ABBRS[prevMonthIdx]]?.manpower > 0 || a.manpowerInd)).length
    const actRatio  = manpower > 0 ? (producing / manpower) * 100 : 0
    return { anp, fyc, actRatio }
  }, [filteredAgents, mode, monthIdx])

  // Trend helpers
  function trendDir(current, prev) {
    if (!prev || prev === 0) return 'flat'
    if (current > prev) return 'up'
    if (current < prev) return 'down'
    return 'flat'
  }
  function trendDelta(current, prev, isCurrency = true) {
    if (!prev || prev === 0) return ''
    const delta = current - prev
    const pct = Math.abs((delta / prev) * 100).toFixed(1)
    return `${delta >= 0 ? '+' : ''}${isCurrency ? formatPeso(delta) : pct + '%'}`
  }

  // Fast Start count
  const fastStartCount = useMemo(() => {
    return filteredAgents.filter(a => {
      const days = a.daysSinceAppt ?? null
      return days !== null && days <= 90 && agentCases(a, mode, monthIdx) > 0
    }).length
  }, [filteredAgents, mode, monthIdx])

  // Top 5 contributors
  const topContributors = useMemo(() => {
    return [...filteredAgents]
      .map(a => ({ agent: a, fyp: agentFyp(a, mode, monthIdx) }))
      .filter(x => x.fyp > 0)
      .sort((a, b) => b.fyp - a.fyp)
      .slice(0, 5)
  }, [filteredAgents, mode, monthIdx])

  // All agents not yet producing this month, ranked by propensity (for "To Activate")
  const allPropensityList = useMemo(() => {
    if (mode === 'ytd') return []
    const allAgents = data?.agents || []
    const currentProducers = new Set(
      filteredAgents.filter(a => getMonthCases(a, monthIdx) > 0).map(a => a.code)
    )
    return filteredAgents
      .filter(a => !currentProducers.has(a.code))
      .map(a => ({ agent: a, score: getPropensityScore(a, monthIdx, allAgents) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [filteredAgents, data, mode, monthIdx])

  // Top 4 shown on overview card (score >= 60)
  const propensityList = useMemo(() => allPropensityList.filter(x => x.score >= 60).slice(0, 4), [allPropensityList])

  // MAPA breakdown
  const mapa = useMemo(() => {
    const rookies   = filteredAgents.filter(a => a.segment === 'Rookie')
    const seasoned  = filteredAgents.filter(a => a.segment === 'Seasoned')

    const rookieManpower   = rookies.filter(a => a.manpowerInd || (a.monthly?.[MONTH_ABBRS[monthIdx]]?.manpower > 0)).length
    const seasonedManpower = seasoned.filter(a => a.manpowerInd || (a.monthly?.[MONTH_ABBRS[monthIdx]]?.manpower > 0)).length
    const rookieProd   = rookies.filter(a => agentProducing(a, mode, monthIdx)).length
    const seasonedProd = seasoned.filter(a => agentProducing(a, mode, monthIdx)).length

    const rookieCases   = rookies.reduce((s, a) => s + agentCases(a, mode, monthIdx), 0)
    const seasonedCases = seasoned.reduce((s, a) => s + agentCases(a, mode, monthIdx), 0)
    const rookieFyp     = rookies.reduce((s, a) => s + agentFyp(a, mode, monthIdx), 0)
    const seasonedFyp   = seasoned.reduce((s, a) => s + agentFyp(a, mode, monthIdx), 0)

    return {
      manpower:     [rookieManpower, seasonedManpower],
      actRatio:     [rookieManpower > 0 ? (rookieProd / rookieManpower) * 100 : null,
                     seasonedManpower > 0 ? (seasonedProd / seasonedManpower) * 100 : null],
      productivity: [rookieProd > 0 ? rookieCases / rookieProd : null,
                     seasonedProd > 0 ? seasonedCases / seasonedProd : null],
      avgCaseSize:  [rookieCases > 0 ? rookieFyp / rookieCases : null,
                     seasonedCases > 0 ? seasonedFyp / seasonedCases : null],
    }
  }, [filteredAgents, mode, monthIdx])

  // Monthly trend chart data (12 months)
  const chartData = useMemo(() => {
    return MONTH_ABBRS.map((abbr, i) => {
      let value = 0
      switch (trendMetric) {
        case 'FYP':   value = filteredAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyp || 0), 0); break
        case 'ANP':   value = filteredAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.anp || 0), 0); break
        case 'FYC':   value = filteredAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyc || 0), 0); break
        case 'Cases': value = filteredAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.cases || 0), 0); break
        case 'Producing Advisors':
          value = filteredAgents.filter(a => (a.monthly?.[abbr]?.cases || 0) > 0).length; break
        default: break
      }
      return value
    })
  }, [filteredAgents, trendMetric])

  // Targets — annual values and monthly slice (annual ÷ 12)
  const annualFypTarget    = targets?.fyp_annual   || 0
  const annualCasesTarget  = targets?.cases_annual || 0
  const monthlyFypTarget   = annualFypTarget   ? annualFypTarget   / 12 : 0
  const monthlyCasesTarget = annualCasesTarget ? annualCasesTarget / 12 : 0
  const monthlyProdTarget  = targets?.producing_monthly || 0

  // Active targets for the current period mode
  const goalFypTarget   = mode === 'ytd' ? annualFypTarget   : monthlyFypTarget
  const goalCasesTarget = mode === 'ytd' ? annualCasesTarget : monthlyCasesTarget
  const goalProdTarget  = monthlyProdTarget   // same for both modes (it's a headcount, not cumulative)
  const goalSectionTitle = mode === 'ytd' ? 'Annual Goals' : 'Monthly Goals'

  const uploadDateStr = data?.uploadDate
    ? new Date(data.uploadDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  if (!isLoaded) return null

  return (
    <div className="min-h-screen pb-4" style={{ backgroundColor: 'var(--surface,#F7F8FA)' }}>
      <div className="max-w-screen-xl mx-auto px-4 py-5 flex flex-col gap-5">

        {/* Page title */}
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h1 className="text-xl" style={{ fontFamily: 'AIA Everest', fontWeight: 800, color: '#1C1C28' }}>
            Agency Overview
          </h1>
          {uploadDateStr && (
            <p className="text-[11px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
              Data as of {uploadDateStr}
            </p>
          )}
        </div>

        {/* 1. Period Controls */}
        <PeriodControl
          value={period}
          onChange={setPeriod}
          showAreaFilter
          area={area}
          onAreaChange={setArea}
        />

        {/* Segment filter */}
        <div className="flex gap-1.5">
          {['All', 'Rookie', 'Seasoned'].map(seg => (
            <button
              key={seg}
              onClick={() => setSegmentFilter(seg)}
              className="px-3 py-1 rounded text-xs transition-colors duration-150"
              style={{
                fontFamily: 'AIA Everest',
                fontWeight: segmentFilter === seg ? 700 : 500,
                backgroundColor: segmentFilter === seg
                  ? (seg === 'Rookie' ? '#D31145' : seg === 'Seasoned' ? 'var(--blue,#1F78AD)' : '#1C1C28')
                  : 'transparent',
                color: segmentFilter === seg ? '#fff' : 'var(--char-60,#6B7180)',
                border: `1px solid ${segmentFilter === seg
                  ? (seg === 'Rookie' ? '#D31145' : seg === 'Seasoned' ? 'var(--blue,#1F78AD)' : '#1C1C28')
                  : 'var(--border,#E8E9ED)'}`,
              }}
            >
              {seg === 'All' ? 'All Advisors' : seg + 's'}
            </button>
          ))}
        </div>

        {/* Agency rank card — computed from Excel Agency sheet, falls back to manual targets */}
        <AgencyRankCard data={data} targets={targets} period={period} />

        {/* 2. Goal Thermometers */}
        {(goalFypTarget > 0 || goalProdTarget > 0 || goalCasesTarget > 0) && (
          <section>
            <SectionHeader title={goalSectionTitle} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <ThermometerCard
                title="FYP vs Target"
                actual={kpis.totalFyp}
                target={goalFypTarget}
              />
              <ThermometerCard
                title="Producing Advisors"
                actual={kpis.producing}
                target={goalProdTarget}
                format="number"
              />
              <ThermometerCard
                title="Cases vs Target"
                actual={kpis.totalCases}
                target={goalCasesTarget}
                format="number"
              />
            </div>
          </section>
        )}

        {/* 3. Alert Strip */}
        <AlertStrip count={fastStartCount} onClick={() => navigate('/activation')} />

        {/* 4. Agency Pulse KPIs */}
        <section>
          <SectionHeader title="Agency Pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <KpiCard
              title="ANP"
              value={formatPeso(kpis.totalAnp)}
              monospace
              trend={prevKpis ? {
                value: trendDelta(kpis.totalAnp, prevKpis.anp),
                direction: trendDir(kpis.totalAnp, prevKpis.anp),
              } : undefined}
            />
            <KpiCard
              title="FYC"
              value={formatPeso(kpis.totalFyc)}
              monospace
              trend={prevKpis ? {
                value: trendDelta(kpis.totalFyc, prevKpis.fyc),
                direction: trendDir(kpis.totalFyc, prevKpis.fyc),
              } : undefined}
            />
            <KpiCard
              title="Activity Ratio"
              value={formatPct(kpis.actRatio)}
              monospace
              trend={prevKpis ? {
                value: trendDelta(kpis.actRatio, prevKpis.actRatio, false),
                direction: trendDir(kpis.actRatio, prevKpis.actRatio),
              } : undefined}
            />
            <KpiCard
              title="A&H Cases"
              value={String(Math.round(kpis.casesAh))}
              monospace
            />
          </div>
        </section>

        {/* 5 & 6. Top Contributors + To Activate */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Contributors */}
          <section>
            <SectionHeader
              title="Top Contributors (FYP)"
              action={{ label: 'See all', onClick: () => navigate('/agents') }}
            />
            <div className="bg-white rounded-xl p-4 mt-3" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
              {topContributors.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ fontFamily: 'AIA Everest', color: 'var(--char-30,#B0B3BC)' }}>
                  No production data for this period
                </p>
              ) : topContributors.map(({ agent, fyp }, i) => (
                <TopContributorRow key={agent.code || i} rank={i + 1} agent={agent} fyp={fyp} />
              ))}
            </div>
          </section>

          {/* To Activate */}
          <section>
            <SectionHeader
              title="To Activate"
              action={mode !== 'ytd' && allPropensityList.length > 0
                ? { label: `See all (${allPropensityList.length})`, onClick: () => setShowPropensityModal(true) }
                : undefined}
            />
            <div className="bg-white rounded-xl p-4 mt-3" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
              {mode === 'ytd' ? (
                <p className="text-xs text-center py-6" style={{ fontFamily: 'AIA Everest', color: 'var(--char-30,#B0B3BC)' }}>
                  Switch to Monthly view to see activation opportunities
                </p>
              ) : propensityList.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ fontFamily: 'AIA Everest', color: 'var(--char-30,#B0B3BC)' }}>
                  No high-propensity advisors found
                </p>
              ) : propensityList.map(({ agent, score }) => (
                <PropensityRow key={agent.code} agent={agent} score={score} monthIdx={monthIdx} allAgents={data?.agents || []} />
              ))}
            </div>
          </section>
        </div>

        {/* To Activate — full modal */}
        {showPropensityModal && (
          <PropensityModal
            list={allPropensityList}
            monthIdx={monthIdx}
            allAgents={data?.agents || []}
            onClose={() => setShowPropensityModal(false)}
          />
        )}

        {/* 7. MAPA Breakdown */}
        <section>
          <SectionHeader title="MAPA Breakdown" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <MapaCard label="Manpower"      rookieVal={mapa.manpower[0]}     seasonedVal={mapa.manpower[1]}     format="number" />
            <MapaCard label="Activity Ratio" rookieVal={mapa.actRatio[0]}    seasonedVal={mapa.actRatio[1]}    format="percent" />
            <MapaCard label="Productivity"  rookieVal={mapa.productivity[0]} seasonedVal={mapa.productivity[1]} format="number" />
            <MapaCard label="Avg Case Size" rookieVal={mapa.avgCaseSize[0]}  seasonedVal={mapa.avgCaseSize[1]}  format="currency" />
          </div>
        </section>

        {/* 8. Monthly Trend Chart */}
        <section>
          <SectionHeader title="Monthly Trend" />
          <div className="bg-white rounded-xl p-4 mt-3" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
            <div className="flex gap-1.5 flex-wrap mb-4">
              {METRIC_OPTIONS.map(m => (
                <button
                  key={m}
                  onClick={() => setTrendMetric(m)}
                  className="px-3 py-1 rounded text-xs transition-colors duration-150"
                  style={{
                    fontFamily: 'AIA Everest', fontWeight: trendMetric === m ? 700 : 500,
                    backgroundColor: trendMetric === m ? '#D31145' : 'transparent',
                    color: trendMetric === m ? '#fff' : 'var(--char-60,#6B7180)',
                    border: `1px solid ${trendMetric === m ? '#D31145' : 'var(--border,#E8E9ED)'}`,
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <MonthlyBarChart
              data={chartData}
              currentMonthIdx={monthIdx}
              metric={trendMetric}
              height={160}
              formatValue={['FYP', 'ANP', 'FYC'].includes(trendMetric) ? formatPeso : (v) => String(Math.round(v))}
            />
          </div>
        </section>

      </div>
    </div>
  )
}
