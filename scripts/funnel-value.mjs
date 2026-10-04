/**
 * Bundle 2 task E — read the value page → listing funnel.
 *
 *   pnpm funnel:value --env=local
 *   pnpm funnel:value --env=prod --days=30 [--game=adopt-me]
 *
 * Reads the service-only view `value_funnel_daily` (views → buy-button
 * clicks → listings opened from a value surface → orders paid within 24 h of
 * that open). Read-only.
 */
import process from 'node:process'
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

const argv = process.argv.slice(2)
const val = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const ENV = val('env', '')
const DAYS = Number(val('days', '30')) || 30
const GAME = val('game', '')

if (!['local', 'prod'].includes(ENV)) {
  console.error('✗ --env=local or --env=prod is required.')
  process.exit(1)
}
const ENV_FILE = ENV === 'local' ? '.env.test' : '.env.local'
if (!existsSync(ENV_FILE)) {
  console.error(`✗ ${ENV_FILE} not found.`)
  process.exit(1)
}
loadEnv({ path: ENV_FILE })
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error(`✗ ${ENV_FILE} is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.`)
  process.exit(1)
}

const since = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10)
let q = createClient(URL, KEY, { auth: { persistSession: false } })
  .from('value_funnel_daily')
  .select('*')
  .gte('day', since)
  .order('day', { ascending: true })
if (GAME) q = q.eq('game_slug', GAME)
const { data, error } = await q
if (error) {
  console.error(`✗ ${error.message}`)
  process.exit(1)
}

const rows = data ?? []
const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—')
console.table(rows.map((r) => ({
  day: r.day, game: r.game_slug, views: r.value_views, clicks: r.cta_clicks, fallbacks: r.fallbacks_shown,
  opened: r.listings_opened, orders: r.orders,
})))
const t = rows.reduce((a, r) => ({
  views: a.views + r.value_views, clicks: a.clicks + r.cta_clicks, opened: a.opened + r.listings_opened, orders: a.orders + r.orders,
}), { views: 0, clicks: 0, opened: 0, orders: 0 })
console.log(`\nLast ${DAYS} days${GAME ? ` · ${GAME}` : ''}: ${t.views} views → ${t.clicks} clicks (${pct(t.clicks, t.views)}) → ${t.opened} listings opened (${pct(t.opened, t.clicks)}) → ${t.orders} paid orders (${pct(t.orders, t.opened)})`)
