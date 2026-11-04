'use server'

import { redirect } from 'next/navigation'
import type { AdminRole, AdminUser } from '@/lib/admin/permissions-constants'
import { getAdminGate, getVerifiedAdmin } from '@/lib/admin/context'

export type { AdminRole, AdminUser }

// ============================================
// CORE AUTH FUNCTIONS
// ============================================

/**
 * Check if user is authenticated, is active staff AND passed two-factor in this
 * session. Redirects to login, home or the two-factor page otherwise. Answered
 * once per request (lib/admin/context), so calling it repeatedly costs nothing.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const gate = await getAdminGate()
  if (gate.status === 'signed_out') redirect('/login')
  if (gate.status === 'not_admin') redirect('/')
  if (gate.status === 'needs_mfa') redirect('/admin/mfa')
  return gate.admin
}

/**
 * Check if user has a specific permission
 */
export async function requirePermission(permission: string): Promise<AdminUser> {
  const admin = await requireAdmin()

  if (!admin.permissions.includes(permission)) {
    throw new Error(`Permission denied: ${permission}`)
  }

  return admin
}

/**
 * Check if user has one of the specified roles
 */
export async function requireRole(roles: AdminRole[]): Promise<AdminUser> {
  const admin = await requireAdmin()

  if (!roles.includes(admin.role)) {
    throw new Error(`Role not allowed: ${admin.role}`)
  }

  return admin
}

/**
 * Get admin user without redirect (for client-side checks). Null unless active
 * staff with two-factor in this session.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  return getVerifiedAdmin()
}

/**
 * Check permission without throwing
 */
export async function hasPermission(permission: string): Promise<boolean> {
  try {
    const admin = await getAdminUser()
    return admin?.permissions.includes(permission) || false
  } catch {
    return false
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const admin = await getAdminUser()
  return admin !== null && admin.isActive
}

/**
 * Alias for getAdminUser - for compatibility
 */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  return await getAdminUser()
}
