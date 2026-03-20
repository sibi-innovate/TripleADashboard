# Monthly Report & Quarterly Bonus Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Monthly Report tab (month-filtered KPIs, highlights, new recruits) and a Quarterly Bonus Tracker tab (computed bonus per advisor with next-tier motivation), plus rename Tenured/Senior → Seasoned globally.

**Architecture:** All monthly data is parsed into a `monthly` object on each agent in `parseExcel.js`. The two new React pages are pure computation from that data — no backend. Segment rename is a single-line change in the parser that cascades everywhere.

**Tech Stack:** React 18, Vite 5, SheetJS (xlsx), Recharts, Tailwind CSS, React Router v6, Plus Jakarta Sans font.

---

## Task 1: Global segment rename — Rookie / Seasoned only

**Files:**
- Modify: `src/utils/parseExcel.js` (segment derivation, ~line 133–137)
- Modify: `src/pages/OverviewPage.jsx` (SEGMENTS constant)
- Modify: `src/pages/LeaderboardPage.jsx` (SEGMENTS constant + SEGMENT_BADGE)
- Modify: `src/pages/UnitsPage.jsx` (segment references)
- Modify: `src/pages/AgentsPage.jsx` (SEGMENTS constant + badge colors)

**Step 1: Update segment derivation in parseExcel.js**

In `parseAgentRow`, replace the segment block (around line 133):

```js
if (agentYear != null) {
  if (agentYear <= 1) segment = 'Rookie'
  else                segment = 'Seasoned'
}
```

**Step 2: Update OverviewPage.jsx SEGMENTS constant**

```js
const SEGMENTS = [
  { label: 'All',     key: 'All' },
  { label: 'Rookie',  key: 'Rookie' },
  { label: 'Seasoned', key: 'Seasoned' },
]
```

Also update `SEGMENT_COLORS`:
```js
const SEGMENT_COLORS = {
  Rookie:   AIA_RED,
  Seasoned: '#FF754D',
}
```

**Step 3: Update LeaderboardPage.jsx**

```js
const SEGMENTS = ['All', 'Rookie', 'Seasoned']

const SEGMENT_BADGE = {
  Rookie:  'bg-red-100 text-red-700',
  Seasoned: 'bg-orange-100 text-orange-700',
  Unknown: 'bg-gray-100 text-gray-500',
}
```

**Step 4: Update AgentsPage.jsx**

Find `SEGMENTS` constant and replace Tenured/Senior with Seasoned. Update any badge color map similarly.

**Step 5: Update UnitsPage.jsx**

Any references to `segment === 'Tenured'` or `segment === 'Senior'` → `segment === 'Seasoned'`. Column headers "Tenured" → "Seasoned".

**Step 6: Verify in browser**

Open preview at `http://localhost:5173/leaderboard`. Confirm segment filter shows "Rookie" and "Seasoned" only. No "Senior" or "Tenured" anywhere.

**Step 7: Commit**
```bash
git add src/utils/parseExcel.js src/pages/OverviewPage.jsx src/pages/LeaderboardPage.jsx src/pages/UnitsPage.jsx src/pages/AgentsPage.jsx
git commit -m "feat: rename segments to Rookie/Seasoned globally, remove Senior"
```

---

## Task 2: Extend parseExcel.js — add monthly data per agent

**Files:**
- Modify: `src/utils/parseExcel.js` — `parseAgentRow` function

**Step 1: Add month helpers at top of file (after existing MONTH_ABBRS/MONTH_LABELS)**

These already exist as module-level constants. Reuse them.

**Step 2: Add monthly data object in parseAgentRow, after the existing monthlyAnp block**

```js
// --- Monthly data (all 12 months)
const MONTH_NUMS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const monthly = {}
for (let i = 0; i < 12; i++) {
  const abbr = MONTH_ABBRS[i]   // e.g. 'JAN'
  const num2 = MONTH_NUMS[i]    // e.g. '01'
  monthly[abbr] = {
    fyc:        getNum(`FYC_PHP_${currentYear}${num2}`),
    anp:        getNum(`ANP_${abbr}${currentYear}`),
    fyp:        getNum(`FYPI_${abbr}${currentYear}`),
    cases:      getNum(`OL_VUL_CS_CNT_${abbr}${currentYear}`),
    producing:  num(get(`PRODUCING_${abbr}${currentYear}`)) === 1,
    persistency: (() => {
      const raw = get(`PERS_${abbr}${currentYear}`)
      if (raw === '' || raw == null) return null
      const pct = Number(raw)
      return isNaN(pct) ? null : pct
    })(),
    manpower:   getNum(`ManPowerCnt_${abbr}${currentYear}`),
    isNewRecruit: num(get(`NEW_RECRUIT_${abbr}${currentYear}`)) === 1,
  }
}

// --- Quarterly persistency
const quarterlyPers = {}
for (let q = 1; q <= 4; q++) {
  const raw = get(`PERS_Q${q}${currentYear}`)
  if (raw === '' || raw == null) {
    quarterlyPers[`Q${q}`] = null
  } else {
    const pct = Number(raw)
    quarterlyPers[`Q${q}`] = isNaN(pct) ? null : pct
  }
}

// --- Recruiter info
const recruiterName = parseName(String(get('RECRUITER_NAME') ?? '').trim())
const recruiterCode = String(get('RECRUITER_CODE') ?? '').trim()
```

