/**
 * One-time migration: import the file-based BLOG_POSTS into the blog_posts DB
 * table so they show in the admin CMS and can live under nested per-game URLs.
 *
 * - Idempotent: upserts on (primary_game_slug, slug). Re-runnable safely.
 * - primary_game_slug = the post's first `games` tag (null if general).
 * - game_slugs = the full tag set (for cross-surfacing rails).
 * - status = published (these are live posts).
 *
 * Run: node scripts/migrate-blog-posts-to-db.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// The posts.ts module is TS; rather than transpile, we parse the exported
// array out of the source via a dynamic import of a tiny shim is overkill —
// instead we read the JSON-ish data by importing the compiled shape. Simplest
// robust path: import the TS through a data extraction using a regex-free eval
// of the exported const is fragile, so we require the caller to have the posts
// available. We read the file and evaluate the BLOG_POSTS array literal.
const src = readFileSync(
  new URL('../src/lib/blog/posts.ts', import.meta.url),
  'utf8',
)

// Extract the array literal `export const BLOG_POSTS: BlogPost[] = [ ... ]`.
// Anchor on the `= [` so the `[]` in the `BlogPost[]` type annotation is skipped.
const start = src.indexOf('export const BLOG_POSTS')
const eq = src.indexOf('=', start)
const arrOpen = src.indexOf('[', eq)
// Find the matching closing bracket for the array.
let depth = 0
let end = -1
for (let i = arrOpen; i < src.length; i++) {
  const c = src[i]
  if (c === '[') depth++
  else if (c === ']') {
    depth--
    if (depth === 0) {
      end = i
      break
    }
  }
}
const literal = src.slice(arrOpen, end + 1)
// The literal is valid JS (object literals + string arrays). Evaluate it.
// eslint-disable-next-line no-eval
const BLOG_POSTS = eval(literal)

console.log(`Parsed ${BLOG_POSTS.length} file-based posts.`)

let ok = 0
let fail = 0
for (const p of BLOG_POSTS) {
  const primaryGame = p.games?.[0] ?? null
  const row = {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? '',
    author: p.author ?? 'DropMarket Team',
    read_minutes: p.readMinutes ?? 5,
    // Best-effort type: value-ish slugs → 'value', sell-ish → 'seller', else 'guide'.
    post_type: /value|worth|price/i.test(p.slug)
      ? 'value'
      : /sell/i.test(p.slug)
        ? 'seller'
        : 'guide',
    status: 'published',
    primary_game_slug: primaryGame,
    game_slugs: p.games ?? [],
    cover_url: p.cover ?? null,
    body: p.body ?? [],
    published_at: new Date(p.publishedAt).toISOString(),
  }
  const { error } = await sb
    .from('blog_posts')
    .upsert(row, { onConflict: 'primary_game_slug,slug' })
  if (error) {
    console.log(`  ✗ ${p.slug}: ${error.message}`)
    fail++
  } else {
    console.log(`  ✓ ${p.slug}  → ${primaryGame ? `/${primaryGame}/blogs/${p.slug}` : `/blog/${p.slug}`}`)
    ok++
  }
}

console.log(`\nDone. ${ok} imported, ${fail} failed.`)
process.exit(fail > 0 ? 1 : 0)
