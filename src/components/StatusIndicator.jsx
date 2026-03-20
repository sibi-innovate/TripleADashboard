/**
 * StatusIndicator — AIA Design System semantic status component.
 * Use for agent status (active/inactive), qualification status, progress states.
 * NOT for segment labels — use Tag for that.
 *
 * Status values:
 *   'positive' — green: active, producing, qualified, on track
 *   'warning'  — yellow: borderline, attention needed (1–2 mo inactive)
 *   'negative' — cerise/red: inactive, not producing, missed target (3+ mo)
 *   'info'     — blue: in progress, pending
 *   'neutral'  — charcoal: resolved, N/A, no data
 */

const STATUS_CONFIG = {
  positive: { color: '#88B943', label: 'Active' },
  warning:  { color: '#F7C926', label: 'Warning' },
  negative: { color: '#D31145', label: 'Inactive' },
  info:     { color: '#1F78AD', label: 'In Progress' },
  neutral:  { color: '#848A90', label: 'N/A' },
};

export default function StatusIndicator({ status = 'neutral', label, className = '' }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.neutral;
  const displayLabel = label ?? config.label;

  return (
    <span className={['inline-flex items-center gap-1.5 text-xs font-medium', className].filter(Boolean).join(' ')}>
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: config.color }}
        aria-hidden="true"
      />
      <span style={{ color: config.color }}>{displayLabel}</span>
    </span>
  );
}