**Step 3: Add new fields to the returned object**

```js
return {
  // ... existing fields ...
  monthly,
  quarterlyPers,
  recruiterName,
  recruiterCode,
}
```

**Step 4: Verify data in browser console**

Open browser console at `/overview`, run:
```js
const d = JSON.parse(localStorage.getItem('davao-amora-data'))
const a = d.agents[0]
console.log(a.monthly.JAN)
// Expected: { fyc: <number>, anp: <number>, ... isNewRecruit: false }
console.log(a.quarterlyPers)
// Expected: { Q1: <number or null>, Q2: null, Q3: null, Q4: null }
console.log(a.recruiterName)
```

Re-upload the Excel file to repopulate localStorage with new data shape.

**Step 5: Commit**
```bash
git add src/utils/parseExcel.js
git commit -m "feat: add monthly, quarterlyPers, recruiterName to agent data"
```

---

## Task 3: Add routes and navbar links

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Navbar.jsx`

**Step 1: Add routes in App.jsx**

Import the two new pages and add routes:
```jsx
import MonthlyReportPage   from './pages/MonthlyReportPage'
import QuarterlyBonusPage  from './pages/QuarterlyBonusPage'

// Inside <Routes>:
<Route path="/monthly"          element={<MonthlyReportPage />} />
<Route path="/quarterly-bonus"  element={<QuarterlyBonusPage />} />
```

**Step 2: Add nav links in Navbar.jsx**

Add after Leaderboard link, before Units:
```jsx
<NavLink to="/monthly">Monthly</NavLink>
<NavLink to="/quarterly-bonus">Quarterly Bonus</NavLink>
```

Match the existing NavLink style pattern already in the component.

**Step 3: Create placeholder pages so app doesn't crash**

`src/pages/MonthlyReportPage.jsx`:
```jsx
export default function MonthlyReportPage() {
  return <div className="p-8 text-aia-darkGray">Monthly Report — coming soon</div>
}
```

`src/pages/QuarterlyBonusPage.jsx`:
```jsx
export default function QuarterlyBonusPage() {
  return <div className="p-8 text-aia-darkGray">Quarterly Bonus — coming soon</div>
}
```

**Step 4: Verify nav renders without crash**

Screenshot the navbar. Both links should appear. Clicking them shows placeholder text.

**Step 5: Commit**
```bash
git add src/App.jsx src/components/Navbar.jsx src/pages/MonthlyReportPage.jsx src/pages/QuarterlyBonusPage.jsx
git commit -m "feat: add Monthly and Quarterly Bonus routes and nav links"
```

---

## Task 4: Monthly Report page — month selector + KPI cards

**Files:**
- Modify: `src/pages/MonthlyReportPage.jsx` (full implementation, replacing placeholder)

**Step 1: Month constants and helpers**

```js
const MONTH_ABBRS  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_NUMS   = ['01','02','03','04','05','06','07','08','09','10','11','12']

// Available months = Jan through current month
const currentMonthIdx = new Date().getMonth() // 0-based; March 2026 → 2
const AVAILABLE_MONTHS = MONTH_ABBRS.slice(0, currentMonthIdx + 1)
  .map((abbr, i) => ({ abbr, label: MONTH_LABELS[i], num: MONTH_NUMS[i] }))
```

**Step 2: Hooks setup**

```jsx
export default function MonthlyReportPage() {
  const { data, isLoaded } = useData()
  const navigate = useNavigate()

  const [selectedMonth, setSelectedMonth] = useState(
    AVAILABLE_MONTHS[AVAILABLE_MONTHS.length - 1].abbr  // default: latest month
  )
  const [highlightTab, setHighlightTab] = useState('FYC')  // 'FYC' | 'FYP' | 'Cases'
  const [segmentView, setSegmentView] = useState('Overall') // 'Overall' | 'BySegment'

  // All useMemo before early return (Rules of Hooks)
  const agents = data?.agents ?? []

  const monthData = useMemo(() => {
    return agents.map(a => ({
      ...a,
      m: a.monthly?.[selectedMonth] ?? {},
    }))
  }, [agents, selectedMonth])

  if (!isLoaded) { navigate('/'); return null }
  // ...
}
```

**Step 3: KPI computation**

```js
const mon = selectedMonth  // e.g. 'JAN'
const totalManpower    = monthData.reduce((s, a) => s + (a.m.manpower || 0), 0)
const producingCount   = monthData.filter(a => a.m.producing).length
const totalAnp         = monthData.reduce((s, a) => s + (a.m.anp || 0), 0)
const totalFyc         = monthData.reduce((s, a) => s + (a.m.fyc || 0), 0)
const totalFyp         = monthData.reduce((s, a) => s + (a.m.fyp || 0), 0)
const totalCases       = monthData.reduce((s, a) => s + (a.m.cases || 0), 0)
const persValues       = monthData.map(a => a.m.persistency).filter(v => v !== null && v > 0)
const avgPersistency   = persValues.length ? persValues.reduce((s,v) => s+v, 0) / persValues.length : null
```

**Step 4: KPI cards layout**

Use the existing `KpiCard` component. 7 cards in a responsive grid.

```jsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
  <KpiCard title="Manpower"          value={formatNumber(totalManpower)}  color="blue" />
  <KpiCard title="Producing Advisors" value={formatNumber(producingCount)} color="green" />
  <KpiCard title="ANP"               value={formatCurrency(totalAnp, true)} color="red" />
  <KpiCard title="FYC"               value={formatCurrency(totalFyc, true)} color="red" />
  <KpiCard title="FYP"               value={formatCurrency(totalFyp, true)} color="red" />
  <KpiCard title="Cases"             value={formatNumber(totalCases)}     color="gray" />
  <KpiCard title="Avg Persistency"
           value={avgPersistency != null ? `${avgPersistency.toFixed(1)}%` : '—'}
           color="gray" />
