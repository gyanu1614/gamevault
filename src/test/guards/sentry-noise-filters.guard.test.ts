/**
 * Guard: the browser SDK keeps filtering known transport noise.
 *
 * Why this exists — on 16 Sep 2026 two Sentry events, both
 * "TypeError: Load failed" from iPhones, were WebKit's opaque message for a
 * network-layer fetch failure rather than defects in this app. The call sites
 * were fixed to degrade; these filters stop the symptom from drowning real
 * errors if another one slips through.
 *
 * Asserted against the file's source rather than by importing it: importing
 * runs Sentry.init() for real, and the config object is not exported.
 *
 * The pairing matters — an ignoreErrors entry hides a symptom, so it is only
 * safe while call sites genuinely degrade. This guard therefore also asserts
 * the degradation helper those call sites depend on still exists.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const CLIENT = path.join(ROOT, 'src', 'instrumentation-client.ts')

describe('sentry client noise filters', () => {
  const src = readFileSync(CLIENT, 'utf8')

  it('ignores the browsers’ opaque network-failure messages', () => {
    for (const pattern of [
      'Load failed', // WebKit / Safari — both 16 Sep events
      'Failed to fetch', // Chromium
      'NetworkError', // Firefox
      'AbortError', // navigation away / webview teardown
    ]) {
      expect(src, `ignoreErrors must still cover "${pattern}"`).toContain(pattern)
    }
  })

  it('ignores the two benign browser-emitted rejections', () => {
    expect(src).toContain('ResizeObserver loop')
    expect(src).toContain('Non-Error promise rejection')
  })

  it('denies errors originating in extensions and webview wrappers', () => {
    for (const scheme of [
      'chrome-extension',
      'moz-extension',
      'safari-extension',
      'app:',
    ]) {
      expect(src, `denyUrls must still cover ${scheme}`).toContain(scheme)
    }
    expect(src).toContain('scripts')
  })

  it('declares both filter keys on the init config', () => {
    expect(/ignoreErrors:\s*\[/.test(src)).toBe(true)
    expect(/denyUrls:\s*\[/.test(src)).toBe(true)
  })

  it('keeps the degradation helper these filters depend on', () => {
    // Filtering "Load failed" is only defensible because the call sites that
    // produced it now fall back instead of rejecting. If this helper is ever
    // deleted, the filters would be hiding real breakage.
    expect(
      existsSync(path.join(ROOT, 'src', 'lib', 'utils', 'safe-background.ts')),
      'safe-background.ts is gone — ignoreErrors would now hide real failures',
    ).toBe(true)
  })
})
