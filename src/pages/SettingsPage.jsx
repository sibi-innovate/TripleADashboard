// SettingsPage — agency configuration (targets, MDRT goal)
import { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatNumber } from '../utils/formatters'
import { CURRENT_YEAR, MDRT_GOAL_DEFAULT } from '../constants'

export default function SettingsPage() {
  const { targets, loadTargets, saveTargets: saveTargetsCtx, targetsLoading } = useData()

  const [fypTarget,  setFypTarget]  = useState('')
  const [caseTarget, setCaseTarget] = useState('')
  const [prodTarget, setProdTarget] = useState('')
  const [mdrtGoal,   setMdrtGoal]   = useState('')
  const [saved,      setSaved]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState(null)
  const [user,       setUser]       = useState(undefined) // undefined = checking

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
    }
  }, [targets])

  async function handleSave() {
    setSaveError(null)
    setSaving(true)
    try {
      await saveTargetsCtx({
        fyp_annual:        Number(fypTarget)  || 0,
        cases_annual:      Number(caseTarget) || 0,
        producing_monthly: Number(prodTarget) || 0,
        mdrt_goal:         Number(mdrtGoal)   || MDRT_GOAL_DEFAULT,
        agency_fyp_target: Number(fypTarget)  || 0,
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

  const annualFyp   = Number(fypTarget)   || 0
  const annualCases = Number(caseTarget)  || 0
  const annualProd  = Number(prodTarget)  || 0

  return (
    <div className="min-h-screen bg-gray-50 pb-16" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="max-w-screen-xl mx-auto px-5 pt-8">

        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Agency Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure annual targets and MDRT goal for {CURRENT_YEAR}</p>
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
          </div>

          {/* Auth guard */}
          {user === null && (
            <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              ⚠️ You must be <strong>logged in</strong> to save settings. Use the Upload page to sign in.
            </div>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving || targetsLoading || user === null || user === undefined}
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

      </div>
    </div>
  )
}