</div>
```

**Step 5: Verify KPI cards render with correct values**

Screenshot the monthly page. KPI cards should show non-zero values for January or March (months with real data).

---

## Task 5: Monthly Report — Highlights section (Top 10)

**Files:**
- Modify: `src/pages/MonthlyReportPage.jsx`

**Step 1: Sorted top-10 lists**

```js
const sortedByFyc   = [...monthData].sort((a,b) => (b.m.fyc||0) - (a.m.fyc||0))
const sortedByFyp   = [...monthData].sort((a,b) => (b.m.fyp||0) - (a.m.fyp||0))
const sortedByCases = [...monthData].sort((a,b) => (b.m.cases||0) - (a.m.cases||0))

function getTop10(sorted) {
  return {
    overall: sorted.filter(a => (a.m.fyc||0)+(a.m.fyp||0)+(a.m.cases||0) > 0 || true).slice(0, 10),
    rookie:  sorted.filter(a => a.segment === 'Rookie').slice(0, 10),
    seasoned: sorted.filter(a => a.segment === 'Seasoned').slice(0, 10),
  }
}
// Use the right sorted array per tab:
const top10 = highlightTab === 'FYC' ? getTop10(sortedByFyc)
            : highlightTab === 'FYP' ? getTop10(sortedByFyp)
            : getTop10(sortedByCases)
