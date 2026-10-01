/**
 * Per-worktree local Supabase stacks (scripts/lib/local-stack.mjs).
 *
 * Until 2026-09-23 every worktree shared the main checkout's stack: one
 * chat's `supabase db reset` wiped another's functions mid-run. These pin the
 * pure rules that keep stacks apart — main stays on the committed ports,
 * worktrees get distinct, stable port blocks and project ids, and the env
 * files the CLI and vitest read point at the worktree's own stack.
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  LEAN_DISABLED,
  MAIN_SLOT,
  MAX_SLOT,
  allocateSlot,
  classifyResetFailure,
  cliOverrides,
  cliProjectId,
  parseContainerRows,
  parseEnv,
  pendingMigrations,
  portsForSlot,
  preferredSlot,
  projectIdFor,
  releaseSlot,
  removeManagedBlock,
  stackReadiness,
  testEnvFor,
  upsertEnvVars,
  upsertManagedBlock,
  waitForStack,
} from '../../../scripts/lib/local-stack.mjs'

describe('port blocks', () => {
  it('slot 0 is exactly the committed supabase/config.toml ports', () => {
    const cfg = readFileSync('supabase/config.toml', 'utf8')
    const section = (name: string) => cfg.split(/^\[/m).find((s) => s.startsWith(`${name}]`)) ?? ''
    const port = (name: string, key = 'port') => Number(new RegExp(`^${key}\\s*=\\s*(\\d+)`, 'm').exec(section(name))?.[1])
    const p = portsForSlot(MAIN_SLOT)
    expect(p.api).toBe(port('api'))
    expect(p.db).toBe(port('db'))
    expect(p.shadow).toBe(port('db', 'shadow_port'))
    expect(p.pooler).toBe(port('db.pooler'))
    expect(p.studio).toBe(port('studio'))
    expect(p.inbucket).toBe(port('local_smtp'))
    expect(p.analytics).toBe(port('analytics'))
    expect(p.inspector).toBe(port('edge_runtime', 'inspector_port'))
  })

  it('no two slots share a port', () => {
    const seen = new Map<number, number>()
    for (let s = 0; s <= MAX_SLOT; s++) {
      for (const port of Object.values(portsForSlot(s))) {
        expect(seen.has(port), `port ${port} in slot ${s} and ${seen.get(port)}`).toBe(false)
        seen.set(port, s)
      }
    }
    expect(Math.max(...seen.keys())).toBeLessThan(65536)
  })

  it('the db port is the api port + 1 (setup-env derives SUPABASE_DB_URL from it)', () => {
    for (let s = 0; s <= MAX_SLOT; s++) expect(portsForSlot(s).db).toBe(portsForSlot(s).api + 1)
  })

  it('rejects an out-of-range slot', () => {
    expect(() => portsForSlot(MAX_SLOT + 1)).toThrow()
    expect(() => portsForSlot(-1)).toThrow()
  })
})

describe('project ids', () => {
  it('derive from the worktree folder name, prefixed once', () => {
    expect(projectIdFor('gamevault-devinfra')).toBe('gamevault-devinfra')
    expect(projectIdFor('delivery-fade')).toBe('gamevault-delivery-fade')
    expect(projectIdFor('Feat_Rate Limits!')).toBe('gamevault-feat-rate-limits')
  })

  it('never collide with the main project id', () => {
    const main = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync('supabase/config.toml', 'utf8'))?.[1]
    expect(main).toBe('gamevault-sab-pages')
    expect(projectIdFor('gamevault-devinfra')).not.toBe(main)
  })
})

describe('slot allocation', () => {
  it('is stable: a registered worktree keeps its slot', () => {
    const a = allocateSlot({ version: 1, stacks: {} }, '/w/gamevault-devinfra', 'gamevault-devinfra')
    expect(a.created).toBe(true)
    expect(a.slot).toBe(preferredSlot('gamevault-devinfra'))
    const b = allocateSlot(a.registry, '/w/gamevault-devinfra', 'gamevault-devinfra', () => false)
    expect(b).toMatchObject({ slot: a.slot, created: false })
  })

  it('probes past a slot another worktree holds', () => {
    const first = allocateSlot({ version: 1, stacks: {} }, '/a/x', 'x')
    // same folder name elsewhere → same preferred slot → must move on
    const second = allocateSlot(first.registry, '/b/x', 'x')
    expect(second.slot).not.toBe(first.slot)
    expect(second.registry.stacks['/b/x'].projectId).not.toBe(first.registry.stacks['/a/x'].projectId)
  })

  it('probes past a slot whose ports are already bound', () => {
    const want = preferredSlot('gamevault-devinfra')
    const r = allocateSlot({ version: 1, stacks: {} }, '/w/d', 'gamevault-devinfra', (s) => s !== want)
    expect(r.slot).toBe(want === MAX_SLOT ? 1 : want + 1)
  })

  it('never hands out slot 0 (main) and throws when full', () => {
    const r = allocateSlot({ version: 1, stacks: {} }, '/w/z', 'z')
    expect(r.slot).toBeGreaterThanOrEqual(1)
    expect(() => allocateSlot({ version: 1, stacks: {} }, '/w/z', 'z', () => false)).toThrow(/no free local-stack slot/)
  })

  it('release frees the slot for reuse', () => {
    const a = allocateSlot({ version: 1, stacks: {} }, '/a/x', 'x')
    const freed = releaseSlot(a.registry, '/a/x')
    expect(allocateSlot(freed, '/b/x', 'x').slot).toBe(a.slot)
  })
})

describe('env files', () => {
  const ports = portsForSlot(7)

  it('the CLI overrides move the containers and every published port', () => {
    const o = cliOverrides('gamevault-x', ports)
    expect(o.SUPABASE_PROJECT_ID).toBe('gamevault-x')
    expect(o.SUPABASE_API_PORT).toBe(String(ports.api))
    expect(o.SUPABASE_DB_PORT).toBe(String(ports.db))
    expect(o.SUPABASE_DB_SHADOW_PORT).toBe(String(ports.shadow))
  })

  it('supabase/.env managed block is replaced, not duplicated, and user lines survive', () => {
    const once = upsertManagedBlock('S3_HOST=foo\n', { A: '1' })
    const twice = upsertManagedBlock(once, { A: '2' })
    expect(twice.match(/local-stack \(managed/g)?.length).toBe(1)
    expect(parseEnv(twice)).toEqual({ S3_HOST: 'foo', A: '2' })
    expect(removeManagedBlock(twice).trim()).toBe('S3_HOST=foo')
    expect(removeManagedBlock(upsertManagedBlock('', { A: '1' }))).toBe('')
  })

  it('.env.test gets this stack\'s URLs in place, other lines untouched', () => {
    const example = readFileSync('.env.test.example', 'utf8')
    const out = upsertEnvVars(example, testEnvFor(ports))
    const env = parseEnv(out)
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(`http://127.0.0.1:${ports.api}`)
    expect(env.SUPABASE_DB_URL).toBe(`postgresql://postgres:postgres@127.0.0.1:${ports.db}/postgres`)
    expect(env.RESEND_API_KEY).toBeUndefined()
    expect(env.PAYMENT_PROVIDER).toBe('fake')
    expect(out.split('\n').filter((l) => l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')).length).toBe(1)
    // idempotent
    expect(upsertEnvVars(out, testEnvFor(ports))).toBe(out)
  })

  it('a lean test stack still runs everything the suites use; --full runs everything', () => {
    const lean = cliOverrides('gamevault-x', ports)
    for (const needed of ['DB', 'AUTH', 'API', 'STORAGE', 'INBUCKET', 'LOCAL_SMTP']) expect(lean[`SUPABASE_${needed}_ENABLED`]).toBeUndefined()
    expect(lean).toMatchObject(LEAN_DISABLED)
    const full = cliOverrides('gamevault-x', ports, { full: true })
    expect(Object.keys(full).some((k) => k.endsWith('_ENABLED'))).toBe(false)
  })
})

describe('cli project id', () => {
  it('is truncated to 40 chars the way the Supabase CLI does, so the container label matches', () => {
    // "gamevault-" + a 31-char folder → 41 chars; the CLI auto-fixes it to the first 40
    expect(cliProjectId('gamevault-wonderful-goldberg-dabc1234567')).toBe('gamevault-wonderful-goldberg-dabc1234567')
    expect(cliProjectId('gamevault-wonderful-goldberg-dabc12345678')).toBe('gamevault-wonderful-goldberg-dabc1234567')
    expect(cliProjectId('gamevault-sab-pages')).toBe('gamevault-sab-pages')
  })
})

/**
 * Under Docker CPU load `supabase db reset` finishes the DB work, restarts the
 * containers, then times out waiting for storage to report healthy (it logged
 * nothing for ~45s on 2026-09-30, healthy ~1 min later). test:reset must wait
 * that out itself — but only for that failure, never for a migration error.
 */
