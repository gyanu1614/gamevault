/** "$0.62", "$4.50", "$75", "$223.53": cents always shown when present, never rounded away. */
export function formatUsd(value: number): string {
  const cents = Math.round(value * 100)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}
