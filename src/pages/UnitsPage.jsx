import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { formatCurrency } from '../utils/formatters'
import KpiCard from '../components/KpiCard'
import Tag from '../components/Tag'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SORT_COLS = {
  unitName:       (u) => (u.unitName || u.unitCode || '').toLowerCase(),
  totalHeadcount: (u) => u.totalHeadcount ?? 0,
  rookieCount:    (u) => u.rookieCount ?? 0,
  seasonedCount:  (u) => u.seasonedCount ?? 0,
  totalFycMtd:    (u) => u.totalFycMtd ?? 0,
  producingCount: (u) => u.producingCount ?? 0,
  totalCases:     (u) => u.totalCases ?? 0,
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) {
    return <span className="ml-1 opacity-30 text-xs select-none">↕</span>
  }
  return (
    <span className="ml-1 text-xs select-none">
      {sortDir === 'asc' ? '↑' : '↓'}
    </span>
  )
}

function SegmentBadge({ segment }) {
  const variantMap = {
    Rookie:   'rookie',
    Seasoned: 'seasoned',
  }
  const variant = variantMap[segment] ?? 'default'
  return <Tag variant={variant}>{segment || '—'}</Tag>
}

function StatusBadge({ isProducing }) {
  if (isProducing) {
    return (
      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        Active
      </span>
    )
  }
  return (
    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
      Inactive
    </span>
  )
}

