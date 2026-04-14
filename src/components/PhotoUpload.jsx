/**
 * PhotoUpload - camera icon overlay on AgentAvatar; allows uploading 1:1 photo.
 * Only visible to authenticated users.
 *
 * Props:
 *   agentCode: string
 *   agentName: string
 *   onSuccess: function() — called after successful upload
 *
 * Usage: wrap <AgentAvatar> as a child inside this component.
 *   <PhotoUpload agentCode={...} agentName={...} onSuccess={...}>
 *     <AgentAvatar ... />
 *   </PhotoUpload>
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function PhotoUpload({ agentCode, agentName, onSuccess, children }) {
  const [user,     setUser]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const inputRef = useRef(null)

  // Mirror how UploadPage.jsx resolves the auth user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setErrorMsg(null)

    const { error } = await supabase.storage
      .from('agent-photos')
      .upload(`${agentCode}.jpg`, file, { upsert: true, contentType: file.type })

    setLoading(false)

    // Reset input so the same file can be re-selected if needed
    if (inputRef.current) inputRef.current.value = ''

    if (error) {
      setErrorMsg('Upload failed: ' + error.message)
      return
    }

    onSuccess?.()
  }

  return (
    <div className="relative inline-block">
      {/* Slight opacity during upload */}
      <div className={loading ? 'opacity-50 pointer-events-none' : undefined}>
        {children}
      </div>

      {/* Camera button — only rendered for authenticated users */}
      {user && (
        <>
          <button
            type="button"
            title={`Upload photo for ${agentName}`}
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center hover:bg-gray-100 transition-colors"
            style={{ transform: 'translate(25%, 25%)' }}
          >
            {/* Inline camera SVG */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-3 h-3 text-gray-600"
            >
              <path
                fillRule="evenodd"
                d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </>
      )}

      {/* Loading spinner overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="animate-spin w-4 h-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        </div>
      )}

      {/* Brief error message */}
      {errorMsg && (
        <div
          className="absolute left-0 right-0 text-center text-xs text-red-600 bg-white rounded shadow px-1 py-0.5"
          style={{ top: '100%', marginTop: 2, whiteSpace: 'nowrap', zIndex: 10 }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  )
}
