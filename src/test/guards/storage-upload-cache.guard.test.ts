/**
 * Storage uploads to a path that is unique per upload (a timestamp or random
 * id in the name, never overwritten) are immutable: a new image gets a new
 * URL. They are served with a one-year Cache-Control so browsers and the
 * Supabase CDN stop re-fetching them from storage — every re-fetch past the
 * cache is free-plan egress (6.3 of 5 GB used on 2026-10-09).
 *
 * A short cache (3600) stays only where it is correct:
 *   - the path is OVERWRITTEN in place (a long cache would pin the old image);
 *   - the bucket is PRIVATE (signed URLs to KYC / delivery evidence: keep shared
 *     caches from holding sensitive files for a year).
 * Each such call is listed below with its reason; a new short-cache upload
 * fails this test until it is either made immutable or added with a reason.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SHORT_CACHE_ALLOWED: Record<string, { count: number; why: string }> = {
  'src/lib/storage/delivery-evidence.ts': {
    count: 1,
    why: 'private delivery-evidence bucket (signed URLs)',
  },
  'src/lib/actions/seller-application.ts': {
    count: 1,
    why: 'private kyc-documents bucket (the profile-picture upload in the same file is immutable)',
  },
  'src/lib/shop/store-banner-service.ts': {
    count: 1,
    why: 'overwritten in place: `${userId}/banner.webp`',
  },
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === 'test' || name === 'node_modules') continue
      walk(path, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

describe('storage upload Cache-Control', () => {
  const files = walk('src')

  it('unique-path uploads are cached for a year; short caches are listed with a reason', () => {
    const found: Record<string, number> = {}
    for (const file of files) {
      const n = (readFileSync(file, 'utf8').match(/cacheControl:\s*['"]3600['"]/g) ?? []).length
      if (n) found[file] = n
    }
    const expected = Object.fromEntries(
      Object.entries(SHORT_CACHE_ALLOWED).map(([f, v]) => [f, v.count]),
    )
    expect(found).toEqual(expected)
  })

  it('the unique-path admin and listing uploads use the one-year cache', () => {
    for (const file of [
      'src/lib/storage/listing-images.ts',
      'src/lib/actions/admin-category-configs.ts',
      'src/lib/actions/admin-game-wizard.ts',
      'src/lib/actions/admin-template-builder.ts',
      'src/lib/actions/admin-games.ts',
      'src/lib/actions/seller-application.ts',
    ]) {
      expect(readFileSync(file, 'utf8'), file).toMatch(/cacheControl:\s*'31536000'/)
    }
  })
})
