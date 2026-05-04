// RecognitionPage — Phase 6 implementation
// Sub-tabs: Birthdays | New Advisors | Awards | Highlights
import { useState, useEffect } from 'react';
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
  { key: 'buddy-system', label: 'Buddy System' },
];

// Buddy pairs for the April challenge — matched by partial name (case-insensitive)
const BUDDY_PAIRS = [
  ['Rogelio Lu',        'Camille Llanera'],
  ['Justin Galindo',    'Andrea Sevilla'],
  ['Clarizza Ramos',    'Divine Ceballos'],
  ['Jonalyn Hermocilla','Rochelle Tallorin'],
  ['Joy Guerra',        'Justine Mari Bio'],
  ['Faivel Inres',      'Michael Davis'],
  ['Joemar Punzalan',   'Jervy Ocquiola'],
  ['Christine Guiang',  'Jeanne Marie Sarigumba'],
  ['Zivie Amora',       'Jose Luis Galay'],
];

export default function RecognitionPage() {
  const { setRecognitionMonthIdx, activeAgents } = useData();
  const [activeTab, setActiveTab] = useState('highlights');
  const [monthIdx, setMonthIdx] = useState(CURRENT_MONTH_IDX);
  useEffect(() => { setRecognitionMonthIdx(monthIdx) }, [monthIdx])

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
        {activeTab === 'buddy-system' && <BuddySystemTab monthIdx={monthIdx} />}
      </div>
    </div>
  );
}

// ─── Sub-tab components ──────────────────────────────────────────────────────

function BirthdaysTab({ monthIdx }) {
  const { activeAgents } = useData();
  const agents = activeAgents;

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
  const isCurrentMonth = monthIdx === today.getMonth();
  const todayDay = today.getDate();

  // Build card renderer
  const renderCard = (a, isToday) => {
    const d = new Date(a.birthDate);
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
            TODAY 🎂
          </span>
        )}
      </div>
    );
  };

  if (!isCurrentMonth) {
    // Non-current month: just sort by day ascending
    const sorted = [...celebrants].sort((a, b) => new Date(a.birthDate).getDate() - new Date(b.birthDate).getDate());
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {sorted.map(a => renderCard(a, false))}
      </div>
    );
  }

  // Current month: split into groups
  const todayGroup    = celebrants.filter(a => new Date(a.birthDate).getDate() === todayDay);
  const upcomingGroup = celebrants.filter(a => new Date(a.birthDate).getDate() > todayDay)
                                  .sort((a, b) => new Date(a.birthDate).getDate() - new Date(b.birthDate).getDate());
  const passedGroup   = celebrants.filter(a => new Date(a.birthDate).getDate() < todayDay)
                                  .sort((a, b) => new Date(a.birthDate).getDate() - new Date(b.birthDate).getDate());

  const SectionLabel = ({ label, color = '#6B7180' }) => (
    <div className="flex-shrink-0 flex flex-col items-center justify-center pr-1">
      <span
        className="text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color, fontFamily: 'AIA Everest' }}
      >
        {label}
      </span>
    </div>
  );

  const Divider = () => (
    <div className="flex-shrink-0 w-px self-stretch bg-[#E8E9ED] mx-1" />
  );

  const hasMultipleGroups = [todayGroup, upcomingGroup, passedGroup].filter(g => g.length > 0).length > 1;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 items-start">
      {/* Today */}
      {todayGroup.length > 0 && (
        <>
          {hasMultipleGroups && <SectionLabel label="Today" color="#D31145" />}
          {todayGroup.map(a => renderCard(a, true))}
        </>
      )}

      {/* Divider between Today and Upcoming */}
      {todayGroup.length > 0 && upcomingGroup.length > 0 && <Divider />}

      {/* Upcoming */}
      {upcomingGroup.length > 0 && (
        <>
          {hasMultipleGroups && <SectionLabel label="Upcoming" color="#1C1C28" />}
          {upcomingGroup.map(a => renderCard(a, false))}
        </>
      )}

      {/* Divider before Already Passed */}
      {(todayGroup.length > 0 || upcomingGroup.length > 0) && passedGroup.length > 0 && <Divider />}

      {/* Already Passed */}
      {passedGroup.length > 0 && (
        <>
          {hasMultipleGroups && <SectionLabel label="Passed" color="#B0B3BC" />}
          {passedGroup.map(a => renderCard(a, false))}
        </>
      )}
    </div>
  );
}