```

**Step 2: Highlight table component (inline, not a separate file)**

```jsx
function HighlightTable({ title, rows, valueKey, valueLabel, formatFn }) {
  const MEDAL = ['🥇','🥈','🥉']
  return (
    <div className="flex-1 min-w-0">
      {title && <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</p>}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-aia-red text-white text-xs">
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Advisor</th>
              <th className="px-3 py-2 text-right">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, idx) => (
              <tr key={a.code ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-3 py-2 font-bold text-gray-500">
                  {idx < 3 ? MEDAL[idx] : idx + 1}
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold text-aia-darkGray text-xs leading-tight">{a.name}</div>
                  <div className="text-xs text-gray-400">{a.segment}</div>
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-aia-darkGray text-xs">
                  {formatFn(a.m[valueKey] || 0)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-400">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 3: Highlights section JSX**

```jsx
{/* Highlight sub-tabs */}
<div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 w-fit">
  {['FYC','FYP','Cases'].map(tab => (
    <button key={tab}
      onClick={() => setHighlightTab(tab)}
      className={['px-4 py-1.5 rounded-md text-sm font-semibold transition-colors',
        highlightTab === tab ? 'bg-aia-red text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
      ].join(' ')}
    >{tab}</button>
  ))}
</div>

{/* Overall / By Segment toggle */}
<div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 w-fit">
  {['Overall','By Segment'].map(v => (
    <button key={v}
      onClick={() => setSegmentView(v)}
      className={['px-4 py-1.5 rounded-md text-sm font-semibold transition-colors',
        segmentView === v ? 'bg-aia-darkGray text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
      ].join(' ')}
    >{v}</button>
  ))}
</div>

{/* Tables */}
<div className={segmentView === 'Overall' ? '' : 'flex gap-4'}>
  {segmentView === 'Overall' ? (
    <HighlightTable
      rows={top10.overall}
      valueKey={highlightTab === 'FYC' ? 'fyc' : highlightTab === 'FYP' ? 'fyp' : 'cases'}
      valueLabel={highlightTab}
      formatFn={highlightTab === 'Cases' ? formatNumber : v => formatCurrency(v, true)}
    />
  ) : (
    <>
      <HighlightTable title="Rookie" rows={top10.rookie}
        valueKey={highlightTab === 'FYC' ? 'fyc' : highlightTab === 'FYP' ? 'fyp' : 'cases'}
        valueLabel={highlightTab}
        formatFn={highlightTab === 'Cases' ? formatNumber : v => formatCurrency(v, true)}
      />
      <HighlightTable title="Seasoned" rows={top10.seasoned}
        valueKey={highlightTab === 'FYC' ? 'fyc' : highlightTab === 'FYP' ? 'fyp' : 'cases'}
        valueLabel={highlightTab}
        formatFn={highlightTab === 'Cases' ? formatNumber : v => formatCurrency(v, true)}
      />
    </>
  )}
</div>
```

**Step 4: Verify in browser**

Check that top 10 renders, Overall shows 10 rows, By Segment shows 2 columns side by side.

---

## Task 6: Monthly Report — New Recruits section

**Files:**
- Modify: `src/pages/MonthlyReportPage.jsx`

**Step 1: Compute new recruits and top recruiters**

```js
const newRecruits = useMemo(() =>
  monthData.filter(a => a.m.isNewRecruit),
  [monthData]
)

const topRecruiters = useMemo(() => {
  const map = new Map()
  for (const a of newRecruits) {
    const rName = a.recruiterName || 'Unknown'
    const rCode = a.recruiterCode || rName
    if (!map.has(rCode)) map.set(rCode, { name: rName, count: 0, recruits: [] })
    const r = map.get(rCode)
    r.count++
    r.recruits.push(a.name)
  }
  return [...map.values()].sort((a,b) => b.count - a.count)
}, [newRecruits])
```

**Step 2: New Recruits section JSX**

```jsx
{newRecruits.length > 0 && (
  <section>
    <h2 className="text-base font-bold text-aia-darkGray mb-3">
      New Recruits — {MONTH_LABELS[MONTH_ABBRS.indexOf(selectedMonth)]}
      <span className="ml-2 text-sm font-semibold text-aia-red">({newRecruits.length})</span>
    </h2>

    {/* Top Recruiters podium */}
    {topRecruiters.length > 0 && (
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Top Recruiters</p>
        <div className="flex gap-3 flex-wrap">
          {topRecruiters.slice(0, 5).map((r, idx) => {
            const MEDAL = ['🥇','🥈','🥉','4th','5th']
            return (
              <div key={r.name} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 min-w-[180px]">
                <span className="text-2xl">{idx < 3 ? MEDAL[idx] : ''}</span>
                <div>
                  <div className="font-bold text-aia-darkGray text-sm">{r.name}</div>
                  <div className="text-xs text-gray-400">{r.count} recruit{r.count !== 1 ? 's' : ''}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )}

    {/* Recruits list */}
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-bold uppercase tracking-wide">
            <th className="px-4 py-2 text-left">New Advisor</th>
            <th className="px-4 py-2 text-left">Segment</th>
            <th className="px-4 py-2 text-left">Area</th>
            <th className="px-4 py-2 text-left">Recruiter</th>
          </tr>
        </thead>
        <tbody>
          {newRecruits.map((a, idx) => (
            <tr key={a.code ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              <td className="px-4 py-2 font-semibold text-aia-darkGray">{a.name}</td>
              <td className="px-4 py-2"><span className="text-xs font-semibold bg-red-50 text-red-600 px-2 py-0.5 rounded">{a.segment}</span></td>
              <td className="px-4 py-2 text-xs text-gray-500">{a.area?.includes('SCM2') ? 'Davao' : 'Gensan'}</td>
              <td className="px-4 py-2 text-xs text-gray-600">{a.recruiterName || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
)}

{newRecruits.length === 0 && (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-8 text-center text-sm text-gray-400">
    No new recruits for {MONTH_LABELS[MONTH_ABBRS.indexOf(selectedMonth)]}.
  </div>
)}
```

**Step 3: Verify in browser**

Screenshot the Monthly Report page. If March 2026 data is loaded, new recruits section should appear (or show "No new recruits" message if none for that month).

**Step 4: Commit**
```bash
git add src/pages/MonthlyReportPage.jsx
git commit -m "feat: Monthly Report page — KPIs, highlights, new recruits"
```

---

## Task 7: Quarterly Bonus Tracker page

**Files:**
- Modify: `src/pages/QuarterlyBonusPage.jsx`

**Step 1: Bonus calculation helpers (at top of file, outside component)**

```js
const FYC_TIERS = [
  { min: 350000, rate: 0.40, label: '₱350K+' },
  { min: 200000, rate: 0.35, label: '₱200K–349K' },
  { min: 120000, rate: 0.30, label: '₱120K–199K' },
  { min:  80000, rate: 0.20, label: '₱80K–119K' },
  { min:  50000, rate: 0.15, label: '₱50K–79K' },
  { min:  30000, rate: 0.10, label: '₱30K–49K' },
  { min:      0, rate: 0.00, label: 'Below ₱30K' },
]

const CCB_TIERS = [
  { min: 9, rate: 0.20, label: '9+ cases' },
  { min: 7, rate: 0.15, label: '7–8 cases' },
  { min: 5, rate: 0.10, label: '5–6 cases' },
  { min: 3, rate: 0.05, label: '3–4 cases' },
  { min: 0, rate: 0.00, label: '<3 cases' },
]

function getFycTier(fyc) {
  return FYC_TIERS.find(t => fyc >= t.min) ?? FYC_TIERS[FYC_TIERS.length - 1]
}

function getCcbTier(cases) {
  return CCB_TIERS.find(t => cases >= t.min) ?? CCB_TIERS[CCB_TIERS.length - 1]
}

function getNextFycTier(fyc) {
  // Find the tier above current
  const currentIdx = FYC_TIERS.findIndex(t => fyc >= t.min)
  return currentIdx > 0 ? FYC_TIERS[currentIdx - 1] : null
}

function getNextCcbTier(cases) {
  const currentIdx = CCB_TIERS.findIndex(t => cases >= t.min)
  return currentIdx > 0 ? CCB_TIERS[currentIdx - 1] : null
}

function getPersMultiplier(pers) {
  // pers: number (e.g. 82.5) or null
  if (pers === null) return 1.0          // default 82.5% → full bonus
  if (pers >= 82.5)  return 1.0
  if (pers >= 75.0)  return 0.8
  return 0.0
}

// Quarter month indices (0-based)
const QUARTER_MONTHS = {
  Q1: [0, 1, 2],   // Jan Feb Mar
  Q2: [3, 4, 5],   // Apr May Jun
  Q3: [6, 7, 8],   // Jul Aug Sep
  Q4: [9, 10, 11], // Oct Nov Dec
}
const MONTH_ABBRS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function computeAdvisorBonus(agent, quarter) {
  const monthIdxs = QUARTER_MONTHS[quarter]
  const months    = monthIdxs.map(i => agent.monthly?.[MONTH_ABBRS[i]] ?? {})

  // Quarterly FYC
  const qtlyFyc = months.reduce((s, m) => s + (m.fyc || 0), 0)

  // Quarterly cases and eligibility
  const monthlyCases = months.map(m => m.cases || 0)
  const qtlyCases    = monthlyCases.reduce((s, c) => s + c, 0)
  const monthsWithCases = monthlyCases.filter(c => c > 0).length
  const ccbEligible  = monthsWithCases >= 2

  // Persistency
  const persRaw = agent.quarterlyPers?.[quarter] ?? null
  const persMultiplier = getPersMultiplier(persRaw)

  // Current tiers
  const fycTier = getFycTier(qtlyFyc)
  const ccbTier = ccbEligible ? getCcbTier(qtlyCases) : CCB_TIERS[CCB_TIERS.length - 1]

  const fycBonus = qtlyFyc * fycTier.rate
  const ccbBonus = ccbEligible ? qtlyFyc * ccbTier.rate : 0
  const totalBonus = (fycBonus + ccbBonus) * persMultiplier

  // Potential (next tiers)
  const nextFycTier = getNextFycTier(qtlyFyc)
  const nextCcbTier = ccbEligible ? getNextCcbTier(qtlyCases) : null

  const potentialFycBonus = nextFycTier
    ? qtlyFyc * nextFycTier.rate
    : fycBonus
  const potentialCcbBonus = nextCcbTier
    ? qtlyFyc * nextCcbTier.rate
    : ccbBonus
  const potentialBonus = (potentialFycBonus + potentialCcbBonus) * persMultiplier

  // Hints
  const hints = []
  if (nextFycTier) {
    const gap = nextFycTier.min - qtlyFyc
    hints.push(`+₱${gap.toLocaleString()} FYC → ${(nextFycTier.rate * 100).toFixed(0)}% tier`)
  }
  if (nextCcbTier) {
    const casesNeeded = nextCcbTier.min - qtlyCases
    hints.push(`+${casesNeeded} case${casesNeeded !== 1 ? 's' : ''} → ${(nextCcbTier.rate * 100).toFixed(0)}% CCB`)
  }
  if (!ccbEligible && qtlyCases > 0) {
    hints.push('Need cases in 2 months for CCB')
  }

  return {
    qtlyFyc,
    qtlyCases,
    monthlyCases,
    ccbEligible,
    fycTierLabel: fycTier.label,
    fycRate: fycTier.rate,
    ccbRate: ccbTier.rate,
    fycBonus,
    ccbBonus,
    persRaw,
    persMultiplier,
    totalBonus,
    potentialBonus,
    gainIfNext: potentialBonus - totalBonus,
    hints,
  }
}
```

**Step 2: Component hooks and state**

```jsx
export default function QuarterlyBonusPage() {
  const { data, isLoaded } = useData()
  const navigate = useNavigate()

  const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`

  const [quarter,    setQuarter]    = useState(currentQuarter)
  const [areaFilter, setAreaFilter] = useState('All')
  const [segFilter,  setSegFilter]  = useState('All')
  const [search,     setSearch]     = useState('')
  const [showOnly,   setShowOnly]   = useState('All') // 'All' | 'Qualifying'

  const agents = data?.agents ?? []

  const bonusRows = useMemo(() => {
    return agents
      .map(agent => ({
        ...agent,
        bonus: computeAdvisorBonus(agent, quarter),
      }))
      .filter(a => {
        if (areaFilter !== 'All' && a.area !== areaFilter) return false
        if (segFilter  !== 'All' && a.segment !== segFilter) return false
        if (showOnly === 'Qualifying' && a.bonus.qtlyFyc < 30000) return false
        if (search.trim()) {
          const q = search.trim().toLowerCase()
          if (!a.name?.toLowerCase().includes(q)) return false
        }
        return true
      })
      .sort((a, b) => b.bonus.totalBonus - a.bonus.totalBonus)
  }, [agents, quarter, areaFilter, segFilter, showOnly, search])

  if (!isLoaded) { navigate('/'); return null }

  // Summary stats
  const totalBonusPool = bonusRows.reduce((s, a) => s + a.bonus.totalBonus, 0)
  const qualifyingCount = bonusRows.filter(a => a.bonus.totalBonus > 0).length
```

**Step 3: Table JSX**

Render a table with these columns. Use color coding:
- `totalBonus > 0` → green bold text
- `gainIfNext > 0` → show in amber as motivational hint

```jsx
<table className="w-full text-sm">
  <thead>
    <tr className="bg-aia-red text-white text-xs">
      <th className="px-3 py-2 text-left">Advisor</th>
      <th className="px-3 py-2 text-center">Segment</th>
      <th className="px-3 py-2 text-right">Qtly FYC</th>
      <th className="px-3 py-2 text-center">FYC Tier</th>
      <th className="px-3 py-2 text-right">Cases</th>
      <th className="px-3 py-2 text-center">CCB</th>
      <th className="px-3 py-2 text-right">Persistency</th>
      <th className="px-3 py-2 text-right font-bold">Bonus</th>
      <th className="px-3 py-2 text-left">Potential</th>
    </tr>
  </thead>
  <tbody>
    {bonusRows.map((a, idx) => {
      const b = a.bonus
      const isQualifying = b.totalBonus > 0
      return (
        <tr key={a.code ?? idx}
            className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
          <td className="px-3 py-2">
            <div className="font-semibold text-aia-darkGray text-xs">{a.name}</div>
            <div className="text-xs text-gray-400">{a.unitName}</div>
          </td>
          <td className="px-3 py-2 text-center">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded
              ${a.segment === 'Rookie' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
              {a.segment}
            </span>
          </td>
          <td className="px-3 py-2 text-right tabular-nums text-xs font-medium text-aia-darkGray">
            {formatCurrency(b.qtlyFyc, true)}
          </td>
          <td className="px-3 py-2 text-center text-xs text-gray-600">{b.fycTierLabel}</td>
          <td className="px-3 py-2 text-right tabular-nums text-xs">
            <div>{b.qtlyCases}</div>
            <div className="text-gray-400">{b.monthlyCases.join('-')}</div>
          </td>
          <td className="px-3 py-2 text-center text-xs">
            {b.ccbEligible
              ? <span className="text-green-600 font-bold">{(b.ccbRate * 100).toFixed(0)}%</span>
              : <span className="text-gray-400">—</span>}
          </td>
          <td className="px-3 py-2 text-right text-xs tabular-nums">
            {b.persRaw != null ? `${b.persRaw.toFixed(1)}%` : 'Default'}
            <div className="text-gray-400">{(b.persMultiplier * 100).toFixed(0)}%×</div>
          </td>
          <td className={`px-3 py-2 text-right font-bold tabular-nums
            ${isQualifying ? 'text-green-600' : 'text-gray-300'}`}>
            {isQualifying ? formatCurrency(b.totalBonus, true) : '—'}
          </td>
          <td className="px-3 py-2 text-xs text-amber-600">
            {b.hints.map((h, i) => (
              <div key={i}>{h}</div>
            ))}
            {b.gainIfNext > 0 && (
              <div className="font-semibold">+{formatCurrency(b.gainIfNext, true)} more</div>
            )}
          </td>
        </tr>
      )
    })}
  </tbody>
</table>
```

**Step 4: Summary bar above table**

```jsx
<div className="flex gap-4 flex-wrap mb-4">
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
    <div className="text-xs text-gray-400 font-medium">Total Bonus Pool</div>
    <div className="text-xl font-extrabold text-green-600 tabular-nums">{formatCurrency(totalBonusPool, true)}</div>
  </div>
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
    <div className="text-xs text-gray-400 font-medium">Qualifying Advisors</div>
    <div className="text-xl font-extrabold text-aia-darkGray tabular-nums">{qualifyingCount}</div>
  </div>
</div>
```

**Step 5: Verify in browser**

Screenshot the Quarterly Bonus page. For Q1 2026:
- Advisors with `FYC_PHP_202601 + FYC_PHP_202602 + FYC_PHP_202603 >= 30000` should show a bonus
- Check the top row manually against bonus formula

**Step 6: Commit**
```bash
git add src/pages/QuarterlyBonusPage.jsx
git commit -m "feat: Quarterly Bonus Tracker with FYC/CCB/persistency computation and next-tier hints"
```

---

## Task 8: Final polish and verification

**Files:** All pages touched in Tasks 1–7

**Step 1: Verify global segment rename everywhere**

- Overview: filter pills show Rookie / Seasoned only
- Leaderboard: segment filter has no "Senior", badges say "Seasoned"
- Units: column headers say "Seasoned" not "Tenured"
- Agents: filter shows Rookie / Seasoned

**Step 2: Verify Monthly Report full flow**

- Change month selector → KPI cards update
- FYC highlights → By Segment shows two columns
- March → check if any new recruits appear

**Step 3: Verify Quarterly Bonus Tracker**

- Q1 selected → sums Jan+Feb+Mar FYC
- Advisor with 0 FYC shows "—" in bonus column
- Hint column shows next-tier guidance for qualifying advisors
- "Qualifying only" filter hides advisors below ₱30K FYC

**Step 4: Take final screenshots for all new pages**

**Step 5: Commit**
```bash
git add -A
git commit -m "feat: complete Monthly Report and Quarterly Bonus Tracker tabs"
```

---

## Task 9: Excel Export — Download dashboard data for certificates & recognition

**Files:**
- Create: `src/utils/exportExcel.js` — all export logic using SheetJS (already installed)
- Modify: `src/pages/MonthlyReportPage.jsx` — add export button
- Modify: `src/pages/QuarterlyBonusPage.jsx` — add export button
- Modify: `src/pages/AgentsPage.jsx` — add export button

**What gets exported (one file, multiple sheets):**

The download button on each page produces an `.xlsx` file with these sheets:

**From Monthly Report page** — filename: `Davao-Amora-Monthly-[MON]-2026.xlsx`
| Sheet | Contents |
|-------|----------|
| `Monthly KPIs` | KPI summary row (Manpower, Producing, ANP, FYC, FYP, Cases, Persistency) |
| `Top FYC` | Top 10 overall + Rookie + Seasoned, with name, unit, area, FYC value |
| `Top FYP` | Same structure for FYP |
| `Top Cases` | Same structure for Cases |
| `New Recruits` | All new recruits with columns: Name, Segment, Area, Unit, Recruiter |
| `Top Recruiters` | Recruiter name, recruit count, recruit names |

**From Quarterly Bonus page** — filename: `Davao-Amora-Bonus-[Q]-2026.xlsx`
| Sheet | Contents |
|-------|----------|
| `Bonus Summary` | One row per advisor: Name, Segment, Unit, Area, Qtly FYC, FYC Tier, Cases, CCB Eligible, CCB Rate, Persistency, Multiplier, Total Bonus, Potential Bonus, Hints |
| `Qualifying` | Same as Bonus Summary but filtered to advisors with bonus > 0 |

**From Agents page** — filename: `Davao-Amora-Agents.xlsx`
| Sheet | Contents |
|-------|----------|
| `All Advisors` | Full agent list with all current MTD metrics |

**Step 1: Create `src/utils/exportExcel.js`**

```js
import * as XLSX from 'xlsx'

function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename)
}

function autoWidth(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'])
  const widths = []
  for (let C = range.s.c; C <= range.e.c; C++) {
    let max = 10
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell && cell.v != null) {
        const len = String(cell.v).length
        if (len > max) max = len
      }
    }
    widths.push({ wch: Math.min(max + 2, 50) })
  }
  ws['!cols'] = widths
  return ws
}

export function exportMonthlyReport({ monthLabel, kpis, top10Fyc, top10Fyp, top10Cases, newRecruits, topRecruiters }) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: KPIs
  const kpiSheet = autoWidth(XLSX.utils.json_to_sheet([kpis]))
  XLSX.utils.book_append_sheet(wb, kpiSheet, 'Monthly KPIs')

  // Helper: format top10 rows for export
  const formatTop = (rows, valueLabel) => rows.map((a, i) => ({
    Rank: i + 1,
    Advisor: a.name,
    Segment: a.segment,
    Unit: a.unitName,
    Area: a.area?.includes('SCM2') ? 'Davao' : 'Gensan',
    [valueLabel]: a._exportValue,
  }))

  // Sheets 2-4: Top 10 by metric
  ;[
    { rows: top10Fyc,   label: 'FYC (PHP)', sheet: 'Top FYC' },
    { rows: top10Fyp,   label: 'FYP (PHP)', sheet: 'Top FYP' },
    { rows: top10Cases, label: 'Cases',     sheet: 'Top Cases' },
  ].forEach(({ rows, label, sheet }) => {
    const data = [
      { Section: 'OVERALL', ...{} },
      ...formatTop(rows.overall, label),
      { Section: '' },
      { Section: 'ROOKIE TOP 10' },
      ...formatTop(rows.rookie, label),
      { Section: '' },
      { Section: 'SEASONED TOP 10' },
      ...formatTop(rows.seasoned, label),
    ]
    XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(data)), sheet)
  })

  // Sheet 5: New Recruits
  const recruitData = newRecruits.map(a => ({
    'Advisor Name': a.name,
    Segment: a.segment,
    Area: a.area?.includes('SCM2') ? 'Davao' : 'Gensan',
    Unit: a.unitName,
    Recruiter: a.recruiterName || '—',
  }))
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(recruitData.length ? recruitData : [{ Note: 'No new recruits' }])), 'New Recruits')

  // Sheet 6: Top Recruiters
  const recData = topRecruiters.map((r, i) => ({
    Rank: i + 1,
    Recruiter: r.name,
    'Recruits This Month': r.count,
    'Recruit Names': r.recruits.join(', '),
  }))
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(recData.length ? recData : [{ Note: 'No recruiters' }])), 'Top Recruiters')

  const abbr = monthLabel.slice(0, 3).toUpperCase()
  downloadWorkbook(wb, `Davao-Amora-Monthly-${abbr}-2026.xlsx`)
}

