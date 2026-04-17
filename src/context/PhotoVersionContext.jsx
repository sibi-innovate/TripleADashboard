/**
 * PhotoVersionContext — global counter that increments whenever any agent photo
 * is uploaded. AgentAvatar appends ?v=N to its Supabase URL so all mounted
 * avatars automatically refetch the latest image after an upload.
 */
import { createContext, useContext, useState, useCallback } from 'react'

const PhotoVersionContext = createContext({ version: 0, bumpPhotoVersion: () => {} })

export function PhotoVersionProvider({ children }) {
  const [version, setVersion] = useState(0)
  const bumpPhotoVersion = useCallback(() => setVersion(v => v + 1), [])
  return (
    <PhotoVersionContext.Provider value={{ version, bumpPhotoVersion }}>
      {children}
    </PhotoVersionContext.Provider>
  )
}

export function usePhotoVersion() {
  return useContext(PhotoVersionContext)
}
