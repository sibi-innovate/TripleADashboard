import { formatCurrency } from '../utils/formatters'
import { formatPeso } from '../utils/calculations'

export default function SmartCurrency({ value }) {
  const num = Number(value)
  const compact = formatCurrency(num, true)   // ₱4.3M or ₱1.2K
  const full = formatPeso(num)                // ₱4,250,000.0
  return (
    <>
      <span className="lg:hidden">{compact}</span>
      <span className="hidden lg:inline">{full}</span>
    </>
  )
}
