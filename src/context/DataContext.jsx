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

  // Historical data state (prior year's parsed data)
  const [historicalData, setHistoricalData] = useState(null)

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
      }
    }

    fetchFromSupabase()
  }, [])

  // --------------------------------------------------------------------------
  // loadTargets: fetch agency targets for the given year from Supabase
  // --------------------------------------------------------------------------
  async function loadTargets(year = CURRENT_YEAR) {
    setTargetsLoading(true)
    const { data, error } = await supabase
      .from('agency_targets')
      .select('*')
      .eq('year', year)
      .single()
    if (data) setTargets(data)
    // If no row exists yet, targets stays null (page will show defaults)
    setTargetsLoading(false)
    return data
  }

  // --------------------------------------------------------------------------
  // saveTargets: upsert agency targets for the given year
  // --------------------------------------------------------------------------
  async function saveTargets(targetsData, year = CURRENT_YEAR) {
    const { data, error } = await supabase
      .from('agency_targets')
      .upsert({ year, ...targetsData, updated_at: new Date().toISOString() }, { onConflict: 'year' })
      .select()
      .single()
    if (data) setTargets(data)
    return { data, error }
  }

  // --------------------------------------------------------------------------
  // loadHistoricalData: fetch a prior year's parsed data from agency_data_history
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
    loadHistoricalData,
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
