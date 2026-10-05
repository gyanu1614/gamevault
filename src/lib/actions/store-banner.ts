'use server'

/**
 * Store banner server actions (Settings → Seller → Shop Banner).
 *
 * Thin wrappers: the session decides WHO is calling; everything else — the
 * Silver+ rank gate, payload checks, re-encode, service-role upload and the
 * profile write — is in `src/lib/shop/store-banner-service.ts`. The posted
 * file arrives as a base64 data URL (bodySizeLimit = 4mb in next.config.js
 * fits the 2.5 MB cap).
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { rateLimitAction } from '@/lib/security/rate-limit'
import {
  getMyStoreBannerCore,
  removeStoreBannerCore,
  supabaseBannerStore,
  uploadStoreBannerCore,
  type BannerDeps,
  type BannerResult,
  type MyStoreBanner,
} from '@/lib/shop/store-banner-service'

async function deps(): Promise<BannerDeps> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return {
    userId: user?.id ?? null,
    store: supabaseBannerStore(createServiceRoleClient()),
    processImage: async (bytes) => {
      const { toStoreBannerImage } = await import('@/lib/shop/store-banner-image')
      return toStoreBannerImage(bytes)
    },
    // /shop/[slug] is prerendered per seller — a concrete path matches it.
    revalidateShop: (slug) => revalidatePath(`/shop/${slug}`),
  }
}

export async function getMyStoreBanner(): Promise<{ ok: true; data: MyStoreBanner } | { ok: false; error: string }> {
  try {
    return await getMyStoreBannerCore(await deps())
  } catch (err) {
    console.error('[store-banner] read failed', err)
    return { ok: false, error: 'Could not load your banner settings.' }
  }
}

export async function uploadStoreBanner(dataUrl: string): Promise<BannerResult> {
  const limited = await rateLimitAction('revalidate', 'Too many uploads. Please wait a minute and try again.')
  if (limited) return { ok: false, error: limited.error }
  try {
    return await uploadStoreBannerCore(await deps(), dataUrl)
  } catch (err) {
    console.error('[store-banner] upload failed', err)
    return { ok: false, error: 'Could not save your banner. Try again in a moment.' }
  }
}

export async function removeStoreBanner(): Promise<BannerResult> {
  const limited = await rateLimitAction('revalidate', 'Too many changes. Please wait a minute and try again.')
  if (limited) return { ok: false, error: limited.error }
  try {
    return await removeStoreBannerCore(await deps())
  } catch (err) {
    console.error('[store-banner] remove failed', err)
    return { ok: false, error: 'Could not remove your banner. Try again in a moment.' }
  }
}