describe('container health', () => {
  const ps = [
    'supabase_db_gamevault-x\trunning\tUp About a minute (healthy)',
    'supabase_storage_gamevault-x\trunning\tUp 11 seconds (health: starting)',
    'supabase_rest_gamevault-x\trunning\tUp About a minute',
    'supabase_auth_gamevault-x\trunning\tUp 2 minutes (unhealthy)',
    'supabase_kong_gamevault-x\trestarting\tRestarting (1) 2 seconds ago',
    'supabase_inbucket_gamevault-x\texited\tExited (137) 5 seconds ago',
    '',
  ].join('\n')

  it('parses docker ps rows into name, state and health', () => {
    expect(parseContainerRows(ps)).toEqual([
      { name: 'supabase_db_gamevault-x', state: 'running', health: 'healthy' },
      { name: 'supabase_storage_gamevault-x', state: 'running', health: 'starting' },
      { name: 'supabase_rest_gamevault-x', state: 'running', health: null },
      { name: 'supabase_auth_gamevault-x', state: 'running', health: 'unhealthy' },
      { name: 'supabase_kong_gamevault-x', state: 'restarting', health: null },
      { name: 'supabase_inbucket_gamevault-x', state: 'exited', health: null },
    ])
  })

  it('is ready when every container runs and is healthy or has no healthcheck', () => {
    const r = stackReadiness([
      { name: 'db', state: 'running', health: 'healthy' },
      { name: 'rest', state: 'running', health: null },
    ])
    expect(r).toEqual({ state: 'ready', pending: [], failed: [] })
  })

  it('waits on starting, unhealthy and restarting containers', () => {
    const r = stackReadiness([
      { name: 'db', state: 'running', health: 'healthy' },
      { name: 'storage', state: 'running', health: 'starting' },
      { name: 'auth', state: 'running', health: 'unhealthy' },
      { name: 'kong', state: 'restarting', health: null },
    ])
    expect(r).toEqual({ state: 'waiting', pending: ['storage (starting)', 'auth (unhealthy)', 'kong (restarting)'], failed: [] })
  })

  it('fails on a container that exited, and on a stack with no containers', () => {
    expect(stackReadiness([
      { name: 'storage', state: 'running', health: 'starting' },
      { name: 'inbucket', state: 'exited', health: null },
    ])).toMatchObject({ state: 'failed', failed: ['inbucket (exited)'] })
    expect(stackReadiness([])).toMatchObject({ state: 'failed' })
  })
})