export function exportQuarterlyBonus(bonusRows, quarter) {
  const wb = XLSX.utils.book_new()

  const formatRow = a => ({
    'Advisor': a.name,
    'Segment': a.segment,
    'Unit': a.unitName,
    'Area': a.area?.includes('SCM2') ? 'Davao' : 'Gensan',
    'Quarterly FYC (PHP)': a.bonus.qtlyFyc,
    'FYC Tier': a.bonus.fycTierLabel,
    'FYC Bonus Rate': `${(a.bonus.fycRate * 100).toFixed(0)}%`,
    'Quarterly Cases': a.bonus.qtlyCases,
    'Monthly Cases': a.bonus.monthlyCases.join(' / '),
    'CCB Eligible': a.bonus.ccbEligible ? 'Yes' : 'No',
    'CCB Rate': `${(a.bonus.ccbRate * 100).toFixed(0)}%`,
    'Persistency': a.bonus.persRaw != null ? `${a.bonus.persRaw.toFixed(1)}%` : 'Default (82.5%)',
    'Persistency Multiplier': `${(a.bonus.persMultiplier * 100).toFixed(0)}%`,
    'Total Bonus (PHP)': a.bonus.totalBonus,
    'Potential Bonus (PHP)': a.bonus.potentialBonus,
    'Next Tier Hints': a.bonus.hints.join(' | '),
  })

  const allData = bonusRows.map(formatRow)
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(allData)), 'Bonus Summary')

  const qualData = bonusRows.filter(a => a.bonus.totalBonus > 0).map(formatRow)
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(qualData.length ? qualData : [{ Note: 'No qualifying advisors' }])), 'Qualifying')

  downloadWorkbook(wb, `Davao-Amora-Bonus-${quarter}-2026.xlsx`)
}

