'use server'

/**
 * Admin server actions for a game's hero background (Admin → Games → Edit →
 * Branding → Hero Background).
 *
 * Thin wrappers: `requireAdmin()` first — OUTSIDE any try, so a non-admin is
 * redirected and nothing below runs — then the logic in
 * `src/lib/games/hero-service.ts` (validation, signed upload, sharp re-encode,
 * service-role writes, revalidation of that one game's pages).
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { gameHeroTag } from '@/lib/revalidation/tags'
import { GAME_HERO_BUCKET } from '@/lib/games/hero'
import {
  createHeroUploadCore,
  processHeroCore,
  removeHeroCore,
  setHeroFocalCore,
  supabaseHeroStore,
  type HeroDeps,
  type HeroResult,
  type HeroUploadTicket,
} from '@/lib/games/hero-service'

function deps(): HeroDeps {
  return {
    store: supabaseHeroStore(createServiceRoleClient(), GAME_HERO_BUCKET),
    processImage: async (gameId, bytes, crop) => {
      const { processHeroImage } = await import('@/lib/games/hero-image')
      return processHeroImage(gameId, bytes, crop)
    },
    revalidateGame: (slug) => {
      // Every page of this game carries the tag through GameHeroBackdrop's
      // cached read — category, landing, listing/item and hub pages alike.
      revalidateTag(gameHeroTag(slug))
      revalidatePath('/admin/games')
    },
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  }
}

/** Step 1: a signed URL the browser uploads the source to (≤ 6 MB). */
export async function createGameHeroUpload(
  gameId: string,
  file: { type: string; size: number },
): Promise<HeroUploadTicket> {
  await requireAdmin()
  try {
    return await createHeroUploadCore(deps(), gameId, file)
  } catch (err) {
    console.error('[game-hero] upload ticket failed', err)
    return { ok: false, error: 'Could not start the upload. Try again in a moment.' }
  }
}

/**
 * Step 2: process the uploaded source into the hero files and save it.
 * `crop` is the area the admin chose in the crop dialog (source pixels).
 */
export async function processGameHero(
  gameId: string,
  sourcePath: string,
  focalY?: number,
  crop?: { x: number; y: number; width: number; height: number } | null,
): Promise<HeroResult> {
  await requireAdmin()
  try {
    return await processHeroCore(deps(), gameId, sourcePath, focalY, crop)
  } catch (err) {
    console.error('[game-hero] process failed', err)
    return { ok: false, error: 'Could not save the hero image. Try again in a moment.' }
  }
}

/** Reposition the saved hero (vertical focal point 0–100). */
export async function saveGameHeroPosition(gameId: string, focalY: number): Promise<HeroResult> {
  await requireAdmin()
  try {
    return await setHeroFocalCore(deps(), gameId, focalY)
  } catch (err) {
    console.error('[game-hero] position failed', err)
    return { ok: false, error: 'Could not save the position. Try again in a moment.' }
  }
}

/** Remove the uploaded hero: the game falls back to its static art / neutral gradient. */
export async function removeGameHero(gameId: string): Promise<HeroResult> {
  await requireAdmin()
  try {
    return await removeHeroCore(deps(), gameId)
  } catch (err) {
    console.error('[game-hero] remove failed', err)
    return { ok: false, error: 'Could not remove the hero image. Try again in a moment.' }
  }
}
