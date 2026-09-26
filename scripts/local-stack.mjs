#!/usr/bin/env node
/**
 * Per-worktree local Supabase stacks — the commands.
 *
 *   pnpm db:up [--full]          start THIS worktree's stack, point .env.test at it
 *   pnpm db:down [--purge]       stop it (--purge: delete its data + free its slot)
 *   pnpm db:list                 every local stack: worktree, ports, state, memory
 *   pnpm test:reset              db reset + every seed, in order, + sanity counts
 *   pnpm test:full               test:reset, then the full vitest suite
 *
 * The main checkout (~/gamevault) is slot 0: the committed config, ports
 * 54320–54329, full service set — exactly what `supabase start` gave before.
 * Any other worktree gets its own project id + port block (see
 * scripts/lib/local-stack.mjs) written to the gitignored supabase/.env, which
 * the Supabase CLI loads on every command.
 *
 * Never run `supabase db reset` by hand to prepare for tests: it leaves the
 * catalogue and the fee pair rules unseeded. `pnpm test:reset` is the recipe.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'

import {
  MAIN_SLOT,
  allocateSlot,
  cliOverrides,
  parseEnv,
  portsForSlot,
  releaseSlot,
  removeManagedBlock,
  testEnvFor,
  upsertEnvVars,
  upsertManagedBlock,
  urlPort,
} from './lib/local-stack.mjs'

const REGISTRY_FILE = 'local-stacks.json'
const FEE_SEED = 'supabase/seeds/fee_rules.local.sql'

// ── identity ────────────────────────────────────────────────────────────────

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function identity() {
  const top = realpathSync(git('rev-parse', '--show-toplevel'))
  const common = realpathSync(git('rev-parse', '--path-format=absolute', '--git-common-dir'))
  const mainRoot = path.basename(common) === '.git' ? path.dirname(common) : null
  const isMain = mainRoot !== null && realpathSync(mainRoot) === top
  return { top, common, isMain, name: path.basename(top) }
}

function mainProjectId(top) {
  const cfg = readFileSync(path.join(top, 'supabase/config.toml'), 'utf8')
  const m = /^project_id\s*=\s*"([^"]+)"/m.exec(cfg)
  if (!m) throw new Error('supabase/config.toml has no project_id')
  return m[1]
}

// ── registry (shared by every worktree, lives in the git common dir) ────────

function withRegistry(common, fn) {
  const file = path.join(common, REGISTRY_FILE)
  const lock = `${file}.lock`
  const deadline = Date.now() + 10_000
  for (;;) {
    try {
      mkdirSync(lock)
      break
    } catch {
      if (Date.now() > deadline) throw new Error(`registry lock ${lock} held for >10s — remove it if no db:up is running`)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
    }
  }
  try {
    const registry = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { version: 1, stacks: {} }
    const result = fn(registry)
    if (result?.registry) writeFileSync(file, `${JSON.stringify(result.registry, null, 2)}\n`)
    return result
  } finally {
    rmSync(lock, { recursive: true, force: true })
  }
}

function readRegistry(common) {
  const file = path.join(common, REGISTRY_FILE)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { version: 1, stacks: {} }
}

/** Is `port` bindable on all interfaces right now? (docker publishes on 0.0.0.0) */
function portFree(port) {
  const r = spawnSync(process.execPath, ['-e', `
    const s = require('net').createServer();
    s.once('error', () => process.exit(1));
    s.listen(${port}, '0.0.0.0', () => s.close(() => process.exit(0)));
  `])
  return r.status === 0
}

/** This worktree's stack: slot, project id, ports. Allocates on first use when `allocate`. */
function resolveStack(id, { allocate }) {
  if (id.isMain) return { slot: MAIN_SLOT, projectId: mainProjectId(id.top), ports: portsForSlot(MAIN_SLOT) }
  if (!allocate) {
    const entry = readRegistry(id.common).stacks[id.top]
    if (!entry) return null
    return { slot: entry.slot, projectId: entry.projectId, ports: portsForSlot(entry.slot) }
  }
  const { slot, created } = withRegistry(id.common, (registry) =>
    allocateSlot(registry, id.top, id.name, (s) => Object.values(portsForSlot(s)).every(portFree)),
  )
  const entry = readRegistry(id.common).stacks[id.top]
  if (created) console.log(`• new stack slot ${slot} for ${id.name}`)
  return { slot, projectId: entry.projectId, ports: portsForSlot(slot) }
}

