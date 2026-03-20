import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { formatCurrency, formatNumber } from '../utils/formatters'
import Tag from '../components/Tag'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_ABBRS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MDRT_TARGET = 3518400

const GAMA_FLA_TIERS = [
  { label: 'Gold',   min: 10300000 },
  { label: 'Silver', min:  5000000 },
  { label: 'Bronze', min:  3000000 },
]

const GAMA_IMA_TIERS = [
  { label: 'Titanium', min: 78500000 },
  { label: 'Diamond',  min: 49000000 },
  { label: 'Platinum', min: 31600000 },
  { label: 'Gold',     min: 20600000 },
  { label: 'Silver',   min:  9500000 },
  { label: 'Bronze',   min:  4500000 },
]

const TIER_COLORS = {
  Gold:     { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-300', badge: 'bg-yellow-100 text-yellow-800', bar: 'bg-yellow-400' },
  Silver:   { text: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  badge: 'bg-slate-100 text-slate-700',  bar: 'bg-slate-400' },
  Bronze:   { text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-300',  badge: 'bg-amber-100 text-amber-800',  bar: 'bg-amber-500' },
  Titanium: { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-300', badge: 'bg-purple-100 text-purple-800', bar: 'bg-purple-500' },
  Diamond:  { text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-300',   badge: 'bg-blue-100 text-blue-700',   bar: 'bg-blue-500' },
  Platinum: { text: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-300',   badge: 'bg-teal-100 text-teal-700',   bar: 'bg-teal-500' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAgentYtdFyp(agent) {
  return MONTH_ABBRS.reduce((s, abbr) => s + (agent.monthly?.[abbr]?.fyp || 0), 0)
}

function getCurrentTier(fyp, tiers) {
  return tiers.find(t => fyp >= t.min) ?? null
}

function getNextTier(fyp, tiers) {
  const currentIdx = tiers.findIndex(t => fyp >= t.min)
  if (currentIdx === -1) return tiers[tiers.length - 1]  // below all tiers → next is lowest
  if (currentIdx === 0) return null                        // already at highest tier
  return tiers[currentIdx - 1]
}

function getTierProgress(fyp, tiers) {
  const nextTier = getNextTier(fyp, tiers)
  if (!nextTier) return { pct: 100, gap: 0, nextLabel: null, nextMin: null }
  const currentTier = getCurrentTier(fyp, tiers)
  const floor = currentTier?.min ?? 0
  const pct = Math.min(100, ((fyp - floor) / (nextTier.min - floor)) * 100)
  return { pct, gap: nextTier.min - fyp, nextLabel: nextTier.label, nextMin: nextTier.min }
}

function getProgressBarColor(pct) {
  if (pct >= 75) return 'bg-green-500'
  if (pct >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierBadge({ label, size = 'sm' }) {
  const colors = TIER_COLORS[label]
  if (!colors) return <span className="text-xs text-gray-400 font-semibold">—</span>
  const padding = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
  return (
    <span className={`font-bold rounded-full ${padding} ${colors.badge}`}>
      {label}
    </span>
  )
}

function ProgressBar({ pct, colorClass, height = 'h-2' }) {
  const bar = colorClass ?? getProgressBarColor(pct)
  return (
    <div className={`w-full bg-gray-100 rounded-full ${height} overflow-hidden`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${bar}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  )
}

// ─── IMA Tier Ladder ──────────────────────────────────────────────────────────

function ImaTierLadder({ agencyFyp }) {
  const reversedTiers = [...GAMA_IMA_TIERS].reverse() // Bronze → Titanium left to right
  const currentTier = getCurrentTier(agencyFyp, GAMA_IMA_TIERS)

  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Tier Milestones</p>
      <div className="flex w-full gap-0.5">
        {reversedTiers.map((tier, i) => {
          const achieved = agencyFyp >= tier.min
          const colors = TIER_COLORS[tier.label]
          const isCurrent = currentTier?.label === tier.label
          return (
            <div
              key={tier.label}
              className={[
                'flex-1 flex flex-col items-center py-2 px-1 rounded-lg border transition-all',
                achieved
                  ? `${colors.bg} ${colors.border}`
                  : 'bg-gray-50 border-gray-200',
                isCurrent ? 'ring-2 ring-offset-1 ring-aia-red' : '',
              ].join(' ')}
            >
              <span className={`text-[10px] font-extrabold uppercase ${achieved ? colors.text : 'text-gray-300'}`}>
                {tier.label}
              </span>
              <span className={`text-[9px] mt-0.5 tabular-nums ${achieved ? 'text-gray-500' : 'text-gray-300'}`}>
                {formatCurrency(tier.min, true)}
              </span>
              {isCurrent && (
                <span className="text-[8px] font-bold text-aia-red mt-0.5">YOU ARE HERE</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AwardsPage() {
  const { data, isLoaded } = useData()
  const navigate = useNavigate()
  const [mdrtView, setMdrtView] = useState('Qualifiers') // 'Qualifiers' | 'On Pace' | 'All'

  const currentMonthFraction = (new Date().getMonth() + 1) / 12  // March 2026 = 3/12

  const agents = useMemo(() =>
    (data?.agents ?? []).filter(a => a.manpowerInd).map(a => ({
      ...a,
      ytdFyp: getAgentYtdFyp(a),
    })),
    [data]
  )

  // Agency total YTD FYP (for IMA)
  const agencyYtdFyp = useMemo(() =>
    agents.reduce((s, a) => s + a.ytdFyp, 0),
    [agents]
  )

  // Unit FYP for GAMA FLA
  const unitFlaData = useMemo(() => {
    const map = new Map()
    for (const a of agents) {
      const key = a.unitCode || '__UNASSIGNED__'
      if (!map.has(key)) map.set(key, { unitName: a.unitName || a.unitCode || '?', agents: [] })
      map.get(key).agents.push(a)
    }
    return Array.from(map.values())
      .filter(u => u.unitName && u.agents.length > 0)
      .map(u => ({
        unitName: u.unitName,
        headcount: u.agents.length,
        ytdFyp: u.agents.reduce((s, a) => s + a.ytdFyp, 0),
      }))
      .sort((a, b) => b.ytdFyp - a.ytdFyp)
  }, [agents])

  // MDRT advisors
  const onPaceThreshold = MDRT_TARGET * currentMonthFraction * 0.8
  const mdrtAdvisors = useMemo(() => {
    const sorted = [...agents].sort((a, b) => b.ytdFyp - a.ytdFyp)
    if (mdrtView === 'Qualifiers') return sorted.filter(a => a.ytdFyp >= MDRT_TARGET)
    if (mdrtView === 'On Pace')    return sorted.filter(a => a.ytdFyp >= onPaceThreshold && a.ytdFyp < MDRT_TARGET)
    return sorted.slice(0, 30)
  }, [agents, mdrtView, onPaceThreshold])

  // Counts for toggle labels
  const qualifierCount = useMemo(() => agents.filter(a => a.ytdFyp >= MDRT_TARGET).length, [agents])
  const onPaceCount    = useMemo(() => agents.filter(a => a.ytdFyp >= onPaceThreshold && a.ytdFyp < MDRT_TARGET).length, [agents, onPaceThreshold])

  if (!isLoaded) { navigate('/'); return null }

  // IMA derived values
  const imaCurrentTier = getCurrentTier(agencyYtdFyp, GAMA_IMA_TIERS)
  const imaProgress    = getTierProgress(agencyYtdFyp, GAMA_IMA_TIERS)

  return (
    <div className="min-h-screen bg-aia-gray">
      <div className="max-w-screen-xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex flex-col gap-6">

        {/* ── Page header */}
        <div>
          <h1 className="text-2xl font-extrabold text-aia-darkGray tracking-tight">Awards Tracker 2026</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Track MDRT, GAMA FLA, and GAMA IMA progress based on annual FYP
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 1: GAMA IMA — Agency Progress
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
            GAMA IMA — Agency Annual FYP
          </p>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            {/* Left: FYP number + tier badge */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl font-extrabold text-aia-darkGray tabular-nums">
                  {formatCurrency(agencyYtdFyp, true)}
                </span>
                {imaCurrentTier
                  ? <TierBadge label={imaCurrentTier.label} size="lg" />
                  : <span className="text-sm font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Not Yet Qualifying</span>
                }
              </div>
              <p className="text-xs text-gray-400 font-medium">
                Agency YTD FYP across {formatNumber(agents.length)} active advisors
              </p>
            </div>

            {/* Right: Next tier info */}
            {imaProgress.nextLabel && (
              <div className={`rounded-xl border px-4 py-3 flex-shrink-0 ${
                imaCurrentTier
                  ? `${TIER_COLORS[imaCurrentTier.label]?.bg ?? 'bg-gray-50'} ${TIER_COLORS[imaCurrentTier.label]?.border ?? 'border-gray-200'}`
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Next Tier</p>
                <p className="font-extrabold text-aia-darkGray text-sm">{imaProgress.nextLabel}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Target: {formatCurrency(imaProgress.nextMin)}
                </p>
                <p className="text-xs font-semibold text-aia-red mt-0.5">
                  +{formatCurrency(imaProgress.gap, true)} needed
                </p>
              </div>
            )}
            {!imaProgress.nextLabel && imaCurrentTier && (
              <div className={`rounded-xl border px-4 py-3 flex-shrink-0 ${TIER_COLORS[imaCurrentTier.label]?.bg} ${TIER_COLORS[imaCurrentTier.label]?.border}`}>
                <p className="text-sm font-extrabold text-green-600">Max Tier Achieved ✓</p>
                <p className="text-xs text-gray-500 mt-0.5">Titanium — Agency pinnacle</p>
              </div>
            )}
          </div>

          {/* Progress bar toward next IMA tier */}
          {imaProgress.nextLabel && (
            <div className="mb-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span className="font-medium">{imaCurrentTier?.label ?? 'Start'}: {formatCurrency(imaCurrentTier?.min ?? 0, true)}</span>
                <span className="font-semibold text-aia-darkGray">{imaProgress.pct.toFixed(1)}%</span>
                <span className="font-medium">{imaProgress.nextLabel}: {formatCurrency(imaProgress.nextMin, true)}</span>
              </div>
              <ProgressBar pct={imaProgress.pct} height="h-3" />
            </div>
          )}

          {/* Tier milestone ladder */}
          <ImaTierLadder agencyFyp={agencyYtdFyp} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 2: GAMA FLA — Unit Leaders
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
          <div className="px-6 pt-5 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              GAMA FLA — Unit / Team Annual FYP
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Bronze ≥ ₱3M &nbsp;|&nbsp; Silver ≥ ₱5M &nbsp;|&nbsp; Gold ≥ ₱10.3M
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[160px]">Unit</th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Advisors</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[110px]">YTD FYP</th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[90px]">FLA Tier</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[130px]">Gap to Next</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[150px]">Progress</th>
                </tr>
              </thead>
              <tbody>
                {unitFlaData.map((unit, idx) => {
                  const currentTier = getCurrentTier(unit.ytdFyp, GAMA_FLA_TIERS)
                  const progress    = getTierProgress(unit.ytdFyp, GAMA_FLA_TIERS)
                  return (
                    <tr key={unit.unitName} className="even:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-aia-darkGray text-xs">{unit.unitName}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-600 tabular-nums">
                        {formatNumber(unit.headcount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-semibold text-aia-darkGray">
                        {formatCurrency(unit.ytdFyp, true)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {currentTier
                          ? <TierBadge label={currentTier.label} />
                          : <span className="text-xs text-gray-300 font-semibold">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums">
                        {progress.nextLabel
                          ? <span className="text-amber-600 font-semibold">+{formatCurrency(progress.gap, true)} to {progress.nextLabel}</span>
                          : <span className="text-green-600 font-bold">Max Tier ✓</span>
                        }
                      </td>
                      <td className="px-4 py-3 min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <ProgressBar pct={progress.pct} />
                          </div>
                          <span className="text-[10px] font-semibold text-gray-500 tabular-nums w-8 text-right flex-shrink-0">
                            {progress.pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {unitFlaData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                      No unit data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 3: MDRT Qualifiers — Individual Advisors
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
          <div className="px-6 pt-5 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                MDRT — Individual Annual FYP
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Target: {formatCurrency(MDRT_TARGET)} &nbsp;|&nbsp;
                On-Pace threshold (Mar 80%): {formatCurrency(Math.round(onPaceThreshold), true)}
              </p>
            </div>

            {/* View toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 self-start flex-shrink-0">
              {[
                { key: 'Qualifiers', label: `Qualifiers (${qualifierCount})` },
                { key: 'On Pace',    label: `On Pace (${onPaceCount})` },
                { key: 'All',        label: 'All Advisors' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setMdrtView(key)}
                  className={[
                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150',
                    mdrtView === key
                      ? 'bg-white text-aia-darkGray shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] w-10">#</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[150px]">Name</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Segment</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[120px]">Unit</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[100px]">YTD FYP</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[70px]">% to MDRT</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[140px]">Status</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] min-w-[120px]">Progress</th>
                </tr>
              </thead>
              <tbody>
                {mdrtAdvisors.map((a, idx) => {
                  const pctToMdrt = Math.min(100, (a.ytdFyp / MDRT_TARGET) * 100)
                  const isQualified = a.ytdFyp >= MDRT_TARGET
                  const isOnPace    = !isQualified && a.ytdFyp >= onPaceThreshold

                  let statusBadge
                  if (isQualified) {
                    statusBadge = (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        MDRT Qualified ✓
                      </span>
                    )
                  } else if (isOnPace) {
                    statusBadge = (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        On Pace
                      </span>
                    )
                  } else {
                    statusBadge = (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                        Needs Work
                      </span>
                    )
                  }

                  const barColor = isQualified
                    ? 'bg-green-500'
                    : isOnPace
                      ? 'bg-amber-400'
                      : pctToMdrt >= 30
                        ? 'bg-red-400'
                        : 'bg-gray-300'

                  return (
                    <tr key={a.code ?? idx} className="even:bg-gray-50">
                      <td className="px-3 py-2.5 text-center text-xs text-gray-400 tabular-nums font-medium">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-aia-darkGray text-xs">{a.name}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Tag variant={a.segment === 'Rookie' ? 'rookie' : 'seasoned'}>
                          {a.segment}
                        </Tag>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{a.unitName || '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs font-semibold text-aia-darkGray">
                        {formatCurrency(a.ytdFyp, true)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs font-semibold text-aia-darkGray">
                        {((a.ytdFyp / MDRT_TARGET) * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {statusBadge}
                      </td>
                      <td className="px-3 py-2.5 min-w-[120px]">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                              style={{ width: `${pctToMdrt}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-gray-400 tabular-nums w-7 text-right flex-shrink-0">
                            {pctToMdrt.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {mdrtAdvisors.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">
                      {mdrtView === 'Qualifiers'
                        ? 'No advisors have reached the MDRT target yet.'
                        : mdrtView === 'On Pace'
                          ? 'No advisors are currently on pace for MDRT.'
                          : 'No advisor data available.'
                      }
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {mdrtAdvisors.length > 0 && mdrtView === 'All' && (
            <div className="px-6 py-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 font-medium">Showing top 30 advisors by YTD FYP.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