export function exportAgents(agents) {
  const wb = XLSX.utils.book_new()
  const data = agents.map(a => ({
    'Agent Code': a.code,
    'Advisor Name': a.name,
    'Segment': a.segment,
    'Agent Year': a.agentYear,
    'Unit Code': a.unitCode,
    'Unit Manager': a.unitName,
    'Area': a.area,
    'ANP MTD (PHP)': a.anpMtd,
    'FYC MTD (PHP)': a.fycMtd,
    'FYP MTD (PHP)': a.fypTotal,
    'Cases MTD': a.casesTotal,
    'Producing': a.isProducing ? 'Yes' : 'No',
  }))
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(data)), 'All Advisors')
  downloadWorkbook(wb, 'Davao-Amora-Agents.xlsx')
}
```

**Step 2: Add export button to MonthlyReportPage.jsx**

Place a download button next to the month selector:

```jsx
import { exportMonthlyReport } from '../utils/exportExcel'

// In JSX, near the month selector:
<button
  onClick={() => exportMonthlyReport({
    monthLabel: MONTH_LABELS[MONTH_ABBRS.indexOf(selectedMonth)],
    kpis: { Manpower: totalManpower, Producing: producingCount, ANP: totalAnp, FYC: totalFyc, FYP: totalFyp, Cases: totalCases, 'Avg Persistency %': avgPersistency },
    top10Fyc: {
      overall: sortedByFyc.slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyc })),
      rookie:  sortedByFyc.filter(a => a.segment === 'Rookie').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyc })),
      seasoned: sortedByFyc.filter(a => a.segment === 'Seasoned').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyc })),
    },
    top10Fyp: {
      overall: sortedByFyp.slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyp })),
      rookie:  sortedByFyp.filter(a => a.segment === 'Rookie').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyp })),
      seasoned: sortedByFyp.filter(a => a.segment === 'Seasoned').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.fyp })),
    },
    top10Cases: {
      overall: sortedByCases.slice(0, 10).map(a => ({ ...a, _exportValue: a.m.cases })),
      rookie:  sortedByCases.filter(a => a.segment === 'Rookie').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.cases })),
      seasoned: sortedByCases.filter(a => a.segment === 'Seasoned').slice(0, 10).map(a => ({ ...a, _exportValue: a.m.cases })),
    },
    newRecruits,
    topRecruiters,
  })}
  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
