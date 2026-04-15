import * as XLSX from 'xlsx'
import { MONTH_ABBRS, MONTH_LABELS, CURRENT_YEAR } from '../constants'
import {
  getTopRookies, getTopOverall,
  getMostTrustedAdvisors, getMostProductiveAdvisors,
  getConsistentProducers,
} from './awardHelpers'

function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename)
}

function autoWidth(ws) {
  if (!ws['!ref']) return ws
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

// ─── Monthly Report export ────────────────────────────────────────────────────
// monthData: array of agents with .m = their monthly data for the selected month
// top10Fyc/top10Fyp/top10Cases: { overall, rookie, seasoned } arrays
// newRecruits: array of agents with isNewRecruit
// topRecruiters: array of { name, count, recruits }

export function exportMonthlyReport({
  monthLabel,
  kpis,
  top10Fyc,
  top10Fyp,
  top10Cases,
  newRecruits,
  topRecruiters,
}) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: KPI Summary
  const kpiSheet = autoWidth(XLSX.utils.json_to_sheet([kpis]))
  XLSX.utils.book_append_sheet(wb, kpiSheet, 'Monthly KPIs')

  // Helper to format a top-10 list into export rows
  const formatTopRows = (rows, valueLabel) =>
    rows.map((a, i) => ({
      Rank: i + 1,
      Advisor: a.name,
      Segment: a.segment,
      Unit: a.unitName || '',
      Area: a.area?.includes('SCM2') ? 'Davao' : 'Gensan',
      [valueLabel]: a._exportValue ?? 0,
    }))

  const buildTopSheet = (top10, valueLabel) => {
    const rows = [
      { Rank: '', Advisor: '— OVERALL TOP 10 —', Segment: '', Unit: '', Area: '', [valueLabel]: '' },
      ...formatTopRows(top10.overall, valueLabel),
      { Rank: '', Advisor: '', Segment: '', Unit: '', Area: '', [valueLabel]: '' },
      { Rank: '', Advisor: '— ROOKIE TOP 10 —', Segment: '', Unit: '', Area: '', [valueLabel]: '' },
      ...formatTopRows(top10.rookie, valueLabel),
      { Rank: '', Advisor: '', Segment: '', Unit: '', Area: '', [valueLabel]: '' },
      { Rank: '', Advisor: '— SEASONED TOP 10 —', Segment: '', Unit: '', Area: '', [valueLabel]: '' },
      ...formatTopRows(top10.seasoned, valueLabel),
    ]
    return autoWidth(XLSX.utils.json_to_sheet(rows))
  }

  XLSX.utils.book_append_sheet(wb, buildTopSheet(top10Fyc,   'FYC (PHP)'), 'Top FYC')
  XLSX.utils.book_append_sheet(wb, buildTopSheet(top10Fyp,   'FYP (PHP)'), 'Top FYP')
  XLSX.utils.book_append_sheet(wb, buildTopSheet(top10Cases, 'Cases'),     'Top Cases')

  // Sheet 5: New Recruits
  const recruitRows = newRecruits.length > 0
    ? newRecruits.map(a => ({
        'Advisor Name': a.name,
        Segment: a.segment,
        Area: a.area?.includes('SCM2') ? 'Davao' : 'Gensan',
        Unit: a.unitName || '',
        Recruiter: a.recruiterName || '',
      }))
    : [{ Note: 'No new recruits this month' }]
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(recruitRows)), 'New Recruits')

  // Sheet 6: Top Recruiters
  const recRows = topRecruiters.length > 0
    ? topRecruiters.map((r, i) => ({
        Rank: i + 1,
        Recruiter: r.name,
        'Recruits This Month': r.count,
        'Recruit Names': r.recruits.join(', '),
      }))
    : [{ Note: 'No recruiters this month' }]
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(recRows)), 'Top Recruiters')

  const abbr = monthLabel.slice(0, 3).toUpperCase()
  downloadWorkbook(wb, `Davao-Amora-Monthly-${abbr}-2026.xlsx`)
}

// ─── Quarterly Bonus export ───────────────────────────────────────────────────

