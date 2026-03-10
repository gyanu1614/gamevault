/**
 * Seller Application Utility Functions
 *
 * Helper functions for formatting and displaying seller application data
 */

/**
 * Format seconds into human-readable time
 */
export function formatTimeRemaining(seconds: number): {
  days: number
  hours: number
  minutes: number
  seconds: number
  formatted: string
} {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  let formatted = ''
  if (days > 0) formatted += `${days}d `
  if (hours > 0) formatted += `${hours}h `
  if (minutes > 0) formatted += `${minutes}m `
  if (secs > 0 || formatted === '') formatted += `${secs}s`

  return {
    days,
    hours,
    minutes,
    seconds: secs,
    formatted: formatted.trim(),
  }
}

/**
 * Get rejection category label
 */
export function getRejectionCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    incomplete_documentation: 'Incomplete Documentation',
    invalid_documents: 'Invalid or Expired Documents',
    information_mismatch: 'Information Mismatch',
    suspicious_activity: 'Suspicious Activity',
    business_verification_failed: 'Business Verification Failed',
    other: 'Other',
  }
  return labels[category] || 'Unknown'
}

/**
 * Get cooldown period label based on rejection count
 */
export function getCooldownLabel(rejectionCount: number): string {
  if (rejectionCount === 0) return '7 days'
  if (rejectionCount === 1) return '30 days'
  if (rejectionCount === 2) return '90 days'
  return 'Permanent (Appeal Required)'
}
