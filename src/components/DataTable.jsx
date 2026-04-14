import { useState, useMemo } from 'react'

// ---------------------------------------------------------------------------
// SortIcon
// ---------------------------------------------------------------------------
function SortIcon({ colKey, sortKey, sortDir }) {
  if (colKey !== sortKey) {
    return <span className="ml-1 opacity-30 select-none text-[9px]">↕</span>
  }
  return (
    <span className="ml-1 select-none text-[9px]">
      {sortDir === 'asc' ? '↑' : '↓'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

/**
 * Reusable sortable + paginated table component.
 *
 * @param {Object} props
 * @param {Array<{
 *   key: string,
 *   label: string,
 *   sortable?: boolean,
 *   align?: 'left'|'right'|'center',
 *   render?: (value: any, row: object) => React.ReactNode,
 *   width?: string,
 *   sticky?: boolean,
 * }>} props.columns
 * @param {Array<object>} props.data
 * @param {{ key: string, dir: 'asc'|'desc' }} [props.defaultSort]
 * @param {number} [props.pageSize=50]
 * @param {(row: object) => void} [props.onRowClick]
 * @param {string} [props.emptyMessage='No data available.']
 */
export default function DataTable({
  columns = [],
  data = [],
  defaultSort = { key: '', dir: 'desc' },
  pageSize = 50,
  onRowClick,
  emptyMessage = 'No data available.',
}) {
  // --------------------------------------------------
  // Sort state
  // --------------------------------------------------
  const [sortState, setSortState] = useState({
    key: defaultSort.key,
    dir: defaultSort.dir,
  })

  // --------------------------------------------------
  // Pagination state
  // --------------------------------------------------
  const [page, setPage] = useState(1)

  // --------------------------------------------------
  // Sorted data (memoised)
  // --------------------------------------------------
  const sorted = useMemo(() => {
    const { key, dir } = sortState
    if (!key) return [...data]

    return [...data].sort((a, b) => {
      let av = a[key]
      let bv = b[key]

      // Booleans: true > false
      if (typeof av === 'boolean') av = av ? 1 : 0
      if (typeof bv === 'boolean') bv = bv ? 1 : 0

      // Nulls last
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1

      const mult = dir === 'asc' ? 1 : -1

      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * mult
      }
      return String(av).localeCompare(String(bv)) * mult
    })
  }, [data, sortState])

  // --------------------------------------------------
  // Paginated slice (memoised)
  // --------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, safePage, pageSize])

  const pageStart = (safePage - 1) * pageSize

  // --------------------------------------------------
  // Handlers
  // --------------------------------------------------
  function handleSortClick(col) {
    const isSortable = col.sortable !== false
    if (!isSortable) return

    setSortState((prev) => {
      if (prev.key === col.key) {
        return { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key: col.key, dir: 'desc' }
    })
    setPage(1)
  }

  // --------------------------------------------------
  // Cell alignment class
  // --------------------------------------------------
  function alignClass(align) {
    if (align === 'right') return 'text-right'
    if (align === 'center') return 'text-center'
    return 'text-left'
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="flex flex-col">
      {/* Table wrapper */}
      <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <table className="w-full text-[12px] border-collapse">
          {/* Head */}
          <thead>
            <tr>
              {columns.map((col) => {
                const isSortable = col.sortable !== false
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSortClick(col)}
                    style={col.width ? { width: col.width } : undefined}
                    className={[
                      'px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap',
                      'bg-[#D31145] text-white select-none',
                      alignClass(col.align),
                      isSortable
                        ? 'cursor-pointer hover:bg-[#b80e3a] transition-colors duration-100'
                        : '',
                      col.sticky ? 'sticky left-0 z-20' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {col.label}
                    {isSortable && (
                      <SortIcon
                        colKey={col.key}
                        sortKey={sortState.key}
                        sortDir={sortState.dir}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-16 text-[#6B7180] text-[12px]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => {
                const isEven = idx % 2 === 1
                const rowBg = isEven ? 'bg-[#FAFAFA]' : 'bg-white'
                const clickable = typeof onRowClick === 'function'

                return (
                  <tr
                    key={idx}
                    onClick={clickable ? () => onRowClick(row) : undefined}
                    className={[
                      rowBg,
                      'group transition-colors duration-75',
                      clickable
                        ? 'cursor-pointer hover:bg-[#FAE8EE]'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {columns.map((col) => {
                      const value = row[col.key]
                      const content =
                        typeof col.render === 'function'
                          ? col.render(value, row)
                          : value ?? '—'

                      return (
                        <td
                          key={col.key}
                          className={[
                            'px-3 py-2 text-[#1C1C28]',
                            alignClass(col.align),
                            col.sticky
                              ? 'sticky left-0 bg-inherit z-10'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {content}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-[11px]">
        <span className="text-[#6B7180]">
          {sorted.length === 0 ? (
            '0 rows'
          ) : (
            <>
              {pageStart + 1}–{Math.min(pageStart + pageSize, sorted.length)}{' '}
              of {sorted.length} rows
            </>
          )}
        </span>

        <div className="flex items-center gap-2">
          <span className="text-[#6B7180]">
            Page {safePage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-2.5 py-1 rounded-md border border-[#E8E9ED] bg-white text-[#1C1C28] font-semibold hover:bg-[#F2F3F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-2.5 py-1 rounded-md border border-[#E8E9ED] bg-white text-[#1C1C28] font-semibold hover:bg-[#F2F3F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
