// ─── Month arrays
export const MONTH_ABBRS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
export const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const MONTH_NUMS = { JAN:1, FEB:2, MAR:3, APR:4, MAY:5, JUN:6, JUL:7, AUG:8, SEP:9, OCT:10, NOV:11, DEC:12 }

// ─── Current month (derive from new Date())
export const CURRENT_MONTH_IDX = new Date().getMonth() // 0-based
export const CURRENT_MONTH_ABBR = MONTH_ABBRS[CURRENT_MONTH_IDX]
export const CURRENT_YEAR = new Date().getFullYear()

// ─── Quarter definitions
export const QUARTERS = {
  Q1: ['JAN','FEB','MAR'],
  Q2: ['APR','MAY','JUN'],
  Q3: ['JUL','AUG','SEP'],
  Q4: ['OCT','NOV','DEC'],
}

export const QUARTER_MONTHS = {
  Q1: [0, 1, 2],
  Q2: [3, 4, 5],
  Q3: [6, 7, 8],
  Q4: [9, 10, 11],
}

// ─── FYC Bonus tiers (quarterly FYC thresholds)
export const FYC_TIERS = [
  { min: 350000, rate: 0.40, label: '≥₱350K' },
  { min: 200000, rate: 0.35, label: '₱200K–₱349K' },
  { min: 120000, rate: 0.30, label: '₱120K–₱199K' },
  { min: 80000,  rate: 0.20, label: '₱80K–₱119K' },
  { min: 50000,  rate: 0.15, label: '₱50K–₱79K' },
  { min: 30000,  rate: 0.10, label: '₱30K–₱49K' },
  { min: 0,      rate: 0,    label: 'Below ₱30K' },
]

// Special Rookie Year-1 tier for 20K–29K range
export const ROOKIE_TIER = { min: 20000, rate: 0.10, label: '₱20K–₱29K (Rookie)' }

// ─── CCB (Case Count Bonus) tiers
export const CCB_TIERS = [
  { min: 9, rate: 0.20, label: '≥9 cases' },
  { min: 7, rate: 0.15, label: '7–8 cases' },
  { min: 5, rate: 0.10, label: '5–6 cases' },
  { min: 3, rate: 0.05, label: '3–4 cases' },
  { min: 0, rate: 0,    label: '<3 cases' },
]

// ─── Persistency multipliers
export const PERSISTENCY_TIERS = [
  { min: 82.5, multiplier: 1.0 },
  { min: 75,   multiplier: 0.8 },
  { min: 0,    multiplier: 0.0 },
]

// ─── Advisor MDRT tiers (% of annual MDRT goal — goal set per year in Supabase)
export const ADVISOR_TIERS = [
  { key: 'newly_coded',   label: 'Newly Coded Advisor', abbr: 'NCA', minPct: null, maxPct: null  },
  { key: 'sa',            label: 'Standard Advisor',    abbr: 'SA',  minPct: 0,    maxPct: 0.30  },
  { key: 'la',            label: 'Life Advisor',        abbr: 'LA',  minPct: 0.30, maxPct: 0.50  },
  { key: 'pa',            label: 'Premier Advisor',     abbr: 'PA',  minPct: 0.50, maxPct: 0.70  },
  { key: 'mdrt_aspirant', label: 'MDRT Aspirant',       abbr: 'MA',  minPct: 0.70, maxPct: 1.00  },
  { key: 'mdrt_achiever', label: 'MDRT Achiever',       abbr: 'ME',  minPct: 1.00, maxPct: null  },
]

// ─── MDRT default target (overridden by agency_targets table)
export const MDRT_GOAL_DEFAULT = 3518400

// ─── GAMA award tiers (FYP-based)
export const GAMA_FLA_TIERS = [
  { label: 'Gold',   min: 10300000 },
  { label: 'Silver', min:  5000000 },
  { label: 'Bronze', min:  3000000 },
]

export const GAMA_IMA_TIERS = [
  { label: 'Titanium', min: 78500000 },
  { label: 'Diamond',  min: 49000000 },
  { label: 'Platinum', min: 31600000 },
  { label: 'Gold',     min: 20600000 },
  { label: 'Silver',   min:  9500000 },
  { label: 'Bronze',   min:  4500000 },
]

// ─── Advisor tier colors (for avatar backgrounds, badges)
export const TIER_COLORS = {
  newly_coded:   { bg: '#1C1C28', text: '#FFFFFF' },
  sa:            { bg: '#B0B3BC', text: '#1C1C28' },
  la:            { bg: '#1F78AD', text: '#FFFFFF' },
  pa:            { bg: '#4E9A51', text: '#FFFFFF' },
  mdrt_aspirant: { bg: '#C97B1A', text: '#FFFFFF' },
  mdrt_achiever: { bg: '#C97B1A', text: '#FFFFFF' }, // gold gradient applied via CSS
  // GAMA award tiers
  Gold:     { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-300', badge: 'bg-yellow-100 text-yellow-800', bar: 'bg-yellow-400' },
  Silver:   { text: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  badge: 'bg-slate-100 text-slate-700',  bar: 'bg-slate-400' },
  Bronze:   { text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-300',  badge: 'bg-amber-100 text-amber-800',  bar: 'bg-amber-500' },
  Titanium: { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-300', badge: 'bg-purple-100 text-purple-800', bar: 'bg-purple-500' },
  Diamond:  { text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-300',   badge: 'bg-blue-100 text-blue-700',   bar: 'bg-blue-500' },
  Platinum: { text: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-300',   badge: 'bg-teal-100 text-teal-700',   bar: 'bg-teal-500' },
}

// ─── Area labels and colors
export const AREA_LABELS = {
  SCM2: 'SCM2 (Davao)',
  SCM3: 'SCM3 (Gensan)',
}

export const AREA_COLORS = {
  'SCM2 (Davao)':  '#D31145',
  'SCM3 (Gensan)': '#1F78AD',
}

// ─── Segment colors
export const SEGMENT_COLORS = {
  Rookie:   '#D31145',
  Seasoned: '#FF754D',
}

// ─── AIA brand colors
export const COLORS = {
  red:     '#D31145',
  red10:   '#FAE8EE',
  red20:   '#F6CCD9',
  charcoal:'#1C1C28',
  char60:  '#6B7180',
  char30:  '#B0B3BC',
  char10:  '#F2F3F5',
  surface: '#F7F8FA',
  border:  '#E8E9ED',
  blue:    '#1F78AD',
  blue10:  '#E8F2F9',
  green:   '#4E9A51',
  green10: '#EAF4EB',
  amber:   '#C97B1A',
  amber10: '#FDF3E3',
}

// Deprecated: use COLORS.red instead
export const AIA_RED = '#D31145'
