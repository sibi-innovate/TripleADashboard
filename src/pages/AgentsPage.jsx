import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { formatCurrency } from '../utils/formatters'
import { exportAgents } from '../utils/exportExcel'
import Tag from '../components/Tag'
import StatusIndicator from '../components/StatusIndicator'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50

const MONTH_ABBRS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function computeMonthsInactive(agent) {
  const currentMonthIdx = new Date().getMonth() // 0-indexed, March = 2
  let count = 0
  for (let i = currentMonthIdx; i >= 0; i--) {
    const abbr = MONTH_ABBRS[i]
    const m = agent.monthly?.[abbr]
    if (!m || (m.cases || 0) === 0) {
      count++
    } else {
      break
    }
  }
  return count
}

const SEGMENT_VARIANT = {
  Rookie:   'rookie',
  Seasoned: 'seasoned',
  Unknown:  'default',
}

const COLUMNS = [
  { key: '#',        label: '#',       sortable: false },
  { key: 'name',     label: 'Name',    sortable: true  },
  { key: 'code',     label: 'Code',    sortable: true  },
  { key: 'area',     label: 'Area',    sortable: true  },
  { key: 'agentYear',label: 'Yr',      sortable: true  },
  { key: 'segment',  label: 'Segment', sortable: true  },
  { key: 'unitName', label: 'Unit',    sortable: true  },
  { key: 'anpMtd',   label: 'ANP MTD', sortable: true  },
  { key: 'fycMtd',   label: 'FYC MTD', sortable: true  },
  { key: 'fypTotal', label: 'FYP MTD', sortable: true  },
  { key: 'casesTotal', label: 'Cases', sortable: true  },
  { key: 'casesRegular', label: 'Regular', sortable: true },
  { key: 'casesAh',  label: 'A&H',    sortable: true  },
  { key: 'isProducing', label: 'Status', sortable: true },
  { key: 'moInactive', label: 'Inactive YTD', sortable: true },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SortIcon({ col, sortKey, sortDir }) {
  if (col.key !== sortKey) {
    return <span className="ml-1 opacity-30 select-none">↕</span>
  }
  return (
    <span className="ml-1 select-none">
      {sortDir === 'asc' ? '↑' : '↓'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AgentsPage() {
  const { data, isLoaded } = useData()
  const navigate = useNavigate()

  // --------------------------------------------------
  // Filter state (all hooks before early return)
  // --------------------------------------------------
  const [search,     setSearch]     = useState('')
  const [areaFilter, setAreaFilter] = useState('All')
  const [segment,    setSegment]    = useState('All')
  const [unit,       setUnit]       = useState('All')
  const [status,     setStatus]     = useState('All')

  // --------------------------------------------------
  // Sort state — default ANP MTD descending
  // --------------------------------------------------
  const [sortKey, setSortKey] = useState('anpMtd')
  const [sortDir, setSortDir] = useState('desc')

  // --------------------------------------------------
  // Pagination
  // --------------------------------------------------
  const [page, setPage] = useState(1)

  // --------------------------------------------------
  // Base agent list with moInactive computed
  // --------------------------------------------------
  const agents = useMemo(
    () => (data?.agents ?? []).filter(a => a.manpowerInd).map(a => ({
      ...a,
      moInactive: computeMonthsInactive(a),
    })),
    [data]
  )

  // --------------------------------------------------
  // Derived: unique unit names (sorted)
  // --------------------------------------------------
  const unitOptions = useMemo(() => {
    const names = [...new Set(agents.map((a) => a.unitName).filter(Boolean))]
    return names.sort((a, b) => a.localeCompare(b))
  }, [agents])

  // --------------------------------------------------
  // Filtered list (memoised)
  // --------------------------------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return agents.filter((a) => {
      // Search filter
      if (q) {
        const nameMatch = (a.name ?? '').toLowerCase().includes(q)
        const codeMatch = (a.code ?? '').toLowerCase().includes(q)
        if (!nameMatch && !codeMatch) return false
      }
      // Area filter
      if (areaFilter !== 'All' && a.area !== areaFilter) return false
      // Segment filter
      if (segment !== 'All' && a.segment !== segment) return false
      // Unit filter
      if (unit !== 'All' && a.unitName !== unit) return false
      // Status filter
      if (status === 'Producing Only' && !a.isProducing) return false
      if (status === 'Non-Producing Only' && a.isProducing) return false
      return true
    })
  }, [agents, search, areaFilter, segment, unit, status])

  // --------------------------------------------------
  // Sorted list (memoised)
  // --------------------------------------------------
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      let av = a[sortKey]
      let bv = b[sortKey]

      // Booleans: true > false
      if (typeof av === 'boolean') av = av ? 1 : 0
      if (typeof bv === 'boolean') bv = bv ? 1 : 0

      // Nulls last
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1

      const dir = sortDir === 'asc' ? 1 : -1

      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir
      }
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [filtered, sortKey, sortDir])

  // Redirect if no data (after all hooks)
  if (!isLoaded) {
    navigate('/')
    return null
  }

  // --------------------------------------------------
  // Paginated slice
  // --------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageStart  = (safePage - 1) * PAGE_SIZE
  const pageRows   = sorted.slice(pageStart, pageStart + PAGE_SIZE)

  // --------------------------------------------------
  // Handlers
  // --------------------------------------------------
  function handleSortClick(col) {
    if (!col.sortable) return
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col.key)
      setSortDir('desc')
    }
    setPage(1)
  }

  function handleFilterChange(setter) {
    return (e) => {
      setter(e.target.value)
      setPage(1)
    }
  }

  function clearFilters() {
    setSearch('')
    setAreaFilter('All')
    setSegment('All')
    setUnit('All')
    setStatus('All')
    setPage(1)
  }

  const hasFilters =
    search !== '' ||
    areaFilter !== 'All' ||
    segment !== 'All' ||
    unit !== 'All' ||
    status !== 'All'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-aia-gray">
      <div className="max-w-screen-2xl mx-auto px-4 py-6">

        {/* ---- Page header ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h1 className="text-2xl font-extrabold text-aia-darkGray tracking-tight">
            All Advisors
          </h1>
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
            Showing <span className="text-aia-red">{sorted.length}</span> of{' '}
            <span className="text-aia-red">{agents.length}</span> advisors
          </span>
        </div>

        {/* ---- Filters row ---- */}
        <div className="flex flex-wrap items-end gap-3 mb-4">

          {/* Search */}
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Search
            </label>
            <input
              type="text"
              placeholder="Name or code…"
              value={search}
              onChange={handleFilterChange(setSearch)}
              className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-aia-red focus:border-transparent transition"
            />
          </div>

          {/* Area */}
          <div className="flex flex-col gap-1 min-w-[150px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Area
            </label>
            <select
              value={areaFilter}
              onChange={handleFilterChange(setAreaFilter)}
              className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-aia-red focus:border-transparent transition cursor-pointer"
            >
              <option value="All">All Areas</option>
              <option value="SCM2 (Davao)">SCM2 (Davao)</option>
              <option value="SCM3 (Gensan)">SCM3 (Gensan)</option>
            </select>
          </div>

          {/* Segment */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Segment
            </label>
            <select
              value={segment}
              onChange={handleFilterChange(setSegment)}
              className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-aia-red focus:border-transparent transition cursor-pointer"
            >
              <option value="All">All</option>
              <option value="Rookie">Rookie</option>
              <option value="Seasoned">Seasoned</option>
            </select>
          </div>

          {/* Unit */}
          <div className="flex flex-col gap-1 min-w-[180px] max-w-[260px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Unit
            </label>
            <select
              value={unit}
              onChange={handleFilterChange(setUnit)}
              className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-aia-red focus:border-transparent transition cursor-pointer"
            >
              <option value="All">All Units</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Status
            </label>
            <select
              value={status}
              onChange={handleFilterChange(setStatus)}
              className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-aia-red focus:border-transparent transition cursor-pointer"
            >
              <option value="All">All</option>
              <option value="Producing Only">Producing Only</option>
              <option value="Non-Producing Only">Non-Producing Only</option>
            </select>
          </div>

          {/* Clear Filters */}
          {hasFilters && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-transparent uppercase tracking-wide select-none">
                &nbsp;
              </label>
              <button
                onClick={clearFilters}
                className="h-9 px-4 text-sm text-aia-red font-semibold hover:text-aia-darkRed underline underline-offset-2 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Download Excel */}
          <div className="flex flex-col gap-1 ml-auto">
            <label className="text-xs font-semibold text-transparent uppercase tracking-wide select-none">
              &nbsp;
            </label>
            <button
              onClick={() => exportAgents(filtered)}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Excel
            </button>
          </div>
        </div>

        {/* ---- Table card ---- */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">

              {/* Head */}
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSortClick(col)}
                      className={[
                        'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white bg-[#D31145] select-none whitespace-nowrap',
                        col.key === 'name' ? 'sticky left-0 z-20 border-r border-[#b80e3a]' : '',
                        col.sortable
                          ? 'cursor-pointer hover:bg-[#b80e3a] transition-colors duration-100'
                          : '',
                      ].join(' ')}
                    >
                      {col.label}
                      {col.sortable && (
                        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={COLUMNS.length}
                      className="text-center py-16 text-gray-400 text-sm"
                    >
                      No advisors match the current filters.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((agent, idx) => {
                    const rowNum = pageStart + idx + 1
                    const isEven = idx % 2 === 1
                    return (
                      <tr
                        key={agent.code ?? rowNum}
                        className="group transition-colors duration-75 hover:bg-slate-50 even:bg-gray-50"
                      >
                        {/* # */}
                        <td className="px-3 py-2.5 text-gray-400 font-mono text-xs tabular-nums">
                          {rowNum}
                        </td>

                        {/* Name — sticky */}
                        <td className="sticky left-0 z-10 px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap bg-white group-even:bg-gray-50 group-hover:bg-slate-50 border-r border-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                          {agent.code
                            ? <Link to={`/agent/${agent.code}`} className="hover:text-aia-red hover:underline underline-offset-2 transition-colors">{agent.name ?? '—'}</Link>
                            : (agent.name ?? '—')
                          }
                        </td>

                        {/* Code */}
                        <td className="px-3 py-2.5 text-gray-400 text-xs font-mono whitespace-nowrap">
                          {agent.code ?? '—'}
                        </td>

                        {/* Area */}
                        <td className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap">
                          <span className={agent.area?.includes('SCM2') ? 'text-aia-red' : 'text-aia-blue'}>
                            {agent.area === 'SCM2 (Davao)' ? 'Davao' : agent.area === 'SCM3 (Gensan)' ? 'Gensan' : agent.area ?? '—'}
                          </span>
                        </td>

                        {/* Yr */}
                        <td className="px-3 py-2.5 text-gray-700 text-center tabular-nums">
                          {agent.agentYear ?? '—'}
                        </td>

                        {/* Segment badge */}
                        <td className="px-3 py-2.5">
                          <Tag variant={SEGMENT_VARIANT[agent.segment] ?? 'default'}>
                            {agent.segment ?? 'Unknown'}
                          </Tag>
                        </td>

                        {/* Unit */}
                        <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                          {agent.unitName ?? '—'}
                        </td>

                        {/* ANP MTD */}
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-800 whitespace-nowrap">
                          {formatCurrency(agent.anpMtd)}
                        </td>

                        {/* FYC MTD */}
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-800 whitespace-nowrap">
                          {formatCurrency(agent.fycMtd)}
                        </td>

                        {/* FYP MTD (compact) */}
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-800 whitespace-nowrap">
                          {formatCurrency(agent.fypTotal, true)}
                        </td>

                        {/* Cases Total */}
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-800">
                          {agent.casesTotal ?? '—'}
                        </td>

                        {/* Regular Cases */}
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                          {agent.casesRegular ?? '—'}
                        </td>

                        {/* A&H Cases */}
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                          {agent.casesAh ?? '—'}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {agent.isProducing
                            ? <StatusIndicator status="positive" label="Producing" />
                            : <StatusIndicator status="neutral" label="—" />
                          }
                        </td>

                        {/* Months Inactive YTD (counts consecutive 0-case months from current month back to Jan) */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {agent.moInactive === 0
                            ? <StatusIndicator status="positive" label="Active" />
                            : agent.moInactive >= 3
                              ? <StatusIndicator status="negative" label={`${agent.moInactive} mo`} />
                              : <StatusIndicator status="warning" label={`${agent.moInactive} mo`} />
                          }
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ---- Pagination footer ---- */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/60">
            <span className="text-xs text-gray-500">
              Page <span className="font-semibold text-gray-700">{safePage}</span> of{' '}
              <span className="font-semibold text-gray-700">{totalPages}</span>
              {sorted.length > 0 && (
                <span className="ml-2 text-gray-400">
                  ({pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, sorted.length)} of {sorted.length})
                </span>
              )}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
