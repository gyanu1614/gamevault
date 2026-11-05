/**
 * Who may call which admin actions. Matches the sidebar (admin/components/Sidebar.tsx);
 * the sidebar only hides links, so these lists are the real limit.
 * staff-action-roles.guard.test.ts fails on an action with no list.
 */
export const ADMIN_ONLY = ['admin', 'super_admin'] as const
export const MODERATOR_STAFF = ['admin', 'moderator', 'super_admin'] as const
export const SUPPORT_STAFF = ['admin', 'support', 'super_admin'] as const

type SignupDetails = { full_name: string | null; address_line: string | null; city: string | null }

/** A seller's legal name and address are for admins. Moderators and support work without them. */
export function seesLegalDetails(role: string): boolean {
  return (ADMIN_ONLY as readonly string[]).includes(role)
}

export function limitSignupForRole<T extends SignupDetails>(signup: T | null, role: string): T | null {
  if (!signup || seesLegalDetails(role)) return signup
  return { ...signup, full_name: null, address_line: null, city: null }
}
