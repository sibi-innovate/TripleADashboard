// RecognitionPage — Phase 6 implementation
// Sub-tabs: Birthdays | New Advisors | Awards | Highlights
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { MONTH_LABELS, MONTH_ABBRS, CURRENT_MONTH_IDX } from '../constants';

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
  const { agents } = useData();

  const hasBirthDateData = agents?.some(a => a.birthDate);
  if (!hasBirthDateData) {
    return (
      <EmptyState
        title="Birth date data not available"
        message="Upload a data file that includes the BIRTH_DATE column to enable birthday celebrations."
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
            <div
              className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-base font-bold text-white"
              style={{ backgroundColor: isToday ? '#D31145' : 'var(--char-30, #B0B3BC)', fontFamily: 'AIA Everest' }}
            >
              {initials(a.name)}
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
  const { agents } = useData();

  const newAdvisors = (agents || []).filter(a => {
    if (!a.appointmentDate) return false;
    const d = new Date(a.appointmentDate);
    return !isNaN(d) && d.getMonth() === monthIdx;
  });

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
            <div
              className="w-10 h-10 rounded-full mb-2 flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: '#1F78AD', fontFamily: 'AIA Everest' }}
            >
              {initials(a.name)}
            </div>
            <p className="text-xs font-bold leading-snug" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{a.name}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'AIA Everest' }}>{a.unit || '—'}</p>
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

function AwardsTab({ monthIdx }) {
  const { agents, targets } = useData();
  const mdrtGoal = targets?.mdrt_goal || 3518400;

  const qualified = (agents || []).filter(a => getAgentYtdFyp(a, monthIdx) >= mdrtGoal);
  const aspirant  = (agents || []).filter(a => {
    const fyp = getAgentYtdFyp(a, monthIdx);
    return fyp >= mdrtGoal * 0.30 && fyp < mdrtGoal;
  });

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-bold mb-3" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
          MDRT Achievers ({qualified.length})
        </h2>
        {qualified.length === 0
          ? <p className="text-xs" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'AIA Everest' }}>No MDRT Achievers yet for the selected period.</p>
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {qualified.map(a => <AwardCard key={a.code} agent={a} monthIdx={monthIdx} mdrtGoal={mdrtGoal} />)}
            </div>
          )
        }
      </section>
      <section>
        <h2 className="text-sm font-bold mb-3" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>
          MDRT Aspirants ({aspirant.length})
        </h2>
        {aspirant.length === 0
          ? <p className="text-xs" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'AIA Everest' }}>No MDRT Aspirants yet for the selected period.</p>
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {aspirant.map(a => <AwardCard key={a.code} agent={a} monthIdx={monthIdx} mdrtGoal={mdrtGoal} />)}
            </div>
          )
        }
      </section>
    </div>
  );
}

function AwardCard({ agent, monthIdx, mdrtGoal }) {
  const fyp = getAgentYtdFyp(agent, monthIdx);
  const pct = Math.min(100, Math.round((fyp / mdrtGoal) * 100));
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border, #E8E9ED)' }}>
      <div
        className="w-10 h-10 rounded-full mb-2 flex items-center justify-center text-sm font-bold text-white"
        style={{ backgroundColor: pct >= 100 ? '#C97B1A' : '#D31145', fontFamily: 'AIA Everest' }}
      >
        {initials(agent.name)}
      </div>
      <p className="text-xs font-bold leading-snug" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{agent.name}</p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'AIA Everest' }}>{agent.unit || '—'}</p>
      <p className="text-xs font-bold mt-1 font-mono" style={{ color: '#D31145', fontFamily: 'DM Mono, monospace' }}>
        ₱{fyp.toLocaleString()}
      </p>
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--char-10, #F2F3F5)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? '#C97B1A' : '#D31145',
          }}
        />
      </div>
      <p className="text-[9px] mt-1 font-mono" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'DM Mono, monospace' }}>{pct}% of MDRT goal</p>
    </div>
  );
}

