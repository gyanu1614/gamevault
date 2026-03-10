/**
 * Seller status utility functions
 */

export type SellerStatus = 'active' | 'restricted' | 'banned'

export interface SellerRestriction {
  status: SellerStatus
  reason?: string | null
  restricted_at?: string | null
  restricted_by?: string | null
}

/**
 * Check if seller can create/publish listings
 */
export function canSellerPublish(status: SellerStatus): boolean {
  return status === 'active'
}

/**
 * Check if seller has any access to seller features
 */
export function hasSellerAccess(status: SellerStatus): boolean {
  return status !== 'banned'
}

/**
 * Get user-friendly status message
 */
export function getStatusMessage(status: SellerStatus, reason?: string | null): {
  title: string
  message: string
  severity: 'info' | 'warning' | 'error'
} {
  switch (status) {
    case 'restricted':
      return {
        title: 'Account Restricted',
        message: reason || 'Your seller account is under review. Please contact support at test@gmail.com',
        severity: 'warning'
      }
    case 'banned':
      return {
        title: 'Account Banned',
        message: reason || 'Your seller account has been banned. Please contact support at test@gmail.com',
        severity: 'error'
      }
    case 'active':
    default:
      return {
        title: 'Account Active',
        message: 'Your seller account is in good standing',
        severity: 'info'
      }
  }
}

/**
 * Get color classes for status
 */
export function getStatusColors(status: SellerStatus): {
  bg: string
  border: string
  text: string
  icon: string
} {
  switch (status) {
    case 'restricted':
      return {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        text: 'text-yellow-400',
        icon: 'text-yellow-400'
      }
    case 'banned':
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-400',
        icon: 'text-red-400'
      }
    case 'active':
    default:
      return {
        bg: 'bg-green-500/10',
        border: 'border-green-500/30',
        text: 'text-green-400',
        icon: 'text-green-400'
      }
  }
}
