import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend,
} from 'recharts'
import { useData } from '../context/DataContext'
import KpiCard from '../components/KpiCard'
import { formatCurrency, formatNumber } from '../utils/formatters'

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const AIA_RED = '#D31145'

const MONTH_ABBRS  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const AVAILABLE_MONTHS = MONTH_ABBRS  // all 12 months — future months will show 0 until data is uploaded

const AREA_COLORS = {
  'SCM2 (Davao)':  AIA_RED,
  'SCM3 (Gensan)': '#1F78AD',
}

const SEGMENT_COLORS = {
  Rookie:   AIA_RED,
  Seasoned: '#FF754D',
}

const AREAS = [
  { label: 'All',           key: 'All' },
  { label: 'Davao (SCM2)', key: 'SCM2 (Davao)' },
  { label: 'Gensan (SCM3)', key: 'SCM3 (Gensan)' },
]

const SEGMENTS = [
  { label: 'All',      key: 'All' },
  { label: 'Rookie',   key: 'Rookie' },
  { label: 'Seasoned', key: 'Seasoned' },
]

function sumField(agents, field) {
  return agents.reduce((acc, a) => acc + (Number(a[field]) || 0), 0)
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 whitespace-nowrap',
        active
          ? 'bg-[#D31145] text-white border-[#D31145] shadow-sm'
          : 'bg-white text-[#848A90] border-[#D6D8DA] hover:border-[#D31145] hover:text-[#D31145]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#848A90]">{title}</p>
      {children}
    </div>
  )
}

