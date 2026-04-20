import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import AgentAvatar from '../components/AgentAvatar'
import PhotoUpload from '../components/PhotoUpload'
import ProgressBar from '../components/ProgressBar'
import MonthlyBarChart from '../components/MonthlyBarChart'
import SectionHeader from '../components/SectionHeader'
import {
  MONTH_ABBRS, MONTH_SHORT, ADVISOR_TIERS, TIER_COLORS, MDRT_GOAL_DEFAULT, CURRENT_MONTH_IDX, MONTH_LABELS, CURRENT_YEAR,
} from '../constants'
import {
  getAgentYtdFyp, getAgentYtdFyc, getAgentYtdAnp, getAgentYtdCases,
  calculateQuarterlyBonus, getAdvisorTier, getFycNextTierGap, formatPeso, formatPct,
} from '../utils/calculations'

// ─── Email + date helpers ──────────────────────────────────────────────────────

function generateAiaEmail(name) {
  if (!name) return null
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  const firstName = parts[0].toLowerCase()
  const lastName  = parts[parts.length - 1].toLowerCase()
  if (parts.length === 2) return `${firstName}.${lastName}@aia.com.ph`
  const mi = parts[1].charAt(0).toLowerCase()
  return `${firstName}-${mi}.${lastName}@aia.com.ph`
}

