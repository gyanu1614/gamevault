#!/usr/bin/env node
/**
 * Game hero background importer — bulk-load hero images through the SAME
 * processing as the admin upload (src/lib/games/hero-image.ts: WebP 960 /
 * 1600 / 2400, quality 72, 24 px LQIP, content-hashed names).
 *
 *   pnpm game-hero:import --env=local                     # dry run (default): every design/game-heroes/<slug>.* file
 *   pnpm game-hero:import --env=local --yes               # apply
 *   pnpm game-hero:import --env=prod  --yes --only mm2    # one game (owner only)
 *   pnpm game-hero:import --env=prod  --yes --force adopt-me   # replace an existing upload
 *   pnpm game-hero:import --env=local --yes --slug roblox --file ~/Downloads/roblox-hero.jpg
 *   pnpm game-hero:import --env=local --yes --slug roblox --url https://…/hero.jpg
 *   pnpm game-hero:import --env=local --yes --static      # seed from the art the repo already ships
 *
 * Folder convention: design/game-heroes/<game-slug>.(jpg|jpeg|png|webp|avif),
 * landscape, 2400 px wide or more (16:9 or wider), subject away from the
 * centre-top where page titles sit. See design/game-heroes/README.md.
 *
 * Options:
 *   --env=local|prod   required. local → .env.test (this worktree's stack),
 *                      prod → .env.local (production). Guarded both ways.
 *   --yes              write. Without it nothing is uploaded or saved.
 *   --dir=<path>       folder to scan (default design/game-heroes).
 *   --only <slug>      just this game from the folder.
 *   --force <slug>     overwrite a game that already has an uploaded hero
 *                      (otherwise those are skipped — never clobber an admin upload).
 *   --static           also import STATIC_GAME_HEROES (public/…) for games
 *                      with no folder file, so they get srcset + LQIP.
 *   --focal <0-100>    vertical focal point to store (default 50).
 *
 * Pages pick the new hero up on their next regeneration: the next deploy, or
 * within 24 h (ISR window). To refresh one game immediately, open it in
 * Admin → Games → Branding, nudge the position and press Save Position
 * (that revalidates its pages).
 *
 * Writes use the service-role key (public.games is admin-only under RLS; the
 * game-heroes bucket has no write policy for anyone else).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, extname, basename, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { processHeroImage, heroColumnsFor } from '../src/lib/games/hero-image.ts'
import {
  GAME_HERO_BUCKET,
  STATIC_GAME_HEROES,
  clampHeroFocalY,
  heroObjectPathFromUrl,
} from '../src/lib/games/hero.ts'

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
/** `--name=value` or `--name value`. */
const flag = (name) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3) || null
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}

const ENV = flag('env') ?? ''
const APPLY = has('--yes')
const DIR = resolve(flag('dir') ?? 'design/game-heroes')
const ONLY = flag('only')
const FORCE = flag('force')
const ONE_SLUG = flag('slug')
const ONE_FILE = flag('file')
const ONE_URL = flag('url')
const WITH_STATIC = has('--static')
const FOCAL = clampHeroFocalY(flag('focal') ?? 50)
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])

if (!['local', 'prod'].includes(ENV)) {
  console.error('✗ --env=local or --env=prod is required (no default, on purpose).')
  process.exit(1)
}
if ((ONE_FILE || ONE_URL) && !ONE_SLUG) {
  console.error('✗ --file / --url need --slug <game-slug>.')
  process.exit(1)
}
if (ONLY !== null && String(ONLY).trim() === '') {
  console.error('✗ --only was given an empty value. Refusing to run over every file.')
  process.exit(1)
}

// ── env ────────────────────────────────────────────────────────────────────
const ENV_FILE = ENV === 'local' ? '.env.test' : '.env.local'
if (!existsSync(ENV_FILE)) {
  console.error(`✗ ${ENV_FILE} not found — cannot resolve credentials for --env=${ENV}.`)
  process.exit(1)
}
loadEnv({ path: ENV_FILE })
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
if (!URL_ || !KEY) {
  console.error(`✗ ${ENV_FILE} is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.`)
  process.exit(1)
}
const isLocalUrl = /(?:localhost|127\.0\.0\.1)/.test(URL_)
if (ENV === 'local' && !isLocalUrl) {
  console.error(`✗ --env=local but ${ENV_FILE} points at ${URL_}. Refusing.`)
  process.exit(1)
}
if (ENV === 'prod' && isLocalUrl) {
  console.error(`✗ --env=prod but ${ENV_FILE} points at a local URL. Refusing.`)
  process.exit(1)
}
const supabase = createClient(URL_, KEY, { auth: { persistSession: false } })