describe('db reset failure', () => {
  const files = ['20260930054945_disable_fortnite_skins_category.sql', '20260930162255_admin_rls_admin_roles.sql', 'README.md']
  const healthTimeout = [
    'Resetting local database...',
    'Recreating database...',
    'Initialising schema...',
    'Applying migration 20260930162255_admin_rls_admin_roles.sql...',
    'Restarting containers...',
    'supabase_storage_gamevault-x container logs:',
    'supabase_storage_gamevault-x container is not ready: starting',
    'Try rerunning the command with --debug to troubleshoot the error.',
  ].join('\n')

  it('lists the migration files the database has not applied', () => {
    expect(pendingMigrations(files, ['20260930054945', '20260930162255'])).toEqual([])
    expect(pendingMigrations(files, ['20260930054945'])).toEqual(['20260930162255'])
  })

  it('waits when only the post-restart health check timed out and every migration landed', () => {
    expect(classifyResetFailure({ output: healthTimeout, migrationFiles: files, appliedVersions: ['20260930054945', '20260930162255'] }))
      .toEqual({ action: 'wait' })
    const unhealthy = healthTimeout.replace('not ready: starting', 'not ready: unhealthy')
    expect(classifyResetFailure({ output: unhealthy, migrationFiles: files, appliedVersions: ['20260930054945', '20260930162255'] }))
      .toEqual({ action: 'wait' })
  })

  it('fails when a migration is missing from the database', () => {
    expect(classifyResetFailure({ output: healthTimeout, migrationFiles: files, appliedVersions: ['20260930054945'] }))
      .toEqual({ action: 'fail', reason: expect.stringContaining('20260930162255') })
  })

  it('fails when the applied versions could not be read', () => {
    expect(classifyResetFailure({ output: healthTimeout, migrationFiles: files, appliedVersions: null }).action).toBe('fail')
  })

  it('fails when the CLI died before restarting the containers (a migration or seed error)', () => {
    const migrationError = [
      'Recreating database...',
      'Applying migration 20260930162255_admin_rls_admin_roles.sql...',
      'ERROR: relation "admin_roles" does not exist (SQLSTATE 42P01)',
    ].join('\n')
    expect(classifyResetFailure({ output: migrationError, migrationFiles: files, appliedVersions: ['20260930054945', '20260930162255'] }).action).toBe('fail')
    // the recreated db's own health wait runs BEFORE migrations: same wording, but nothing was done
    const dbTimeout = 'Recreating database...\nsupabase_db_gamevault-x container is not ready: starting'
    expect(classifyResetFailure({ output: dbTimeout, migrationFiles: files, appliedVersions: ['20260930054945', '20260930162255'] }).action).toBe('fail')
  })

  it('fails on any other error after the restart', () => {
    const restartError = 'Restarting containers...\nfailed to restart supabase_storage_gamevault-x: Error response from daemon: No such container'
    expect(classifyResetFailure({ output: restartError, migrationFiles: files, appliedVersions: ['20260930054945', '20260930162255'] }).action).toBe('fail')
    const notRunning = 'Restarting containers...\nsupabase_storage_gamevault-x container is not running: exited'
    expect(classifyResetFailure({ output: notRunning, migrationFiles: files, appliedVersions: ['20260930054945', '20260930162255'] }).action).toBe('fail')
  })
})

