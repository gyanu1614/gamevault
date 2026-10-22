import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Every scheduled values data job tells Discord when it fails or times out
 * (2026-10-22). Before this only the backup did: a pipeline that stopped was
 * found by a human weeks later. The daily values-health cron covers "it ran
 * but the data is stale"; these steps cover "it did not finish".
 */
const WORKFLOWS = ['values-pricing-daily.yml', 'values-catalogue-daily.yml', 'sab-retention-nightly.yml', 'adopt-me-weekly-catalog.yml']

describe('data workflows alert on failure (guard)', () => {
  for (const file of WORKFLOWS) {
    it(file, () => {
      const yml = readFileSync(`.github/workflows/${file}`, 'utf8')
      expect(yml).toMatch(/DISCORD_OPS_WEBHOOK_URL/)
      expect(yml).toMatch(/failure\(\)|contains\(needs\.\*\.result, 'failure'\)/)
      expect(yml).toMatch(/cancelled/)
      // An alert must never fail the run itself and hide the original error.
      expect(yml).toMatch(/exit 0/)
    })
  }
})