// ── env files ───────────────────────────────────────────────────────────────

function writeCliEnv(id, stack, { full = false } = {}) {
  const file = path.join(id.top, 'supabase/.env')
  const before = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const after = id.isMain ? removeManagedBlock(before) : upsertManagedBlock(before, cliOverrides(stack.projectId, stack.ports, { full }))
  if (after === before) return
  if (after) writeFileSync(file, after)
  else rmSync(file, { force: true })
}

function writeTestEnv(id, stack, keys) {
  const file = path.join(id.top, '.env.test')
  if (!existsSync(file)) {
    copyFileSync(path.join(id.top, '.env.test.example'), file)
    console.log('• created .env.test from .env.test.example')
  }
  const vars = { ...testEnvFor(stack.ports) }
  if (keys.ANON_KEY) vars.NEXT_PUBLIC_SUPABASE_ANON_KEY = keys.ANON_KEY
  if (keys.SERVICE_ROLE_KEY) vars.SUPABASE_SERVICE_ROLE_KEY = keys.SERVICE_ROLE_KEY
  const before = readFileSync(file, 'utf8')
  const after = upsertEnvVars(before, vars)
  if (after !== before) writeFileSync(file, after)
}

// ── supabase CLI ────────────────────────────────────────────────────────────

function supabaseBin(top) {
  const bin = path.join(top, 'node_modules/.bin/supabase')
  if (!existsSync(bin)) throw new Error('node_modules/.bin/supabase missing — run `pnpm install` in this worktree first')
  return bin
}

/**
 * Run the CLI. It loads supabase/.env itself; the same values also go in the
 * child env (belt and braces), and any SUPABASE_* override left in the
 * caller's shell is dropped so only this worktree's file decides the target.
 */
function supabase(id, args, { capture = false } = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^SUPABASE_(PROJECT_ID|.*_PORT|.*_ENABLED)$/.test(k)))
  const file = path.join(id.top, 'supabase/.env')
  if (!id.isMain && existsSync(file)) Object.assign(env, parseEnv(readFileSync(file, 'utf8')))
  return spawnSync(supabaseBin(id.top), args, { cwd: id.top, env, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' })
}

function statusEnv(id) {
  const r = supabase(id, ['status', '-o', 'env'], { capture: true })
  return r.status === 0 ? parseEnv(r.stdout) : null
}

function dockerUp() {
  return spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'ignore' }).status === 0
}

function docker(args) {
  const r = spawnSync('docker', args, { encoding: 'utf8' })
  return r.status === 0 ? r.stdout : ''
}

// ── psql ────────────────────────────────────────────────────────────────────

function psql(dbUrl, args, input) {
  const r = spawnSync('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', ...args], { encoding: 'utf8', input })
  if (r.error?.code === 'ENOENT') throw new Error('psql not found on PATH (brew install postgresql@15)')
  if (r.status !== 0) throw new Error(`psql failed:\n${r.stderr || r.stdout}`)
  return r
}

// ── commands ────────────────────────────────────────────────────────────────

function printStack(id, stack) {
  const p = stack.ports
  console.log(`\n  worktree  ${id.top}${id.isMain ? '  (main checkout)' : ''}`)
  console.log(`  project   ${stack.projectId}   slot ${stack.slot}`)
  console.log(`  api       http://127.0.0.1:${p.api}`)
  console.log(`  db        postgresql://postgres:postgres@127.0.0.1:${p.db}/postgres`)
  if (stack.full) console.log(`  studio    http://127.0.0.1:${p.studio}`)
  console.log(`  mail      http://127.0.0.1:${p.inbucket}\n`)
}

function cmdUp() {
  const id = identity()
  if (!dockerUp()) throw new Error('Docker is not running — start Docker Desktop, then `pnpm db:up` again')
  const stack = resolveStack(id, { allocate: true })
  const full = id.isMain || process.argv.includes('--full')
  writeCliEnv(id, stack, { full })

  console.log(`• supabase start   (project ${stack.projectId}, ${full ? 'all services' : 'lean: no studio/analytics/realtime/edge/imgproxy'})`)
  const r = supabase(id, ['start'])
  if (r.status !== 0) throw new Error(`supabase start failed (exit ${r.status})`)

  const keys = statusEnv(id)
  if (!keys) throw new Error('supabase status failed after start')
  if (urlPort(keys.API_URL) !== stack.ports.api) {
    throw new Error(`the CLI reports API ${keys.API_URL} but this worktree's slot is on ${stack.ports.api} — overrides not applied; aborting before .env.test is touched`)
  }
  writeTestEnv(id, stack, keys)
  printStack(id, { ...stack, full })
  console.log('✓ stack up; .env.test points at it. Next: `pnpm test:reset` (fresh stack = no games, no fee pair rules).')
}

