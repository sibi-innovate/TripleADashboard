import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import AgentAvatar from '../components/AgentAvatar'
import PhotoUpload from '../components/PhotoUpload'
import ProgressBar from '../components/ProgressBar'
import MonthlyBarChart from '../components/MonthlyBarChart'
import SectionHeader from '../components/SectionHeader'
import {
  MONTH_ABBRS, MONTH_SHORT, ADVISOR_TIERS, TIER_COLORS, MDRT_GOAL_DEFAULT, CURRENT_MONTH_IDX,
} from '../constants'
import {
  getAgentYtdFyp, getAgentYtdFyc, getAgentYtdAnp, getAgentYtdCases,
  calculateQuarterlyBonus, getAdvisorTier, getFycNextTierGap, formatPeso, formatPct,
} from '../utils/calculations'

const PROFILE_TABS = [
  { key: 'performance',  label: 'Performance' },
  { key: 'bonus',        label: 'Bonus' },
  { key: 'qualifications', label: 'Qualifications' },
  { key: 'team',         label: 'Team Impact' },
]

const QUARTER_KEYS = ['Q1', 'Q2', 'Q3', 'Q4']

function currentQuarter() {
  const m = new Date().getMonth()
  return QUARTER_KEYS[Math.floor(m / 3)]
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function formatApptDate(v) {
  if (!v || v < 19000101) return '—'
  const s = String(v)
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function YtdKpi({ label, value, delta }) {
  const isPos = delta != null && delta > 0
  const isNeg = delta != null && delta < 0
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-1"
        style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>{value}</p>
      {delta != null && (
        <p className="text-[10px] mt-0.5" style={{
          fontFamily: 'DM Mono, monospace',
          color: isPos ? 'var(--green,#4E9A51)' : isNeg ? '#D31145' : 'var(--char-60,#6B7180)',
        }}>
          {isPos ? '+' : ''}{typeof delta === 'number' ? formatPeso(delta) : delta} vs last year
        </p>
      )}
    </div>
  )
}

function BonusRow({ label, value, sub, highlight }) {
  return (
    <div className="flex items-start justify-between py-2.5" style={{ borderBottom: '1px solid var(--border,#E8E9ED)' }}>
      <div>
        <p className="text-xs font-semibold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{label}</p>
        {sub && <p className="text-[10px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>{sub}</p>}
      </div>
      <p className="text-sm font-bold" style={{
        fontFamily: 'DM Mono, monospace',
        color: highlight ? '#D31145' : '#1C1C28',
      }}>{value}</p>
    </div>
  )
}

// ─── Performance Tab ──────────────────────────────────────────────────────────

function PerformanceTab({ agent, agents, targets }) {
  const [chartMetric, setChartMetric] = useState('FYP')
  const mdrtGoal = targets?.mdrt_goal || MDRT_GOAL_DEFAULT

  const ytdFyp   = getAgentYtdFyp(agent, CURRENT_MONTH_IDX)
  const ytdFyc   = getAgentYtdFyc(agent, CURRENT_MONTH_IDX)
  const ytdCases = getAgentYtdCases(agent, CURRENT_MONTH_IDX)
  const mdrtPct  = mdrtGoal > 0 ? (ytdFyp / mdrtGoal) * 100 : 0

  // Projected year-end FYP at current pace
  const monthsElapsed = CURRENT_MONTH_IDX + 1
  const projectedYeFyp = monthsElapsed > 0 ? (ytdFyp / monthsElapsed) * 12 : 0

  // Unit average comparison
  const unitAgents = agents.filter(a => (a.unitName || a.unit) === (agent.unitName || agent.unit) && a.code !== agent.code)
  const unitAvgFyp   = unitAgents.length > 0 ? unitAgents.reduce((s, a) => s + getAgentYtdFyp(a, CURRENT_MONTH_IDX), 0) / unitAgents.length : 0
  const unitAvgCases = unitAgents.length > 0 ? unitAgents.reduce((s, a) => s + getAgentYtdCases(a, CURRENT_MONTH_IDX), 0) / unitAgents.length : 0
  const maxFyp = Math.max(ytdFyp, unitAvgFyp, 1)
  const maxCases = Math.max(ytdCases, unitAvgCases, 1)

  // Chart data
  const chartData = useMemo(() => {
    return MONTH_ABBRS.map(abbr => {
      const m = agent.monthly?.[abbr] || {}
      if (chartMetric === 'FYP') return m.fyp || 0
      if (chartMetric === 'FYC') return m.fyc || 0
      if (chartMetric === 'Cases') return m.cases || 0
      return 0
    })
  }, [agent, chartMetric])

  return (
    <div className="flex flex-col gap-5">
      {/* YTD KPIs */}
      <section>
        <SectionHeader title="YTD Performance" />
        <div className="grid grid-cols-3 gap-3 mt-3">
          <YtdKpi label="FYP YTD" value={formatPeso(ytdFyp)} />
          <YtdKpi label="FYC YTD" value={formatPeso(ytdFyc)} />
          <YtdKpi label="Cases YTD" value={String(ytdCases)} />
        </div>
      </section>

      {/* MDRT Progress */}
      <section>
        <SectionHeader title="MDRT Progress" />
        <div className="bg-white rounded-xl p-4 mt-3" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
              {formatPeso(ytdFyp)} YTD
            </span>
            <span className="text-xs" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
              Goal: {formatPeso(mdrtGoal)}
            </span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'var(--char-10,#F2F3F5)' }}>
            {/* Aspirant threshold at 70% */}
            <div className="absolute top-0 bottom-0 w-px" style={{ left: '70%', backgroundColor: 'var(--amber,#C97B1A)', zIndex: 1 }} />
            {/* Achiever threshold at 100% */}
            <div className="absolute top-0 bottom-0 w-px" style={{ left: '100%', backgroundColor: 'var(--green,#4E9A51)', zIndex: 1 }} />
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, mdrtPct)}%`,
                backgroundColor: mdrtPct >= 100 ? 'var(--green,#4E9A51)' : mdrtPct >= 70 ? 'var(--amber,#C97B1A)' : '#D31145',
              }}
            />
          </div>
          <div className="flex justify-between text-[9px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
            <span>0%</span>
            <span style={{ color: 'var(--amber,#C97B1A)' }}>70% Aspirant</span>
            <span style={{ color: 'var(--green,#4E9A51)' }}>100% Achiever</span>
          </div>
          <p className="text-[11px] mt-2 font-semibold" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
            At current pace: projected YE FYP {formatPeso(projectedYeFyp)}
          </p>
        </div>
      </section>

      {/* Monthly Chart */}
      <section>
        <div className="flex items-center justify-between">
          <SectionHeader title="Monthly Performance" />
          <div className="flex gap-1">
            {['FYP', 'FYC', 'Cases'].map(m => (
              <button
                key={m}
                onClick={() => setChartMetric(m)}
                className="px-2.5 py-1 rounded text-[10px] transition-colors"
                style={{
                  fontFamily: 'AIA Everest', fontWeight: chartMetric === m ? 700 : 500,
                  backgroundColor: chartMetric === m ? '#D31145' : 'transparent',
                  color: chartMetric === m ? '#fff' : 'var(--char-60,#6B7180)',
                  border: `1px solid ${chartMetric === m ? '#D31145' : 'var(--border,#E8E9ED)'}`,
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 mt-3" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
          <MonthlyBarChart data={chartData} currentMonthIdx={CURRENT_MONTH_IDX} metric={chartMetric} height={140} />
        </div>
      </section>

      {/* vs Unit Average */}
      {unitAgents.length > 0 && (
        <section>
          <SectionHeader title="vs. Unit Average" />
          <div className="bg-white rounded-xl p-4 mt-3 flex flex-col gap-4" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
            {/* FYP comparison */}
            <div>
              <div className="flex justify-between text-[10px] mb-1" style={{ fontFamily: 'AIA Everest' }}>
                <span style={{ color: '#D31145', fontWeight: 700 }}>You: {formatPeso(ytdFyp)}</span>
                <span style={{ color: 'var(--char-60,#6B7180)' }}>Unit avg: {formatPeso(unitAvgFyp)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--char-10,#F2F3F5)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(ytdFyp / maxFyp) * 100}%`, backgroundColor: '#D31145' }} />
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--char-10,#F2F3F5)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(unitAvgFyp / maxFyp) * 100}%`, backgroundColor: 'var(--char-30,#B0B3BC)' }} />
                </div>
              </div>
              <p className="text-[9px] mt-0.5" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>FYP YTD</p>
            </div>
            {/* Cases comparison */}
            <div>
              <div className="flex justify-between text-[10px] mb-1" style={{ fontFamily: 'AIA Everest' }}>
                <span style={{ color: '#D31145', fontWeight: 700 }}>You: {ytdCases} cases</span>
                <span style={{ color: 'var(--char-60,#6B7180)' }}>Unit avg: {unitAvgCases.toFixed(1)} cases</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--char-10,#F2F3F5)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(ytdCases / maxCases) * 100}%`, backgroundColor: '#D31145' }} />
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--char-10,#F2F3F5)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(unitAvgCases / maxCases) * 100}%`, backgroundColor: 'var(--char-30,#B0B3BC)' }} />
                </div>
              </div>
              <p className="text-[9px] mt-0.5" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>Cases YTD</p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Bonus Tab ────────────────────────────────────────────────────────────────