describe('waiting for the stack', () => {
  type Readiness = ReturnType<typeof stackReadiness>
  /** A fake clock: sleep advances it, probes return the scripted readiness in turn. */
  function harness(script: Readiness[]) {
    let t = 0
    const probes: number[] = []
    return {
      probes,
      deps: {
        probe: () => { probes.push(t); return script[Math.min(probes.length - 1, script.length - 1)] },
        now: () => t,
        sleep: async (ms: number) => { t += ms },
      },
    }
  }
  const waiting: Readiness = { state: 'waiting', pending: ['storage (starting)'], failed: [] }
  const ready: Readiness = { state: 'ready', pending: [], failed: [] }

  it('resolves once the stack turns ready, polling at the interval', async () => {
    const h = harness([waiting, waiting, ready])
    await expect(waitForStack({ ...h.deps, timeoutMs: 180_000, intervalMs: 3_000 })).resolves.toMatchObject({ state: 'ready' })
    expect(h.probes).toEqual([0, 3_000, 6_000])
  })

  it('gives up at the timeout, naming what is still not ready', async () => {
    const h = harness([waiting])
    await expect(waitForStack({ ...h.deps, timeoutMs: 9_000, intervalMs: 3_000 })).rejects.toThrow(/storage \(starting\)/)
    expect(h.probes).toEqual([0, 3_000, 6_000, 9_000])
  })

  it('stops at once when a container has failed', async () => {
    const h = harness([waiting, { state: 'failed', pending: [], failed: ['storage (exited)'] }])
    await expect(waitForStack({ ...h.deps, timeoutMs: 180_000, intervalMs: 3_000 })).rejects.toThrow(/storage \(exited\)/)
    expect(h.probes).toHaveLength(2)
  })
})
