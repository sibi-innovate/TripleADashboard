import { useMemo } from 'react'
import { MONTH_SHORT } from '../constants'

// ---------------------------------------------------------------------------
// MonthlyBarChart
// ---------------------------------------------------------------------------
// Pure CSS/div bar chart — no Recharts dependency.
// Shows 12 months of data with:
//   - Past months: light pink bars
//   - Current month: AIA red bar
//   - Future months: dashed outline bars (target height if targetData provided)
//
// Props:
//   data            Array<{ month: string, value: number }>  (12 items, month = 'Jan')
//   currentMonthIdx number   0-based (e.g. 3 = April)
//   targetData      Array<{ month: string, value: number }> | null
//   height          number   chart area height px (default 80)
//   metric          string   label for metric (e.g. 'FYP', 'Cases')
//   onMetricChange  (metric) => void   optional
//   metricOptions   Array<string>      optional list for selector
//   formatValue     (value) => string  format function for bar labels
// ---------------------------------------------------------------------------

export default function MonthlyBarChart({
  data = [],
  currentMonthIdx = new Date().getMonth(),
  targetData = null,
  height = 80,
  metric = '',
  onMetricChange,
  metricOptions = [],
  formatValue = (v) => String(v),
}) {
  // Normalize: accept plain number[] or {month,value}[] interchangeably
  const normalized = useMemo(() =>
    data.map((d, i) =>
      typeof d === 'number'
        ? { month: MONTH_SHORT[i] ?? String(i + 1), value: d }
        : d
    ), [data])

  // Reserve 24px at top for value labels above bars
  const LABEL_RESERVE = 24
  const chartHeight = height - LABEL_RESERVE

  // --------------------------------------------------
  // Compute max value across actual + target data
  // --------------------------------------------------
  const maxValue = useMemo(() => {
    const actuals = normalized.map((d) => d.value ?? 0)
    const targets = targetData ? targetData.map((d) => d.value ?? 0) : []
    const all = [...actuals, ...targets]
    const m = Math.max(...all, 1) // at least 1 to avoid /0
    return m
  }, [normalized, targetData])

  // --------------------------------------------------
  // Build target lookup by month
  // --------------------------------------------------
  const targetMap = useMemo(() => {
    if (!targetData) return {}
    return Object.fromEntries(targetData.map((d) => [d.month, d.value ?? 0]))
  }, [targetData])

  // --------------------------------------------------
  // Bar height helper
  // --------------------------------------------------
  function barHeightPx(value) {
    if (!value || value <= 0) return 0
    const h = (value / maxValue) * chartHeight
    return Math.max(h, 4) // minimum 4px visible
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="bg-white border border-[#E8E9ED] rounded-xl p-4 shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-[#1C1C28] uppercase tracking-widest">
          {metric}
        </span>

        {metricOptions.length > 0 && typeof onMetricChange === 'function' && (
          <select
            value={metric}
            onChange={(e) => onMetricChange(e.target.value)}
            className="border border-[#E8E9ED] rounded-md text-[11px] px-2 py-1 text-[#1C1C28] bg-white focus:outline-none focus:ring-1 focus:ring-[#D31145] cursor-pointer"
          >
            {metricOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Bar area */}
      <div
        className="flex items-end gap-1"
        style={{ height: `${height}px` }}
      >
        {normalized.map((item, idx) => {
          const isPast = idx < currentMonthIdx
          const isCurrent = idx === currentMonthIdx
          const isFuture = idx > currentMonthIdx

          const actualValue = item.value ?? 0
          const targetValue = targetMap[item.month] ?? 0

          // Determine bar height
          let bh = 0
          if (isPast || isCurrent) {
            bh = barHeightPx(actualValue)
          } else {
            // Future: use target height if available, else minimal empty bar
            bh = targetValue > 0 ? barHeightPx(targetValue) : 4
          }

          // Value label: only show for past/current with non-zero values
          const showLabel = (isPast || isCurrent) && actualValue > 0

          // Bar styles
          let barStyle = {}
          let barClass = 'w-full rounded-t-sm'

          if (isPast) {
            barClass += ' bg-[#F6CCD9]'
          } else if (isCurrent) {
            barClass += ' bg-[#D31145]'
          } else {
            // Future — dashed outline, no solid fill
            barClass += ' bg-transparent border border-dashed border-[#B0B3BC] border-b-0'
          }

          // Month label style
          const monthLabelClass = isCurrent
            ? 'text-[9px] font-bold text-[#D31145]'
            : 'text-[9px] font-semibold text-[#6B7180]'

          return (
            <div
              key={item.month}
              className="flex flex-col items-center gap-0.5 flex-1"
              style={{ height: `${height}px` }}
            >
              {/* Top spacer + value label area (24px reserved) */}
              <div
                className="flex items-end justify-center w-full"
                style={{ height: `${LABEL_RESERVE}px` }}
              >
                {showLabel && (
                  <span className="text-[8px] font-mono text-[#6B7180] leading-none truncate max-w-full text-center">
                    {formatValue(actualValue)}
                  </span>
                )}
              </div>

              {/* Bar */}
              <div
                className={barClass}
                style={{ height: `${bh}px`, minHeight: bh > 0 ? '4px' : '0' }}
              />

              {/* Month label */}
              <span className={monthLabelClass}>{item.month}</span>
            </div>
          )
        })}
      </div>

      {/* Legend (only if targetData provided) */}
      {targetData && (
        <div className="flex items-center gap-4 mt-3">
          <LegendSwatch color="#F6CCD9" label="Prior months" />
          <LegendSwatch color="#D31145" label="Current" />
          <LegendSwatchDashed label="Target" />
        </div>
      )}

      {/* Chart note — shown if no targetData and we're past November */}
      {!targetData && currentMonthIdx < 11 && (
        <p className="text-[9px] text-[#B0B3BC] mt-1">
          Future months shown without targets.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Legend helpers
// ---------------------------------------------------------------------------

function LegendSwatch({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-[9px] text-[#6B7180]">{label}</span>
    </span>
  )
}

function LegendSwatchDashed({ label }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0 border border-dashed border-[#B0B3BC]" />
      <span className="text-[9px] text-[#6B7180]">{label}</span>
    </span>
  )
}
