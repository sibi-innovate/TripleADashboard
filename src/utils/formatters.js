/**
 * Formats a number as Philippine Peso currency.
 * @param {number|string|null|undefined} value - The numeric value to format.
 * @param {boolean} compact - If true, abbreviates large numbers (e.g. ₱1.2M, ₱4.5K).
 * @returns {string} Formatted currency string, or '—' for null/undefined/invalid values.
 */
export function formatCurrency(value, compact = false) {
  if (value === null || value === undefined || value === '') return '—';

  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : Number(value);

  if (isNaN(num)) return '—';

  if (compact) {
    if (Math.abs(num) >= 1_000_000) {
      const formatted = (num / 1_000_000).toFixed(1).replace(/\.0$/, '');
      return `₱${formatted}M`;
    }
    if (Math.abs(num) >= 1_000) {
      const formatted = (num / 1_000).toFixed(1).replace(/\.0$/, '');
      return `₱${formatted}K`;
    }
    return `₱${num.toLocaleString('en-PH')}`;
  }

  return `₱${num.toLocaleString('en-PH')}`;
}

/**
 * Formats a number with comma separators.
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-PH');
}

/**
 * Formats a decimal as a percentage string.
 * @param {number|null|undefined} value - e.g. 0.125 → "12.5%"
 * @param {number} decimals - decimal places (default 1)
 * @returns {string}
 */
export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  return `${(num * 100).toFixed(decimals)}%`;
}