export function exportQuarterlyBonus(bonusRows, quarter) {
  const wb = XLSX.utils.book_new()

  const formatRow = a => ({
    'Advisor': a.name,
    'Segment': a.segment,
    'Unit': a.unitName || '',
    'Area': a.area?.includes('SCM2') ? 'Davao' : 'Gensan',
    'Quarterly FYC (PHP)': a.bonus.qtlyFyc,
    'FYC Tier': a.bonus.fycTierLabel,
    'FYC Bonus Rate': `${(a.bonus.fycRate * 100).toFixed(0)}%`,
    'Quarterly Cases': a.bonus.qtlyCases,
    'Monthly Cases (M1/M2/M3)': a.bonus.monthlyCases.join(' / '),
    'CCB Eligible': a.bonus.ccbEligible ? 'Yes' : 'No',
    'CCB Rate': `${(a.bonus.ccbRate * 100).toFixed(0)}%`,
    'Persistency': a.bonus.persRaw != null
      ? `${a.bonus.persRaw.toFixed(1)}%`
      : 'Default (82.5%)',
    'Persistency Multiplier': `${(a.bonus.persMultiplier * 100).toFixed(0)}%`,
    'FYC Bonus (PHP)': Math.round(a.bonus.fycBonus),
    'CCB Bonus (PHP)': Math.round(a.bonus.ccbBonus),
    'Total Bonus (PHP)': Math.round(a.bonus.totalBonus),
    'Potential Bonus (PHP)': Math.round(a.bonus.potentialBonus),
    'Next Tier Hints': a.bonus.hints.join(' | '),
  })

  const allData  = bonusRows.map(formatRow)
  const qualData = bonusRows.filter(a => a.bonus.totalBonus > 0).map(formatRow)

  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(allData.length ? allData : [{ Note: 'No data' }])), 'Bonus Summary')
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(qualData.length ? qualData : [{ Note: 'No qualifying advisors' }])), 'Qualifying')

  downloadWorkbook(wb, `Davao-Amora-Bonus-${quarter}-2026.xlsx`)
}

// ─── Highlights Report export ─────────────────────────────────────────────────

