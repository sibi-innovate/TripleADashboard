import * as XLSX from 'xlsx'

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