function CountBadge({ value, color }) {
  const colorMap = {
    blue:   'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    amber:  'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${colorMap[color] ?? 'bg-gray-100 text-gray-600'}`}>
      {value ?? 0}
    </span>
  )
}

function AgentsSubTable({ agents }) {
  const sorted = useMemo(
    () => [...(agents ?? [])].sort((a, b) => (b.fycMtd ?? 0) - (a.fycMtd ?? 0)),
    [agents]
  )

  if (!sorted.length) {
    return (
      <tr>
        <td colSpan={8} className="bg-gray-50 px-10 py-3 text-xs text-gray-400 italic">
          No agents found for this unit.
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td colSpan={8} className="p-0">
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-white bg-[#D31145] uppercase tracking-wider">Name</th>
                <th className="text-center py-2 px-3 text-[10px] font-semibold text-white bg-[#D31145] uppercase tracking-wider">Yr</th>
                <th className="text-center py-2 px-3 text-[10px] font-semibold text-white bg-[#D31145] uppercase tracking-wider">Segment</th>
                <th className="text-right py-2 px-3 text-[10px] font-semibold text-white bg-[#D31145] uppercase tracking-wider">FYC MTD</th>
                <th className="text-center py-2 px-3 text-[10px] font-semibold text-white bg-[#D31145] uppercase tracking-wider">Cases</th>
                <th className="text-center py-2 px-3 text-[10px] font-semibold text-white bg-[#D31145] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((agent, idx) => (
                <tr
                  key={agent.code ?? idx}
                  className="even:bg-gray-50"
                >
                  <td className="py-2 px-3 font-medium text-gray-800 whitespace-nowrap">
                    {agent.code
                      ? <Link to={`/agent/${agent.code}`} className="hover:text-aia-red hover:underline underline-offset-2 transition-colors">{agent.name || '—'}</Link>
                      : (agent.name || '—')
                    }
                  </td>
                  <td className="py-2 px-3 text-center text-gray-600">
                    {agent.agentYear ?? '—'}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <SegmentBadge segment={agent.segment} />
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-gray-800">
                    {formatCurrency(agent.fycMtd, true)}
                  </td>
                  <td className="py-2 px-3 text-center text-gray-700">
                    {agent.casesTotal ?? 0}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <StatusBadge isProducing={agent.isProducing} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function UnitsPage() {
  const { data, isLoaded } = useData()
  const navigate = useNavigate()

  const [areaFilter, setAreaFilter] = useState('All')
  const [sortCol, setSortCol] = useState('totalFycMtd')
  const [sortDir, setSortDir] = useState('desc')
  const [expandedRows, setExpandedRows] = useState(new Set())

  const allUnits = data?.units ?? []

  // All hooks before any early return
  const units = useMemo(() => {
    return allUnits.map(unit => {
      // Only licensed advisors (ManpowerCnt=1)
      let filtered = unit.agents.filter(a => a.manpowerInd)
      if (areaFilter !== 'All') filtered = filtered.filter(a => a.area === areaFilter)
      if (filtered.length === 0) return null
      const rookies   = filtered.filter(a => a.segment === 'Rookie')
      const seasoned  = filtered.filter(a => a.segment === 'Seasoned')
      const producing = filtered.filter(a => a.isProducing)
      return {
        ...unit,
        agents:         filtered,
        totalHeadcount: filtered.length,
        rookieCount:    rookies.length,
        seasonedCount:  seasoned.length,
        totalFycMtd:    filtered.reduce((s, a) => s + (a.fycMtd    ?? 0), 0),
        producingCount: producing.length,
        totalCases:     filtered.reduce((s, a) => s + (a.casesTotal ?? 0), 0),
      }
    }).filter(Boolean)
  }, [allUnits, areaFilter])

  // Summary stats
  const totalUnits = units.length
  const totalHeadcount = units.reduce((sum, u) => sum + (u.totalHeadcount ?? 0), 0)
  const totalProducing = units.reduce((sum, u) => sum + (u.producingCount ?? 0), 0)

  // Sorted units
  const sortedUnits = useMemo(() => {
    const getter = SORT_COLS[sortCol] ?? SORT_COLS.totalFycMtd
    return [...units].sort((a, b) => {
      const av = getter(a)
      const bv = getter(b)
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [units, sortCol, sortDir])

  // Redirect if data not loaded (after all hooks)
  if (!isLoaded) {
    navigate('/')
    return null
  }

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  function toggleRow(unitCode) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(unitCode)) {
        next.delete(unitCode)
      } else {
        next.add(unitCode)
      }
      return next
    })
  }

  const thShared =
    'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] cursor-pointer select-none whitespace-nowrap hover:bg-[#b80e3a] transition-colors duration-100'
  const thBase   = thShared + ' text-left'
  const thRight  = thShared + ' text-right'
  const thCenter = thShared + ' text-center'

  return (
    <div className="min-h-screen bg-aia-gray">
      <div className="max-w-screen-xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Unit Breakdown
          </h1>
          <p className="text-sm text-gray-500 mt-1">Performance by unit manager</p>
        </div>

        {/* Area filter */}
        <div className="flex gap-2 mb-4">
          {['All', 'SCM2 (Davao)', 'SCM3 (Gensan)'].map(a => (
            <button
              key={a}
              onClick={() => setAreaFilter(a)}
              className={[
                'px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors',
                areaFilter === a
                  ? 'bg-aia-red text-white border-aia-red'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-aia-red hover:text-aia-red',
              ].join(' ')}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <KpiCard
            title="Total Units"
            value={totalUnits}
            color="red"
            icon="🏢"
          />
          <KpiCard
            title="Total Headcount"
            value={totalHeadcount}
            color="blue"
            icon="👥"
          />
          <KpiCard
            title="Producing Advisors"
            value={totalProducing}
            color="green"
            icon="✅"
          />
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {units.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg
                className="w-12 h-12 mb-3 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="font-semibold text-sm">No unit data available</p>
              <p className="text-xs mt-1">Upload a report to view unit performance</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                {/* Table Head */}
                <thead>
                  <tr>
                    {/* Expand toggle column — no sort */}
                    <th className="sticky left-0 z-20 px-3 py-2.5 w-10 bg-[#D31145]" aria-label="Expand" />

                    <th
                      className={`sticky left-10 z-20 border-r border-[#b80e3a] ${thBase}`}
                      onClick={() => handleSort('unitName')}
                    >
                      Unit
                      <SortIcon col="unitName" sortCol={sortCol} sortDir={sortDir} />
                    </th>

                    <th
                      className={thCenter}
                      onClick={() => handleSort('totalHeadcount')}
                    >
                      Total
                      <SortIcon col="totalHeadcount" sortCol={sortCol} sortDir={sortDir} />
                    </th>

                    <th
                      className={thCenter}
                      onClick={() => handleSort('rookieCount')}
                    >
                      Rookie
                      <SortIcon col="rookieCount" sortCol={sortCol} sortDir={sortDir} />
                    </th>

                    <th
                      className={thCenter}
                      onClick={() => handleSort('seasonedCount')}
                    >
                      Seasoned
                      <SortIcon col="seasonedCount" sortCol={sortCol} sortDir={sortDir} />
                    </th>

                    <th
                      className={thRight}
                      onClick={() => handleSort('totalFycMtd')}
                    >
                      FYC MTD
                      <SortIcon col="totalFycMtd" sortCol={sortCol} sortDir={sortDir} />
                    </th>

                    <th
                      className={thCenter}
                      onClick={() => handleSort('producingCount')}
                    >
                      Producing
                      <SortIcon col="producingCount" sortCol={sortCol} sortDir={sortDir} />
                    </th>

                    <th
                      className={thCenter}
                      onClick={() => handleSort('totalCases')}
                    >
                      Cases
                      <SortIcon col="totalCases" sortCol={sortCol} sortDir={sortDir} />
                    </th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody>
                  {sortedUnits.map((unit, idx) => {
                    const key = unit.unitCode ?? idx
                    const isExpanded = expandedRows.has(key)

                    return [
                      /* Main unit row */
                      <tr
                        key={`unit-${key}`}
                        className="group even:bg-gray-50 border-b border-gray-100 hover:bg-red-50 transition-colors duration-100"
                      >
                        {/* Expand toggle — sticky */}
                        <td className="sticky left-0 z-10 px-4 py-3 text-center bg-white group-even:bg-gray-50 group-hover:bg-red-50">
                          <button
                            onClick={() => toggleRow(key)}
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            className="text-gray-400 hover:text-aia-red transition-colors duration-100 focus:outline-none"
                          >
                            <svg
                              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>
                        </td>

                        {/* Unit name — sticky, clickable */}
                        <td className="sticky left-10 z-10 px-4 py-3 font-semibold text-gray-900 whitespace-nowrap bg-white group-even:bg-gray-50 group-hover:bg-red-50 border-r border-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                          {unit.unitCode
                            ? (
                              <Link to={`/unit/${unit.unitCode}`} className="hover:text-aia-red hover:underline underline-offset-2 transition-colors">
                                {unit.unitName || unit.unitCode}
                              </Link>
                            )
                            : (unit.unitName || '—')
                          }
                          {unit.unitCode && unit.unitName && (
                            <span className="ml-2 text-[10px] text-gray-400 font-normal">
                              {unit.unitCode}
                            </span>
                          )}
                        </td>

                        {/* Total headcount */}
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">
                          {unit.totalHeadcount ?? 0}
                        </td>

                        {/* Rookie count */}
                        <td className="px-4 py-3 text-center">
                          <CountBadge value={unit.rookieCount} color="blue" />
                        </td>

                        {/* Seasoned count */}
                        <td className="px-4 py-3 text-center">
                          <CountBadge value={unit.seasonedCount} color="purple" />
                        </td>

                        {/* FYC MTD Total */}
                        <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                          {formatCurrency(unit.totalFycMtd, true)}
                        </td>

                        {/* Producing */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="font-medium text-gray-900">
                            {unit.producingCount ?? 0}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {' '}/ {unit.totalHeadcount ?? 0}
                          </span>
                        </td>

                        {/* Cases */}
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">
                          {unit.totalCases ?? 0}
                        </td>
                      </tr>,

                      /* Expanded agents sub-table */
                      isExpanded && (
                        <AgentsSubTable
                          key={`agents-${key}`}
                          agents={unit.agents}
                        />
                      ),
                    ]
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="mt-4 text-xs text-gray-400 text-right">
          {units.length} unit{units.length !== 1 ? 's' : ''} shown
          {data?.uploadDate
            ? ` · Data as of ${new Date(data.uploadDate).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}`
            : ''}
        </p>
      </div>
    </div>
  )
}