function BonusTab({ agent }) {
  const [qtr, setQtr] = useState(currentQuarter())
  const isRookie = agent.segment === 'Rookie' && agent.agentYear === 1
  const b = calculateQuarterlyBonus(agent, qtr)

  const nextFycGap = getFycNextTierGap(b.qtlyFyc, isRookie)

  return (
    <div className="flex flex-col gap-4">
      {/* Quarter selector */}
      <div className="flex gap-2">
        {QUARTER_KEYS.map(q => (
          <button
            key={q}
            onClick={() => setQtr(q)}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{
              fontFamily: 'AIA Everest',
              backgroundColor: qtr === q ? '#D31145' : '#fff',
              color: qtr === q ? '#fff' : 'var(--char-60,#6B7180)',
              border: `1px solid ${qtr === q ? '#D31145' : 'var(--border,#E8E9ED)'}`,
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Bonus breakdown */}
      <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
        <BonusRow label="Quarterly FYC" value={formatPeso(b.qtlyFyc)} />
        <BonusRow label="FYC Tier" value={b.fycTier.label} sub={`${(b.fycTier.rate * 100).toFixed(0)}% rate`} />
        <BonusRow label="FYC Bonus" value={formatPeso(b.fycBonus)} />
        <BonusRow label="Quarterly Cases" value={String(b.qtlyCases)} />
        <BonusRow label="CCB Tier" value={b.ccbTier.label}
          sub={b.ccbEligible ? `${(b.ccbTier.rate * 100).toFixed(0)}% rate` : 'Need 2+ months producing'} />
        <BonusRow label="CCB Bonus" value={formatPeso(b.ccbBonus)} />
        <BonusRow label="Persistency" value={b.persRaw != null ? formatPct(b.persRaw) : 'N/A'}
          sub={`×${b.persistencyMultiplier.toFixed(1)} multiplier`} />
        <BonusRow label="Estimated Total Bonus" value={formatPeso(b.totalBonus)} highlight />
      </div>

      {/* Reach next tier nudge */}
      {nextFycGap && (
        <div className="rounded-xl px-4 py-3"
          style={{ backgroundColor: 'var(--red-10,#FAE8EE)', border: '1px solid var(--red-20,#F6CCD9)' }}>
          <p className="text-xs font-bold" style={{ fontFamily: 'AIA Everest', color: '#D31145' }}>
            Reach next tier: {nextFycGap.nextTierLabel}
          </p>
          <p className="text-[11px] mt-0.5" style={{ fontFamily: 'AIA Everest', color: '#D31145' }}>
            {formatPeso(nextFycGap.amountNeeded)} more FYC needed this quarter
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Qualifications Tab ───────────────────────────────────────────────────────

function QualificationsTab({ agent, targets }) {
  const mdrtGoal = targets?.mdrt_goal || MDRT_GOAL_DEFAULT
  const ytdFyp   = getAgentYtdFyp(agent, CURRENT_MONTH_IDX)
  const mdrtPct  = Math.min(100, (ytdFyp / mdrtGoal) * 100)
  const tier     = getAdvisorTier(ytdFyp, mdrtGoal)

  // SVG circle progress
  const r = 54
  const circ = 2 * Math.PI * r
  const dash = (mdrtPct / 100) * circ

  return (
    <div className="flex flex-col gap-4">
      {/* MDRT Status Ring */}
      <div className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
        <SectionHeader title="MDRT Status" />
        <div className="flex items-center gap-6 mt-4">
          <div className="relative flex-shrink-0">
            <svg width="128" height="128" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={r} fill="none" stroke="var(--char-10,#F2F3F5)" strokeWidth="8" />
              <circle
                cx="64" cy="64" r={r}
                fill="none"
                stroke={mdrtPct >= 100 ? 'var(--green,#4E9A51)' : mdrtPct >= 70 ? 'var(--amber,#C97B1A)' : '#D31145'}
                strokeWidth="8"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                strokeDashoffset={circ / 4}
                transform="rotate(-90 64 64)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
                {mdrtPct.toFixed(0)}%
              </span>
              <span className="text-[9px] font-semibold" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
                of goal
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold mb-1" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
              {tier.label}
            </p>
            <p className="text-[11px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
              YTD FYP: {formatPeso(ytdFyp)}
            </p>
            <p className="text-[11px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
              MDRT Goal: {formatPeso(mdrtGoal)}
            </p>
            {mdrtPct < 100 && (
              <p className="text-[11px] mt-2 font-semibold" style={{ fontFamily: 'AIA Everest', color: '#D31145' }}>
                {formatPeso(mdrtGoal - ytdFyp)} more to MDRT Achiever
              </p>
            )}
            {mdrtPct >= 100 && (
              <p className="text-[11px] mt-2 font-bold" style={{ fontFamily: 'AIA Everest', color: 'var(--green,#4E9A51)' }}>
                MDRT Achiever — congratulations!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tier definitions */}
      <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
        <p className="text-[10px] font-bold uppercase tracking-wide mb-3"
          style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>Advisor Tiers</p>
        <div className="flex flex-col gap-1.5">
          {ADVISOR_TIERS.map(t => (
            <div
              key={t.key}
              className="flex items-center justify-between py-1.5 px-2 rounded"
              style={{
                backgroundColor: tier.key === t.key ? 'var(--red-10,#FAE8EE)' : 'transparent',
              }}
            >
              <span className="text-xs font-semibold" style={{
                fontFamily: 'AIA Everest',
                color: tier.key === t.key ? '#D31145' : '#1C1C28',
                fontWeight: tier.key === t.key ? 700 : 500,
              }}>{t.label}</span>
              <span className="text-[10px]" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--char-60,#6B7180)' }}>
                {t.minPct !== null && t.maxPct !== null
                  ? `${(t.minPct * 100).toFixed(0)}–${(t.maxPct * 100).toFixed(0)}%`
                  : t.key === 'mdrt_achiever' ? '≥100%' : 'First year'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Team Impact Tab ──────────────────────────────────────────────────────────

function TeamImpactTab({ agent, agents }) {
  const recruits = agents.filter(a => a.recruiterCode === agent.code || a.recruiterId === agent.code)

  if (recruits.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm font-bold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>No recruits on record</p>
        <p className="text-xs mt-1" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
          Recruits linked by recruiter code will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {recruits.map(r => {
        const ytdCases = getAgentYtdCases(r, CURRENT_MONTH_IDX)
        const status = ytdCases >= 5 ? 'Fast Start' : ytdCases > 0 ? 'Activated' : 'Not Yet'
        return (
          <div
            key={r.code}
            className="bg-white rounded-xl p-4 flex items-center gap-3"
            style={{ border: '1px solid var(--border,#E8E9ED)' }}
          >
            <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: '#1F78AD', fontFamily: 'AIA Everest' }}>
              {(r.name?.[0] || '?').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{r.name}</p>
              <p className="text-[10px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
                {r.code} · {formatApptDate(r.apptDate)}
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
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AgentProfilePage() {
  const { code }             = useParams()
  const navigate             = useNavigate()
  const { data, isLoaded, targets } = useData()
  const [activeTab, setActiveTab]   = useState('performance')

  const agent  = data?.agents?.find(a => a.code === code)
  const agents = data?.agents || []

  if (!isLoaded) return null
  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--surface,#F7F8FA)' }}>
        <div className="text-center">
          <p className="text-sm font-bold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>Agent not found</p>
          <button onClick={() => navigate('/agents')} className="mt-3 text-xs text-[#D31145]" style={{ fontFamily: 'AIA Everest' }}>
            Back to agents
          </button>
        </div>
      </div>
    )
  }

  const mdrtGoal  = targets?.mdrt_goal || MDRT_GOAL_DEFAULT
  const ytdFyp    = getAgentYtdFyp(agent, CURRENT_MONTH_IDX)
  const advisorTier = getAdvisorTier(ytdFyp, mdrtGoal)

  return (
    <div className="min-h-screen pb-4" style={{ backgroundColor: 'var(--surface,#F7F8FA)' }}>

      {/* Hero */}
      <div className="bg-white" style={{ borderBottom: '1px solid var(--border,#E8E9ED)' }}>
        <div className="max-w-screen-xl mx-auto px-4 pt-5 pb-0">
          {/* Back */}
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

          {/* Profile row */}
          <div className="flex items-start gap-4 mb-4">
            {/* Avatar with photo upload overlay */}
            <div className="relative flex-shrink-0">
              <AgentAvatar agentCode={agent.code} name={agent.name} size={64} tierKey={advisorTier.key} />
              <PhotoUpload agentCode={agent.code} agentName={agent.name} onSuccess={() => {}} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h1 className="text-lg font-extrabold leading-tight" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
                    {agent.name}
                  </h1>
                  <p className="text-[11px] mt-0.5" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--char-60,#6B7180)' }}>
                    {agent.code}
                  </p>
                </div>
                {/* MDRT badge */}
                {(advisorTier.key === 'mdrt_aspirant' || advisorTier.key === 'mdrt_achiever') && (
                  <span
                    className="text-[10px] font-bold rounded-full px-2.5 py-1 flex-shrink-0"
                    style={{
                      fontFamily: 'AIA Everest',
                      backgroundColor: advisorTier.key === 'mdrt_achiever' ? 'var(--green-10,#EAF4EB)' : 'var(--amber-10,#FDF3E3)',
                      color: advisorTier.key === 'mdrt_achiever' ? 'var(--green,#4E9A51)' : 'var(--amber,#C97B1A)',
                      border: `1px solid ${advisorTier.key === 'mdrt_achiever' ? 'var(--green,#4E9A51)' : 'var(--amber,#C97B1A)'}`,
                    }}
                  >
                    {advisorTier.label}
                  </span>
                )}
              </div>

              {/* Pills */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {agent.segment && (
                  <span className="text-[10px] font-semibold rounded-full px-2.5 py-0.5"
                    style={{
                      fontFamily: 'AIA Everest',
                      backgroundColor: agent.segment === 'Seasoned' ? 'var(--blue-10,#E8F2F9)' : 'var(--red-10,#FAE8EE)',
                      color: agent.segment === 'Seasoned' ? 'var(--blue,#1F78AD)' : '#D31145',
                    }}>
                    {agent.segment}
                  </span>
                )}
                {advisorTier.key !== 'mdrt_aspirant' && advisorTier.key !== 'mdrt_achiever' && (
                  <span className="text-[10px] font-semibold rounded-full px-2.5 py-0.5"
                    style={{ fontFamily: 'AIA Everest', backgroundColor: 'var(--char-10,#F2F3F5)', color: '#1C1C28' }}>
                    {advisorTier.abbr}
                  </span>
                )}
                {(agent.unitName || agent.unit) && (
                  <span className="text-[10px] font-semibold rounded-full px-2.5 py-0.5"
                    style={{ fontFamily: 'AIA Everest', backgroundColor: 'var(--char-10,#F2F3F5)', color: '#1C1C28' }}>
                    {agent.unitName || agent.unit}
                  </span>
                )}
                {agent.area && (
                  <span className="text-[10px] font-semibold rounded-full px-2.5 py-0.5"
                    style={{ fontFamily: 'AIA Everest', backgroundColor: 'var(--char-10,#F2F3F5)', color: '#1C1C28' }}>
                    {agent.area}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-0 -mb-px overflow-x-auto scrollbar-none">
            {PROFILE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2.5 text-xs whitespace-nowrap flex-shrink-0 transition-colors"
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

      {/* Tab content */}
      <div className="max-w-screen-xl mx-auto px-4 py-5">
        {activeTab === 'performance'    && <PerformanceTab agent={agent} agents={agents} targets={targets} />}
        {activeTab === 'bonus'          && <BonusTab agent={agent} />}
        {activeTab === 'qualifications' && <QualificationsTab agent={agent} targets={targets} />}
        {activeTab === 'team'           && <TeamImpactTab agent={agent} agents={agents} />}
      </div>
    </div>
  )
}