export function exportHighlightsReport({
  monthLabel,
  selectedMonth,
  ytdMonths,
  allProducing,
  top10Fyc,
  top10Fyp,
  top10Cases,
  top5Units,
  newRecruits,
  consistentProducers,
  mostTrusted,
  kpis,
  unitAgg,
  agencyYtdFyp,
}) {
  const wb = XLSX.utils.book_new()
  const abbr = monthLabel.slice(0, 3).toUpperCase()

  // ── Sheet 1: Summary KPIs
  const summaryRows = [
    { Metric: 'Total Producing Advisors',  Value: kpis.totalProducing },
    { Metric: 'Total Cases',               Value: kpis.totalCases },
    { Metric: 'Total FYP (PHP)',           Value: kpis.totalFyp },
    { Metric: 'Total FYC (PHP)',           Value: kpis.totalFyc },
    { Metric: 'Case Rate (Cases / Producing Advisor)', Value: Number(kpis.caseRate.toFixed(2)) },
    { Metric: 'Average Case Size (FYP / Case) (PHP)',  Value: Math.round(kpis.avgCaseSize) },
  ]
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(summaryRows)), 'Summary')

  // ── Top-10 helper
  const fmtTop = (rows, valueLabel) =>
    rows.map((a, i) => ({
      Rank:       i + 1,
      Advisor:    a.name,
      Segment:    a.segment,
      Unit:       a.unitName || '',
      [valueLabel]: a.m?.[valueLabel.toLowerCase()] ?? a.m?.fyc ?? 0,
    }))

  const buildTop10Sheet = (top10, key, label) => {
    const rows = [
      { Rank: '', Advisor: `— OVERALL TOP 10 — ${label}`, Segment: '', Unit: '', [label]: '' },
      ...top10.overall.map((a, i) => ({ Rank: i+1, Advisor: a.name, Segment: a.segment, Unit: a.unitName||'', [label]: a.m?.[key]||0 })),
      { Rank: '', Advisor: '', Segment: '', Unit: '', [label]: '' },
      { Rank: '', Advisor: `— ROOKIE TOP 10 — ${label}`, Segment: '', Unit: '', [label]: '' },
      ...top10.rookie.map((a, i) => ({ Rank: i+1, Advisor: a.name, Segment: a.segment, Unit: a.unitName||'', [label]: a.m?.[key]||0 })),
      { Rank: '', Advisor: '', Segment: '', Unit: '', [label]: '' },
      { Rank: '', Advisor: `— SEASONED TOP 10 — ${label}`, Segment: '', Unit: '', [label]: '' },
      ...top10.seasoned.map((a, i) => ({ Rank: i+1, Advisor: a.name, Segment: a.segment, Unit: a.unitName||'', [label]: a.m?.[key]||0 })),
    ]
    return autoWidth(XLSX.utils.json_to_sheet(rows))
  }

  XLSX.utils.book_append_sheet(wb, buildTop10Sheet(top10Fyc,   'fyc',   'FYC (PHP)'), 'Top 10 FYC')
  XLSX.utils.book_append_sheet(wb, buildTop10Sheet(top10Fyp,   'fyp',   'FYP (PHP)'), 'Top 10 FYP')
  XLSX.utils.book_append_sheet(wb, buildTop10Sheet(top10Cases, 'cases', 'Cases'),     'Top 10 Cases')

  // ── Sheet: Top 5 Unit Managers
  const umRows = unitAgg
    .sort((a, b) => b.totalFyc - a.totalFyc)
    .slice(0, 5)
    .map((u, i) => ({
      Rank:              i + 1,
      'Unit Manager':    u.unitName,
      'Team Size':       u.agents.length,
      'Producing':       u.producing,
      'New Recruits':    u.newRecruits,
      'FYC (PHP)':       u.totalFyc,
      'FYP (PHP)':       u.totalFyp,
      'Cases':           u.totalCases,
    }))
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(umRows.length ? umRows : [{ Note: 'No unit data' }])), 'Top 5 Units')

  // ── Sheet: All Producing Advisors
  const producingRows = allProducing.map((a, i) => ({
    '#':            i + 1,
    'Advisor Name': a.name,
    'Segment':      a.segment,
    'Unit':         a.unitName || '',
    'FYC (PHP)':    a.m?.fyc  || 0,
    'FYP (PHP)':    a.m?.fyp  || 0,
    'Cases':        a.m?.cases || 0,
  }))
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(producingRows.length ? producingRows : [{ Note: 'No producing advisors' }])), 'All Producing')

  // ── Sheet: Most Trusted Advisors (FYC ≥ 10k)
  const trustedRows = mostTrusted.map((a, i) => ({
    Rank:           i + 1,
    'Advisor Name': a.name,
    'Segment':      a.segment,
    'Unit':         a.unitName || '',
    'FYC (PHP)':    a.m?.fyc  || 0,
    'FYP (PHP)':    a.m?.fyp  || 0,
    'Cases':        a.m?.cases || 0,
  }))
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(trustedRows.length ? trustedRows : [{ Note: 'No advisors with FYC ≥ ₱10,000' }])), 'Most Trusted')

  // ── Sheet: Consistent Producers
  const consistentRows = consistentProducers.map((a, i) => ({
    '#':                     i + 1,
    'Advisor Name':          a.name,
    'Segment':               a.segment,
    'Unit':                  a.unitName || '',
    'Months Produced':       a.streak,
    'Out of Months':         ytdMonths.length,
    'Active Months':         ytdMonths.filter(mo => a.monthly?.[mo]?.producing).join(', '),
    'YTD FYP (PHP)':         ytdMonths.reduce((s, mo) => s + (a.monthly?.[mo]?.fyp || 0), 0),
    'YTD FYC (PHP)':         ytdMonths.reduce((s, mo) => s + (a.monthly?.[mo]?.fyc || 0), 0),
  }))
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(consistentRows.length ? consistentRows : [{ Note: 'No consistent producers' }])), 'Consistent Producers')

  // ── Sheet: New Recruits
  const recruitRows = newRecruits.map((a, i) => ({
    '#':            i + 1,
    'Recruit Name': a.name,
    'Segment':      a.segment,
    'Recruiter':    a.recruiterName || '',
    'Unit':         a.unitName || '',
  }))
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(recruitRows.length ? recruitRows : [{ Note: 'No new recruits this month' }])), 'New Recruits')

  // ── Sheet: GAMA FYP Tracker
  const GAMA_TIERS = [
    { name: 'Pre-GAMA',        fyp: 0 },
    { name: 'GAMA Qualifying', fyp: 3_000_000 },
    { name: 'GAMA Silver',     fyp: 6_000_000 },
    { name: 'GAMA Gold',       fyp: 12_000_000 },
    { name: 'GAMA Platinum',   fyp: 24_000_000 },
  ]
  const getCurrentTier = ytd => {
    let t = GAMA_TIERS[0]
    for (const tier of GAMA_TIERS) { if (ytd >= tier.fyp) t = tier; else break }
    return t
  }
  const getNextTier = ytd => {
    for (const tier of GAMA_TIERS) { if (ytd < tier.fyp) return tier }
    return null
  }
  const gamaRows = [
    {
      Name:              'Agency Overall',
      'YTD FYP (PHP)':   agencyYtdFyp,
      'Current Tier':    getCurrentTier(agencyYtdFyp).name,
      'Next Tier':       getNextTier(agencyYtdFyp)?.name ?? 'Max Tier',
      'Next Tier Target (PHP)': getNextTier(agencyYtdFyp)?.fyp ?? agencyYtdFyp,
      'Gap to Next (PHP)': Math.max(0, (getNextTier(agencyYtdFyp)?.fyp ?? agencyYtdFyp) - agencyYtdFyp),
    },
    ...unitAgg.sort((a,b) => b.ytdFyp - a.ytdFyp).map(u => ({
      Name:              u.unitName,
      'YTD FYP (PHP)':   u.ytdFyp,
      'Current Tier':    getCurrentTier(u.ytdFyp).name,
      'Next Tier':       getNextTier(u.ytdFyp)?.name ?? 'Max Tier',
      'Next Tier Target (PHP)': getNextTier(u.ytdFyp)?.fyp ?? u.ytdFyp,
      'Gap to Next (PHP)': Math.max(0, (getNextTier(u.ytdFyp)?.fyp ?? u.ytdFyp) - u.ytdFyp),
    })),
  ]
  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(gamaRows)), 'GAMA Tracker')

  downloadWorkbook(wb, `Davao-Amora-Highlights-${abbr}-2026.xlsx`)
}

