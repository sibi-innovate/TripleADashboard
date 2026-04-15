// SettingsPage — agency configuration (targets, MDRT goal)
import { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { formatCurrency, formatNumber } from '../utils/formatters'
import { CURRENT_YEAR, MDRT_GOAL_DEFAULT } from '../constants'

export default function SettingsPage() {
  const { targets, loadTargets, saveTargets: saveTargetsCtx, targetsLoading } = useData()

  const [fypTarget,  setFypTarget]  = useState('')
  const [caseTarget, setCaseTarget] = useState('')
  const [prodTarget, setProdTarget] = useState('')
  const [mdrtGoal,   setMdrtGoal]   = useState('')
  const [saved,      setSaved]      = useState(false)
  const [saveError,  setSaveError]  = useState(null)

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
    try {
      await saveTargetsCtx?.({
        fyp_annual:        Number(fypTarget)  || 0,
        cases_annual:      Number(caseTarget) || 0,
        producing_monthly: Number(prodTarget) || 0,
        mdrt_goal:         Number(mdrtGoal)   || MDRT_GOAL_DEFAULT,
        agency_fyp_target: Number(fypTarget)  || 0,
      }, CURRENT_YEAR)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveError(err?.message || 'Failed to save. Check your connection.')
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

          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={handleSave}
              disabled={targetsLoading}
              className="bg-[#D31145] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#b80e3a] transition-colors duration-150 disabled:opacity-50"
            >
              Save Settings
            </button>
            {saved && <span className="text-green-600 text-sm font-semibold">Saved to cloud ✓</span>}
            {saveError && <span className="text-red-500 text-sm">{saveError}</span>}
            {targets?.updated_at && (
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
