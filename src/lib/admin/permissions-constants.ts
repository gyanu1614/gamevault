// Admin permission constants
// Note: This file does NOT have 'use server' so we can export constants

export const PERMISSIONS = {
  APPLICATIONS_VIEW: 'applications.view',
  APPLICATIONS_REVIEW: 'applications.review',
  APPLICATIONS_APPROVE: 'applications.approve',
  APPLICATIONS_REJECT: 'applications.reject',
  USERS_VIEW: 'users.view',
  USERS_EDIT: 'users.edit',
  USERS_SUSPEND: 'users.suspend',
  USERS_BAN: 'users.ban',
  SELLERS_VIEW: 'sellers.view',
  SELLERS_EDIT: 'sellers.edit',
  SELLERS_SUSPEND: 'sellers.suspend',
  SELLERS_CHANGE_TIER: 'sellers.change_tier',
  TRANSACTIONS_VIEW: 'transactions.view',
  TRANSACTIONS_REFUND: 'transactions.refund',
  DISPUTES_VIEW: 'disputes.view',
  DISPUTES_ASSIGN: 'disputes.assign',
  DISPUTES_RESOLVE: 'disputes.resolve',
  DISPUTES_ESCALATE: 'disputes.escalate',
  ANALYTICS_VIEW: 'analytics.view',
  TEAM_VIEW: 'team.view',
  TEAM_MANAGE: 'team.manage',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  ACTIVITY_LOG_VIEW: 'activity_log.view',
} as const

export type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'support'

export interface AdminUser {
  userId: string
  email: string
  role: AdminRole
  isActive: boolean
  permissions: string[]
  lastActiveAt: string | null
}

// Predefined action constants for activity logging
export const ADMIN_ACTIONS = {
  APPLICATION_VIEWED: 'application.viewed',
  APPLICATION_REVIEW_STARTED: 'application.review_started',
  APPLICATION_APPROVED: 'application.approved',
  APPLICATION_REJECTED: 'application.rejected',
  APPLICATION_INFO_REQUESTED: 'application.info_requested',
  DOCUMENT_VERIFIED: 'document.verified',
  FRAUD_SCORE_UPDATED: 'fraud_score.updated',
  USER_VIEWED: 'user.viewed',
  USER_SUSPENDED: 'user.suspended',
  USER_UNSUSPENDED: 'user.unsuspended',
  USER_BANNED: 'user.banned',
  SELLER_VIEWED: 'seller.viewed',
  SELLER_TIER_CHANGED: 'seller.tier_changed',
  SELLER_SUSPENDED: 'seller.suspended',
  DISPUTE_VIEWED: 'dispute.viewed',
  DISPUTE_ASSIGNED: 'dispute.assigned',
  DISPUTE_MESSAGE_SENT: 'dispute.message_sent',
  DISPUTE_RESOLVED: 'dispute.resolved',
  DISPUTE_ESCALATED: 'dispute.escalated',
  ADMIN_ADDED: 'admin.added',
  ADMIN_ROLE_CHANGED: 'admin.role_changed',
  ADMIN_DEACTIVATED: 'admin.deactivated',
  SETTINGS_UPDATED: 'settings.updated',
} as const