// ─── Agents export ────────────────────────────────────────────────────────────

export function exportAgents(agents) {
  const wb = XLSX.utils.book_new()

  const data = agents.map(a => ({
    'Agent Code':       a.code || '',
    'Advisor Name':     a.name,
    'Segment':          a.segment,
    'Agent Year':       a.agentYear ?? '',
    'Unit Code':        a.unitCode || '',
    'Unit Manager':     a.unitName || '',
    'Area':             a.area || '',
    'ANP MTD (PHP)':    a.anpMtd   || 0,
    'FYC MTD (PHP)':    a.fycMtd   || 0,
    'FYP MTD (PHP)':    a.fypTotal || 0,
    'Cases MTD':        a.casesTotal || 0,
    'Regular Cases':    a.casesRegular || 0,
    'A&H Cases':        a.casesAh || 0,
    'Producing':        a.isProducing ? 'Yes' : 'No',
  }))

  XLSX.utils.book_append_sheet(wb, autoWidth(XLSX.utils.json_to_sheet(data.length ? data : [{ Note: 'No agents' }])), 'All Advisors')
  downloadWorkbook(wb, 'Davao-Amora-Agents.xlsx')
}

// ─── exportFullReport: full 6-sheet workbook ─────────────────────────────────

export function exportFullReport(data, targets, monthIdx) {
  const agents   = (data?.agents ?? []).filter(a => a.manpowerInd)
  const abbr     = MONTH_ABBRS[monthIdx]
  const mdrtGoal = targets?.mdrt_goal || 3518400
  const wb       = XLSX.utils.book_new()

  // ── Sheet 1: Overview — monthly KPIs Jan → monthIdx
  {
    const rows = [['Month','Producing','FYP','FYC','Cases','Avg Persistency (%)','Case Rate']]
    MONTH_ABBRS.slice(0, monthIdx + 1).forEach((a, i) => {
      const producing = agents.filter(ag => ag.monthly?.[a]?.producing).length
      const fyp       = agents.reduce((s, ag) => s + (ag.monthly?.[a]?.fyp   || 0), 0)
      const fyc       = agents.reduce((s, ag) => s + (ag.monthly?.[a]?.fyc   || 0), 0)
      const cases     = agents.reduce((s, ag) => s + (ag.monthly?.[a]?.cases || 0), 0)
      const persVals  = agents.map(ag => ag.monthly?.[a]?.persistency).filter(v => v != null && !isNaN(v))
      const persAvg   = persVals.length > 0 ? persVals.reduce((s, v) => s + v, 0) / persVals.length : null
      const caseRate  = producing > 0 ? (cases / producing) : null
      rows.push([
        MONTH_LABELS[i], producing,
        fyp, fyc, cases,
        persAvg != null ? Number(persAvg.toFixed(1)) : '—',
        caseRate != null ? Number(caseRate.toFixed(2)) : '—',
      ])
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(wb, ws, 'Overview')
  }

  // ── Sheet 2: Team Rankings
  {
    const rows = [['Unit','Headcount','FYP (Month)','YTD FYP','Cases (Month)','New Recruits (Month)']]
    const unitMap = new Map()
    agents.forEach(a => {
      const key = a.unitCode || '__UNASSIGNED__'
      if (!unitMap.has(key)) unitMap.set(key, { name: a.unitName || key, agents: [] })
      unitMap.get(key).agents.push(a)
    })
    const unitRows = Array.from(unitMap.values()).map(u => ({
      name: u.name,
      headcount: u.agents.length,
      fyp:   u.agents.reduce((s, a) => s + (a.monthly?.[abbr]?.fyp   || 0), 0),
      ytdFyp: u.agents.reduce((s, a) => {
        return s + MONTH_ABBRS.slice(0, monthIdx + 1).reduce((ss, ab) => ss + (a.monthly?.[ab]?.fyp || 0), 0)
      }, 0),
      cases: u.agents.reduce((s, a) => s + (a.monthly?.[abbr]?.cases || 0), 0),
      newRecruits: u.agents.filter(a => a.monthly?.[abbr]?.isNewRecruit).length,
    })).sort((a, b) => b.fyp - a.fyp)
    unitRows.forEach(u => rows.push([u.name, u.headcount, u.fyp, u.ytdFyp, u.cases, u.newRecruits]))
    const ws = XLSX.utils.aoa_to_sheet(rows)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(wb, ws, 'Team Rankings')
  }

  // ── Sheet 3: Advisor Rankings (Top 20 by month FYP)
  {
    const rows = [['Rank','Advisor','Unit','Segment','FYP','FYC','Cases','ANP']]
    const sorted = [...agents]
      .sort((a, b) => (b.monthly?.[abbr]?.fyp || 0) - (a.monthly?.[abbr]?.fyp || 0))
      .slice(0, 20)
    sorted.forEach((a, i) => rows.push([
      i + 1, a.name, a.unitName || '—', a.segment,
      a.monthly?.[abbr]?.fyp   || 0,
      a.monthly?.[abbr]?.fyc   || 0,
      a.monthly?.[abbr]?.cases || 0,
      a.monthly?.[abbr]?.anp   || 0,
    ]))
    const ws = XLSX.utils.aoa_to_sheet(rows)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(wb, ws, 'Advisor Rankings')
  }

  // ── Sheet 4: Goals
  {
    const rows = []
    rows.push(['Agency Ace Award Progress'], ['Metric','Target','YTD Actual','% of Target'])
    const ytdFyc   = agents.reduce((s, a) => s + MONTH_ABBRS.slice(0, monthIdx + 1).reduce((ss, ab) => ss + (a.monthly?.[ab]?.fyc || 0), 0), 0)
    const ytdCases = agents.reduce((s, a) => s + MONTH_ABBRS.slice(0, monthIdx + 1).reduce((ss, ab) => ss + (a.monthly?.[ab]?.cases || 0), 0), 0)
    const persVals = agents.flatMap(a => MONTH_ABBRS.slice(0, monthIdx + 1).map(ab => a.monthly?.[ab]?.persistency).filter(v => v != null && !isNaN(v)))
    const persAvg  = persVals.length > 0 ? persVals.reduce((s, v) => s + v, 0) / persVals.length : 0
    rows.push(['FYC', 300000, ytdFyc, Number(((ytdFyc / 300000) * 100).toFixed(1))])
    rows.push(['Cases', 24, ytdCases, Number(((ytdCases / 24) * 100).toFixed(1))])
    rows.push(['Persistency (%)', 82.5, Number(persAvg.toFixed(1)), Number(((persAvg / 82.5) * 100).toFixed(1))])
    rows.push([])
    rows.push(['Annual Targets'])
    rows.push(['FYP Annual Target', targets?.fyp_annual || 0])
    rows.push(['Cases Annual Target', targets?.cases_annual || 0])
    rows.push(['Monthly Producing Target', targets?.producing_monthly || 0])
    rows.push(['MDRT Goal', targets?.mdrt_goal || mdrtGoal])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(wb, ws, 'Goals')
  }

  // ── Sheet 5: Recognition
  {
    const rows = []
    const mn = MONTH_ABBRS[monthIdx]

    rows.push([`Birthdays — ${MONTH_LABELS[monthIdx]}`], ['Name','Unit','Birth Date'])
    agents
      .filter(a => a.birthDate && new Date(a.birthDate).getMonth() === monthIdx)
      .forEach(a => rows.push([a.name, a.unitName || '—', a.birthDate]))
    rows.push([])

    rows.push([`New Advisors — ${MONTH_LABELS[monthIdx]}`], ['Name','Unit','Appointment Date'])
    agents
      .filter(a => a.appointmentDate && new Date(a.appointmentDate).getMonth() === monthIdx)
      .forEach(a => rows.push([a.name, a.unitName || '—', a.appointmentDate]))
    rows.push([])

    rows.push(['Top 5 Rookie Advisors'], ['Rank','Name','Unit','Score','FYP','Cases','ANP'])
    getTopRookies(agents, mn, 5).forEach((r, i) =>
      rows.push([i+1, r.agent.name, r.agent.unitName||'—', Number(r.combinedScore.toFixed(4)), r.fyp, r.cases, r.anp])
    )
    rows.push([])

    rows.push(['Top 5 Overall Advisors'], ['Rank','Name','Unit','Score','FYP','Cases','ANP'])
    getTopOverall(agents, mn, 5).forEach((r, i) =>
      rows.push([i+1, r.agent.name, r.agent.unitName||'—', Number(r.combinedScore.toFixed(4)), r.fyp, r.cases, r.anp])
    )
    rows.push([])

    rows.push(['Most Trusted Advisors (MTA)'], ['Rank','Name','Unit','Cases','FYP','FYC'])
    getMostTrustedAdvisors(agents, mn).forEach((r, i) =>
      rows.push([i+1, r.agent.name, r.agent.unitName||'—', r.cases, r.fyp, r.fyc])
    )
    rows.push([])

    rows.push(['Most Productive Advisors (MPA)'], ['Rank','Name','Unit','FYC','FYP','Cases'])
    getMostProductiveAdvisors(agents, mn).forEach((r, i) =>
      rows.push([i+1, r.agent.name, r.agent.unitName||'—', r.fyc, r.fyp, r.cases])
    )
    rows.push([])

    rows.push(['Consistent Monthly Producers (No Gaps)'], ['Rank','Name','Unit','Months Producing','Total Months'])
    getConsistentProducers(agents, monthIdx, true).forEach((r, i) =>
      rows.push([i+1, r.agent.name, r.agent.unitName||'—', r.producingMonths, r.totalMonths])
    )

    const ws = XLSX.utils.aoa_to_sheet(rows)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(wb, ws, 'Recognition')
  }

  // ── Sheet 6: Agency Targets
  {
    const annualFyp   = targets?.fyp_annual  || 0
    const annualCases = targets?.cases_annual || 0
    const fypActuals  = MONTH_ABBRS.map(ab => agents.reduce((s, a) => s + (a.monthly?.[ab]?.fyp || 0), 0))
    const caseActuals = MONTH_ABBRS.map(ab => agents.reduce((s, a) => s + (a.monthly?.[ab]?.cases || 0), 0))

    const rollingFyp = (() => {
      const t = new Array(12).fill(0); let cum = 0
      for (let i = 0; i < 11; i++) { t[i] = Math.max(0, (annualFyp - cum) / (11 - i)); cum += fypActuals[i] || 0 }
      return t
    })()
    const rollingCase = (() => {
      const t = new Array(12).fill(0); let cum = 0
      for (let i = 0; i < 11; i++) { t[i] = Math.max(0, (annualCases - cum) / (11 - i)); cum += caseActuals[i] || 0 }
      return t
    })()

    const rows = [
      ['Agency Targets', CURRENT_YEAR],
      ['FYP Annual Target', annualFyp],
      ['Cases Annual Target', targets?.cases_annual || 0],
      ['Monthly Producing Target', targets?.producing_monthly || 0],
      ['MDRT Goal', targets?.mdrt_goal || mdrtGoal],
      [],
      ['Monthly FYP Breakdown'],
      ['Month', 'Rolling FYP Target', 'Actual FYP', 'Rolling Case Target', 'Actual Cases'],
      ...MONTH_ABBRS.map((ab, i) => [MONTH_LABELS[i], rollingFyp[i], fypActuals[i], rollingCase[i], caseActuals[i]]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    autoWidth(ws)
    XLSX.utils.book_append_sheet(wb, ws, 'Agency Targets')
  }

  downloadWorkbook(wb, `Amora-Dashboard-Report-${MONTH_ABBRS[monthIdx]}-${CURRENT_YEAR}.xlsx`)
}
