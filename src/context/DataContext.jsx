import { createContext, useContext, useState, useEffect } from 'react'
import { parseExcelFile } from '../utils/parseExcel'
import { supabase } from '../lib/supabase'
import { CURRENT_YEAR } from '../constants'

const DataContext = createContext(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DataProvider({ children }) {
  const [data,      setData]      = useState(null)
  const [isLoading, setIsLoading] = useState(true)   // true on mount while fetching
  const [error,     setError]     = useState(null)

  // Targets state
  const [targets,        setTargets]        = useState(null)
  const [targetsLoading, setTargetsLoading] = useState(false)

  // Historical data state
  const [historicalData,    setHistoricalData]    = useState(null)  // most recent prior year (for agent profile YoY)
  const [allHistoricalData, setAllHistoricalData] = useState({})    // { [year]: parsedData } — all years
  const [histUploading,     setHistUploading]     = useState(false)
  const [histError,         setHistError]         = useState(null)

  // On mount: load from Supabase (single source of truth for all users)
  useEffect(() => {
    async function fetchFromSupabase() {
      try {
        const { data: row, error: fetchError } = await supabase
          .from('agency_data')
          .select('data, uploaded_at')
          .eq('id', 1)
          .single()

        if (fetchError) throw fetchError

        if (row?.data) {
          setData(row.data)
        }
      } catch (e) {
        // Supabase unavailable or no data yet — silently continue
        console.warn('DataContext: could not load from Supabase:', e.message)
      } finally {
        setIsLoading(false)
        // Chain targets load after main data resolves
        loadTargets()
        // Load ALL available historical years (silently fails if table empty)
        loadAllHistoricalData().catch(() => {})
      }
    }

    fetchFromSupabase()
  }, [])

  // --------------------------------------------------------------------------
  // loadTargets: fetch agency targets for the given year from Supabase
  // --------------------------------------------------------------------------
  async function loadTargets(year = CURRENT_YEAR) {
    setTargetsLoading(true)
    try {
      // REQUIRED: agency_targets table must have a UNIQUE constraint on (year).
      // If missing, run in Supabase SQL editor:
      //   ALTER TABLE agency_targets ADD CONSTRAINT agency_targets_year_key UNIQUE (year);
      // Without this, upsert inserts duplicates. The .order+.limit below is a safe fallback.
      const { data, error } = await supabase
        .from('agency_targets')
        .select('*')
        .eq('year', year)
        .order('updated_at', { ascending: false })
        .limit(1)
      if (error) console.warn('DataContext: loadTargets error:', error.message)
      if (data && data.length > 0) setTargets(data[0])
      return data?.[0] ?? null
    } finally {
      setTargetsLoading(false)
    }
  }

  // --------------------------------------------------------------------------
  // saveTargets: upsert agency targets for the given year
  // --------------------------------------------------------------------------
  async function saveTargets(targetsData, year = CURRENT_YEAR) {
    const { data, error } = await supabase
      .from('agency_targets')
      .upsert(
        { year, ...targetsData, updated_at: new Date().toISOString() },
        { onConflict: 'year' }
      )
      .select()
    if (error) {
      console.error('DataContext: saveTargets error:', error.message)
      throw error
    }
    const saved = data?.[0] ?? null
    if (saved) setTargets(saved)
    return { data: saved, error: null }
  }

  // --------------------------------------------------------------------------
  // loadHistoricalData: fetch a single prior year (kept for backward compat)
  // --------------------------------------------------------------------------
  async function loadHistoricalData(year) {
    const { data } = await supabase
      .from('agency_data_history')
      .select('data, uploaded_at')
      .eq('year', year)
      .single()
    if (data) setHistoricalData(data.data)
    return data
  }

  // --------------------------------------------------------------------------
  // loadAllHistoricalData: fetch every uploaded prior year at once
  // --------------------------------------------------------------------------
  async function loadAllHistoricalData() {
    const { data: rows } = await supabase
      .from('agency_data_history')
      .select('year, data')
    if (!rows || rows.length === 0) return
    const hist = {}
    for (const row of rows) hist[row.year] = row.data
    setAllHistoricalData(hist)
    // Keep historicalData pointing at the most recent prior year (agent profile YoY)
    const priorYearData = hist[CURRENT_YEAR - 1]
    if (priorYearData) setHistoricalData(priorYearData)
  }

  // --------------------------------------------------------------------------
  // uploadHistoricalData: parse an Excel file and explicitly save it as a
  // prior-year snapshot (year passed explicitly by the caller).
  // Does NOT overwrite the current year's data.
  // --------------------------------------------------------------------------
  async function uploadHistoricalData(arrayBuffer, year) {
    setHistUploading(true)
    setHistError(null)
    try {
      const result = await new Promise((resolve, reject) => {
        setTimeout(() => {
          try { resolve(parseExcelFile(arrayBuffer)) }
          catch (err) { reject(err) }
        }, 0)
      })

      if (year === CURRENT_YEAR) {
        // Current year → overwrite main agency_data (same as Upload page)
        const { error: saveError } = await supabase
          .from('agency_data')
          .upsert({ id: 1, data: result, uploaded_at: new Date().toISOString() })
        if (saveError) throw new Error('Upload failed: ' + saveError.message)
        setData(result)
      } else {
        // Prior year → upsert into agency_data_history (overwrites same year)
        const { error: saveError } = await supabase
          .from('agency_data_history')
          .upsert(
            { year, data: result, uploaded_at: new Date().toISOString() },
            { onConflict: 'year' }
          )
        if (saveError) throw new Error('History upload failed: ' + saveError.message)
        // Keep the most-recent-prior-year pointer for agent profile YoY
        if (year === CURRENT_YEAR - 1) setHistoricalData(result)
      }

      // Update the all-years map regardless of which year
      setAllHistoricalData(prev => ({ ...prev, [year]: result }))
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setHistError(msg)
      throw err
    } finally {
      setHistUploading(false)
    }
  }

  // --------------------------------------------------------------------------
  // loadData: parse Excel + save to Supabase (admin only)
  // --------------------------------------------------------------------------
  async function loadData(arrayBuffer) {
    setIsLoading(true)
    setError(null)

    try {
      const result = await new Promise((resolve, reject) => {
        setTimeout(() => {
          try { resolve(parseExcelFile(arrayBuffer)) }
          catch (err) { reject(err) }
        }, 0)
      })

      // Detect the year from the uploaded data; default to CURRENT_YEAR if not present
      const dataYear = result.uploadDate
        ? new Date(result.uploadDate).getFullYear()
        : CURRENT_YEAR

      if (dataYear === CURRENT_YEAR) {
        // Same year: overwrite current data (existing behavior)
        const { error: saveError } = await supabase
          .from('agency_data')
          .upsert({ id: 1, data: result, uploaded_at: new Date().toISOString() })

        if (saveError) throw new Error('Upload failed: ' + saveError.message)

        setData(result)
      } else {
        // Different year: save to history, don't overwrite current
        const { error: saveError } = await supabase
          .from('agency_data_history')
          .upsert(
            { year: dataYear, data: result, uploaded_at: new Date().toISOString() },
            { onConflict: 'year' }
          )

        if (saveError) throw new Error('History upload failed: ' + saveError.message)

        // Also expose this as historical data in context
        setHistoricalData(result)
      }
    } catch (err) {
      console.error('DataContext: loadData failed:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  // --------------------------------------------------------------------------
  // clearData: sign out + clear local state (does NOT wipe Supabase)
  // --------------------------------------------------------------------------
  async function clearData() {
    await supabase.auth.signOut()
    setData(null)
    setError(null)
  }

  const value = {
    data,
    loadData,
    clearData,
    isLoaded:  data !== null,
    isLoading,
    error,
    // Targets
    targets,
    targetsLoading,
    loadTargets,
    saveTargets,
    // Historical data
    historicalData,
    allHistoricalData,
    loadHistoricalData,
    loadAllHistoricalData,
    uploadHistoricalData,
    histUploading,
    histError,
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within a DataProvider')
  return ctx
}
