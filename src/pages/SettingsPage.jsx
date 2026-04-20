// SettingsPage — agency configuration (targets, MDRT goal) + historical data upload
import { useState, useEffect, useRef } from 'react'
import { useData } from '../context/DataContext'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatNumber } from '../utils/formatters'
import { CURRENT_YEAR, MDRT_GOAL_DEFAULT } from '../constants'

// ── Compact sign-in / sign-out widget ────────────────────────────────────────
function AuthWidget({ user }) {
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [signing,    setSigning]    = useState(false)
  const [authError,  setAuthError]  = useState(null)

  async function handleSignIn(e) {
    e.preventDefault()
    setAuthError(null)
    setSigning(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSigning(false)
    if (error) setAuthError(error.message)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  // ── Signed in state
  if (user) {
    return (
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-green-800">Signed in as {user.email}</p>
          <p className="text-[11px] text-green-600">Full access to settings and data uploads</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs text-green-700 font-semibold hover:text-green-900 underline underline-offset-2 flex-shrink-0"
        >
          Sign out
        </button>
      </div>
    )
  }

  // ── Signed out: login form
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 className="text-sm font-bold text-gray-700">Sign in to manage settings &amp; upload data</h3>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Admin access is required to save targets and upload historical data.
        Photo uploads are available to everyone without signing in.
      </p>
      <form onSubmit={handleSignIn} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email" required
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
        />
        <input
          type="password" required
          value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
        />
        <button
          type="submit" disabled={signing}
          className="px-5 py-2 bg-[#D31145] text-white text-sm font-semibold rounded-lg hover:bg-[#b80e3a] transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          {signing ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Signing in…
            </>
          ) : 'Sign In'}
        </button>
      </form>
      {authError && (
        <p className="mt-2 text-xs text-red-500">{authError}</p>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const {
    targets, loadTargets, saveTargets: saveTargetsCtx, targetsLoading,
    historicalData, allHistoricalData, uploadHistoricalData, histUploading, histError,
  } = useData()

  const [fypTarget,     setFypTarget]     = useState('')
  const [caseTarget,    setCaseTarget]    = useState('')
  const [prodTarget,    setProdTarget]    = useState('')
  const [mdrtGoal,      setMdrtGoal]      = useState('')
  const [agencyRank,    setAgencyRank]    = useState('')
  const [totalAgencies, setTotalAgencies] = useState('')
  const [saved,      setSaved]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState(null)
  const [user,       setUser]       = useState(undefined) // undefined = checking

  // Historical data upload state
  const [histYear,       setHistYear]       = useState(CURRENT_YEAR - 1)
  const [histFile,       setHistFile]       = useState(null)
  const [histDone,       setHistDone]       = useState(false)
  const histInputRef = useRef(null)

  // Watch auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { loadTargets?.(CURRENT_YEAR) }, [])
  useEffect(() => {
    if (targets) {
      setFypTarget(String(targets.fyp_annual        || ''))
      setCaseTarget(String(targets.cases_annual     || ''))
      setProdTarget(String(targets.producing_monthly|| ''))
      setMdrtGoal(String(targets.mdrt_goal          || ''))
      setAgencyRank(String(targets.agency_rank      || ''))
      setTotalAgencies(String(targets.total_agencies|| ''))
    }
  }, [targets])

  async function handleSave() {
    setSaveError(null)
    setSaving(true)
    try {
      await saveTargetsCtx({
        fyp_annual:        Number(fypTarget)      || 0,
        cases_annual:      Number(caseTarget)     || 0,
        producing_monthly: Number(prodTarget)     || 0,
        mdrt_goal:         Number(mdrtGoal)       || MDRT_GOAL_DEFAULT,
        agency_fyp_target: Number(fypTarget)      || 0,
        agency_rank:       Number(agencyRank)     || null,
        total_agencies:    Number(totalAgencies)  || null,
      }, CURRENT_YEAR)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      const msg = err?.message || ''
      if (msg.includes('row-level security') || msg.includes('policy')) {
        setSaveError('Permission denied. Run the RLS policy SQL in your Supabase dashboard first (see CLAUDE.md or ask your admin).')
      } else {
        setSaveError(msg || 'Failed to save. Check your connection.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleHistUpload() {
    if (!histFile) return
    setHistDone(false)
    try {
      const buf = await histFile.arrayBuffer()
      await uploadHistoricalData(buf, histYear)
      setHistDone(true)
      setHistFile(null)
      if (histInputRef.current) histInputRef.current.value = ''
      setTimeout(() => setHistDone(false), 4000)
    } catch {
      // error already in histError from context
    }
  }

  const annualFyp   = Number(fypTarget)   || 0
  const annualCases = Number(caseTarget)  || 0
  const annualProd  = Number(prodTarget)  || 0

  return (
    <div className="min-h-screen bg-gray-50 pb-16" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="max-w-screen-xl mx-auto px-5 pt-8">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Agency Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure annual targets and MDRT goal for {CURRENT_YEAR}</p>
        </div>

        {/* Auth widget */}
        <div className="max-w-2xl mb-6">
          {user !== undefined && <AuthWidget user={user} />}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          <h2 className="text-base font-bold text-gray-700 mb-1">Annual Targets</h2>
          <p className="text-xs text-gray-400 mb-5">
            Targets spread over 11 months (Jan–Nov). December is target-free.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Annual MDRT Goal (₱) — changes yearly
              </label>
              <input
                type="number" value={mdrtGoal}
                onChange={e => setMdrtGoal(e.target.value)}
                placeholder={`e.g. ${MDRT_GOAL_DEFAULT}`}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
              />
              <p className="text-[11px] text-gray-400 mt-1">Used for advisor tier classification and awards</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Year-End FYP Target (₱)
              </label>
              <input
                type="number" value={fypTarget}
                onChange={e => setFypTarget(e.target.value)}
                placeholder="e.g. 10000000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
              />
              {annualFyp > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Monthly base: {formatCurrency(annualFyp / 11, true)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Year-End Case Count Target
              </label>
              <input
                type="number" value={caseTarget}
                onChange={e => setCaseTarget(e.target.value)}
                placeholder="e.g. 500"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
              />
              {annualCases > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Monthly base: {formatNumber(Math.round(annualCases / 11))} cases
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Monthly Producing Advisors Target
              </label>
              <input
                type="number" value={prodTarget}
                onChange={e => setProdTarget(e.target.value)}
                placeholder="e.g. 60"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
              />
              {annualProd > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">Monthly target: {formatNumber(annualProd)} advisors</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Our Agency Rank (vs. all AIA Philippines agencies)
              </label>
              <input
                type="number" value={agencyRank}
                onChange={e => setAgencyRank(e.target.value)}
                placeholder="e.g. 12"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
              />
              <p className="text-[11px] text-gray-400 mt-1">Enter manually from AIA ranking reports</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Total AIA Philippines Agencies
              </label>
              <input
                type="number" value={totalAgencies}
                onChange={e => setTotalAgencies(e.target.value)}
                placeholder="e.g. 120"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving || targetsLoading || !user}
              className="bg-[#D31145] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#b80e3a] transition-colors duration-150 disabled:opacity-50 min-w-[120px] flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Saving…
                </>
              ) : 'Save Settings'}
            </button>
            {saved && (
              <span className="text-green-600 text-sm font-semibold flex items-center gap-1">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 8l3.5 3.5L13 4.5"/></svg>
                Saved to cloud
              </span>
            )}
            {saveError && (
              <p className="text-red-500 text-xs max-w-sm leading-relaxed">{saveError}</p>
            )}
            {targets?.updated_at && !saveError && (
              <span className="text-xs text-gray-400">
                Last saved {new Date(targets.updated_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* ── Historical Data ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl mt-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-gray-700">Historical Data</h2>
            {!user && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Sign in required
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Upload performance reports for any year to enable multi-year trend analysis and year-over-year comparisons.
            Uploading <strong>{CURRENT_YEAR}</strong> will overwrite the current data.
          </p>

          {/* Year status grid — shows which years have data */}
          {Object.keys(allHistoricalData ?? {}).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i).map(y => {
                const hasData = y === CURRENT_YEAR
                  ? true // current year always loaded if we're on this page
                  : !!allHistoricalData?.[y]
                return (
                  <span key={y} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${hasData ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                    {hasData && <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5"><path d="M1.5 5l2.5 2.5L8.5 2.5"/></svg>}
                    {y}
                  </span>
                )
              })}
            </div>
          )}

          {user ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                {/* Year selector — 8 years */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
                  <select
                    value={histYear}
                    onChange={e => setHistYear(Number(e.target.value))}
                    className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D31145]/30 focus:border-[#D31145]"
                  >
                    {Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i).map(y => (
                      <option key={y} value={y}>{y}{y === CURRENT_YEAR ? ' (current — overwrites)' : ''}</option>
                    ))}
                  </select>
                </div>

                {/* File picker */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Excel File (.xlsx)</label>
                  <input
                    ref={histInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={e => setHistFile(e.target.files?.[0] ?? null)}
                    className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                </div>

                {/* Upload button */}
                <button
                  onClick={handleHistUpload}
                  disabled={!histFile || histUploading}
                  className="h-9 px-5 bg-[#D31145] text-white text-sm font-semibold rounded-lg hover:bg-[#b80e3a] transition-colors disabled:opacity-40 flex items-center gap-2"
                >
                  {histUploading ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Uploading…
                    </>
                  ) : `Upload ${histYear} Data`}
                </button>
              </div>

              {/* Feedback */}
              {histDone && (
                <p className="mt-3 text-sm text-green-600 font-semibold flex items-center gap-1">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 8l3.5 3.5L13 4.5"/></svg>
                  {histYear === CURRENT_YEAR
                    ? `${histYear} data updated — current year dashboard refreshed.`
                    : `${histYear} data uploaded — available in Historical Analysis.`}
                </p>
              )}
              {histError && (
                <p className="mt-3 text-xs text-red-500 leading-relaxed">{histError}</p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500">
              <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Sign in above to upload historical performance data.
            </div>
          )}

          <p className="text-[11px] text-gray-400 mt-4">
            The file must use the same column format as the current year report. Only data for the selected year is stored — your current {CURRENT_YEAR} data is not affected.
          </p>
        </div>

      </div>
    </div>
  )
}
