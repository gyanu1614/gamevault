/**
 * A buyer who disputed a card payment with their bank is blocked from paying
 * (buyer_blocks, migration 20261028143542) until an admin unblocks them.
 * Read with the service role: the table has no RLS policies.
 */
import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/service'

export const BUYER_BLOCKED_MESSAGE =
  'Purchases are paused on your account while a payment dispute is open. Contact support to sort it out.'

export async function isBuyerBlocked(userId: string): Promise<boolean> {
  // buyer_blocks is newer than the generated DB types.
  const db = createServiceRoleClient() as unknown as { from: (table: 'buyer_blocks') => any }
  const { data, error } = await db.from('buyer_blocks').select('user_id').eq('user_id', userId).maybeSingle()
  // Fail closed: a read error must not let a blocked buyer through.
  if (error) throw new Error(`buyer_blocks read failed: ${error.message}`)
  return Boolean(data)
}