function cmdDown() {
  const id = identity()
  const stack = resolveStack(id, { allocate: false })
  if (!stack) {
    console.log('• this worktree has no registered stack — nothing to stop')
    return
  }
  const purge = process.argv.includes('--purge')
  if (purge && id.isMain) throw new Error('refusing --purge on the main checkout — use `supabase stop --no-backup` yourself if you really mean it')
  const r = supabase(id, ['stop', ...(purge ? ['--no-backup'] : [])])
  if (r.status !== 0) throw new Error(`supabase stop failed (exit ${r.status})`)
  if (purge) {
    withRegistry(id.common, (registry) => ({ registry: releaseSlot(registry, id.top) }))
    writeCliEnv({ ...id, isMain: true }, stack) // strips the managed block
    console.log(`✓ ${stack.projectId} stopped, data deleted, slot ${stack.slot} released`)
  } else {
    console.log(`✓ ${stack.projectId} stopped (data kept — \`pnpm db:up\` resumes it; \`pnpm db:down --purge\` deletes it)`)
  }
}

function cmdList() {
  const id = identity()
  const registry = readRegistry(id.common)
  const byProject = new Map()
  byProject.set(mainProjectId(path.dirname(id.common)), { worktree: path.dirname(id.common) + '  (main)', slot: MAIN_SLOT })
  for (const [top, e] of Object.entries(registry.stacks)) byProject.set(e.projectId, { worktree: top, slot: e.slot })

  const rows = docker(['ps', '-a', '--filter', 'label=com.supabase.cli.project', '--format', '{{.Label "com.supabase.cli.project"}}\t{{.Names}}\t{{.State}}\t{{.Ports}}'])
    .split('\n').filter(Boolean).map((l) => l.split('\t'))
  const mem = new Map(
    docker(['stats', '--no-stream', '--format', '{{.Name}}\t{{.MemUsage}}']).split('\n').filter(Boolean)
      .map((l) => { const [n, u] = l.split('\t'); return [n, u.split('/')[0].trim()] }),
  )
  const toMiB = (s) => {
    const m = /([\d.]+)\s*(KiB|MiB|GiB|B)/.exec(s ?? '')
    if (!m) return 0
    return Number(m[1]) * ({ B: 1 / 1048576, KiB: 1 / 1024, MiB: 1, GiB: 1024 }[m[2]])
  }
  const projects = new Map()
  for (const [project, name, state, ports] of rows) {
    const p = projects.get(project) ?? { running: 0, total: 0, mib: 0 }
    p.total++
    // published host ports, for stacks the registry does not know
    const published = /:(\d+)->/.exec(ports ?? '')?.[1]
    if (published && name.startsWith('supabase_kong_')) p.api = Number(published)
    if (published && name.startsWith('supabase_db_')) p.db = Number(published)
    if (state === 'running') { p.running++; p.mib += toMiB(mem.get(name)) }
    projects.set(project, p)
  }
  for (const project of byProject.keys()) if (!projects.has(project)) projects.set(project, { running: 0, total: 0, mib: 0 })

  console.log('\nPROJECT                              SLOT  API    DB     CONTAINERS  MEMORY    WORKTREE')
  let totalMib = 0
  for (const [project, p] of [...projects.entries()].sort()) {
    const reg = byProject.get(project)
    const ports = reg ? portsForSlot(reg.slot) : null
    totalMib += p.mib
    const state = p.total === 0 ? 'down' : `${p.running}/${p.total} up`
    console.log(
      `${project.padEnd(36)} ${String(reg?.slot ?? '-').padEnd(5)} ${String(ports?.api ?? p.api ?? '?').padEnd(6)} ${String(ports?.db ?? p.db ?? '?').padEnd(6)} ${state.padEnd(11)} ${(p.mib ? `${Math.round(p.mib)} MiB` : '-').padEnd(9)} ${reg?.worktree ?? '(not in registry — started outside db:up)'}`,
    )
  }
  const cap = docker(['info', '--format', '{{.MemTotal}}']).trim()
  console.log(`\nrunning stacks use ${Math.round(totalMib)} MiB of Docker's ${cap ? Math.round(Number(cap) / 1048576) : '?'} MiB\n`)
}

