import { createContext, useContext, useState, useEffect } from 'react'
import { parseExcelFile } from '../utils/parseExcel'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DataContext = createContext(null)

const STORAGE_KEY = 'davao-amora-data'

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DataProvider({ children }) {
  const [data,      setData]      = useState(null)   // { agents, agencyKpis, units, uploadDate }
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState(null)

  // On mount: try to restore from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setData(parsed)
      }
    } catch (e) {
      // Corrupted or oversized entry – clear it so the UI stays usable
      console.warn('DataContext: could not restore from localStorage:', e)
      try { localStorage.removeItem(STORAGE_KEY) } catch (_) { /* ignore */ }
    }
  }, [])

  // --------------------------------------------------------------------------
  // loadData: accepts an ArrayBuffer produced by FileReader.readAsArrayBuffer
  // --------------------------------------------------------------------------
  async function loadData(arrayBuffer) {
    setIsLoading(true)
    setError(null)

    try {
      // parseExcelFile is synchronous but can be slow on large files;
      // wrapping in a Promise keeps the UI from locking up by yielding first.
      const result = await new Promise((resolve, reject) => {
        // Yield to the event loop so React can repaint (e.g. show a spinner)
        setTimeout(() => {
          try {
            resolve(parseExcelFile(arrayBuffer))
          } catch (err) {
            reject(err)
          }
        }, 0)
      })

      setData(result)

      // Persist to localStorage; if quota is exceeded, keep data in memory only
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
      } catch (storageErr) {
        console.warn(
          'DataContext: localStorage quota exceeded – data kept in memory only.',
          storageErr
        )
      }
    } catch (err) {
      console.error('DataContext: parseExcelFile failed:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  // --------------------------------------------------------------------------
  // clearData
  // --------------------------------------------------------------------------
  function clearData() {
    setData(null)
    setError(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch (_) { /* ignore */ }
  }

  // --------------------------------------------------------------------------
  // Context value
  // --------------------------------------------------------------------------
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
