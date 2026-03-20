# Monthly Report & Quarterly Bonus Tracker — Design

**Date:** 2026-03-19
**Project:** Davao Amora Agency Dashboard

---

## Summary

Add two new tabs to the dashboard and globally rename the "Tenured/Senior" segment to "Seasoned (Year 2+)".

---

## Global Change: Segment Rename

- **Rookie** = Year 1 (unchanged)
- **Seasoned** = Year 2+ (was Tenured + Senior merged)
- **Remove Senior** as a category everywhere

Change in `parseExcel.js`: `agentYear >= 2 → 'Seasoned'`. This cascades through all pages automatically.

Also remove Senior from all SEGMENT constant arrays in Overview, Leaderboard, Units, Agents pages.

---

## Tab 1: Monthly Report (`/monthly`)

### Month Selector
Dropdown or pill tabs: Jan → current month (March 2026 at time of writing).

### KPI Cards (top bar, from selected month's columns)
| Card | Column |
|------|--------|
| Manpower | `ManPowerCnt_[MON]2026` |
| Producing Advisors | Sum of `PRODUCING_[MON]2026 = 1` |
| ANP | `ANP_[MON]2026` |
| FYC | `FYC_PHP_2026MM` |
| FYP | `FYPI_[MON]2026` |
| Cases | `OL_VUL_CS_CNT_[MON]2026` |
| Persistency | Average of non-zero `PERS_[MON]2026` values |

Month abbreviation mapping: JAN/FEB/MAR/APR/MAY/JUN/JUL/AUG/SEP/OCT/NOV/DEC
FYC column format is different: `FYC_PHP_202601` (zero-padded month number, not abbreviation)

### Highlights Section
Three sub-tabs: **FYC** | **FYP** | **Cases**

Each sub-tab has:
- A toggle: **Overall** (default) | **By Segment**
- **Overall mode:** Single top-10 table of all advisors ranked by that metric for the selected month
- **By Segment mode:** Two side-by-side tables — Rookie (top 10) | Seasoned (top 10)

Columns in each table: Rank | Advisor | Unit | Area | Value | Segment badge

### New Recruits Section
- Lists advisors where `NEW_RECRUIT_[MON]2026 = 1`
- Groups by `RECRUITER_NAME`
- Shows **Top Recruiters** podium: rank by number of recruits brought in for the month

---

## Tab 2: Quarterly Bonus Tracker (`/quarterly-bonus`)

### Quarter Selector
Q1 (Jan–Mar) | Q2 (Apr–Jun) | Q3 (Jul–Sep) | Q4 (Oct–Dec)

Auto-selects current quarter on load.

### Data Computation (per advisor, for selected quarter)

**Step 1 — Quarterly FYC**
```
Q1: FYC_PHP_202601 + FYC_PHP_202602 + FYC_PHP_202603
Q2: FYC_PHP_202604 + FYC_PHP_202605 + FYC_PHP_202606
Q3: FYC_PHP_202607 + FYC_PHP_202608 + FYC_PHP_202609
Q4: FYC_PHP_202610 + FYC_PHP_202611 + FYC_PHP_202612
```

**Step 2 — FYC Bonus Rate**
| Quarterly FYC | Rate |
|---|---|
| < ₱30,000 | 0% (no bonus) |
| ₱30,000 – ₱49,999 | 10% |
| ₱50,000 – ₱79,999 | 15% |
| ₱80,000 – ₱119,999 | 20% |
| ₱120,000 – ₱199,999 | 30% |
| ₱200,000 – ₱349,999 | 35% |
| ₱350,000+ | 40% |

FYC Bonus = Quarterly FYC × FYC Bonus Rate

**Step 3 — Case Count Bonus (CCB)**

Quarterly case count = sum of `OL_VUL_CS_CNT_[MON]` for each month in the quarter.

