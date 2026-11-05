/**
 * Signup told sellers things the product does not do: buyers seeing their
 * games, a guess setting their limits, listings going live at once, and a
 * Discord hint inviting the off-site contact the House Rules forbid (audit
 * 2026-11-04). The lines stay out; a new promise here needs a feature behind it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const flow = (name: string) => read(`src/app/founding/_flow/${name}`)

describe('signup makes no false promise', () => {
  const steps = ['StepAccount.tsx', 'StepDetails.tsx', 'StepStore.tsx', 'StepAgreement.tsx', 'DoneScreen.tsx', 'CongratsDialog.tsx', 'WhySellPanel.tsx']
  const source = steps.map(flow).join('\n')

  it.each([
    ['talks about the form', /Your store name comes in step 3/],
    ['no buyer page reads the games', /Buyers see the games/],
    ['no later screen adds games', /You can add more later/],
    ['no code reads the volume guess', /set your limits/],
    ['nothing uses the country for this yet', /payouts and tax rules later/],
    ['invites the contact the rules forbid', /buyers and our team can reach you/],
    ['the first 3 listings are reviewed', /goes live right away/],
  ])('%s', (_why, line) => {
    expect(source).not.toMatch(line)
  })

  it('the done card says the first listings are checked', () => {
    expect(flow('DoneScreen.tsx')).toMatch(/first 3 listings are checked by our team/i)
  })
})

describe('seller-facing metadata stays clear of ID checks', () => {
  it('/founding metadata does not mention verifying', () => {
    expect(read('src/app/founding/page.tsx')).not.toMatch(/verify when you cash out/i)
  })
})
