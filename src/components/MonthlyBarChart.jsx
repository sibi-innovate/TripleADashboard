import { useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Cell,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import { MONTH_SHORT } from '../constants'

// ---------------------------------------------------------------------------
// MonthlyBarChart — Recharts-powered
// Past months: light pink bars. Current month: AIA red bar.
// Future months: dashed-stroke target bar (if targetData provided).
//
// Props (unchanged API):
//   data            Array<{ month, value }> | number[]  (12 items)
//   currentMonthIdx number   0-based (e.g. 3 = April)
//   targetData      Array<{ month, value }> | null
//   height          number   chart area height px (default 80)
//   metric          string   label for the metric
//   onMetricChange  (metric) => void
//   metricOptions   Array<string>
//   formatValue     (value) => string
// ---------------------------------------------------------------------------

function CustomTargetBar(props) {
  const { x, y, width, height: h } = props
  if (!h || h <= 0) return null
  return (
    <rect
      x={x} y={y} width={width} height={h}
      fill="none"
      stroke="#B0B3BC"
      strokeWidth={1.5}
      strokeDasharray="3 2"
      rx={2}
    />
  )
}

function CustomTooltip({ active, payload, label, formatValue }) {
  if (!active || !payload?.length) return null
  const actual = payload.find(p => p.dataKey === 'actual')
  const target = payload.find(p => p.dataKey === 'target')
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {actual && actual.value > 0 && (
        <p className="text-aia-darkGray">Actual: <span className="font-semibold">{formatValue(actual.value)}</span></p>
      )}
      {target && target.value > 0 && (
        <p className="text-gray-400">Target: <span className="font-semibold">{formatValue(target.value)}</span></p>
      )}
    </div>
  )
}

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
  const chartData = useMemo(() => {
    const normalized = data.map((d, i) =>
      typeof d === 'number'
        ? { month: MONTH_SHORT[i] ?? String(i + 1), value: d }
        : d
    )
    const targetMap = targetData
      ? Object.fromEntries(targetData.map(d => [d.month, d.value ?? 0]))
      : {}

    return MONTH_SHORT.map((month, idx) => {
      const actual = normalized[idx]?.value ?? 0
      const targetVal = targetMap[month] ?? 0
      const isFuture = idx > currentMonthIdx
      return {
        month,
        actual: isFuture ? 0 : actual,
        target: isFuture ? (targetVal || actual) : 0,
        isCurrent: idx === currentMonthIdx,
        isPast: idx < currentMonthIdx,
      }
    })
  }, [data, currentMonthIdx, targetData])

  const maxValue = useMemo(() => {
    const vals = chartData.flatMap(d => [d.actual, d.target])
    return Math.max(...vals, 1)
  }, [chartData])

  const chartHeight = Math.max(height, 80)

  return (
    <div className="bg-white border border-[#E8E9ED] rounded-xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-[#1C1C28] uppercase tracking-widest">
          {metric}
        </span>
        {metricOptions.length > 0 && typeof onMetricChange === 'function' && (
          <select
            value={metric}
            onChange={e => onMetricChange(e.target.value)}
            className="border border-[#E8E9ED] rounded-md text-[11px] px-2 py-1 text-[#1C1C28] bg-white focus:outline-none focus:ring-1 focus:ring-[#D31145] cursor-pointer"
          >
            {metricOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart data={chartData} margin={{ top: 16, right: 0, left: 0, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="#F3F4F6" strokeDasharray="0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis hide domain={[0, maxValue * 1.15]} />
          <Tooltip
            content={<CustomTooltip formatValue={formatValue} />}
            cursor={{ fill: 'rgba(211,17,69,0.04)' }}
          />
          {/* Actual bars (past + current) */}
          <Bar dataKey="actual" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={true}>
            {chartData.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.isCurrent ? '#D31145' : '#F6CCD9'}
              />
            ))}
          </Bar>
          {/* Target bars (future months) */}
          <Bar dataKey="target" shape={<CustomTargetBar />} maxBarSize={28} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      {targetData && (
        <div className="flex items-center gap-4 mt-1">
          <LegendSwatch color="#F6CCD9" label="Prior months" />
          <LegendSwatch color="#D31145" label="Current" />
          <LegendSwatchDashed label="Target" />
        </div>
      )}
      {!targetData && currentMonthIdx < 11 && (
        <p className="text-[9px] text-[#B0B3BC] mt-1">Future months shown without targets.</p>
      )}
    </div>
  )
}

function LegendSwatch({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
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