**Eligibility check:** Advisor must have `OL_VUL_CS_CNT_[MON] > 0` in at least 2 of the 3 months in the quarter. If not eligible, CCB = 0.

| Quarterly Cases | CCB Rate |
|---|---|
| < 3 | 0% |
| 3–4 | 5% |
| 5–6 | 10% |
| 7–8 | 15% |
| 9+ | 20% |

CCB = Quarterly FYC × CCB Rate (applied to quarterly FYC, same base)

**Step 4 — Persistency Multiplier**

Use `PERS_Q1[2026]`, `PERS_Q2[2026]`, `PERS_Q3[2026]`, `PERS_Q4[2026]`.

Column names: `PERS_Q12026`, `PERS_Q22026`, `PERS_Q32026`, `PERS_Q42026`

| Persistency | Multiplier |
|---|---|
| ≥ 82.5% | 100% (full bonus) |
| 75% – 82.49% | 80% |
| < 75% | 0% (no bonus) |
| Blank / no data | Default 82.5% → 100% |

**Step 5 — Final Bonus**
```
Final Bonus = (FYC Bonus + CCB Bonus) × Persistency Multiplier
```

**Step 6 — Potential Bonus (next tier)**

Compute what the advisor would earn if they reached:
- The next FYC tier (show the gap amount needed, and the bonus they'd earn)
- The next CCB tier (show cases needed, and the extra bonus)

Display as a motivational "Reach ₱X more FYC to earn ₱Y bonus" hint.

### Table Columns
Advisor | Segment | Qtly FYC | FYC Tier | Qtly Cases | CCB Eligible | CCB Tier | Persistency | Multiplier | **Current Bonus** | **Potential Bonus**

### Filters
- Area: All | Davao | Gensan
- Segment: All | Rookie | Seasoned
- Producing only toggle

---

## Excel Column Reference

| Purpose | Column Pattern |
|---------|---------------|
| Monthly FYC | `FYC_PHP_202601` … `FYC_PHP_202612` |
| Monthly ANP | `ANP_JAN2026` … `ANP_DEC2026` |
| Monthly FYP | `FYPI_JAN2026` … `FYPI_DEC2026` |
| Monthly Cases | `OL_VUL_CS_CNT_JAN2026` … `OL_VUL_CS_CNT_DEC2026` |
| Monthly Producing | `PRODUCING_JAN2026` … `PRODUCING_DEC2026` |
| Monthly Persistency | `PERS_JAN2026` … `PERS_DEC2026` |
| Monthly Manpower | `ManPowerCnt_JAN2026` … `ManPowerCnt_DEC2026` |
| Monthly New Recruit | `NEW_RECRUIT_JAN2026` … `NEW_RECRUIT_DEC2026` |
| Quarterly Persistency | `PERS_Q12026`, `PERS_Q22026`, `PERS_Q32026`, `PERS_Q42026` |
| Recruiter | `RECRUITER_NAME`, `RECRUITER_CODE` |

---

## Navigation Changes

**Current:** Upload / Overview / Leaderboard / Units / Agents
**New:** Upload / Overview / Leaderboard / **Monthly** / **Quarterly Bonus** / Units / Agents

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/utils/parseExcel.js` | Add `monthly` object per agent, add `recruiterName`, fix segment to Rookie/Seasoned |
| `src/pages/MonthlyReportPage.jsx` | New page |
| `src/pages/QuarterlyBonusPage.jsx` | New page |
| `src/App.jsx` | Add 2 new routes |
| `src/components/Navbar.jsx` | Add 2 new nav links |
| `src/pages/OverviewPage.jsx` | Remove Senior from SEGMENTS array |
| `src/pages/LeaderboardPage.jsx` | Rename Tenured→Seasoned, remove Senior |
| `src/pages/UnitsPage.jsx` | Rename Tenured→Seasoned, remove Senior |
| `src/pages/AgentsPage.jsx` | Rename Tenured→Seasoned, remove Senior |
