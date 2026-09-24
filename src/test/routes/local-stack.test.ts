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
  cliOverrides,
  parseEnv,
  portsForSlot,
  preferredSlot,
  projectIdFor,
  releaseSlot,
  removeManagedBlock,
  testEnvFor,
  upsertEnvVars,
  upsertManagedBlock,
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
