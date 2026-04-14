/**
 * KpiCard — premium metric display card for the AIA Agency Dashboard.
 *
 * Props:
 *   title      {string}                          — e.g. "ANP MTD"
 *   value      {string|number}                   — e.g. "₱4,250,000" or 142
 *   subtitle   {string}                          — optional secondary line, e.g. "vs last month: +12%"
 *   trend      {Object|string}                   — optional trend arrow with color
 *     - new format: { value: string, direction: 'up'|'down'|'flat' }
 *     - legacy format: 'up'|'down'|'neutral'
 *   color      {'red'|'blue'|'green'|'gray'}     — accent color (default 'red')
 *   icon       {string}                          — optional emoji / unicode icon in top-right
 *   monospace  {boolean}                         — if true, render value in DM Mono monospace font
 *   className  {string}                          — optional extra classes on the outer wrapper
 */

const ACCENT_COLORS = {
  red:   'border-l-[#D31145]',
  blue:  'border-l-[#1F78AD]',
  green: 'border-l-[#88B943]',
  gray:  'border-l-[#848A90]',
};

const TREND_CONFIG = {
  up: {
    symbol: '\u2191',
    className: 'text-[#88B943]',
  },
  down: {
    symbol: '\u2193',
    className: 'text-[#D31145]',
  },
  neutral: {
    symbol: '\u2192',
    className: 'text-[#848A90]',
  },
};

// SVG icons for new trend format
const TREND_ICONS = {
  up: (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  down: (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <polyline points="18 9 12 15 6 9" />
    </svg>
  ),
  flat: (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
};

const TREND_COLORS = {
  up: 'text-[#4E9A51]',   // green
  down: 'text-[#D31145]', // red
  flat: 'text-[#B0B3BC]', // char-30
};

export default function KpiCard({
  title,
  value,
  subtitle,
  trend,
  color = 'red',
  icon,
  monospace = false,
  className = '',
}) {
  const accentClass = ACCENT_COLORS[color] ?? ACCENT_COLORS.red;

  // Handle both legacy (string) and new (object) trend formats
  const trendMeta = trend
    ? typeof trend === 'string'
      ? TREND_CONFIG[trend]
      : null
    : null;

  // Parse new trend object format
  const newTrendMeta =
    trend && typeof trend === 'object' && trend.value && trend.direction
      ? {
          value: trend.value,
          direction: trend.direction,
          icon: TREND_ICONS[trend.direction],
          colorClass: TREND_COLORS[trend.direction],
        }
      : null;

  return (
    <div
      className={[
        // Base card
        'bg-white rounded-xl border border-gray-100',
        'shadow-sm hover:shadow-md',
        'transition-shadow duration-200 ease-in-out',
        // Left accent — refined 3px border
        'border-l-[3px]',
        accentClass,
        // Spacing
        'px-5 py-4',
        'flex flex-col gap-1.5',
        'min-w-0',
        // Entrance animation
        'animate-fade-in-up',
        // Extra classes
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Header row: title + optional icon */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 leading-tight select-none truncate">
          {title}
        </span>
        {icon && (
          <span
            className="text-base leading-none flex-shrink-0 opacity-60"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>

      {/* Primary value */}
      <div
        className={[
          'text-2xl font-bold text-[#333D47] leading-tight truncate tabular-nums',
          monospace && 'font-mono',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value !== null && value !== undefined && value !== '' ? value : '\u2014'}
      </div>

      {/* Trend arrow (new format: below value) */}
      {newTrendMeta && (
        <div
          className={`text-[10px] font-semibold flex items-center gap-1 mt-1 ${newTrendMeta.colorClass}`}
          aria-label={`Trend: ${newTrendMeta.value} ${newTrendMeta.direction}`}
        >
          {newTrendMeta.icon}
          <span>{newTrendMeta.value}</span>
        </div>
      )}

      {/* Subtitle + legacy trend indicator */}
      {(subtitle || trendMeta) && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {trendMeta && (
            <span
              className={`text-xs font-semibold leading-none ${trendMeta.className}`}
              aria-label={`Trend: ${trend}`}
            >
              {trendMeta.symbol}
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-gray-400 truncate">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
