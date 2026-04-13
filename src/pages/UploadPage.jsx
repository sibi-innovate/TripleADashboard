import { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { supabase } from '../lib/supabase'

export default function UploadPage() {
  const { loadData, isLoaded, isLoading, error, data } = useData()
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [isDragging,    setIsDragging]    = useState(false)
  const [localError,    setLocalError]    = useState(null)
  const [adminOpen,     setAdminOpen]     = useState(false)
  const [authUser,      setAuthUser]      = useState(null)
  const [authChecked,   setAuthChecked]   = useState(false)
  const [loginEmail,    setLoginEmail]    = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading,  setLoginLoading]  = useState(false)
  const [loginError,    setLoginError]    = useState(null)

  // Check Supabase session on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthUser(user)
      setAuthChecked(true)
      if (user) setAdminOpen(true)   // auto-open upload zone if already logged in
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Redirect to overview after successful load
  useEffect(() => {
    if (!isLoading && isLoaded && !error) {
      navigate('/overview')
    }
  }, [isLoading, isLoaded, error, navigate])

  // ── Auth handlers ──────────────────────────────────────────────────────────

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError(null)
    setLoginLoading(true)
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
    setLoginLoading(false)
    if (authErr) {
      setLoginError('Invalid email or password.')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      setAuthUser(user)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setAuthUser(null)
    setAdminOpen(false)
  }

  // ── File handlers ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file) => {
    setLocalError(null)
    if (!file) return
    if (!file.name.endsWith('.xlsx') && file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      setLocalError('Only .xlsx files are accepted.')
      return
    }
    const reader = new FileReader()
    reader.onload = async (e) => { await loadData(e.target.result) }
    reader.onerror = () => setLocalError('Failed to read the file. Please try again.')
    reader.readAsArrayBuffer(file)
  }, [loadData])

  const onInputChange  = (e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }
  const onDragOver     = (e) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave    = (e) => { e.preventDefault(); setIsDragging(false) }
  const onDrop         = (e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }
  const onDropZoneClick = () => { if (!isLoading) inputRef.current?.click() }

  const displayError = error || localError

  const uploadDate = data?.uploadDate
    ? new Date(data.uploadDate).toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAFA] via-white to-[#FFF0F3] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(211,17,69,0.15),0_8px_24px_-8px_rgba(0,0,0,0.08)] overflow-hidden">

        {/* Header Band */}
        <div className="relative bg-aia-red px-8 pt-8 pb-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#e8134f] via-aia-red to-[#a80d37]" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex-shrink-0 w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-red-900/20">
              <span className="text-aia-red font-extrabold text-2xl tracking-tight leading-none">AIA</span>
            </div>
            <div>
              <h1 className="text-white font-extrabold text-xl sm:text-2xl leading-tight tracking-tight">
                Amora Assurance Agency
              </h1>
              <p className="text-red-200 text-xs font-semibold mt-0.5 tracking-wide">
                of AIA Philippines · Production Dashboard
              </p>
            </div>
          </div>
          <svg viewBox="0 0 1080 120" className="absolute bottom-0 left-0 w-full h-[60px]" preserveAspectRatio="none">
            <polygon points="0,120 160,30 320,120"  fill="white" opacity="0.12" />
            <polygon points="160,120 380,10 600,120" fill="white" opacity="0.45" />
            <polygon points="420,120 660,20 900,120" fill="white" opacity="0.7" />
            <polygon points="680,120 900,0 1080,120" fill="white" opacity="1" />
          </svg>
        </div>

        {/* Body */}
        <div className="px-8 py-8 flex flex-col gap-5">

          {/* ── Loading state (fetching from Supabase) */}
          {isLoading && !isLoaded && (
            <div className="flex flex-col items-center gap-3 py-6">
              <svg className="w-10 h-10 text-aia-red animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-gray-400 text-sm font-medium">Loading dashboard data…</p>
            </div>
          )}

          {/* ── Data loaded: view dashboard button */}
          {isLoaded && (
            <div className="flex flex-col gap-4">
              {uploadDate && (
                <div className="flex items-center justify-center">
                  <span className="inline-flex items-center gap-2 bg-red-50 text-aia-red text-xs font-semibold px-4 py-2 rounded-full border border-red-100">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Last uploaded: {uploadDate}
                  </span>
                </div>
              )}
              <button
                onClick={() => navigate('/overview')}
                className="w-full bg-aia-red hover:bg-[#b80e3b] text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 text-base shadow-lg shadow-red-200/50 flex items-center justify-center gap-2.5 group"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View Dashboard
              </button>
            </div>
          )}

          {/* ── Admin section toggle */}
          {!isLoading && (
            <div>
              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-gray-200" />
                <button
                  onClick={() => setAdminOpen(v => !v)}
                  className="px-3 text-xs text-gray-400 hover:text-aia-red font-semibold transition-colors"
                >
                  {adminOpen ? '▲ Hide Admin' : '▼ Admin Upload'}
                </button>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              {adminOpen && (
                <div className="mt-4 flex flex-col gap-4">

                  {/* ── Not logged in: login form */}
                  {!authUser && (
                    <form onSubmit={handleLogin} className="flex flex-col gap-3">
                      <p className="text-xs text-gray-500 text-center font-medium">Sign in to upload new data</p>
                      <input
                        type="email"
                        placeholder="Email"
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-aia-red/40 focus:border-aia-red"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-aia-red/40 focus:border-aia-red"
                      />
                      {loginError && (
                        <p className="text-xs text-aia-red font-medium text-center">{loginError}</p>
                      )}
                      <button
                        type="submit"
                        disabled={loginLoading}
                        className="w-full bg-[#333D47] hover:bg-[#222a33] text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors disabled:opacity-60"
                      >
                        {loginLoading ? 'Signing in…' : 'Sign In'}
                      </button>
                    </form>
                  )}

                  {/* ── Logged in: upload zone */}
                  {authUser && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#88B943] font-semibold">
                          ✅ Signed in as {authUser.email}
                        </p>
                        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-aia-red font-medium transition-colors">
                          Sign out
                        </button>
                      </div>

                      {/* Drop zone */}
                      <div
                        role="button"
                        tabIndex={isLoading ? -1 : 0}
                        onClick={onDropZoneClick}
                        onKeyDown={e => e.key === 'Enter' && onDropZoneClick()}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        className={[
                          'flex flex-col items-center justify-center gap-4',
                          'border-2 border-dashed rounded-2xl px-8 py-12',
                          'select-none transition-all duration-200',
                          isLoading
                            ? 'border-gray-200 bg-gray-50/50 cursor-not-allowed'
                            : isDragging
                            ? 'border-aia-red bg-red-50/60 scale-[1.01]'
                            : 'border-gray-300 hover:border-aia-red/60 hover:bg-red-50/30 cursor-pointer',
                        ].join(' ')}
                      >
                        <input
                          ref={inputRef}
                          type="file"
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          className="hidden"
                          onChange={onInputChange}
                          disabled={isLoading}
                        />

                        {isLoading ? (
                          <div className="flex flex-col items-center gap-4">
                            <svg className="w-12 h-12 text-aia-red animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <div className="text-center">
                              <p className="text-aia-red font-bold text-base">Parsing &amp; saving…</p>
                              <p className="text-gray-400 text-sm mt-1">This may take a moment</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${isDragging ? 'bg-aia-red/10 scale-110' : 'bg-gray-100'}`}>
                              <svg className={`w-7 h-7 transition-colors duration-200 ${isDragging ? 'text-aia-red' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                            </div>
                            <div className="text-center">
                              <p className={`font-bold text-base transition-colors duration-200 ${isDragging ? 'text-aia-red' : 'text-gray-700'}`}>
                                Drag &amp; drop your AIA report
                              </p>
                              <p className="text-gray-400 text-sm mt-1.5">
                                or <span className="text-aia-red font-semibold underline underline-offset-2">click to browse</span>
                              </p>
                            </div>
                            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-4 py-1.5 rounded-full font-medium">
                              .xlsx files only
                            </span>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {displayError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5">
              <svg className="w-5 h-5 text-aia-red flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-aia-red font-medium leading-snug">{displayError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gradient-to-r from-gray-50 to-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400 font-medium">AIA Philippines</p>
          <p className="text-xs text-gray-300 font-mono tracking-wider">v2.0</p>
        </div>
      </div>
    </div>
  )
}
