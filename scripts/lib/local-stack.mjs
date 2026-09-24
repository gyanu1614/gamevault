/**
 * Per-worktree local Supabase stacks — the pure half (no fs, no docker).
 *
 * Every chat works in its own git worktree, and until 2026-09-23 they all
 * shared ONE local stack (the main checkout's `supabase start`). One
 * worktree's `supabase db reset` wiped another's functions mid-test-run and
 * fixtures leaked between suites. Each worktree now gets its own stack:
 *
 *   · the main checkout (~/gamevault) is SLOT 0 and changes nothing — the
 *     committed supabase/config.toml project_id and ports 54320–54329;
 *   · every other worktree gets a slot ≥ 1 from a registry shared by all
 *     worktrees (<git common dir>/local-stacks.json), a project id derived
 *     from its folder name, and the port block 54320 + 100 × slot.
 *
 * The overrides reach the Supabase CLI through the gitignored supabase/.env,
 * which the CLI loads on EVERY command. So in a worktree even a raw
 * `supabase db reset` hits that worktree's own stack, never main's.
 *
 * scripts/local-stack.mjs is the impure half (git, docker, the CLI, psql).
 */

/** Main checkout: the committed config, untouched. */
export const MAIN_SLOT = 0
/** Slots 1..MAX_SLOT → ports up to 54320 + 100 × 40 + 9 = 58329. */
export const MAX_SLOT = 40
export const BASE_PORT = 54320
export const INSPECTOR_BASE_PORT = 8083

/**
 * Services a worktree TEST stack does not run. The suites need db, auth,
 * rest, kong, storage (storage-policies guard) and inbucket (auth SMTP);
 * nothing reads studio (+ pg-meta), logs (analytics + vector), realtime,
 * image transforms or edge functions. Dropping them takes a stack from
 * ~1.1–1.7 GB to ~0.4 GB. `pnpm db:up --full` runs everything.
 *
 * Switched off through config overrides, not `supabase start -x`: CLI 2.109
 * ignores the -x names it documents (analytics + pg-meta started anyway and
 * the analytics container was OOM-killed), and an override in supabase/.env
 * also holds for `db reset`, which restarts the stack.
 */
export const LEAN_DISABLED = {
  SUPABASE_STUDIO_ENABLED: 'false',
  SUPABASE_ANALYTICS_ENABLED: 'false',
  SUPABASE_REALTIME_ENABLED: 'false',
  SUPABASE_EDGE_RUNTIME_ENABLED: 'false',
  SUPABASE_STORAGE_IMAGE_TRANSFORMATION_ENABLED: 'false',
}

const MANAGED_BEGIN = '# >>> local-stack (managed by `pnpm db:up` — do not edit) >>>'
const MANAGED_END = '# <<< local-stack <<<'

/** 32-bit FNV-1a — stable across Node versions and machines. */
export function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Folder name → docker-safe slug (lowercase a-z0-9 and '-'). */
export function slugify(name) {
  const s = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s || 'worktree'
}

/**
 * Worktree folder name → Supabase project id. `gamevault-devinfra` stays as
 * is; `delivery-fade` (a .claude/worktrees/ folder) becomes
 * `gamevault-delivery-fade`. Docker names derive from it
 * (supabase_db_<project_id>), so keep it short.
 */
export function projectIdFor(folderName) {
  const rest = slugify(folderName).replace(/^gamevault-?/, '')
  return `gamevault-${rest || 'worktree'}`.slice(0, 48).replace(/-+$/, '')
}

/** The slot a folder name asks for first; collisions probe upward. */
export function preferredSlot(folderName, maxSlot = MAX_SLOT) {
  return 1 + (fnv1a(slugify(folderName)) % maxSlot)
}

/** Every host port a stack in `slot` publishes (or may publish). */
export function portsForSlot(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT) throw new Error(`invalid stack slot ${slot}`)
  const base = BASE_PORT + 100 * slot
  return {
    shadow: base + 0,
    api: base + 1,
    db: base + 2,
    studio: base + 3,
    inbucket: base + 4,
    analytics: base + 7,
    pooler: base + 9,
    inspector: INSPECTOR_BASE_PORT + slot,
  }
}

/**
 * Pick the slot for `key` (the worktree's absolute path). An existing entry
 * is kept, so a worktree's ports never move. A new one takes its preferred
 * slot, or probes upward (wrapping) past slots that are registered to
 * another worktree or rejected by `isFree(slot)` (a port already bound —
 * e.g. a stack started from a hand-edited config.toml).
 *
 * Pure: returns the new registry, never mutates the input.
 *
 * @param {{ version?: number, stacks?: Record<string, { slot: number, name: string, projectId: string }> } | null | undefined} registry
 * @param {string} key
 * @param {string} folderName
 * @param {(slot: number) => boolean} [isFree]
 * @param {number} [maxSlot]
 */