function sanity(dbUrl) {
  const sql = `
    WITH pr4 AS (SELECT min(starts_at) AS s FROM public.fee_rules WHERE note LIKE 'PR4:%' AND kind = 'base' AND scope = 'category')
    SELECT
      (SELECT count(*) FROM public.games),
      (SELECT count(*) FROM public.game_categories),
      (SELECT count(*) FROM public.fee_rules),
      (SELECT count(*) FROM public.game_categories gc
        WHERE (SELECT r.rule_id FROM public.resolve_seller_fee(NULL, gc.id) r) IS NULL
           OR ((SELECT s FROM pr4) IS NOT NULL
               AND (SELECT r.rule_id FROM public.resolve_seller_fee(NULL, gc.id, (SELECT s FROM pr4)) r) IS NULL)),
      (SELECT s FROM pr4);`
  const out = psql(dbUrl, ['-At', '-F', '\t', '-c', sql]).stdout.trim()
  const [games, pairs, rules, gaps, start] = out.split('\t')
  return { games: Number(games), pairs: Number(pairs), rules: Number(rules), gaps: Number(gaps), start }
}

function cmdReset() {
  const id = identity()
  const stack = resolveStack(id, { allocate: false })
  if (!stack) throw new Error('this worktree has no stack yet — run `pnpm db:up` first')
  const keys = statusEnv(id)
  if (!keys) throw new Error(`stack ${stack.projectId} is not running — run \`pnpm db:up\` first`)

  // .env.test must point at THIS stack before anything is seeded through it.
  const testEnv = existsSync(path.join(id.top, '.env.test')) ? parseEnv(readFileSync(path.join(id.top, '.env.test'), 'utf8')) : {}
  if (urlPort(testEnv.NEXT_PUBLIC_SUPABASE_URL) !== stack.ports.api || urlPort(testEnv.SUPABASE_DB_URL) !== stack.ports.db) {
    writeTestEnv(id, stack, keys)
    console.log('• .env.test re-pointed at this worktree\'s stack')
  }
  const dbUrl = testEnvFor(stack.ports).SUPABASE_DB_URL
  const t0 = Date.now()
  const step = (n, label) => console.log(`\n[${n}/4] ${label}`)

  step(1, `supabase db reset  (project ${stack.projectId}, db :${stack.ports.db})`)
  if (urlPort(keys.DB_URL) !== stack.ports.db) throw new Error(`the CLI targets db ${keys.DB_URL}, not this worktree's :${stack.ports.db} — refusing to reset`)
  const r = supabase(id, ['db', 'reset'])
  if (r.status !== 0) throw new Error(`supabase db reset failed (exit ${r.status})`)

  step(2, 'seed catalogue: pnpm seed:games --env=local')
  const g = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/seed-games.mjs', '--env=local'], { cwd: id.top, stdio: 'inherit' })
  if (g.status !== 0) throw new Error(`seed:games failed (exit ${g.status})`)

  step(3, `seed fee pair rules: ${FEE_SEED}`)
  psql(dbUrl, ['-q', '--single-transaction', '-f', path.join(id.top, FEE_SEED)])
  psql(dbUrl, ['-q', '-c', "NOTIFY pgrst, 'reload schema'"])

  step(4, 'sanity check')
  const s = sanity(dbUrl)
  console.log(`  games ${s.games} · pairs ${s.pairs} · fee rules ${s.rules} · resolver gaps ${s.gaps}   (PR 4 start ${s.start || 'n/a'})`)
  if (!s.games || !s.pairs || !s.rules) throw new Error('sanity: an empty catalogue or rule table — the seed did not land')
  if (s.gaps !== 0) throw new Error(`sanity: ${s.gaps} pair(s) resolve through the fee fallback`)
  console.log(`\n✓ test:reset done in ${Math.round((Date.now() - t0) / 1000)}s — ${stack.projectId}`)
}

const commands = { up: cmdUp, down: cmdDown, list: cmdList, reset: cmdReset }
const cmd = commands[process.argv[2]]
if (!cmd) {
  console.error(`usage: node scripts/local-stack.mjs <${Object.keys(commands).join('|')}>`)
  process.exit(2)
}
try {
  cmd()
} catch (e) {
  console.error(`\n✗ ${e?.message ?? e}`)
  process.exit(1)
}
