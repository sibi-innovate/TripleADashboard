import { createContext, useContext, useState, useEffect } from 'react'
import { parseExcelFile } from '../utils/parseExcel'
import { supabase } from '../lib/supabase'

const DataContext = createContext(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DataProvider({ children }) {
  const [data,      setData]      = useState(null)
  const [isLoading, setIsLoading] = useState(true)   // true on mount while fetching
  const [error,     setError]     = useState(null)

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
      }
    }

    fetchFromSupabase()
  }, [])

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

      // Save to Supabase (requires authenticated session via RLS)
      const { error: saveError } = await supabase
        .from('agency_data')
        .upsert({ id: 1, data: result, uploaded_at: new Date().toISOString() })

      if (saveError) throw new Error('Upload failed: ' + saveError.message)

      setData(result)
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
