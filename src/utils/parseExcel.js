import * as XLSX from 'xlsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v) {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// ---------------------------------------------------------------------------
// Name parser: "I/AUXTERO/RITA/E@" → "Rita E Auxtero"
// ---------------------------------------------------------------------------

function parseName(raw) {
  if (!raw) return ''
  const s = String(raw).trim()

  const match = s.match(/^[A-Z]\/([^/]+)\/([^/]+?)(?:\/([^/@]*))?@?$/i)
  if (match) {
    const lastName = match[1].trim()
    const firstName = match[2].trim()
    const mi = match[3] ? match[3].trim() : ''

    const titleCase = str =>
      str
        .toLowerCase()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')

    const parts = [titleCase(firstName)]
    if (mi) parts.push(mi.toUpperCase())
    parts.push(titleCase(lastName))
    return parts.join(' ')
  }

  return s.replace(/^[A-Z]\//i, '').replace(/@$/, '').trim()
}

// ---------------------------------------------------------------------------
// Area derivation from SECTOR column
// ---------------------------------------------------------------------------

function deriveArea(sector) {
  if (!sector) return 'Other'
  const s = String(sector).toUpperCase()
  if (s.includes('MINDANAO 2') || s.includes('SCM2') || s.includes('SC MINDANAO 2'))
    return 'SCM2 (Davao)'
  if (s.includes('MINDANAO 3') || s.includes('SCM3') || s.includes('SC MINDANAO 3'))
    return 'SCM3 (Gensan)'
  return sector
}

// ---------------------------------------------------------------------------
// Build column mapping from system names row
// The Excel has display headers at row 0 (after range:4), an empty row 0,
// system column names at row 1, and data starting at row 2.
// System names row has values like: MTD -> "ANP_MTD", __EMPTY_20 -> "CASECNT_MTD"
// We use these system names to re-key data rows for reliable column matching.
// ---------------------------------------------------------------------------

function buildColumnMap(sysNamesRow) {
  const map = {}
  if (!sysNamesRow) return map
  for (const [displayKey, sysName] of Object.entries(sysNamesRow)) {
    if (sysName !== '' && typeof sysName === 'string') {
      map[displayKey] = sysName.trim()
    }
  }
  return map
}

function rekeyRow(row, columnMap) {
  const out = {}
  for (const [displayKey, value] of Object.entries(row)) {
    const sysName = columnMap[displayKey]
    if (sysName) {
      out[sysName] = value
    } else {
      out[displayKey] = value
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Agent row parser (uses system column names)
// ---------------------------------------------------------------------------

function parseAgentRow(row) {
  const get = (key) => row[key]
  const getNum = (key) => num(row[key])

  // --- Identity
  const rawName  = get('AGENT_NAME') ?? get('AGENT NAME') ?? ''
  const name     = parseName(rawName)
  const code     = String(get('AGENT_CODE') ?? get('AGT CODE') ?? '').trim()
  const unitCode = String(get('UM_CODE') ?? get('UMCODE') ?? '').trim()
  const rawUmName = get('LEADER_UM_NAME') ?? get('UM NAME') ?? ''
  const unitName = parseName(rawUmName)

  // --- Area / Sector
  const sectorRaw = String(get('SECTOR') ?? '').trim()
  const area = deriveArea(sectorRaw)

  // --- Agent year from AGTYR / AGENT_YEAR column
  const agentYearRaw = get('AGENT_YEAR') ?? get('AGTYR')
  let agentYear = agentYearRaw != null && !isNaN(Number(agentYearRaw)) && Number(agentYearRaw) > 0
    ? Math.round(Number(agentYearRaw))
    : null

  // --- Segmentation from APPTDATE (fallback if AGTYR missing)
  const rawAppt  = get('APPTDATE') ?? get('APPT DATE')
  const apptDate = rawAppt != null ? num(rawAppt) : 0
  let agentYears = null
  let segment    = 'Unknown'

  const SENTINEL = 19000101
  if (apptDate && apptDate > SENTINEL) {
    const y  = Math.floor(apptDate / 10000)
    const mo = Math.floor((apptDate % 10000) / 100) - 1
    const d  = apptDate % 100
    const apptMs = new Date(y, mo, d).getTime()
    agentYears = (Date.now() - apptMs) / (365.25 * 24 * 60 * 60 * 1000)

    if (agentYear == null) {
      agentYear = Math.floor(agentYears) + 1
    }
  }

  if (agentYear != null) {
    if (agentYear <= 1) segment = 'Rookie'
    else                segment = 'Seasoned'
  }

  // --- Production – ANP
  const anpMtd = getNum('ANP_MTD') || getNum('MTD')
  const anpQtd = getNum('ANP_QTD') || getNum('QTD')
  const anpYtd = getNum('ANP_YTD') || getNum('YTD')

  // --- Production – FYC
  const fycMtd = getNum('FYC_MTD') || getNum('FYC MTD')

  // --- Production – FYP by product
  const fypOlReg  = getNum('FYP_OLREG_MTD') || getNum('OLREG')
  const fypOlSp   = getNum('FYP_OLSP_MTD') || getNum('OLSP')
  const fypVulReg = getNum('FYP_VULREG_MTD') || getNum('VULREG')
  const fypVulSp  = getNum('FYP_VULSP_MTD') || getNum('VULSP')
  const fypAh     = getNum('FYP_AH_MTD') || getNum('AH')
  const fypProductSum = fypOlReg + fypOlSp + fypVulReg + fypVulSp + fypAh

  // Prefer FYPI_MTD (MTD total FYP), fallback to FYP_MTD, fallback to product sum
  // NOTE: MDRT_TOTALFYP is a YTD MDRT tracker and must NOT be used as MTD fallback
  const fypTotal = getNum('FYPI_MTD') || getNum('FYP_MTD') || fypProductSum

  // --- Cases (from "Paid for cases" section)
  const casesTotal   = getNum('CASECNT_MTD')
  const casesExAh    = getNum('CASECNT_EX_AH_MTD')
  const casesAh      = casesTotal - casesExAh
  const casesRegular = casesExAh

  // --- Producing flag
  const producingRaw = get('AGENT_WITH_PRODUCTION_IND') ?? get('AGENT W/ PROD (INC A&H)')
  const isProducing = num(producingRaw) === 1

  // --- Manpower indicator (ManpowerCnt = 1 means real active agent)
  const manpowerInd = Number(get('ManpowerCnt')) === 1

  // --- Activity ratio
  const activityRatio = getNum('Sales_Act_Ratio') || getNum('SALES ACTIVITY RATIO')

  // --- Monthly FYC for trend charts
  const monthlyFyc = {}
  const currentYear = new Date().getFullYear()
  const MONTH_ABBRS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  for (let i = 0; i < 12; i++) {
    const key = `FYC_PHP_${currentYear}${String(i + 1).padStart(2, '0')}`
    const val = getNum(key)
    if (val > 0) monthlyFyc[MONTH_ABBRS[i]] = val
  }

  // --- Monthly ANP for trend charts
  const monthlyAnp = {}
  for (let i = 0; i < 12; i++) {
    const key = `ANP_${MONTH_ABBRS[i]}${currentYear}`
    const val = getNum(key)
    if (val > 0) monthlyAnp[MONTH_ABBRS[i]] = val
  }

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

  return {
    name,
    code,
    unitCode,
    unitName,
    sector: sectorRaw,
    area,
    apptDate,
    agentYears,
    agentYear,
    segment,
    anpMtd,
    anpQtd,
    anpYtd,
    fycMtd,
    fypTotal,
    fypOlReg,
    fypOlSp,
    fypVulReg,
    fypVulSp,
    fypAh,
    casesTotal,
    casesRegular,
    casesAh,
    manpowerInd,
    isProducing,
    activityRatio,
    monthlyFyc,
    monthlyAnp,
    monthly,
    quarterlyPers,
    recruiterName,
    recruiterCode,
  }
}

// ---------------------------------------------------------------------------
// Unit grouping
// ---------------------------------------------------------------------------

function buildUnits(agents) {
  const map = new Map()

  for (const agent of agents) {
    const key = agent.unitCode || '__UNASSIGNED__'
    if (!map.has(key)) {
      map.set(key, {
        unitCode: agent.unitCode,
        unitName: agent.unitName,
        agents:   [],
      })
    }
    map.get(key).agents.push(agent)
  }

  return Array.from(map.values()).map(unit => {
    const { agents } = unit
    const rookies   = agents.filter(a => a.segment === 'Rookie')
    const seasoned  = agents.filter(a => a.segment === 'Seasoned')
    const producing = agents.filter(a => a.isProducing)
    const scm2      = agents.filter(a => a.area === 'SCM2 (Davao)')
    const scm3      = agents.filter(a => a.area === 'SCM3 (Gensan)')

    return {
      unitCode:        unit.unitCode,
      unitName:        unit.unitName,
      agents,
      totalHeadcount:  agents.length,
      rookieCount:     rookies.length,
      seasonedCount:   seasoned.length,
      totalAnpMtd:     agents.reduce((s, a) => s + a.anpMtd,   0),
      rookieAnpMtd:    rookies.reduce((s, a) => s + a.anpMtd,  0),
      seasonedAnpMtd:  seasoned.reduce((s, a) => s + a.anpMtd, 0),
      producingCount:  producing.length,
      totalCases:      agents.reduce((s, a) => s + a.casesTotal, 0),
      scm2Count:       scm2.length,
      scm3Count:       scm3.length,
      scm2AnpMtd:      scm2.reduce((s, a) => s + a.anpMtd, 0),
      scm3AnpMtd:      scm3.reduce((s, a) => s + a.anpMtd, 0),
    }
  })
}

// ---------------------------------------------------------------------------
// Compute agency KPIs from agent data (more reliable than parsing AGENCY sheet)
// ---------------------------------------------------------------------------

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_ABBRS  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function computeAgencyKpis(agents) {
  const anpMtd = agents.reduce((s, a) => s + a.anpMtd, 0)
  const anpQtd = agents.reduce((s, a) => s + a.anpQtd, 0)
  const anpYtd = agents.reduce((s, a) => s + a.anpYtd, 0)
  const advisorCnt = agents.length

  // Count unique unit managers
  const umCodes = new Set(agents.map(a => a.unitCode).filter(Boolean))
  const umCnt = umCodes.size

  // Monthly ANP trend (sum per-agent monthly ANP)
  const currentMonth = new Date().getMonth() + 1
  const monthlyAnp = []
  for (let i = 0; i < currentMonth; i++) {
    const abbr = MONTH_ABBRS[i]
    const label = MONTH_LABELS[i]
    const value = agents.reduce((s, a) => s + (a.monthlyAnp[abbr] || 0), 0)
    monthlyAnp.push({ month: label, value })
  }

  return { anpMtd, anpQtd, anpYtd, advisorCnt, aumCnt: 0, umCnt, sumCnt: 0, monthlyAnp }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function parseExcelFile(arrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })

  const sheetNames  = workbook.SheetNames
  const agentSheet  = sheetNames.find(n => n.toUpperCase() === 'AGENT')
                   || sheetNames.find(n => n.toUpperCase().includes('AGENT'))

  if (!agentSheet) throw new Error('Could not find an AGENT sheet in the workbook.')

  // ---- AGENT sheet --------------------------------------------------------
  // Headers are at row 8 (absolute) = row 4 within the sheet range.
  // After range:4, row 0 is empty, row 1 has system column names, data starts at row 2.
  const agentWs   = workbook.Sheets[agentSheet]
  const agentRaws = XLSX.utils.sheet_to_json(agentWs, { range: 4, defval: '' })

  // Build column mapping from system names row (row index 1)
  const sysNamesRow = agentRaws[1]
  const columnMap = buildColumnMap(sysNamesRow)

  // Skip first 2 rows (empty + system names), re-key using system names
  const dataRows = agentRaws.slice(2).map(row => rekeyRow(row, columnMap))

  // Filter to DAVAO-AMORA AGENCY specifically (not JAMORA or others)
  const isAmoraAgency = row => {
    const agencyName = String(row['AGENCY_NAME'] ?? row['AGENCY NAME'] ?? '').toUpperCase()
    return agencyName.includes('DAVAO-AMORA')
  }

  const filteredRows = dataRows.filter(isAmoraAgency)
  const sourceRows   = filteredRows.length > 0 ? filteredRows : dataRows

  const agents = sourceRows.map(parseAgentRow)

  // ---- Agency KPIs (computed from agent data) ----------------------------
  const agencyKpis = computeAgencyKpis(agents)

  // ---- Unit groupings -----------------------------------------------------
  const units = buildUnits(agents)

  // ---- Area summary -------------------------------------------------------
  const areas = {
    scm2: agents.filter(a => a.area === 'SCM2 (Davao)'),
    scm3: agents.filter(a => a.area === 'SCM3 (Gensan)'),
  }

  return {
    agents,
    agencyKpis,
    units,
    areas,
    uploadDate: new Date().toISOString(),
  }
}
