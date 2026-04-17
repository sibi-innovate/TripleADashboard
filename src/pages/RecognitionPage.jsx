// RecognitionPage — Phase 6 implementation
// Sub-tabs: Birthdays | New Advisors | Awards | Highlights
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { MONTH_LABELS, MONTH_ABBRS, CURRENT_MONTH_IDX, TIER_COLORS } from '../constants';
import { formatCurrency } from '../utils/formatters';
import AgentAvatar from '../components/AgentAvatar';
import {
  getTopRookies, getTopOverall,
  getMostTrustedAdvisors, getMostProductiveAdvisors,
  getConsistentProducers, getAgencyBuilders,
  getUnitAwards,
  getPathToMdrt, getLeaderGamaProgress, getAgencyGamaStatus,
} from '../utils/awardHelpers';

const TABS = [
  { key: 'birthdays',    label: 'Birthdays' },
  { key: 'new-advisors', label: 'New Advisors' },
  { key: 'awards',       label: 'Awards' },
  { key: 'highlights',   label: 'Highlights' },
];

export default function RecognitionPage() {
  const [activeTab, setActiveTab] = useState('highlights');
  const [monthIdx, setMonthIdx] = useState(CURRENT_MONTH_IDX);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface, #F7F8FA)' }}>
      {/* Page header */}
      <div className="bg-white border-b" style={{ borderColor: 'var(--border, #E8E9ED)' }}>
        <div className="max-w-screen-xl mx-auto px-4 pt-5 pb-0">
          <h1
            className="text-xl mb-4"
            style={{ fontFamily: 'AIA Everest', fontWeight: 800, color: '#1C1C28' }}
          >
            Recognition
          </h1>

          {/* Month selector */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-3">
            {MONTH_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => setMonthIdx(i)}
                className="flex-shrink-0 px-3 py-1 rounded text-xs transition-colors duration-150"
                style={{
                  fontFamily: 'AIA Everest',
                  fontWeight: monthIdx === i ? 700 : 500,
                  backgroundColor: monthIdx === i ? '#D31145' : 'transparent',
                  color: monthIdx === i ? '#fff' : 'var(--char-60, #6B7180)',
                  border: `1px solid ${monthIdx === i ? '#D31145' : 'var(--border, #E8E9ED)'}`,
                }}
              >
                {label.slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-0 -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2.5 text-xs transition-colors duration-150"
                style={{
                  fontFamily: 'AIA Everest',
                  fontWeight: activeTab === tab.key ? 700 : 500,
                  color: activeTab === tab.key ? '#D31145' : 'var(--char-60, #6B7180)',
                  borderBottom: activeTab === tab.key ? '2px solid #D31145' : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        {activeTab === 'birthdays'    && <BirthdaysTab monthIdx={monthIdx} />}
        {activeTab === 'new-advisors' && <NewAdvisorsTab monthIdx={monthIdx} />}
        {activeTab === 'awards'       && <AwardsTab monthIdx={monthIdx} />}
        {activeTab === 'highlights'   && <HighlightsTab monthIdx={monthIdx} />}
      </div>
    </div>
  );
}

// ─── Sub-tab components ──────────────────────────────────────────────────────

function BirthdaysTab({ monthIdx }) {
  const { data } = useData();
  const agents = data?.agents || [];

  const hasBirthDateData = agents.some(a => a.birthDate);
  if (!hasBirthDateData) {
    return (
      <EmptyState
        title="Birth date data not available"
        message="Re-upload your data file to enable birthday celebrations. Make sure the file includes the AGENT_BIRTHDATE column."
      />
    );
  }

  const celebrants = (agents || []).filter(a => {
    if (!a.birthDate) return false;
    const d = new Date(a.birthDate);
    return !isNaN(d) && d.getMonth() === monthIdx;
  });

  if (celebrants.length === 0) {
    return <EmptyState title="No birthdays this month" message="No advisors have birthdays in the selected month." />;
  }

  const today = new Date();
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {celebrants.map(a => {
        const d = new Date(a.birthDate);
        const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
        return (
          <div
            key={a.code}
            className="flex-shrink-0 w-36 rounded-xl p-4 text-center"
            style={{
              background: '#fff',
              border: `2px solid ${isToday ? '#D31145' : 'var(--border, #E8E9ED)'}`,
              boxShadow: isToday ? '0 0 0 3px rgba(211,17,69,0.12)' : 'none',
            }}
          >
            <div className="mx-auto mb-2 w-12 h-12">
              <AgentAvatar agentCode={a.code} name={a.name} size={48} className="!rounded-full" />
            </div>
            <p className="text-xs font-bold leading-snug" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{a.name}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'DM Mono, monospace' }}>
              {d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </p>
            {isToday && (
              <span className="mt-1.5 inline-block text-[9px] font-bold text-white bg-red-600 rounded px-1.5 py-0.5" style={{ fontFamily: 'AIA Everest' }}>
                TODAY
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NewAdvisorsTab({ monthIdx }) {
  const { data } = useData();
  const agents = data?.agents || [];

  // Only advisors whose NEW_RECRUIT_{MONTH}{YEAR} column = 1 for this month
  const abbr = MONTH_ABBRS[monthIdx];
  const newAdvisors = agents.filter(a => a.monthly?.[abbr]?.isNewRecruit === true);

  if (newAdvisors.length === 0) {
    return <EmptyState title="No new advisors this month" message="No advisors were appointed in the selected month." />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {newAdvisors.map(a => {
        const status = getActivationStatus(a);
        return (
          <div
            key={a.code}
            className="bg-white rounded-xl p-4"
            style={{ border: '1px solid var(--border, #E8E9ED)' }}
          >
            <div className="mb-2 w-10 h-10">
              <AgentAvatar agentCode={a.code} name={a.name} size={40} className="!rounded-full" />
            </div>
            <p className="text-xs font-bold leading-snug" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{a.name}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'AIA Everest' }}>{a.unitName || '—'}</p>
            <span
              className="mt-2 inline-block text-[9px] font-bold rounded px-1.5 py-0.5"
              style={{
                fontFamily: 'AIA Everest',
                backgroundColor: status === 'Fast Start' ? 'var(--green-10, #EAF4EB)' : status === 'Activated' ? 'var(--blue-10, #E8F2F9)' : 'var(--char-10, #F2F3F5)',
                color: status === 'Fast Start' ? 'var(--green, #4E9A51)' : status === 'Activated' ? 'var(--blue, #1F78AD)' : 'var(--char-60, #6B7180)',
              }}
            >
              {status}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Award sub-tab constants
const INDIVIDUAL_AWARD_TABS = [
  { key: 'rookies',    label: 'Top Rookies' },
  { key: 'overall',   label: 'Top Overall' },
  { key: 'mta',       label: 'MTA' },
  { key: 'mpa',       label: 'MPA' },
  { key: 'consistent',label: 'Consistent' },
  { key: 'builders',  label: 'Agency Builders' },
];
const UNIT_AWARD_TABS = [
  { key: 'unit-fyp',         label: 'Team FYP' },
  { key: 'unit-recruitment', label: 'Recruitment' },
  { key: 'unit-producing',   label: 'Producing' },
  { key: 'unit-cases',       label: 'Case Count' },
];

function AwardsTab({ monthIdx }) {
  const { data, targets } = useData();
  const agents   = data?.agents || [];
  const mdrtGoal = targets?.mdrt_goal || 3518400;
  const abbr     = MONTH_ABBRS[monthIdx];

  const [awardTab, setAwardTab] = useState('rookies');
  const [consistentGapFree, setConsistentGapFree] = useState(true);

  const unitAwards = getUnitAwards(agents, abbr);

  return (
    <div className="space-y-4">
      {/* Individual award tabs */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5" style={{ fontFamily: 'AIA Everest' }}>Individual Awards</p>
        <div className="flex gap-1.5 flex-wrap">
          {INDIVIDUAL_AWARD_TABS.map(t => (
            <button key={t.key} onClick={() => setAwardTab(t.key)}
              className="px-3 py-1.5 rounded text-xs transition-colors"
              style={{
                fontFamily: 'AIA Everest', fontWeight: awardTab === t.key ? 700 : 500,
                backgroundColor: awardTab === t.key ? '#D31145' : '#fff',
                color: awardTab === t.key ? '#fff' : '#6B7180',
                border: `1px solid ${awardTab === t.key ? '#D31145' : '#E8E9ED'}`,
              }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Unit award tabs */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5" style={{ fontFamily: 'AIA Everest' }}>Unit Awards</p>
        <div className="flex gap-1.5 flex-wrap">
          {UNIT_AWARD_TABS.map(t => (
            <button key={t.key} onClick={() => setAwardTab(t.key)}
              className="px-3 py-1.5 rounded text-xs transition-colors"
              style={{
                fontFamily: 'AIA Everest', fontWeight: awardTab === t.key ? 700 : 500,
                backgroundColor: awardTab === t.key ? '#1F78AD' : '#fff',
                color: awardTab === t.key ? '#fff' : '#6B7180',
                border: `1px solid ${awardTab === t.key ? '#1F78AD' : '#E8E9ED'}`,
              }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── Individual award panels ── */}

      {awardTab === 'rookies' && (() => {
        const list = getTopRookies(agents, abbr, 5);
        return list.length === 0
          ? <EmptyState title="No Rookie data" message="No Rookie advisors found for this month." />
          : <RankScoreList items={list} title="Top 5 Rookie Advisors" abbr={abbr} />;
      })()}

      {awardTab === 'overall' && (() => {
        const list = getTopOverall(agents, abbr, 5);
        return list.length === 0
          ? <EmptyState title="No data" message="No advisor data for this month." />
          : <RankScoreList items={list} title="Top 5 Overall Advisors" abbr={abbr} />;
      })()}

      {awardTab === 'mta' && (() => {
        const list = getMostTrustedAdvisors(agents, abbr);
        return list.length === 0
          ? <EmptyState title="No MTA qualifiers" message="No advisors with 2 or more cases this month." />
          : (
            <RankedTable
              title="Most Trusted Advisors (MTA)"
              subtitle="Monthly case count ≥ 2"
              rows={list}
              columns={[
                { label: 'Advisor', render: r => r.agent.name },
                { label: 'Unit',    render: r => r.agent.unitName || '—' },
                { label: 'Cases',   render: r => r.cases, align: 'right' },
                { label: 'FYP',     render: r => formatCurrency(r.fyp, true), align: 'right' },
                { label: 'FYC',     render: r => formatCurrency(r.fyc, true), align: 'right' },
              ]}
            />
          );
      })()}

      {awardTab === 'mpa' && (() => {
        const list = getMostProductiveAdvisors(agents, abbr);
        return list.length === 0
          ? <EmptyState title="No MPA qualifiers" message="No advisors with FYC > ₱20,000 this month." />
          : (
            <RankedTable
              title="Most Productive Advisors (MPA)"
              subtitle="Monthly FYC > ₱20,000"
              rows={list}
              columns={[
                { label: 'Advisor', render: r => r.agent.name },
                { label: 'Unit',    render: r => r.agent.unitName || '—' },
                { label: 'FYC',     render: r => formatCurrency(r.fyc, true), align: 'right' },
                { label: 'FYP',     render: r => formatCurrency(r.fyp, true), align: 'right' },
                { label: 'Cases',   render: r => r.cases, align: 'right' },
              ]}
            />
          );
      })()}

      {awardTab === 'consistent' && (() => {
        const list = getConsistentProducers(agents, monthIdx, consistentGapFree);
        return (
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <p className="text-sm font-bold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
                  Consistent Monthly Producers
                </p>
                <p className="text-[11px]" style={{ color: '#6B7180', fontFamily: 'AIA Everest' }}>
                  {consistentGapFree ? 'Produced every month Jan → selected' : 'All producers, sorted by month count'}
                </p>
              </div>
              <button
                onClick={() => setConsistentGapFree(v => !v)}
                className="text-xs px-3 py-1.5 rounded border transition-colors"
                style={{ fontFamily: 'AIA Everest', fontWeight: 600, borderColor: '#D31145', color: '#D31145', backgroundColor: '#fff' }}
              >
                {consistentGapFree ? 'Show All Producers' : 'Show No-Gap Only'}
              </button>
            </div>
            {list.length === 0
              ? <EmptyState title="No consistent producers" message="No advisors produced in every month up to the selected month." />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {['Rank','Advisor','Unit','Producing Months'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r, i) => (
                        <tr key={r.agent.code} className="border-b border-gray-50 even:bg-gray-50">
                          <td className="py-2 px-3 font-bold text-gray-500">{i + 1}</td>
                          <td className="py-2 px-3 text-gray-700 font-medium">{r.agent.name}</td>
                          <td className="py-2 px-3 text-gray-500 text-[11px]">{r.agent.unitName || '—'}</td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-[#D31145]">{r.producingMonths}</span>
                            <span className="text-gray-400 text-[11px]"> of {r.totalMonths} months</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        );
      })()}

      {awardTab === 'builders' && (() => {
        const list = getAgencyBuilders(agents, abbr);
        return list.length === 0
          ? <EmptyState title="No new recruits" message="No new recruits licensed this month." />
          : (
            <RankedTable
              title="Agency Builders"
              subtitle="Most new recruits licensed this month"
              rows={list}
              columns={[
                { label: 'Recruiter',   render: r => r.recruiterName },
                { label: 'Unit',        render: r => {
                  const ag = agents.find(a => a.code === r.recruiterCode);
                  return ag?.unitName || '—';
                }},
                { label: 'New Recruits', render: r => r.count, align: 'right' },
                { label: 'Names',        render: r => r.recruits.slice(0, 3).join(', ') + (r.recruits.length > 3 ? ` +${r.recruits.length - 3}` : '') },
              ]}
            />
          );
      })()}

      {/* ── Unit award panels ── */}

      {awardTab === 'unit-fyp' && (
        <UnitAwardList title="Top 3 Units — Team FYP" units={unitAwards.topByFyp}
          valueLabel="FYP" getValue={u => formatCurrency(u.fyp, true)} />
      )}
      {awardTab === 'unit-recruitment' && (
        <UnitAwardList title="Top Unit — Recruitment" units={unitAwards.topByRecruitment}
          valueLabel="New Recruits" getValue={u => u.newRecruits} />
      )}
      {awardTab === 'unit-producing' && (
        <UnitAwardList title="Top 3 Units — Producing Advisors" units={unitAwards.topByProducing}
          valueLabel="Producing Advisors" getValue={u => u.producing} />
      )}
      {awardTab === 'unit-cases' && (
        <UnitAwardList title="Top 3 Units — Case Count" units={unitAwards.topByCases}
          valueLabel="Cases" getValue={u => u.cases} />
      )}
    </div>
  );
}

function RankScoreList({ items, title, abbr }) {
  return (
    <div>
      <p className="text-sm font-bold mb-3" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{title}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.agent.code} className="bg-white rounded-xl p-4 flex items-center gap-3"
            style={{ border: '1px solid #E8E9ED' }}>
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: i === 0 ? '#C97B1A' : i === 1 ? '#B0B3BC' : i === 2 ? '#CD7F32' : '#D31145', fontFamily: 'AIA Everest' }}>
              {i + 1}
            </div>
            <AgentAvatar agentCode={item.agent.code} name={item.agent.name} size={36} className="!rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{item.agent.name}</p>
              <p className="text-[10px]" style={{ color: '#6B7180', fontFamily: 'AIA Everest' }}>{item.agent.unitName || '—'}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {[
                { label: 'FYP',   value: formatCurrency(item.fyp, true) },
                { label: 'Cases', value: item.cases },
                { label: 'ANP',   value: formatCurrency(item.anp, true) },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-[9px] text-gray-400 uppercase" style={{ fontFamily: 'AIA Everest' }}>{label}</p>
                  <p className="text-xs font-bold text-gray-700" style={{ fontFamily: 'DM Mono, monospace' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankedTable({ title, subtitle, rows, columns }) {
  return (
    <div>
      <p className="text-sm font-bold mb-0.5" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{title}</p>
      {subtitle && <p className="text-[11px] mb-3" style={{ color: '#6B7180', fontFamily: 'AIA Everest' }}>{subtitle}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">Rank</th>
              {columns.map(c => (
                <th key={c.label} className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 even:bg-gray-50">
                <td className="py-2 px-3 font-bold text-gray-500">{i + 1}</td>
                {columns.map(c => (
                  <td key={c.label} className={`py-2 px-3 ${c.align === 'right' ? 'text-right' : ''} text-gray-700`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UnitAwardList({ title, units, valueLabel, getValue }) {
  return (
    <div>
      <p className="text-sm font-bold mb-3" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{title}</p>
      <div className="space-y-2">
        {units.map((u, i) => (
          <div key={u.unitCode || i} className="bg-white rounded-xl p-4 flex items-center gap-3"
            style={{ border: '1px solid #E8E9ED' }}>
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: i === 0 ? '#C97B1A' : '#1F78AD', fontFamily: 'AIA Everest' }}>
              {i + 1}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{u.unitName}</p>
            </div>
            <p className="text-sm font-bold" style={{ fontFamily: 'DM Mono, monospace', color: '#D31145' }}>
              {getValue(u)} <span className="text-[10px] text-gray-400 font-normal">{valueLabel}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HighlightsTab({ monthIdx }) {
  const { data, targets } = useData();
  const agents   = data?.agents || [];
  const mdrtGoal = targets?.mdrt_goal || 3518400;

  if (agents.length === 0) {
    return <EmptyState title="No data available" message="Upload data to see highlights." />;
  }

  const pathToMdrt = getPathToMdrt(agents, monthIdx, mdrtGoal);
  const leaderGama = getLeaderGamaProgress(agents, monthIdx);
  const agencyGama = getAgencyGamaStatus(agents, monthIdx);

  // Agency Ace Challenge
  const ACE_FYC = 300000, ACE_CASES = 24, ACE_PERS = 82.5;
  const aceAdvisors = agents
    .filter(a => a.manpowerInd)
    .map(a => {
      const ytdFyc   = MONTH_ABBRS.slice(0, monthIdx + 1).reduce((s, abbr) => s + (a.monthly?.[abbr]?.fyc   || 0), 0);
      const ytdCases = MONTH_ABBRS.slice(0, monthIdx + 1).reduce((s, abbr) => s + (a.monthly?.[abbr]?.cases || 0), 0);
      const persVals = MONTH_ABBRS.slice(0, monthIdx + 1)
        .map(abbr => a.monthly?.[abbr]?.persistency)
        .filter(v => v != null && !isNaN(v));
      const avgPers   = persVals.length > 0 ? persVals.reduce((s, v) => s + v, 0) / persVals.length : null;
      const fycMet    = ytdFyc   >= ACE_FYC;
      const casesMet  = ytdCases >= ACE_CASES;
      const persMet   = avgPers == null || avgPers >= ACE_PERS;
      const qualified = fycMet && casesMet && persMet;
      return { agent: a, ytdFyc, ytdCases, avgPers, fycMet, casesMet, persMet, qualified };
    })
    .sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      return b.ytdFyc - a.ytdFyc;
    });

  const qualCount = aceAdvisors.filter(x => x.qualified).length;

  return (
    <div className="space-y-8">

      {/* ── 1. Agency GAMA Status — TOP ── */}
      <section>
        <h2 className="text-sm font-bold mb-3" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
          Agency GAMA Status
        </h2>
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #E8E9ED' }}>
          <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#6B7180', fontFamily: 'AIA Everest' }}>Total Agency YTD FYP</p>
              <p className="text-2xl font-extrabold" style={{ fontFamily: 'DM Mono, monospace', color: '#1C1C28' }}>{formatCurrency(agencyGama.totalFyp)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#6B7180', fontFamily: 'AIA Everest' }}>Current Tier</p>
              <span className="text-sm font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700" style={{ fontFamily: 'AIA Everest' }}>{agencyGama.tier.label}</span>
            </div>
          </div>
          {agencyGama.nextTier && (() => {
            const pct = Math.min(100, (agencyGama.totalFyp / agencyGama.nextTier.min) * 100);
            return (
              <>
                <div className="flex justify-between text-[11px] mb-1" style={{ fontFamily: 'AIA Everest' }}>
                  <span style={{ color: '#6B7180' }}>Progress to <strong style={{ color: '#1F78AD' }}>{agencyGama.nextTier.label}</strong></span>
                  <span className="font-bold" style={{ color: '#1F78AD' }}>{pct.toFixed(1)}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden mb-1.5" style={{ backgroundColor: '#EFF6FF' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: '#1F78AD' }} />
                </div>
                <p className="text-[11px]" style={{ fontFamily: 'AIA Everest', color: '#6B7180' }}>
                  Balance: <span className="font-bold" style={{ color: '#D31145', fontFamily: 'DM Mono, monospace' }}>{formatCurrency(agencyGama.balance)}</span> more to reach {agencyGama.nextTier.label}
                </p>
              </>
            );
          })()}
          {!agencyGama.nextTier && (
            <p className="text-sm font-bold mt-1" style={{ fontFamily: 'AIA Everest', color: '#4E9A51' }}>🏆 GAMA Platinum achieved!</p>
          )}
        </div>
      </section>

      {/* ── 2. Agency Ace Challenge ── */}
      <section>
        <h2 className="text-sm font-bold mb-1" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
          Agency Ace Challenge
        </h2>
        <p className="text-[11px] mb-3" style={{ color: '#6B7180', fontFamily: 'AIA Everest' }}>
          Individual annual award · FYC ≥ ₱300,000 · Cases ≥ 24 · Persistency ≥ 82.5%
          {' '}· <strong style={{ color: '#4E9A51' }}>{qualCount}</strong> of {aceAdvisors.length} on track
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Advisor', 'Unit', 'FYC YTD', 'Cases YTD', 'Persistency', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aceAdvisors.map(({ agent: a, ytdFyc, ytdCases, avgPers, fycMet, casesMet, persMet, qualified }) => (
                <tr key={a.code} className="border-b border-gray-50 even:bg-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 px-3 text-gray-700 font-medium text-[12px]">{a.name}</td>
                  <td className="py-2 px-3 text-gray-500 text-[11px]">{a.unitName || '—'}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-10 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ backgroundColor: '#F2F3F5' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, ytdFyc / ACE_FYC * 100)}%`, backgroundColor: fycMet ? '#4E9A51' : '#D31145' }} />
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: fycMet ? '#4E9A51' : '#1C1C28' }}>
                        ₱{Math.round(ytdFyc / 1000)}k
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-[11px] font-medium" style={{ color: casesMet ? '#4E9A51' : '#1C1C28' }}>{ytdCases}</span>
                  </td>
                  <td className="py-2 px-3">
                    {avgPers != null
                      ? <span className="text-[11px] font-medium" style={{ color: persMet ? '#4E9A51' : '#1C1C28' }}>{avgPers.toFixed(1)}%</span>
                      : <span className="text-[11px] text-gray-300">—</span>}
                  </td>
                  <td className="py-2 px-3">
                    {qualified
                      ? <span className="text-[10px] font-bold rounded px-1.5 py-0.5" style={{ backgroundColor: '#EAF4EB', color: '#4E9A51' }}>✓ On Track</span>
                      : <span className="text-[10px] rounded px-1.5 py-0.5" style={{ backgroundColor: '#F2F3F5', color: '#6B7180' }}>In Progress</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 3. Path to MDRT — top 15 + progress bars ── */}
      <section>
        <h2 className="text-sm font-bold mb-1" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
          Path to MDRT
        </h2>
        <p className="text-[11px] mb-3" style={{ color: '#6B7180', fontFamily: 'AIA Everest' }}>
          Top 15 by YTD FYP · Goal: ₱{mdrtGoal.toLocaleString()} · sorted by % of goal
        </p>
        <div className="space-y-2">
          {pathToMdrt.slice(0, 15).map(({ agent, tier, ytdFyp, pct, balanceToNext }, i) => {
            const colors   = TIER_COLORS[tier.key] || TIER_COLORS.sa;
            const barColor = pct >= 1 ? '#4E9A51' : pct >= 0.7 ? '#C97B1A' : '#D31145';
            return (
              <div key={agent.code} className="bg-white rounded-xl p-3" style={{ border: '1px solid #E8E9ED' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold w-5 text-center flex-shrink-0" style={{ fontFamily: 'AIA Everest', color: '#6B7180' }}>{i + 1}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: colors.bg, color: colors.text }}>{tier.abbr}</span>
                  <span className="text-xs font-bold truncate flex-1" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{agent.name}</span>
                  <span className="text-[10px] text-gray-500 flex-shrink-0 hidden sm:block">{agent.unitName || '—'}</span>
                  <span className="text-xs font-bold flex-shrink-0" style={{ fontFamily: 'DM Mono, monospace', color: barColor }}>{(pct * 100).toFixed(1)}%</span>
                </div>
                <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F2F3F5' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, pct * 100)}%`, backgroundColor: barColor }} />
                  {/* 70% Aspirant marker */}
                  <div className="absolute top-0 bottom-0 w-px opacity-40" style={{ left: '70%', backgroundColor: '#C97B1A' }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px]" style={{ fontFamily: 'DM Mono, monospace', color: '#6B7180' }}>{formatCurrency(ytdFyp, true)} YTD</span>
                  {balanceToNext > 0 && (
                    <span className="text-[9px]" style={{ fontFamily: 'AIA Everest', color: '#6B7180' }}>{formatCurrency(balanceToNext, true)} to next tier</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 4. Leader GAMA Progress — with progress bars ── */}
      <section>
        <h2 className="text-sm font-bold mb-1" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
          Leader GAMA Progress
        </h2>
        <p className="text-[11px] mb-3" style={{ color: '#6B7180', fontFamily: 'AIA Everest' }}>
          YTD unit FYP vs GAMA qualification tiers
        </p>
        <div className="space-y-2">
          {leaderGama.map(({ unitName, ytdFyp, tier, nextTier, balance }) => {
            const barPct = nextTier ? Math.min(100, (ytdFyp / nextTier.min) * 100) : 100;
            return (
              <div key={unitName} className="bg-white rounded-xl p-3" style={{ border: '1px solid #E8E9ED' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: '#DBEAFE', color: '#1F78AD', fontFamily: 'AIA Everest' }}>{tier.label}</span>
                  <span className="text-xs font-bold truncate flex-1" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{unitName}</span>
                  <span className="text-xs font-bold flex-shrink-0" style={{ fontFamily: 'DM Mono, monospace', color: '#1F78AD' }}>{formatCurrency(ytdFyp, true)}</span>
                </div>
                <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#EFF6FF' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%`, backgroundColor: '#1F78AD' }} />
                </div>
                {nextTier ? (
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[9px]" style={{ fontFamily: 'AIA Everest', color: '#6B7180' }}>{barPct.toFixed(1)}% to {nextTier.label}</span>
                    {balance > 0 && <span className="text-[9px]" style={{ fontFamily: 'DM Mono, monospace', color: '#6B7180' }}>{formatCurrency(balance, true)} needed</span>}
                  </div>
                ) : (
                  <p className="text-[9px] mt-0.5 font-bold" style={{ color: '#4E9A51', fontFamily: 'AIA Everest' }}>🏆 GAMA Platinum!</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="text-center py-16">
      <p className="text-sm font-bold mb-1" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{title}</p>
      <p className="text-xs" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'AIA Everest' }}>{message}</p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getActivationStatus(agent) {
  const hasFastStart = agent?.fastStart === true || agent?.fastStartQualified === true;
  const isActivated = (agent?.totalCases || 0) > 0 || (agent?.totalFyp || 0) > 0;
  if (hasFastStart) return 'Fast Start';
  if (isActivated) return 'Activated';
  return 'Not Yet';
}