function NewAdvisorsTab({ monthIdx }) {
  const { activeAgents } = useData();
  const agents = activeAgents;

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
  const { targets, activeAgents } = useData();
  const agents   = activeAgents;
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
  const { targets, activeAgents } = useData();
  const agents   = activeAgents;
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
    .filter(a => a.ytdFyc > 0)           // no award if metric is 0
    .sort((a, b) => b.ytdFyc - a.ytdFyc) // top 15 by YTD FYC
    .slice(0, 15);

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
          Top 15 by YTD FYC · Annual thresholds: FYC ≥ ₱300,000 · Cases ≥ 24 · Persistency ≥ 82.5%
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

// ─── Buddy System Tab ─────────────────────────────────────────────────────────

const QUARTERLY_ABBRS = ['APR', 'MAY', 'JUN'];

function BuddySystemTab({ monthIdx }) {
  const { activeAgents } = useData();
  const abbr = MONTH_ABBRS[monthIdx];
  const monthLabel = MONTH_LABELS[monthIdx];

  function findAgent(buddyName) {
    const words = buddyName.toLowerCase().split(/\s+/).filter(Boolean);
    return activeAgents.find(a => {
      const n = (a.name || '').toLowerCase();
      return words.every(w => n.includes(w));
    }) || null;
  }

  function qtyCases(agent) {
    if (!agent) return 0;
    return QUARTERLY_ABBRS.reduce((s, ab) => s + (agent.monthly?.[ab]?.cases || 0), 0);
  }

  const pairs = BUDDY_PAIRS.map(([nameA, nameB], idx) => {
    const agentA = findAgent(nameA);
    const agentB = findAgent(nameB);
    const activeA = !!(agentA?.monthly?.[abbr]?.producing);
    const activeB = !!(agentB?.monthly?.[abbr]?.producing);
    const bothActive = activeA && activeB;
    // Quarterly: both have ≥3 cases across Apr–Jun
    const casesA = qtyCases(agentA);
    const casesB = qtyCases(agentB);
    const quarterlyQualified = casesA >= 3 && casesB >= 3;
    return { pairNum: idx + 1, nameA, nameB, agentA, agentB, activeA, activeB, bothActive, casesA, casesB, quarterlyQualified };
  });

  const activePairs  = pairs.filter(p => p.bothActive);
  const otherPairs   = pairs.filter(p => !p.bothActive);
  const monthlyWinners = activePairs.length;
  const quarterlyWinners = pairs.filter(p => p.quarterlyQualified).length;

  const PairCard = ({ p }) => {
    const { pairNum, nameA, nameB, agentA, agentB, activeA, activeB, bothActive, casesA, casesB, quarterlyQualified } = p;
    const noneActive = !activeA && !activeB;
    return (
      <div
        className="rounded-xl border shadow-sm overflow-hidden"
        style={{
          backgroundColor: bothActive ? '#F1FBF3' : '#fff',
          borderColor: bothActive ? '#A5D6A7' : noneActive ? '#FFCDD2' : '#FFE0B2',
          borderLeftWidth: 4,
          borderLeftColor: bothActive ? '#2E7D32' : noneActive ? '#D31145' : '#FF9800',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: bothActive ? '#2E7D32' : '#848A90' }}>
            Pair {pairNum}
          </span>
          <div className="flex items-center gap-1.5">
            {bothActive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#C8E6C9', color: '#1B5E20' }}>
                🍚 5 kg rice each
              </span>
            )}
            {quarterlyQualified && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E3F2FD', color: '#0D47A1' }}>
                🏆 +10 kg quarterly
              </span>
            )}
            {!bothActive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: noneActive ? '#FFEBEE' : '#FFF3E0',
                  color: noneActive ? '#C62828' : '#E65100',
                }}
              >
                {noneActive ? 'Neither Active' : 'One Active'}
              </span>
            )}
          </div>
        </div>

        {/* Members */}
        <div className="px-4 pb-3 flex flex-col gap-2">
          {[
            { name: nameA, agent: agentA, active: activeA, cases: casesA },
            { name: nameB, agent: agentB, active: activeB, cases: casesB },
          ].map(({ name, agent, active, cases }, j) => (
            <div key={j} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
                  {agent ? agent.name : name}
                </p>
                {agent ? (
                  <p className="text-[10px] truncate" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'AIA Everest' }}>
                    {agent.unitName || '—'} · {agent.segment} · Q cases: {cases}
                  </p>
                ) : (
                  <p className="text-[10px]" style={{ color: '#E65100', fontFamily: 'AIA Everest' }}>Not found in data</p>
                )}
              </div>
              <div
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: active ? '#2E7D32' : '#D31145' }}
              >
                {active ? '✓' : '✗'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
            Buddy System Challenge
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'AIA Everest' }}>
            {monthLabel} · April–June Quarter
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#E8F5E9', color: '#1B5E20', fontFamily: 'AIA Everest' }}>
            🍚 Monthly: {monthlyWinners}/{pairs.length} pairs · 5 kg rice
          </div>
          <div className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#E3F2FD', color: '#0D47A1', fontFamily: 'AIA Everest' }}>
            🏆 Quarterly: {quarterlyWinners}/{pairs.length} pairs · 10 kg rice
          </div>
        </div>
      </div>

      {/* Campaign rules */}
      <div className="mb-6 rounded-xl border p-4 grid sm:grid-cols-2 gap-4" style={{ backgroundColor: '#FAFAFA', borderColor: '#E8E9ED' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#848A90' }}>Monthly Category</p>
          <p className="text-xs font-semibold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>Both active in {monthLabel}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--char-60, #6B7180)' }}>🍚 5 kg of rice each</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#848A90' }}>Quarterly Category (Apr–Jun)</p>
          <p className="text-xs font-semibold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>Both reach 3 cases total (Apr+May+Jun)</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--char-60, #6B7180)' }}>🏆 10 kg of rice each</p>
        </div>
      </div>

      {/* Active pairs section */}
      {activePairs.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1" style={{ backgroundColor: '#A5D6A7' }} />
            <span className="text-xs font-bold uppercase tracking-widest px-2" style={{ color: '#2E7D32', fontFamily: 'AIA Everest' }}>
              ✓ Active Pairs — {activePairs.length}
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: '#A5D6A7' }} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activePairs.map(p => <PairCard key={p.pairNum} p={p} />)}
          </div>
        </div>
      )}

      {/* Other pairs section */}
      {otherPairs.length > 0 && (
        <div>
          {activePairs.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1" style={{ backgroundColor: '#E8E9ED' }} />
              <span className="text-xs font-bold uppercase tracking-widest px-2" style={{ color: '#848A90', fontFamily: 'AIA Everest' }}>
                Other Pairs — {otherPairs.length}
              </span>
              <div className="h-px flex-1" style={{ backgroundColor: '#E8E9ED' }} />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {otherPairs.map(p => <PairCard key={p.pairNum} p={p} />)}
          </div>
        </div>
      )}
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