>
  ⬇ Download Excel
</button>
```

**Step 3: Add export button to QuarterlyBonusPage.jsx**

```jsx
import { exportQuarterlyBonus } from '../utils/exportExcel'

<button
  onClick={() => exportQuarterlyBonus(bonusRows, quarter)}
  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
>
  ⬇ Download Excel
</button>
```

**Step 4: Add export button to AgentsPage.jsx**

```jsx
import { exportAgents } from '../utils/exportExcel'

<button
  onClick={() => exportAgents(filtered)}  // exports currently filtered agents
  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
>
  ⬇ Download Excel
</button>
```

**Step 5: Test download in browser**

Click each download button. Verify:
- File downloads with correct filename
- Excel opens with multiple sheets
- Column widths auto-sized (readable without manual resize)
- No empty rows or broken columns

**Step 6: Commit**
```bash
git add src/utils/exportExcel.js src/pages/MonthlyReportPage.jsx src/pages/QuarterlyBonusPage.jsx src/pages/AgentsPage.jsx
git commit -m "feat: Excel export — Monthly Report, Quarterly Bonus, Agents list download"
```

---

## Column Reference (for reference during implementation)

| Feature | Excel Column |
|---------|-------------|
| Monthly FYC | `FYC_PHP_202601` … `FYC_PHP_202612` |
| Monthly ANP | `ANP_JAN2026` … `ANP_DEC2026` |
| Monthly FYP | `FYPI_JAN2026` … `FYPI_DEC2026` |
| Monthly Cases | `OL_VUL_CS_CNT_JAN2026` … `OL_VUL_CS_CNT_DEC2026` |
| Monthly Producing | `PRODUCING_JAN2026` … `PRODUCING_DEC2026` |
| Monthly Persistency | `PERS_JAN2026` … `PERS_DEC2026` |
| Monthly Manpower | `ManPowerCnt_JAN2026` … `ManPowerCnt_DEC2026` |
| Monthly New Recruit | `NEW_RECRUIT_JAN2026` … `NEW_RECRUIT_DEC2026` |
| Quarterly Persistency | `PERS_Q12026` `PERS_Q22026` `PERS_Q32026` `PERS_Q42026` |
| Recruiter | `RECRUITER_NAME` `RECRUITER_CODE` |
