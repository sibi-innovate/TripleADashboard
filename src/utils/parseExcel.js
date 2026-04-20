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

/**
 * Scan the system-column-name map (or a raw data row) for year-stamped column
 * names like "FYC_PHP_202501", "ANP_JAN2025", "FYPI_JAN2025", "PERS_Q12025".
 * Returns the 4-digit year found, or falls back to the current calendar year.
 */
function detectDataYear(columnMapOrRow) {
  const CURRENT = new Date().getFullYear()
  for (const name of Object.values(columnMapOrRow)) {
    if (typeof name !== 'string') continue
    // FYC_PHP_202501 → 2025
    let m = name.match(/FYC_PHP_(\d{4})\d{2}/)
    if (m) return Number(m[1])
    // ANP_JAN2025, FYPI_JAN2025, OL_VUL_CS_CNT_JAN2025, PRODUCING_JAN2025, etc.
    m = name.match(/[A-Z_]+_[A-Z]{3}(\d{4})$/)
    if (m) { const y = Number(m[1]); if (y >= 2000 && y <= CURRENT + 1) return y }
    // PERS_Q12025
    m = name.match(/PERS_Q[1-4](\d{4})$/)
    if (m) return Number(m[1])
  }
  return CURRENT
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

function parseAgentRow(row, year) {
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
  const rawAppt  = get('PADATE') ?? get('PA DATE') ?? get('PA_DATE') ?? get('APPTDATE') ?? get('APPT DATE')
  let apptDate   = rawAppt != null ? num(rawAppt) : 0
  let agentYears = null
  let segment    = 'Unknown'

  const SENTINEL = 19000101
  // Handle Excel serial date format for apptDate
  if (apptDate >= 20000 && apptDate <= 60000) {
    // Convert serial to YYYYMMDD integer for downstream compatibility
    const serialDate = new Date(Date.UTC(1900, 0, apptDate - 1))
    apptDate = serialDate.getUTCFullYear() * 10000
      + (serialDate.getUTCMonth() + 1) * 100
      + serialDate.getUTCDate()
  }

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
  // NOTE: `year` is passed in — do NOT use new Date().getFullYear() here.
  // For historical files (2024, 2023 etc.) the columns use that year's number.
  const MONTH_ABBRS_LOCAL = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  for (let i = 0; i < 12; i++) {
    const key = `FYC_PHP_${year}${String(i + 1).padStart(2, '0')}`
    const val = getNum(key)
    if (val > 0) monthlyFyc[MONTH_ABBRS_LOCAL[i]] = val
  }

  // --- Monthly ANP for trend charts
  const monthlyAnp = {}
  for (let i = 0; i < 12; i++) {
    const key = `ANP_${MONTH_ABBRS_LOCAL[i]}${year}`
    const val = getNum(key)
    if (val > 0) monthlyAnp[MONTH_ABBRS_LOCAL[i]] = val
  }

  // --- Monthly data (all 12 months)
  const MONTH_NUMS = ['01','02','03','04','05','06','07','08','09','10','11','12']
  const monthly = {}
  for (let i = 0; i < 12; i++) {
    const abbr = MONTH_ABBRS_LOCAL[i]  // e.g. 'JAN'
    const num2 = MONTH_NUMS[i]         // e.g. '01'
    monthly[abbr] = {
      fyc:        getNum(`FYC_PHP_${year}${num2}`),
      anp:        getNum(`ANP_${abbr}${year}`),
      fyp:        getNum(`FYPI_${abbr}${year}`),
      cases:      getNum(`OL_VUL_CS_CNT_${abbr}${year}`),
      producing:  num(get(`PRODUCING_${abbr}${year}`)) === 1,
      persistency: (() => {
        const raw = get(`PERS_${abbr}${year}`)
        if (raw === '' || raw == null) return null
        const pct = Number(raw)
        return isNaN(pct) ? null : pct
      })(),
      manpower:   getNum(`ManPowerCnt_${abbr}${year}`),
      isNewRecruit: num(get(`NEW_RECRUIT_${abbr}${year}`)) === 1,
    }
  }

  // --- Quarterly persistency
  const quarterlyPers = {}
  for (let q = 1; q <= 4; q++) {
    const raw = get(`PERS_Q${q}${year}`)
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

  // --- Birth date (optional column — graceful if missing)
  const rawBirth  = get('AGENT_BIRTHDATE') ?? get('BIRTH_DATE') ?? get('BIRTHDATE') ?? get('BIRTH DATE')
  let birthDate = null
  if (rawBirth != null) {
    const bNum = num(rawBirth)
    if (bNum && bNum > 19000101) {
      // YYYYMMDD integer format (e.g. 19870315)
      const by  = Math.floor(bNum / 10000)
      const bmo = Math.floor((bNum % 10000) / 100) - 1
      const bd  = bNum % 100
      // Build ISO string directly — avoids local-midnight UTC rollback in UTC+8
      birthDate = `${by}-${String(bmo + 1).padStart(2, '0')}-${String(bd).padStart(2, '0')}`
    } else if (bNum >= 20000 && bNum <= 60000) {
      // Excel serial date: days since 1900-01-00 (Lotus 1-2-3 bug: serial 1 = Jan 1 1900)
      birthDate = new Date(Date.UTC(1900, 0, bNum - 1)).toISOString().split('T')[0]
    } else if (typeof rawBirth === 'string' && rawBirth.trim()) {
      const parsed = new Date(rawBirth.trim())
      if (!isNaN(parsed)) birthDate = parsed.toISOString().split('T')[0]
    }
  }

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
    birthDate,
    appointmentDate: apptDate && apptDate > 19000101
      ? (() => { const y=Math.floor(apptDate/10000),mo=Math.floor((apptDate%10000)/100)-1,d=apptDate%100; return new Date(y,mo,d).toISOString().split('T')[0] })()
      : null,
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
// Parse the AGENCY sheet → array of { name, territory, region, monthly, anpMtd, anpYtd }
// Combines rows that share the same AGENCY_NAME (different sectors of same agency).
// ---------------------------------------------------------------------------

function parseAgencySheet(ws, year) {
  if (!ws) return []

  // Try to find the structure: scan offsets 0,1,2,3,4 looking for the system-names row
  let raws = []
  let found = false
  let detectedYear = year  // prefer caller-supplied year
  for (const offset of [4, 3, 2, 1, 0]) {
    const rows = XLSX.utils.sheet_to_json(ws, { range: offset, defval: '' })
    if (!rows || rows.length < 4) continue
    // System-names row contains a value like "AGENCY_NAME"
    const sysIdx = rows.findIndex(r =>
      Object.values(r).some(v => String(v).toUpperCase().replace(/[\s_]/g, '').includes('AGENCYNAME'))
    )
    if (sysIdx >= 0) {
      const colMap = buildColumnMap(rows[sysIdx])
      if (!year) detectedYear = detectDataYear(colMap)
      raws = rows.slice(sysIdx + 1).map(row => rekeyRow(row, colMap))
      found = true
      break
    }
    // Fallback: AGENCY_NAME appears directly as a key (no system-names row)
    if (rows[0] && (Object.keys(rows[0]).some(k => k.toUpperCase().replace(/[\s_]/g, '').includes('AGENCYNAME')))) {
      if (!year) detectedYear = detectDataYear(rows[0])
      raws = rows
      found = true
      break
    }
  }
  if (!found || !raws.length) return []

  const MONTH_NUMS = ['01','02','03','04','05','06','07','08','09','10','11','12']
  const dataYear = detectedYear || new Date().getFullYear()

  // Group by AGENCY_NAME (combine same agency across multiple sector rows)
  const agencyMap = new Map()
  for (const row of raws) {
    const rawName = String(
      row['AGENCY_NAME'] ?? row['AGENCY NAME'] ?? row['AgencyName'] ?? ''
    ).trim()
    if (!rawName) continue

    if (!agencyMap.has(rawName)) {
      const territory = String(
        row['TERRITORY'] ?? row['TERR'] ?? row['TERRITORY_NAME'] ?? ''
      ).trim()
      const region = String(
        row['REGION'] ?? row['REGION_NAME'] ?? ''
      ).trim()
      agencyMap.set(rawName, { name: rawName, territory, region, rows: [] })
    }
    agencyMap.get(rawName).rows.push(row)
  }

  // For each agency, aggregate metrics across all its rows
  const agencies = []
  for (const { name, territory, region, rows } of agencyMap.values()) {
    const sumKey = key => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0)

    // Monthly ANP (try several column-name patterns)
    const monthly = {}
    for (let i = 0; i < 12; i++) {
      const abbr  = MONTH_ABBRS[i]
      const num2  = MONTH_NUMS[i]
      monthly[abbr] = {
        // Try FYPI_JANXXXX, ANP_JANXXXX, FYP_PHPJANXXXX, etc.
        fyp: sumKey(`FYPI_${abbr}${dataYear}`)
          || sumKey(`FYP_${abbr}${dataYear}`)
          || sumKey(`FYPI_${abbr}_${dataYear}`),
        anp: sumKey(`ANP_${abbr}${dataYear}`)
          || sumKey(`ANP_${abbr}_${dataYear}`),
        fyc: sumKey(`FYC_PHP_${dataYear}${num2}`)
          || sumKey(`FYC_${abbr}${dataYear}`),
      }
    }

    // YTD totals — prefer explicit column, fallback to summing monthly
    const anpYtd = sumKey('ANP_YTD')
      || sumKey('ANP_YTD_TOTAL')
      || MONTH_ABBRS.reduce((s, abbr) => s + (monthly[abbr].anp || 0), 0)
    const anpMtd = sumKey('ANP_MTD')
      || monthly[MONTH_ABBRS[new Date().getMonth()]].anp
    const fypYtd = sumKey('FYP_YTD')
      || sumKey('FYPI_YTD')
      || MONTH_ABBRS.reduce((s, abbr) => s + (monthly[abbr].fyp || 0), 0)
    const fypMtd = sumKey('FYP_MTD')
      || sumKey('FYPI_MTD')
      || monthly[MONTH_ABBRS[new Date().getMonth()]].fyp

    agencies.push({ name, territory, region, monthly, anpYtd, anpMtd, fypYtd, fypMtd })
  }

  return agencies
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
  const columnMap   = buildColumnMap(sysNamesRow)

  // *** Detect the data year from the column names in THIS file ***
  // e.g. "FYC_PHP_202501" → 2025;  "ANP_JAN2024" → 2024
  // This is essential for historical uploads so monthly keys resolve correctly.
  const dataYear = detectDataYear(columnMap)

  // Skip first 2 rows (empty + system names), re-key using system names
  const dataRows = agentRaws.slice(2).map(row => rekeyRow(row, columnMap))

  // Filter to DAVAO-AMORA AGENCY specifically (not JAMORA or others)
  const isAmoraAgency = row => {
    const agencyName = String(row['AGENCY_NAME'] ?? row['AGENCY NAME'] ?? '').toUpperCase()
    return agencyName.includes('DAVAO-AMORA')
  }

  const filteredRows = dataRows.filter(isAmoraAgency)
  const sourceRows   = filteredRows.length > 0 ? filteredRows : dataRows

  // Pass the detected year so every agent's monthly data uses the correct column keys
  const agents = sourceRows.map(row => parseAgentRow(row, dataYear))

  // ---- AGENCY sheet (optional — for inter-agency rank comparison) ---------
  const agencySheetName = sheetNames.find(n => n.toUpperCase() === 'AGENCY')
                       || sheetNames.find(n => n.toUpperCase().includes('AGENC'))
  const agencyRankData = agencySheetName
    ? parseAgencySheet(workbook.Sheets[agencySheetName], dataYear)
    : []

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
    agencyRankData,      // [] if no Agency sheet; populated for inter-agency ranking
    uploadDate: new Date().toISOString(),
  }
}
