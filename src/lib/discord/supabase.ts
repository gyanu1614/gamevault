/**
 * Supabase client for the Discord bot.
 *
 * Deliberately NOT the cookie-bound SSR client the pages use: a Discord
 * interaction is a signed webhook, not a browser session, so there is no
 * cookie jar to bind to and nothing to read as a logged-in user.
 *
 * Anon key only. Everything the bot reads (`sab_public_price_catalog`,
 * `sab_brainrot_market_catalog`, `sab_brainrot_mutation_calculator`) is already
 * granted to `anon` for the public value pages, so the service-role key never
 * needs to touch a route that accepts outside traffic.
 *
 * Module-scope singleton so warm invocations reuse the connection pool.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function botSupabase(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Discord bot is missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY',
    )
  }

  cached = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cached
}

/**
 * Read every row of a table, page by page.
 *
 * PostgREST caps a plain select at 1000 rows and returns the truncated set
 * *without an error* — the exact failure mode that would silently drop
 * Brainrots from autocomplete the moment the catalog outgrows the cap.
 */
export async function selectAll<T>(
  table: string,
  columns: string,
  pageSize = 1000,
): Promise<T[]> {
  const supabase = botSupabase()
  const rows: T[] = []

  for (let page = 0; ; page += 1) {
    const from = page * pageSize
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break

    rows.push(...(data as T[]))

    if (data.length < pageSize) break
  }

  return rows
}