export function allocateSlot(registry, key, folderName, isFree = () => true, maxSlot = MAX_SLOT) {
  const stacks = { ...(registry?.stacks ?? {}) }
  const existing = stacks[key]
  if (existing && Number.isInteger(existing.slot)) return { slot: existing.slot, registry: { version: 1, stacks }, created: false }

  const taken = new Set(Object.entries(stacks).filter(([k]) => k !== key).map(([, v]) => v.slot))
  const start = preferredSlot(folderName, maxSlot)
  for (let i = 0; i < maxSlot; i++) {
    const slot = 1 + ((start - 1 + i) % maxSlot)
    if (taken.has(slot) || !isFree(slot)) continue
    const takenIds = new Set(Object.values(stacks).map((v) => v.projectId))
    let projectId = projectIdFor(folderName)
    if (takenIds.has(projectId)) projectId = `${projectId}-${slot}`
    stacks[key] = { slot, name: folderName, projectId }
    return { slot, registry: { version: 1, stacks }, created: true }
  }
  throw new Error(`no free local-stack slot (1..${maxSlot}) — run \`pnpm db:list\` and \`pnpm db:down --purge\` in worktrees you no longer use`)
}

/** Drop `key` from the registry (its slot becomes reusable). */
export function releaseSlot(registry, key) {
  const stacks = { ...(registry?.stacks ?? {}) }
  delete stacks[key]
  return { version: 1, stacks }
}

/**
 * The env vars the Supabase CLI reads as config overrides (viper: prefix
 * SUPABASE_, dots → underscores). Verified against CLI 2.109:
 * SUPABASE_PROJECT_ID moves the containers, the *_PORT vars move the ports.
 */
/**
 * @param {string} projectId
 * @param {ReturnType<typeof portsForSlot>} ports
 * @param {{ full?: boolean }} [opts]
 * @returns {Record<string, string>}
 */
export function cliOverrides(projectId, ports, { full = false } = {}) {
  return {
    ...(full ? {} : LEAN_DISABLED),
    SUPABASE_PROJECT_ID: projectId,
    SUPABASE_API_PORT: String(ports.api),
    SUPABASE_DB_PORT: String(ports.db),
    SUPABASE_DB_SHADOW_PORT: String(ports.shadow),
    SUPABASE_DB_POOLER_PORT: String(ports.pooler),
    SUPABASE_STUDIO_PORT: String(ports.studio),
    SUPABASE_INBUCKET_PORT: String(ports.inbucket),
    SUPABASE_LOCAL_SMTP_PORT: String(ports.inbucket),
    SUPABASE_ANALYTICS_PORT: String(ports.analytics),
    SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT: String(ports.inspector),
  }
}

/** The test env a stack implies: what .env.test must say to reach it. */
export function testEnvFor(ports) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${ports.api}`,
    SUPABASE_DB_URL: `postgresql://postgres:postgres@127.0.0.1:${ports.db}/postgres`,
  }
}

/** Replace (or append) the managed block in a dotenv file's text. */
export function upsertManagedBlock(text, vars) {
  const body = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n')
  const block = `${MANAGED_BEGIN}\n${body}\n${MANAGED_END}\n`
  const stripped = removeManagedBlock(text)
  return stripped.length ? `${stripped.replace(/\n*$/, '\n')}\n${block}` : block
}

/** Remove the managed block; returns '' when nothing else remains. */
export function removeManagedBlock(text) {
  const src = String(text ?? '')
  const i = src.indexOf(MANAGED_BEGIN)
  if (i === -1) return src.trim() ? src : ''
  const j = src.indexOf(MANAGED_END, i)
  const end = j === -1 ? src.length : j + MANAGED_END.length
  const out = (src.slice(0, i) + src.slice(end)).replace(/\n{3,}/g, '\n\n')
  return out.trim() ? out.replace(/^\n+/, '') : ''
}

/**
 * Set KEY=value lines in a dotenv text: replaced in place where the key
 * exists (first occurrence; later duplicates removed), appended otherwise.
 * Comments and every other line are kept.
 */
export function upsertEnvVars(text, vars) {
  const lines = String(text ?? '').split('\n')
  const seen = new Set()
  const out = []
  for (const line of lines) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)
    if (m && Object.prototype.hasOwnProperty.call(vars, m[1])) {
      if (seen.has(m[1])) continue
      seen.add(m[1])
      out.push(`${m[1]}=${vars[m[1]]}`)
    } else {
      out.push(line)
    }
  }
  const missing = Object.keys(vars).filter((k) => !seen.has(k))
  if (missing.length) {
    while (out.length && out[out.length - 1] === '') out.pop()
    out.push('', '# ── Local stack for THIS worktree (written by `pnpm db:up`) ──')
    for (const k of missing) out.push(`${k}=${vars[k]}`)
    out.push('')
  }
  return out.join('\n')
}

/**
 * Parse KEY=value lines (no expansion) — enough for .env.test / status -o env.
 * @param {string | null | undefined} text
 * @returns {Record<string, string>}
 */
export function parseEnv(text) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const line of String(text ?? '').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

/** Port of an http(s)/postgres URL, or null. */
export function urlPort(url) {
  try {
    const u = new URL(url)
    return u.port ? Number(u.port) : null
  } catch {
    return null
  }
}
