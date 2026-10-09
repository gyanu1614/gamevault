import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { discordHandleFromUser } from '@/lib/auth/oauth'

/**
 * The Discord username of an account that signed in with Discord, read from
 * the auth identity Supabase already stores (auth.identities.identity_data).
 * No profile column: the identity is the source of truth and survives a
 * username change on Discord's side only until the next Discord sign-in,
 * which is exactly when Supabase refreshes it. Server-only (service role);
 * the founding flow's step 2 uses it to prefill its Discord field.
 */
export async function lookupDiscordHandle(userId: string): Promise<string | null> {
  try {
    const { data, error } = await createServiceRoleClient().auth.admin.getUserById(userId)
    if (error || !data.user) return null
    return discordHandleFromUser(data.user)
  } catch {
    return null
  }
}
