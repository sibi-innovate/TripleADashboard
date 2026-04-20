import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { CURRENT_MONTH_IDX } from '../constants';
import { exportFullReport } from '../utils/exportExcel';

// SVG icon set — AIA Qi monoline style, 16×16 viewBox
const Icons = {
  overview: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  ),
  team: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-2.761 2.239-5 5-5s5 2.239 5 5" />
      <circle cx="12" cy="5" r="2" />
      <path d="M15 14c0-2.209-1.343-4-3-4" />
    </svg>
  ),
  rankings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,12 5,7 9,9 15,3" />
      <polyline points="11,3 15,3 15,7" />
    </svg>
  ),
  targets: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="8" cy="8" r="3.5" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  recognition: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="8,1.5 10.09,6.26 15.27,6.9 11.5,10.47 12.55,15.6 8,13 3.45,15.6 4.5,10.47 0.73,6.9 5.91,6.26" />
    </svg>
  ),
  history: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,13 4,8 7,10 10,5 13,7 15,3" />
      <line x1="1" y1="13" x2="15" y2="13" />
    </svg>
  ),
  more: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="8" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  upload: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1v8M4 4l3-3 3 3M2 10v2a1 1 0 001 1h8a1 1 0 001-1v-2" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
    </svg>
  ),
  download: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1v8M4 9l3 3 3-3M2 11v1a1 1 0 001 1h8a1 1 0 001-1v-1" />
    </svg>
  ),
};

// Tab definitions
const TABS = [
  { key: 'overview',    label: 'Overview',    icon: Icons.overview,    path: '/overview',       activePaths: ['/overview'] },
  { key: 'team',        label: 'Team',        icon: Icons.team,        path: '/agents',         activePaths: ['/agents', '/units', '/activation'] },
  { key: 'rankings',    label: 'Rankings',    icon: Icons.rankings,    path: '/leaderboard',    activePaths: ['/leaderboard'] },
  { key: 'goals',       label: 'Goals',       icon: Icons.targets,     path: '/goals',          activePaths: ['/goals', '/targets'] },
  { key: 'recognition', label: 'Recognition', icon: Icons.recognition, path: '/recognition',    activePaths: ['/recognition'] },
  { key: 'history',     label: 'History',     icon: Icons.history,     path: '/history',        activePaths: ['/history'] },
  { key: 'more',        label: 'Bonuses',     icon: Icons.more,        path: '/quarterly-bonus',activePaths: ['/quarterly-bonus', '/awards'] },
  { key: 'settings',    label: 'Settings',    icon: Icons.settings,    path: '/settings',       activePaths: ['/settings'] },
];

// Bottom nav (5 items, condensed)
const BOTTOM_TABS = [
  { key: 'overview',    label: 'Overview',    icon: Icons.overview,    path: '/overview',    activePaths: ['/overview'] },
  { key: 'team',        label: 'Team',        icon: Icons.team,        path: '/agents',      activePaths: ['/agents', '/units', '/activation'] },
  { key: 'rankings',    label: 'Rankings',    icon: Icons.rankings,    path: '/leaderboard', activePaths: ['/leaderboard'] },
  { key: 'goals',       label: 'Goals',       icon: Icons.targets,     path: '/goals',       activePaths: ['/goals', '/targets'] },
  { key: 'recognition', label: 'Recognition', icon: Icons.recognition, path: '/recognition', activePaths: ['/recognition'] },
];

function isTabActive(tab, pathname) {
  return tab.activePaths.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, targets } = useData();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAdmin(!!data?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAdmin(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleUpload = () => navigate('/', { state: { intentUpload: true } });

  return (
    <>
      {/* Top bar */}
      <div
        className="w-full sticky top-0 z-50"
        style={{ backgroundColor: '#D31145', boxShadow: '0 1px 0 rgba(0,0,0,0.12)' }}
      >
        <div className="h-12 flex items-center justify-between px-4 max-w-screen-xl mx-auto">
          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img
              src="/AIA Logo - White.png"
              alt="AIA"
              className="h-6 w-auto object-contain aia-logo-white"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
            <div className="flex flex-col leading-none select-none">
              <span
                className="text-white text-sm tracking-tight"
                style={{ fontFamily: 'AIA Everest', fontWeight: 800, lineHeight: 1.2 }}
              >
                Amora Assurance Agency
              </span>
              <span
                className="text-white/70 text-[10px] tracking-wide"
                style={{ fontFamily: 'AIA Everest', fontWeight: 500 }}
              >
                of AIA Philippines
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Download Report button — only shown when data is loaded */}
            {data && (
              <button
                onClick={() => exportFullReport(data, targets, CURRENT_MONTH_IDX)}
                className="flex items-center gap-1.5 text-white text-xs border border-white/70 rounded px-3 py-1.5 hover:bg-white/10 transition-colors duration-150"
                style={{ fontFamily: 'AIA Everest', fontWeight: 600 }}
              >
                {Icons.download}
                Download Report
              </button>
            )}
            {/* Upload button */}
            <button
              onClick={handleUpload}
              className="flex items-center gap-1.5 text-white text-xs border border-white/70 rounded px-3 py-1.5 hover:bg-white/10 transition-colors duration-150"
              style={{ fontFamily: 'AIA Everest', fontWeight: 600 }}
            >
              {Icons.upload}
              Upload
            </button>
          </div>
        </div>

        {/* Tab bar — scrollable */}
        <div
          className="flex overflow-x-auto scrollbar-none"
          style={{ backgroundColor: '#D31145', borderTop: '1px solid rgba(255,255,255,0.15)' }}
        >
          <div className="flex min-w-max px-2">
            {TABS.map(tab => {
              const active = isTabActive(tab, location.pathname);
              return (
                <button
                  key={tab.key}
                  onClick={() => navigate(tab.path)}
                  className="relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors duration-150 flex-shrink-0 whitespace-nowrap"
                  style={{
                    fontFamily: 'AIA Everest',
                    fontWeight: active ? 700 : 500,
                    color: active ? '#ffffff' : 'rgba(255,255,255,0.65)',
                    borderBottom: active ? '2px solid #ffffff' : '2px solid transparent',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.badge && badgeCount > 0 && (
                    <span
                      className="absolute top-1 right-1 min-w-[16px] h-4 text-[10px] font-bold text-white rounded-full flex items-center justify-center px-1"
                      style={{ backgroundColor: '#1C1C28', fontFamily: 'DM Mono, monospace' }}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom nav — mobile only */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{ backgroundColor: '#1C1C28', boxShadow: '0 -1px 0 rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-stretch h-16">
          {BOTTOM_TABS.map(tab => {
            const active = isTabActive(tab, location.pathname);
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.path)}
                className="flex-1 flex flex-col items-center justify-center gap-1 relative min-h-[44px] transition-colors duration-150"
                style={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.4)' }}
              >
                {tab.icon}
                <span
                  className="text-[9px] leading-none"
                  style={{ fontFamily: 'AIA Everest', fontWeight: active ? 700 : 500 }}
                >
                  {tab.label}
                </span>
                {tab.badge && badgeCount > 0 && (
                  <span
                    className="absolute top-2 right-[calc(50%-12px)] min-w-[14px] h-3.5 text-[9px] font-bold text-white rounded-full flex items-center justify-center px-1"
                    style={{ backgroundColor: '#D31145', fontFamily: 'DM Mono, monospace' }}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Safe area spacer for iOS */}
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </nav>

      {/* Bottom padding so content isn't hidden behind bottom nav on mobile */}
      <div className="md:hidden h-16" aria-hidden="true" />
    </>
  );
}
