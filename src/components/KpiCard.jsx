/**
 * KpiCard — premium metric display card for the AIA Agency Dashboard.
 *
 * Props:
 *   title     {string}                       — e.g. "ANP MTD"
 *   value     {string|number}                — e.g. "₱4,250,000" or 142
 *   subtitle  {string}                       — optional secondary line, e.g. "vs last month: +12%"
 *   trend     {'up'|'down'|'neutral'}        — optional trend arrow with color
 *   color     {'red'|'blue'|'green'|'gray'}  — accent color (default 'red')
 *   icon      {string}                       — optional emoji / unicode icon in top-right
 *   className {string}                       — optional extra classes on the outer wrapper
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

export default function KpiCard({
  title,
  value,
  subtitle,
  trend,
  color = 'red',
  icon,
  className = '',
}) {
  const accentClass = ACCENT_COLORS[color] ?? ACCENT_COLORS.red;
  const trendMeta = trend ? TREND_CONFIG[trend] : null;

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
      <div className="text-2xl font-bold text-[#333D47] leading-tight truncate tabular-nums">
        {value !== null && value !== undefined && value !== '' ? value : '\u2014'}
      </div>

      {/* Subtitle + trend indicator */}
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