// ── sources: slug → { label, load() } ──────────────────────────────────────
/** @type {Map<string, { label: string, load: () => Promise<Uint8Array> }>} */
const sources = new Map()
if (ONE_SLUG) {
  if (ONE_FILE) sources.set(ONE_SLUG, { label: ONE_FILE, load: async () => new Uint8Array(readFileSync(ONE_FILE)) })
  else if (ONE_URL) {
    sources.set(ONE_SLUG, {
      label: ONE_URL,
      load: async () => {
        const res = await fetch(ONE_URL)
        if (!res.ok) throw new Error(`GET ${ONE_URL} → ${res.status}`)
        return new Uint8Array(await res.arrayBuffer())
      },
    })
  }
} else {
  if (existsSync(DIR)) {
    for (const name of readdirSync(DIR).sort()) {
      const ext = extname(name).toLowerCase()
      if (!EXTS.has(ext)) continue
      const slug = basename(name, extname(name))
      const path = join(DIR, name)
      sources.set(slug, { label: path, load: async () => new Uint8Array(readFileSync(path)) })
    }
  } else if (!WITH_STATIC) {
    console.error(`✗ ${DIR} does not exist. Create it and add <slug>.jpg files, or pass --static / --file.`)
    process.exit(1)
  }
  if (WITH_STATIC) {
    for (const [slug, rel] of Object.entries(STATIC_GAME_HEROES)) {
      if (sources.has(slug)) continue
      const path = join('public', rel)
      if (existsSync(path)) sources.set(slug, { label: path, load: async () => new Uint8Array(readFileSync(path)) })
    }
  }
  if (ONLY) {
    for (const slug of [...sources.keys()]) if (slug !== ONLY) sources.delete(slug)
    if (sources.size === 0) {
      console.error(`✗ --only ${ONLY} matched no file. Refusing to run over every file.`)
      process.exit(1)
    }
  }
}
if (sources.size === 0) {
  console.log('Nothing to import.')
  process.exit(0)
}

// ── games ──────────────────────────────────────────────────────────────────
const { data: games, error: readErr } = await supabase
  .from('games')
  .select('id, slug, name, hero_bg_url, hero_bg_srcset')
  .in('slug', [...sources.keys()])
if (readErr) {
  console.error(`✗ Could not read games: ${readErr.message}`)
  if (/hero_bg_/.test(readErr.message)) {
    console.error('   Push supabase/migrations/20261005000116_game_hero_backgrounds.sql first.')
  }
  process.exit(1)
}
const bySlug = new Map((games ?? []).map((g) => [g.slug, g]))

console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} · env=${ENV} · ${sources.size} source(s)\n`)
const kb = (n) => `${Math.round(n / 1024)} KB`
let done = 0
let failed = 0
for (const [slug, src] of sources) {
  const game = bySlug.get(slug)
  if (!game) {
    console.log(`  ✗ ${slug}: no game with this slug (${src.label})`)
    failed++
    continue
  }
  if (game.hero_bg_url && FORCE !== slug) {
    console.log(`  · ${slug}: already has an uploaded hero — skipped (use --force ${slug} to replace)`)
    continue
  }
  let bytes
  try {
    bytes = await src.load()
  } catch (err) {
    console.log(`  ✗ ${slug}: could not read ${src.label}: ${err.message}`)
    failed++
    continue
  }
  const processed = await processHeroImage(game.id, bytes)
  if (!processed.ok) {
    console.log(`  ✗ ${slug}: ${processed.error} (${src.label})`)
    failed++
    continue
  }
  const sizes = processed.variants.map((v) => `${v.width}w ${kb(v.bytes.byteLength)}`).join(', ')
  console.log(
    `  ${APPLY ? '→' : '○'} ${slug}: ${processed.sourceWidth}×${processed.sourceHeight} ${kb(bytes.byteLength)} → ${sizes}; LQIP ${processed.blur.length} chars`,
  )
  if (!APPLY) continue

  const bucket = supabase.storage.from(GAME_HERO_BUCKET)
  let upErr = null
  for (const v of processed.variants) {
    const { error } = await bucket.upload(v.path, v.bytes, { contentType: 'image/avif', upsert: true, cacheControl: '31536000' })
    if (error) {
      upErr = error
      break
    }
  }
  if (upErr) {
    console.log(`  ✗ ${slug}: upload failed: ${upErr.message}`)
    await bucket.remove(processed.variants.map((v) => v.path))
    failed++
    continue
  }
  const patch = heroColumnsFor(processed, (p) => bucket.getPublicUrl(p).data.publicUrl, FOCAL, new Date().toISOString())
  const { error: updErr } = await supabase.from('games').update(patch).eq('id', game.id)
  if (updErr) {
    console.log(`  ✗ ${slug}: games update failed: ${updErr.message}`)
    await bucket.remove(processed.variants.map((v) => v.path))
    failed++
    continue
  }
  // The previous upload's files, unless this is the same image (same hash).
  const keep = new Set(processed.variants.map((v) => v.path))
  const old = [game.hero_bg_url, ...Object.values(game.hero_bg_srcset ?? {})]
    .map((u) => heroObjectPathFromUrl(u, URL_))
    .filter((p) => p && !keep.has(p))
  if (old.length > 0) await bucket.remove([...new Set(old)])
  done++
}

console.log(
  `\n${APPLY ? `Imported ${done}` : 'Dry run only — pass --yes to write'}${failed ? ` · ${failed} failed` : ''}.` +
    (APPLY && done ? '\nPages refresh at the next deploy or within 24 h; nudging + saving the position in Admin → Games → Branding refreshes one game now.' : ''),
)
process.exit(failed > 0 ? 1 : 0)