function HighlightsTab({ monthIdx }) {
  const { agents } = useData();
  if (!agents || agents.length === 0) {
    return <EmptyState title="No data available" message="Upload data to see monthly highlights." />;
  }

  const sorted = [...agents].sort((a, b) => getAgentMonthFyp(b, monthIdx) - getAgentMonthFyp(a, monthIdx));
  const topFyp = sorted[0];
  const topRookie = [...agents]
    .filter(a => a.segment === 'Rookie')
    .sort((a, b) => getAgentMonthFyp(b, monthIdx) - getAgentMonthFyp(a, monthIdx))[0];
  const topRecruiter = [...agents]
    .sort((a, b) => (b.activatedRecruitsCount || 0) - (a.activatedRecruitsCount || 0))[0];

  // Top unit by total FYP
  const unitFyp = {};
  agents.forEach(a => {
    if (!a.unit) return;
    unitFyp[a.unit] = (unitFyp[a.unit] || 0) + getAgentMonthFyp(a, monthIdx);
  });
  const topUnit = Object.entries(unitFyp).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <HighlightCard title="Top Producer" agent={topFyp} value={topFyp ? `₱${getAgentMonthFyp(topFyp, monthIdx).toLocaleString()}` : null} />
      <HighlightCard title="Top Rookie" agent={topRookie} value={topRookie ? `₱${getAgentMonthFyp(topRookie, monthIdx).toLocaleString()}` : null} />
      <HighlightCard title="Top Recruiter" agent={topRecruiter} value={topRecruiter ? `${topRecruiter.activatedRecruitsCount || 0} activated recruits` : null} />
      {topUnit && (
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border, #E8E9ED)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'AIA Everest' }}>Top Unit</p>
          <p className="text-sm font-bold" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{topUnit[0]}</p>
          <p className="text-base font-bold mt-1" style={{ fontFamily: 'DM Mono, monospace', color: '#D31145' }}>₱{topUnit[1].toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

function HighlightCard({ title, agent, value }) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid var(--border, #E8E9ED)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'AIA Everest' }}>{title}</p>
      {agent ? (
        <>
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: '#D31145', fontFamily: 'AIA Everest' }}
            >
              {initials(agent.name)}
            </div>
            <div>
              <p className="text-sm font-bold leading-snug" style={{ fontFamily: 'AIA Everest', color: '#1C1C28' }}>{agent.name}</p>
              <p className="text-[10px]" style={{ color: 'var(--char-60, #6B7180)', fontFamily: 'AIA Everest' }}>{agent.unit || '—'}</p>
            </div>
          </div>
          {value && (
            <p className="text-base font-bold mt-2" style={{ fontFamily: 'DM Mono, monospace', color: '#D31145' }}>{value}</p>
          )}
        </>
      ) : (
        <p className="text-xs" style={{ color: 'var(--char-30, #B0B3BC)', fontFamily: 'AIA Everest' }}>—</p>
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

function getAgentYtdFyp(agent, upToMonthIdx) {
  if (!agent?.monthly) return 0;
  return MONTH_ABBRS.slice(0, upToMonthIdx + 1).reduce((sum, abbr) => {
    return sum + (agent.monthly[abbr]?.fyp || 0);
  }, 0);
}

function getAgentMonthFyp(agent, monthIdx) {
  if (!agent?.monthly) return 0;
  const abbr = MONTH_ABBRS[monthIdx];
  return agent.monthly[abbr]?.fyp || 0;
}

function getActivationStatus(agent) {
  const hasFastStart = agent?.fastStart === true || agent?.fastStartQualified === true;
  const isActivated = (agent?.totalCases || 0) > 0 || (agent?.totalFyp || 0) > 0;
  if (hasFastStart) return 'Fast Start';
  if (isActivated) return 'Activated';
  return 'Not Yet';
}
