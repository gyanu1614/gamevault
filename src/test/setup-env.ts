/**
 * Vitest setup: load .env.local so integration tests can reach Supabase.
 *
 * Unit tests (money/ids/errors/the pure ledger seam) need none of this; they
 * run with no env. Integration tests (post_journal against the real DB) read
 * NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and SKIP THEMSELVES if
 * those are absent, so the suite stays green in CI without secrets.
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
