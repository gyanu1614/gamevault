import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('./server', () => ({ captureServerEvent: vi.fn(async () => undefined) }))

import { captureServerEvent } from './server'
import { trackFoundingStep } from './founding'

describe('trackFoundingStep', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends founding_step_completed keyed by the user id', async () => {
    await trackFoundingStep('u-1', 2)
    expect(captureServerEvent).toHaveBeenCalledWith({ event: 'founding_step_completed', distinctId: 'u-1', props: { step: 2 } })
  })

  it('carries extra flat props (sign-up method)', async () => {
    await trackFoundingStep('u-1', 1, { method: 'oauth' })
    expect(captureServerEvent).toHaveBeenCalledWith({ event: 'founding_step_completed', distinctId: 'u-1', props: { step: 1, method: 'oauth' } })
  })

  it('sends nothing without a user id', async () => {
    await trackFoundingStep('', 3)
    expect(captureServerEvent).not.toHaveBeenCalled()
  })
})

/**
 * The founding funnel broke (2026-10-11) because every "completed" step was
 * fired in the browser per visit: an email-confirmed sign-up came back on a
 * fresh page already at step 2, so "Signed up" never fired and the funnel
 * read 0 from step 1 on. The steps now fire on the server where each is
 * saved; this pins every seam so a refactor cannot silently drop one.
 */
describe('every founding step is tracked where it is saved', () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('step 1: email sign-up to /founding and the OAuth return to /founding', () => {
    expect(src('src/lib/actions/auth.ts')).toMatch(/trackFoundingStep\([^)]*,\s*1\b/)
    expect(src('src/app/auth/callback/route.ts')).toMatch(/trackFoundingStep\([^)]*,\s*1\b/)
  })

  it('steps 2–4: details, store, agreement', () => {
    const s = src('src/lib/actions/founding-onboarding.ts')
    for (const step of [2, 3, 4]) expect(s).toMatch(new RegExp(`trackFoundingStep\\([^)]*,\\s*${step}\\b`))
  })

  it('the browser no longer fires founding_step_completed (it would double count)', () => {
    expect(src('src/app/founding/_flow/FoundingFlow.tsx')).not.toMatch(/founding_step_completed/)
  })

  it('steps 2 and 3 record whether the optional Discord and logo fields were left blank', () => {
    const s = src('src/lib/actions/founding-onboarding.ts')
    expect(s).toMatch(/trackFoundingStep\(user\.id, 2, \{ discord_given: Boolean\(d\.discord\) \}\)/)
    expect(s).toMatch(/trackFoundingStep\(user\.id, 3, \{ logo_given: Boolean\(logoUrl \|\| existing\.logo_uploaded_at\) \}\)/)
  })
})

/**
 * Leaving the page has two routes: the tab closes or moves to another site
 * (pagehide, no React cleanup runs), or a link inside the app (cleanup runs, no
 * pagehide). Dropping either undercounts people leaving at the same step.
 */
describe('founding_left is wired for both ways of leaving', () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  const hook = src('src/app/founding/_flow/useFoundingDropOff.ts')

  it('the flow uses the hook with the step it is on', () => {
    expect(src('src/app/founding/_flow/FoundingFlow.tsx')).toMatch(/useFoundingDropOff\(stage, state\.signedIn\)/)
  })

  it('leaving the site and leaving by an in-app link both report', () => {
    expect(hook).toMatch(/addEventListener\('pagehide', exit\.left\)/)
    expect(hook).toMatch(/return \(\) => \{[\s\S]*exit\.left\(\)/)
  })

  it('sends by beacon so the request survives the page closing', () => {
    expect(hook).toMatch(/track\('founding_left', props, \{ beacon: true \}\)/)
  })
})
