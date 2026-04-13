import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

const NAV_LINKS = [
  { label: 'Overview', to: '/overview' },
  { label: 'Leaderboard', to: '/leaderboard' },
  { label: 'Quarter Bonuses', to: '/quarterly-bonus' },
  { label: '90 Day Ascent', to: '/activation' },
  { label: 'Units', to: '/units' },
  { label: 'Agents', to: '/agents' },
  { label: 'Targets', to: '/targets' },
  { label: 'Awards', to: '/awards' },
  { label: 'Bulletin', to: '/bulletin' },
  { label: 'Highlights', to: '/highlights' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { clearData } = useData();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleUploadNew = () => {
    navigate('/');
  };

  return (
    <nav
      className="w-full sticky top-0 z-50"
      style={{
        backgroundColor: '#D31145',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div className="max-w-screen-xl mx-auto px-5 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex flex-col leading-none select-none">
            <span className="text-white font-extrabold text-base tracking-tight leading-snug">
              Amora Assurance Agency
            </span>
            <span className="text-white/70 text-[10px] font-semibold tracking-wide">
              of AIA Philippines
            </span>
          </div>
        </div>

        {/* Desktop nav links + Upload button */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'text-white text-sm font-medium px-3.5 py-1.5 rounded-md transition-all duration-150',
                  isActive
                    ? 'bg-white/10 underline underline-offset-[6px] decoration-2'
                    : 'hover:bg-white/10',
                ].join(' ')
              }
            >
              {label}
            </NavLink>
          ))}

          <button
            onClick={handleUploadNew}
            className="ml-5 text-white text-xs font-semibold border border-white/80 rounded-md px-4 py-1.5 hover:bg-white hover:text-[#D31145] transition-colors duration-150 flex-shrink-0"
          >
            Upload New
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white focus:outline-none"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="md:hidden px-5 pb-4 pt-2 flex flex-col gap-1"
          style={{ backgroundColor: '#b80e3a' }}
        >
          {NAV_LINKS.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                [
                  'text-white text-sm font-medium px-3.5 py-2.5 rounded-md transition-colors duration-150',
                  isActive
                    ? 'bg-white/15 underline underline-offset-[6px] decoration-2 font-semibold'
                    : 'hover:bg-white/10',
                ].join(' ')
              }
            >
              {label}
            </NavLink>
          ))}
          <button
            onClick={() => {
              setMenuOpen(false);
              handleUploadNew();
            }}
            className="mt-2 text-white text-xs font-semibold border border-white/80 rounded-md px-4 py-2.5 hover:bg-white hover:text-[#D31145] transition-colors duration-150 text-left"
          >
            Upload New
          </button>
        </div>
      )}
    </nav>
  );
}