function formatLicenseDate(isoStr) {
  if (!isoStr) return null
  const [y, m, d] = isoStr.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function computeRollingTargets(annualTarget, actuals) {
  const tgts = new Array(12).fill(0)
  let cum = 0
  for (let i = 0; i < 11; i++) {
    tgts[i] = Math.max(0, (annualTarget - cum) / (11 - i))
    cum += actuals[i] || 0
  }
  return tgts
}

const PROFILE_TABS = [
  { key: 'performance',    label: 'Performance' },
  { key: 'bonus',          label: 'Bonus' },
  { key: 'qualifications', label: 'Qualifications' },
  { key: 'team',           label: 'Team Impact' },
  { key: 'goals',          label: 'Goals' },
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

function PerformanceTab({ agent, agents, targets, historicalData }) {
  const [chartMetric, setChartMetric] = useState('FYP')
  const mdrtGoal = targets?.mdrt_goal || MDRT_GOAL_DEFAULT

  const ytdFyp   = getAgentYtdFyp(agent, CURRENT_MONTH_IDX)
  const ytdFyc   = getAgentYtdFyc(agent, CURRENT_MONTH_IDX)
  const ytdCases = getAgentYtdCases(agent, CURRENT_MONTH_IDX)
  const mdrtPct  = mdrtGoal > 0 ? (ytdFyp / mdrtGoal) * 100 : 0

  // Projected year-end FYP at current pace
  const monthsElapsed = CURRENT_MONTH_IDX + 1
  const projectedYeFyp = monthsElapsed > 0 ? (ytdFyp / monthsElapsed) * 12 : 0

  // ── Activity & Consistency ──
  const activeMonths = MONTH_ABBRS.slice(0, monthsElapsed)
    .filter(abbr => (agent.monthly?.[abbr]?.cases || 0) > 0).length
  const consistencyPct = monthsElapsed > 0 ? (activeMonths / monthsElapsed) * 100 : 0

  // Current consecutive streak (counting back from current month)
  let currentStreak = 0
  for (let i = CURRENT_MONTH_IDX; i >= 0; i--) {
    if ((agent.monthly?.[MONTH_ABBRS[i]]?.cases || 0) > 0) currentStreak++
    else break
  }
  // Best streak this year
  let bestStreak = 0, tempStreak = 0
  for (let i = 0; i <= CURRENT_MONTH_IDX; i++) {
    if ((agent.monthly?.[MONTH_ABBRS[i]]?.cases || 0) > 0) { tempStreak++; bestStreak = Math.max(bestStreak, tempStreak) }
    else tempStreak = 0
  }

  // ── Year-over-year: find this agent in historical data ──
  const priorAgent = historicalData?.agents?.find(a => a.code === agent.code)

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

      {/* Activity & Consistency */}
      <section>
        <SectionHeader title="Activity & Consistency" />
        <div className="bg-white rounded-xl p-4 mt-3" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
          {/* Row 1: stat pills */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--char-10,#F2F3F5)' }}>
              <p className="text-[9px] font-semibold uppercase tracking-wide mb-0.5"
                style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>Active Months</p>
              <p className="text-xl font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
                {activeMonths}
                <span className="text-sm font-normal text-[#6B7180]"> / {monthsElapsed}</span>
              </p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--char-10,#F2F3F5)' }}>
              <p className="text-[9px] font-semibold uppercase tracking-wide mb-0.5"
                style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>Consistency</p>
              <p className="text-xl font-bold" style={{
                fontFamily: 'DM Mono, monospace',
                color: consistencyPct >= 80 ? 'var(--green,#4E9A51)' : consistencyPct >= 50 ? 'var(--amber,#C97B1A)' : '#D31145',
              }}>
                {consistencyPct.toFixed(0)}%
              </p>
            </div>
          </div>
          {/* Consistency bar */}
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'var(--char-10,#F2F3F5)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${consistencyPct}%`,
                backgroundColor: consistencyPct >= 80 ? 'var(--green,#4E9A51)' : consistencyPct >= 50 ? 'var(--amber,#C97B1A)' : '#D31145',
              }} />
          </div>
          {/* Month activity dots */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {MONTH_ABBRS.slice(0, monthsElapsed).map((abbr, i) => {
              const active = (agent.monthly?.[abbr]?.cases || 0) > 0
              return (
                <div key={abbr} className="flex flex-col items-center gap-0.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: active ? 'var(--green,#4E9A51)' : 'var(--char-10,#F2F3F5)',
                      border: `1px solid ${active ? 'var(--green,#4E9A51)' : 'var(--border,#E8E9ED)'}`,
                    }}>
                    {active && <svg width="8" height="8" viewBox="0 0 8 8" fill="white"><path d="M1.5 4l2 2L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>}
                  </div>
                  <span className="text-[8px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
                    {abbr.charAt(0) + abbr.slice(1, 2).toLowerCase()}
                  </span>
                </div>
              )
            })}
          </div>
          {/* Streak stats */}
          <div className="flex gap-4 text-[11px]" style={{ fontFamily: 'AIA Everest' }}>
            <span style={{ color: 'var(--char-60,#6B7180)' }}>
              Current streak: <strong style={{ color: currentStreak >= 3 ? '#D31145' : '#1C1C28' }}>
                {currentStreak} {currentStreak === 1 ? 'month' : 'months'}
              </strong>
            </span>
            <span style={{ color: 'var(--char-60,#6B7180)' }}>
              Best this year: <strong style={{ color: '#1C1C28' }}>{bestStreak} {bestStreak === 1 ? 'month' : 'months'}</strong>
            </span>
          </div>
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

      {/* vs Last Year */}
      {priorAgent && (
        <section>
          <SectionHeader title={`vs Last Year (${new Date().getFullYear() - 1})`} />
          <div className="bg-white rounded-xl p-4 mt-3" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'FYP',   curr: ytdFyp,   prev: getAgentYtdFyp(priorAgent, CURRENT_MONTH_IDX),   fmt: formatPeso },
                { label: 'FYC',   curr: ytdFyc,   prev: getAgentYtdFyc(priorAgent, CURRENT_MONTH_IDX),   fmt: formatPeso },
                { label: 'Cases', curr: ytdCases, prev: getAgentYtdCases(priorAgent, CURRENT_MONTH_IDX), fmt: v => String(v) },
              ].map(({ label, curr, prev, fmt }) => {
                const diff = curr - prev
                const pct  = prev > 0 ? (diff / prev) * 100 : null
                const up   = diff > 0
                return (
                  <div key={label} className="rounded-lg p-3" style={{ backgroundColor: 'var(--char-10,#F2F3F5)' }}>
                    <p className="text-[9px] font-semibold uppercase tracking-wide mb-1"
                      style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>{label} YTD</p>
                    <p className="text-sm font-bold leading-tight" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>
                      {fmt(curr)}
                    </p>
                    {pct !== null && (
                      <p className="text-[10px] font-semibold mt-0.5"
                        style={{ fontFamily: 'AIA Everest', color: up ? 'var(--green,#4E9A51)' : '#D31145' }}>
                        {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
                      </p>
                    )}
                    <p className="text-[9px] mt-0.5" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
                      Prior: {fmt(prev)}
                    </p>
                  </div>
                )
              })}
            </div>
            {/* Monthly FYP comparison bars */}
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-2"
              style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>Monthly FYP Comparison</p>
            <div className="flex gap-1 items-end" style={{ height: 80 }}>
              {MONTH_ABBRS.slice(0, monthsElapsed).map(abbr => {
                const curr = agent.monthly?.[abbr]?.fyp || 0
                const prev = priorAgent.monthly?.[abbr]?.fyp || 0
                const maxVal = Math.max(curr, prev, 1)
                return (
                  <div key={abbr} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex gap-0.5 items-end" style={{ height: 60 }}>
                      <div className="flex-1 rounded-t-sm transition-all duration-500"
                        style={{ height: `${(curr / maxVal) * 100}%`, backgroundColor: '#D31145', minHeight: curr > 0 ? 2 : 0 }} />
                      <div className="flex-1 rounded-t-sm transition-all duration-500"
                        style={{ height: `${(prev / maxVal) * 100}%`, backgroundColor: 'var(--char-30,#B0B3BC)', minHeight: prev > 0 ? 2 : 0 }} />
                    </div>
                    <span className="text-[7px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
                      {abbr.charAt(0) + abbr.slice(1, 2).toLowerCase()}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-2 text-[10px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#D31145]" /> {new Date().getFullYear()}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--char-30,#B0B3BC)' }} /> {new Date().getFullYear() - 1}
              </span>
            </div>
          </div>
        </section>
      )}

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

// ─── Goals Tab ───────────────────────────────────────────────────────────────

function GoalsTab({ agent, allAgents, targets }) {
  const annualFyp = targets?.fyp_annual || 0

  // ── Ace Award ──
  const ACE_FYC = 300000, ACE_CASES = 24, ACE_PERS = 82.5
  const ytdFyc   = getAgentYtdFyc(agent, CURRENT_MONTH_IDX)
  const ytdCases = getAgentYtdCases(agent, CURRENT_MONTH_IDX)
  const persVals = MONTH_ABBRS.slice(0, CURRENT_MONTH_IDX + 1)
    .map(abbr => agent.monthly?.[abbr]?.persistency)
    .filter(v => v != null && !isNaN(v))
  const avgPers = persVals.length > 0 ? persVals.reduce((s, v) => s + v, 0) / persVals.length : null
  const aceQualified = ytdFyc >= ACE_FYC && ytdCases >= ACE_CASES && (avgPers == null || avgPers >= ACE_PERS)

  // ── Personal Monthly FYP Target ──
  const activeAgents = allAgents.filter(a => a.manpowerInd)
  const totalManpower = activeAgents.length
  const fypActuals = MONTH_ABBRS.map(abbr =>
    activeAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyp || 0), 0)
  )
  const rollingFypTargets = computeRollingTargets(annualFyp, fypActuals)
  const monthlyTarget = rollingFypTargets[CURRENT_MONTH_IDX]

  // Unit + segment allocation
  const agentUnitKey = agent.unitCode || agent.unitName || ''
  const unitAgents   = activeAgents.filter(a => (a.unitCode || a.unitName || '') === agentUnitKey)
  const unitShare    = totalManpower > 0 ? unitAgents.length / totalManpower : 0
  const unitTarget   = monthlyTarget * unitShare
  const isRookie     = agent.segment === 'Rookie'
  const poolCount    = isRookie
    ? unitAgents.filter(a => a.segment === 'Rookie').length
    : unitAgents.filter(a => a.segment !== 'Rookie').length
  const personalTarget = poolCount > 0
    ? (unitTarget * (isRookie ? 0.40 : 0.60)) / poolCount
    : 0

  const abbr     = MONTH_ABBRS[CURRENT_MONTH_IDX]
  const actualFyp = agent.monthly?.[abbr]?.fyp || 0
  const targetAch = personalTarget > 0 ? (actualFyp / personalTarget) * 100 : null

  return (
    <div className="flex flex-col gap-4">

      {/* ── Ace Award Progress ── */}
      <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
        <div className="flex items-center justify-between mb-1">
          <SectionHeader title="Ace Award Progress" />
          {aceQualified && (
            <span className="text-[10px] font-bold rounded-full px-2 py-0.5"
              style={{ fontFamily: 'AIA Everest', backgroundColor: '#EAF4EB', color: '#4E9A51', border: '1px solid #4E9A51' }}>
              ✓ On Track
            </span>
          )}
        </div>
        <p className="text-[10px] mb-4" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
          Individual award · FYC ≥ ₱300,000 · Cases ≥ 24 · Persistency ≥ 82.5%
        </p>
        {[
          { label: 'FYC (YTD)',        actual: ytdFyc,   target: ACE_FYC,   format: v => formatPeso(v),                        targetLabel: '₱300,000',  met: ytdFyc >= ACE_FYC,    na: false },
          { label: 'Cases (YTD)',      actual: ytdCases, target: ACE_CASES, format: v => String(v),                            targetLabel: '24 cases',  met: ytdCases >= ACE_CASES, na: false },
          { label: 'Persistency (Avg)',actual: avgPers,  target: ACE_PERS,  format: v => v != null ? `${v.toFixed(1)}%` : 'N/A', targetLabel: '82.5%', met: avgPers != null && avgPers >= ACE_PERS, na: avgPers == null },
        ].map(({ label, actual, target, format, targetLabel, met, na }) => {
          const pct   = na ? 0 : Math.min(100, (actual / target) * 100)
          const color = met ? '#4E9A51' : pct >= 80 ? '#C97B1A' : '#D31145'
          return (
            <div key={label} className="mb-3 last:mb-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-semibold" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>{label}</span>
                <span className="text-xs font-bold" style={{ fontFamily: 'DM Mono, monospace', color }}>{format(actual)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--char-10,#F2F3F5)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[9px]" style={{ fontFamily: 'AIA Everest', color }}>{na ? 'N/A' : `${pct.toFixed(0)}%`}</span>
                <span className="text-[9px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>Target: {targetLabel}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Personal Monthly FYP Target ── */}
      {annualFyp > 0 ? (
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
          <SectionHeader title="Personal Monthly FYP Target" />
          <p className="text-[10px] mt-1 mb-3" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
            {MONTH_LABELS[CURRENT_MONTH_IDX]} {CURRENT_YEAR} · {isRookie ? 'Rookie' : 'Seasoned'} pool · allocated from agency target
          </p>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-2xl font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>{formatPeso(actualFyp)}</p>
              <p className="text-[10px] mt-0.5" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>Actual FYP</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--char-60,#6B7180)' }}>{formatPeso(personalTarget)}</p>
              <p className="text-[10px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>Target</p>
            </div>
          </div>
          {personalTarget > 0 && targetAch !== null && (
            <>
              <div className="h-2.5 rounded-full overflow-hidden mb-1" style={{ backgroundColor: 'var(--char-10,#F2F3F5)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, targetAch)}%`,
                    backgroundColor: targetAch >= 100 ? '#4E9A51' : targetAch >= 80 ? '#C97B1A' : '#D31145',
                  }}
                />
              </div>
              <p className="text-[11px] font-semibold" style={{
                fontFamily: 'AIA Everest',
                color: targetAch >= 100 ? '#4E9A51' : targetAch >= 80 ? '#C97B1A' : '#D31145',
              }}>{targetAch.toFixed(1)}% of target</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-4 text-center" style={{ border: '1px solid var(--border,#E8E9ED)' }}>
          <p className="text-xs font-semibold mb-1" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>No agency target set</p>
          <p className="text-[10px]" style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>Set an annual FYP target in Settings to see personal targets.</p>
        </div>
      )}

    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AgentProfilePage() {
  const { code }             = useParams()
  const navigate             = useNavigate()
  const { data, isLoaded, targets, historicalData } = useData()
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

  const mdrtGoal    = targets?.mdrt_goal || MDRT_GOAL_DEFAULT
  const ytdFyp      = getAgentYtdFyp(agent, CURRENT_MONTH_IDX)
  const advisorTier = getAdvisorTier(ytdFyp, mdrtGoal)
  const aiaEmail    = generateAiaEmail(agent.name)
  const licenseDate = formatLicenseDate(agent.appointmentDate)

  return (
    <div className="min-h-screen pb-4" style={{ backgroundColor: 'var(--surface,#F7F8FA)' }}>

      {/* ── Hero ── */}
      <div className="bg-white" style={{ borderBottom: '1px solid var(--border,#E8E9ED)' }}>
        <div className="max-w-screen-xl mx-auto px-4 pt-5 pb-0">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs mb-5"
            style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 3L5 7l4 4" />
            </svg>
            Back
          </button>

          {/* Profile row */}
          <div className="flex items-end gap-5 mb-5">

            {/* Prominent circular avatar with upload button */}
            <PhotoUpload agentCode={agent.code} agentName={agent.name} onSuccess={() => {}}>
              <AgentAvatar
                agentCode={agent.code}
                name={agent.name}
                size={96}
                tierKey={advisorTier.key}
                className="!rounded-full ring-4 ring-white shadow-md"
              />
            </PhotoUpload>

            {/* Name + details */}
            <div className="flex-1 min-w-0 pb-1">

              {/* MDRT badge (top-right) */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <h1 className="text-xl font-extrabold leading-tight truncate"
                    style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
                    {agent.name}
                  </h1>
                  {aiaEmail && (
                    <p className="text-[11px] mt-0.5 truncate"
                      style={{ fontFamily: 'DM Mono, monospace', color: 'var(--char-60,#6B7180)' }}>
                      {aiaEmail}
                    </p>
                  )}
                </div>
                {(advisorTier.key === 'mdrt_aspirant' || advisorTier.key === 'mdrt_achiever') && (
                  <span
                    className="flex-shrink-0 text-[10px] font-bold rounded-full px-2.5 py-1"
                    style={{
                      fontFamily: 'AIA Everest',
                      backgroundColor: advisorTier.key === 'mdrt_achiever' ? 'var(--green-10,#EAF4EB)' : 'var(--amber-10,#FDF3E3)',
                      color:           advisorTier.key === 'mdrt_achiever' ? 'var(--green,#4E9A51)'    : 'var(--amber,#C97B1A)',
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
                      color:           agent.segment === 'Seasoned' ? 'var(--blue,#1F78AD)'    : '#D31145',
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
                  fontFamily:   'AIA Everest',
                  fontWeight:   activeTab === tab.key ? 700 : 500,
                  color:        activeTab === tab.key ? '#D31145' : 'var(--char-60,#6B7180)',
                  borderBottom: activeTab === tab.key ? '2px solid #D31145' : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── About card (always visible) ── */}
      <div className="max-w-screen-xl mx-auto px-4 pt-4">
        <div className="bg-white rounded-xl px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2.5"
          style={{ border: '1px solid var(--border,#E8E9ED)' }}>
          {[
            { label: 'Agent Code',     value: agent.code },
            { label: 'AIA Email',      value: aiaEmail },
            { label: 'Licensed Since', value: licenseDate },
            { label: 'Unit',           value: agent.unitName || agent.unit || null },
            { label: 'Area',           value: agent.area || null },
            { label: 'Segment',        value: agent.segment || null },
          ].filter(r => r.value).map(({ label, value }) => (
            <div key={label}>
              <p className="text-[9px] font-semibold uppercase tracking-wide mb-0.5"
                style={{ fontFamily: 'AIA Everest', color: 'var(--char-60,#6B7180)' }}>
                {label}
              </p>
              <p className="text-xs font-semibold break-all"
                style={{ fontFamily: label === 'AIA Email' || label === 'Agent Code' ? 'DM Mono, monospace' : 'AIA Everest', color: '#1C1C28' }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="max-w-screen-xl mx-auto px-4 py-5">
        {activeTab === 'performance'    && <PerformanceTab agent={agent} agents={agents} targets={targets} historicalData={historicalData} />}
        {activeTab === 'bonus'          && <BonusTab agent={agent} />}
        {activeTab === 'qualifications' && <QualificationsTab agent={agent} targets={targets} />}
        {activeTab === 'team'           && <TeamImpactTab agent={agent} agents={agents} />}
        {activeTab === 'goals'          && <GoalsTab agent={agent} allAgents={agents} targets={targets} />}
      </div>
    </div>
  )
}