function MapaCard({ label, rookieVal, seasonedVal, format = 'number', suffix = '' }) {
  const fmt = (v) => {
    if (v === null || v === undefined || isNaN(v)) return '—'
    if (format === 'currency') return formatCurrency(v, true)
    if (format === 'percent') return `${v.toFixed(1)}%`
    return formatNumber(Math.round(v)) + suffix
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#848A90]">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-[#D31145] font-bold uppercase tracking-wide">Rookie</span>
          <span className="text-lg font-extrabold text-[#333D47] tabular-nums leading-tight">{fmt(rookieVal)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[#FF754D] font-bold uppercase tracking-wide">Seasoned</span>
          <span className="text-lg font-extrabold text-[#333D47] tabular-nums leading-tight">{fmt(seasonedVal)}</span>
        </div>
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const { data, isLoaded } = useData()

  const [area, setArea]       = useState('All')
  const [segment, setSegment] = useState('All')
  // null = MTD (use Excel MTD columns); string = specific month abbr
  const [monthFilter, setMonthFilter] = useState(null)
  const [unitFilter, setUnitFilter]   = useState('All Units')
  const [trendMetric, setTrendMetric] = useState('ANP')

  // All hooks must be called before any early return
  const filteredAgents = useMemo(() => {
    if (!data?.agents) return []
    let result = data.agents
    if (area !== 'All') result = result.filter(a => a.area === area)
    if (segment !== 'All') result = result.filter(a => a.segment === segment)
    return result
  }, [data, area, segment])

  // Unit options derived from filteredAgents (before unit filter applied)
  const unitOptions = useMemo(() => {
    const names = [...new Set(filteredAgents.map(a => a.unitName).filter(Boolean))].sort()
    return ['All Units', ...names]
  }, [filteredAgents])

  // displayAgents: filteredAgents further narrowed by unitFilter — drives ALL KPI calculations
  const displayAgents = useMemo(() => {
    if (unitFilter === 'All Units') return filteredAgents
    return filteredAgents.filter(a => a.unitName === unitFilter)
  }, [filteredAgents, unitFilter])

  // Month-aware agent data: when monthFilter is set, use monthly columns
  const agentsWithMonth = useMemo(() => {
    if (!monthFilter) return displayAgents // use MTD columns
    return displayAgents.map(a => ({
      ...a,
      _m: a.monthly?.[monthFilter] ?? {},
    }))
  }, [displayAgents, monthFilter])

  // Helper to get a numeric field (month-aware)
  function getField(a, mtdField, monthField) {
    if (monthFilter) return a._m?.[monthField] || 0
    return Number(a[mtdField]) || 0
  }

  // Trend chart data (all 12 months, filtered by trendMetric and displayAgents)
  const trendData = useMemo(() => {
    return MONTH_ABBRS.map((abbr, i) => {
      const manpowerCnt = displayAgents.filter(a => (a.monthly?.[abbr]?.manpower || 0) > 0).length
      const producingCnt = displayAgents.filter(a => a.monthly?.[abbr]?.producing === true).length
      let value = 0
      switch (trendMetric) {
        case 'ANP':               value = displayAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.anp   || 0), 0); break
        case 'FYC':               value = displayAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyc   || 0), 0); break
        case 'FYP':               value = displayAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyp   || 0), 0); break
        case 'Cases':             value = displayAgents.reduce((s, a) => s + (a.monthly?.[abbr]?.cases || 0), 0); break
        case 'Producing Advisors': value = producingCnt; break
        case 'Activity Ratio':    value = manpowerCnt > 0 ? (producingCnt / manpowerCnt) * 100 : 0; break
        default: break
      }
      return { month: MONTH_LABELS[i], abbr, value }
    }).filter(d => d.value > 0)
  }, [displayAgents, trendMetric])

  const trendFormatter = trendMetric === 'Activity Ratio'
    ? (v) => [`${v.toFixed(1)}%`, trendMetric]
    : ['ANP', 'FYC', 'FYP'].includes(trendMetric)
      ? (v) => [formatCurrency(v, true), trendMetric]
      : (v) => [formatNumber(Math.round(v)), trendMetric]

  if (!isLoaded) {
    navigate('/')
    return null
  }

  // Manpower = only agents with manpowerInd === true (MTD) or monthly manpower > 0
  const manpowerAgents    = monthFilter
    ? agentsWithMonth.filter(a => (a._m?.manpower || 0) > 0)
    : displayAgents.filter(a => a.manpowerInd)
  const totalManpower     = manpowerAgents.length
  const producingAdvisors = monthFilter
    ? agentsWithMonth.filter(a => a._m?.producing).length
    : displayAgents.filter(a => a.isProducing).length

  // KPIs
  const anpMtd      = agentsWithMonth.reduce((s,a) => s + getField(a,'anpMtd','anp'), 0)
  const fycMtd      = agentsWithMonth.reduce((s,a) => s + getField(a,'fycMtd','fyc'), 0)
  const fypTotal    = agentsWithMonth.reduce((s,a) => s + getField(a,'fypTotal','fyp'), 0)
  const totalCases  = agentsWithMonth.reduce((s,a) => s + getField(a,'casesTotal','cases'), 0)
  const casesAh     = monthFilter ? 0 : sumField(displayAgents, 'casesAh')

  // Activity Ratio by segment (producing / manpower for that segment)
  const rookieAgents   = agentsWithMonth.filter(a => a.segment === 'Rookie')
  const seasonedAgents = agentsWithMonth.filter(a => a.segment === 'Seasoned')

  const rookieManpower = monthFilter
    ? rookieAgents.filter(a => (a._m?.manpower||0) > 0).length
    : displayAgents.filter(a => a.segment === 'Rookie' && a.manpowerInd).length
  const seasonedManpower = monthFilter
    ? seasonedAgents.filter(a => (a._m?.manpower||0) > 0).length
    : displayAgents.filter(a => a.segment === 'Seasoned' && a.manpowerInd).length
  const rookieProducing = monthFilter
    ? rookieAgents.filter(a => a._m?.producing).length
    : displayAgents.filter(a => a.segment === 'Rookie' && a.isProducing).length
  const seasonedProducing = monthFilter
    ? seasonedAgents.filter(a => a._m?.producing).length
    : displayAgents.filter(a => a.segment === 'Seasoned' && a.isProducing).length

  const rookieActRatio   = rookieManpower   > 0 ? (rookieProducing   / rookieManpower)   * 100 : null
  const seasonedActRatio = seasonedManpower > 0 ? (seasonedProducing / seasonedManpower) * 100 : null

  // MAPA metrics per segment
  const rookieCases    = rookieAgents.reduce((s,a)   => s + getField(a,'casesTotal','cases'), 0)
  const seasonedCases  = seasonedAgents.reduce((s,a) => s + getField(a,'casesTotal','cases'), 0)
  const rookieAnp      = rookieAgents.reduce((s,a)   => s + getField(a,'anpMtd','anp'), 0)
  const seasonedAnp    = seasonedAgents.reduce((s,a) => s + getField(a,'anpMtd','anp'), 0)

  const rookieProductivity   = rookieProducing   > 0 ? rookieCases   / rookieProducing   : null
  const seasonedProductivity = seasonedProducing > 0 ? seasonedCases / seasonedProducing : null

  const rookieAvgCaseSize   = rookieCases   > 0 ? rookieAnp   / rookieCases   : null
  const seasonedAvgCaseSize = seasonedCases > 0 ? seasonedAnp / seasonedCases : null

  // Chart: Manpower by Area
  const areaManpower = Object.entries(AREA_COLORS).map(([areaKey, color]) => ({
    name: areaKey === 'SCM2 (Davao)' ? 'Davao' : 'Gensan',
    value: monthFilter
      ? agentsWithMonth.filter(ag => ag.area === areaKey && (ag._m?.manpower||0) > 0).length
      : displayAgents.filter(ag => ag.area === areaKey && ag.manpowerInd).length,
    color,
  })).filter(d => d.value > 0)

  // Chart: Manpower by Segment
  const segmentCounts = ['Rookie', 'Seasoned'].map(seg => ({
    name: seg,
    value: monthFilter
      ? agentsWithMonth.filter(a => a.segment === seg && (a._m?.manpower||0) > 0).length
      : displayAgents.filter(a => a.segment === seg && a.manpowerInd).length,
    color: SEGMENT_COLORS[seg],
  })).filter(d => d.value > 0)

  const uploadDateStr = data.uploadDate
    ? new Date(data.uploadDate).toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null

  const monthLabel = monthFilter ? MONTH_LABELS[MONTH_ABBRS.indexOf(monthFilter)] : 'MTD'

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">

        {/* Page header */}
        <div className="animate-fade-in-up flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#333D47] tracking-tight">Agency Overview</h1>
            {uploadDateStr && (
              <p className="text-xs text-[#848A90] mt-1 font-medium">Data as of {uploadDateStr}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Month picker */}
            <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-[#D6D8DA] flex-wrap">
              <button
                onClick={() => setMonthFilter(null)}
                className={[
                  'px-3 py-1.5 rounded-md text-xs font-bold transition-colors duration-150',
                  monthFilter === null ? 'bg-[#D31145] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
                ].join(' ')}
              >
                MTD
              </button>
              {AVAILABLE_MONTHS.map((abbr, i) => (
                <button
                  key={abbr}
                  onClick={() => setMonthFilter(abbr)}
                  className={[
                    'px-3 py-1.5 rounded-md text-xs font-bold transition-colors duration-150',
                    monthFilter === abbr ? 'bg-[#D31145] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {MONTH_LABELS[i]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <span className="bg-white border border-[#D6D8DA] text-[#848A90] text-xs font-semibold px-3 py-1.5 rounded-full">
                {totalManpower} manpower
              </span>
              <span className="bg-white border border-[#D6D8DA] text-[#848A90] text-xs font-semibold px-3 py-1.5 rounded-full">
                {data.units?.length ?? 0} units
              </span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 sm:gap-6 animate-fade-in-up delay-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#D31145]">Area</span>
            <div className="flex gap-1.5 flex-wrap">
              {AREAS.map(({ label, key }) => (
                <FilterPill key={key} active={area === key} onClick={() => setArea(key)}>{label}</FilterPill>
              ))}
            </div>
          </div>
          <div className="hidden sm:block w-px bg-[#D6D8DA]" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#848A90]">Segment</span>
            <div className="flex gap-1.5 flex-wrap">
              {SEGMENTS.map(({ label, key }) => (
                <FilterPill key={key} active={segment === key} onClick={() => setSegment(key)}>{label}</FilterPill>
              ))}
            </div>
          </div>
          <div className="hidden sm:block w-px bg-[#D6D8DA]" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#848A90]">Unit</span>
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="h-7 px-2 rounded-lg border border-[#D6D8DA] bg-white text-xs text-[#333D47] focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145] cursor-pointer"
            >
              {unitOptions.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard title={`ANP ${monthLabel}`}  value={formatCurrency(anpMtd, true)}   color="red"   className="delay-1" />
            <KpiCard title={`FYC ${monthLabel}`}  value={formatCurrency(fycMtd, true)}   color="red"   className="delay-2" />
            <KpiCard title={`FYP ${monthLabel}`}  value={formatCurrency(fypTotal, true)} color="red"   className="delay-3" />
            <KpiCard title="Manpower"           value={formatNumber(totalManpower)}     color="blue"  className="delay-4" />
            <KpiCard title="Producing Advisors" value={formatNumber(producingAdvisors)} color="green" className="delay-5"
              subtitle={totalManpower > 0
                ? `${Math.round(producingAdvisors / totalManpower * 100)}% of manpower`
                : undefined}
            />
            <KpiCard title="Total Cases"        value={formatNumber(totalCases)}       color="gray"  className="delay-6" />
            <KpiCard title="A&H Cases"          value={formatNumber(casesAh)}          color="gray"  className="delay-7" />
          </div>
        </section>

        {/* ── MAPA Section ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-bold text-[#333D47] uppercase tracking-widest">MAPA</h2>
            <span className="text-xs text-[#848A90] font-medium">Manpower · Activity · Productivity · Avg Case Size</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <MapaCard
              label="M — Manpower"
              rookieVal={rookieManpower}
              seasonedVal={seasonedManpower}
              format="number"
            />
            <MapaCard
              label="A — Activity Ratio"
              rookieVal={rookieActRatio}
              seasonedVal={seasonedActRatio}
              format="percent"
            />
            <MapaCard
              label="P — Productivity"
              rookieVal={rookieProductivity}
              seasonedVal={seasonedProductivity}
              format="number"
              suffix=" cases"
            />
            <MapaCard
              label="A — Avg Case Size"
              rookieVal={rookieAvgCaseSize}
              seasonedVal={seasonedAvgCaseSize}
              format="currency"
            />
          </div>
        </section>

        {/* Charts */}
        <section>
          <div className="flex flex-col gap-4 sm:gap-6">

            {/* Monthly Trend — full width */}
            <ChartCard title="Monthly Trend">
              <div className="flex flex-wrap gap-1 mb-2">
                {['ANP','FYC','FYP','Cases','Producing Advisors','Activity Ratio'].map(m => (
                  <button
                    key={m}
                    onClick={() => setTrendMetric(m)}
                    className={[
                      'px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all',
                      trendMetric === m
                        ? 'bg-[#D31145] text-white border-[#D31145]'
                        : 'text-[#848A90] border-[#D6D8DA] hover:border-[#D31145] hover:text-[#D31145]'
                    ].join(' ')}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {trendData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-xs text-[#848A90]">
                  No monthly data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#848A90' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#848A90' }} axisLine={false} tickLine={false}
                      tickFormatter={v => ['ANP','FYC','FYP'].includes(trendMetric) ? formatCurrency(v, true) : trendMetric === 'Activity Ratio' ? `${v.toFixed(0)}%` : v}
                      width={58} />
                    <Tooltip formatter={trendFormatter} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Line type="monotone" dataKey="value" name={trendMetric} stroke={AIA_RED} strokeWidth={2.5}
                      dot={{ r: 4, fill: AIA_RED, strokeWidth: 0 }} activeDot={{ r: 6, fill: AIA_RED }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Manpower charts — side by side, compact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <ChartCard title="Manpower by Area">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={areaManpower} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={40} outerRadius={62} paddingAngle={4}
                      label={({ name, value, percent }) =>
                        `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}>
                      {areaManpower.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, name) => [v + ' advisors', name]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Manpower by Segment">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={segmentCounts} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={40} outerRadius={62} paddingAngle={4}
                      label={({ name, value, percent }) =>
                        `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}>
                      {segmentCounts.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, name) => [v + ' advisors', name]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

          </div>
        </section>

      </div>
    </div>
  )
}
