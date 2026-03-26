'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { AdminRole, AdminUser } from '@/lib/admin/permissions-constants'

export type { AdminRole, AdminUser }

// ============================================
// CORE AUTH FUNCTIONS
// ============================================

/**
 * Check if user is authenticated and is an admin
 * Redirects to login or home if not authorized
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check admin_roles table (NOT profiles.role)
  const { data: adminRole, error } = await supabase
    .from('admin_roles')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single() as any

  if (error || !adminRole) {
    redirect('/')
  }

  // Get permissions for this role
  const { data: permissions } = await supabase
    .from('role_permissions')
    .select('permission')
    .eq('role', adminRole.role) as any

  // Fetch profile data for additional user info
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, avatar_url')
    .eq('id', user.id)
    .single() as any

  // Update last active timestamp
  await (supabase
    .from('admin_roles')
    .update as any)({ last_active_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return {
    userId: user.id,
    email: user.email || '',
    role: adminRole.role as AdminRole,
    isActive: adminRole.is_active,
    permissions: permissions?.map((p: any) => p.permission) || [],
    lastActiveAt: adminRole.last_active_at,
    // Add profile fields for UI components
    username: profile?.username || null,
    full_name: profile?.full_name || null,
    avatar_url: profile?.avatar_url || null,
  } as any
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
 * Get admin user without redirect (for client-side checks)
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: adminRole } = await supabase
    .from('admin_roles')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single() as any

  if (!adminRole) return null

  const { data: permissions } = await supabase
    .from('role_permissions')
    .select('permission')
    .eq('role', adminRole.role) as any

  // Fetch profile data for additional user info
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, avatar_url')
    .eq('id', user.id)
    .single() as any

  return {
    userId: user.id,
    email: user.email || '',
    role: adminRole.role as AdminRole,
    isActive: adminRole.is_active,
    permissions: permissions?.map((p: any) => p.permission) || [],
    lastActiveAt: adminRole.last_active_at,
    // Add profile fields for UI components
    username: profile?.username || null,
    full_name: profile?.full_name || null,
    avatar_url: profile?.avatar_url || null,
    badges: [], // Default empty array for badges
  } as any
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
