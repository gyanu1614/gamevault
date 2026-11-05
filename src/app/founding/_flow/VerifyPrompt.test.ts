// @vitest-environment node
/**
 * Owner, 2026-11-05: a verify prompt after signup, "small not dominant". These pin
 * that: nothing is drawn at first, it only comes once the store is open and the
 * congratulations are closed, and it never dims or blocks the page.
 */
import React, { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

;(globalThis as { React?: unknown }).React = React

import { VerifyPrompt } from './VerifyPrompt'

const source = (file: string) => readFileSync(join(process.cwd(), 'src/app/founding/_flow', file), 'utf8')

describe('VerifyPrompt', () => {
  it('draws nothing on arrival, so the page lands first', () => {
    const client = new QueryClient()
    client.setQueryData(['identity-check'], { state: 'not_started', available: true })
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(VerifyPrompt, { userId: 'u1' })))
    expect(html).toBe('')
  })

  it('only offers the check to a seller who has not started, and stays closed once closed', () => {
    const code = source('VerifyPrompt.tsx')
    expect(code).toContain("state !== 'not_started' || !available || safeLocal.get(key)")
    expect(code).toContain("safeLocal.set(key, '1')")
  })

  it('is a small corner card, not a dialog over the page, and says it is optional', () => {
    const code = source('VerifyPrompt.tsx')
    expect(code).toContain('sm:w-[340px]')
    expect(code).not.toMatch(/@\/components\/ui\/dialog|bg-black\/|fixed inset-0/)
    expect(code).toContain('you can list and sell without it')
  })

  it('waits for the store to open and the congratulations to close', () => {
    expect(source('FoundingFlow.tsx')).toContain('stage >= 5 && state.isSeller && !celebrate && state.user?.id && <VerifyPrompt')
  })
})
