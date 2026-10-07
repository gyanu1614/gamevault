'use client'

/**
 * Admin → Games → Branding → Hero Background.
 *
 * ONE image per game, behind the top of every page of that game (marketplace
 * category pages, landing, listing pages, values / calculators / guides /
 * sell). The preview frame is the desktop band's shape and draws the image
 * under the SAME night filter, veil, light and fade the site uses
 * (GameHeroOverlays + --hero-art-filter), so the preview is what visitors see.
 *
 * Upload: pick a file → ImageCropDialog (a band-shaped box on the image; owner,
 * 2026-10-06, replaced drag-to-position) → the browser sends the source
 * (≤ 6 MB) straight to storage through a signed URL → the server cuts the
 * chosen area and re-encodes it (AVIF 960 / 1600 / 1920, each ≤ 100 KB + a
 * blurred placeholder) and refreshes that game's pages. No new hero → the
 * game keeps its static art, or a neutral gradient.
 */

import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { UploadSimpleIcon } from '@phosphor-icons/react/dist/csr/UploadSimple'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { GameHeroOverlays } from '@/components/marketplace/GameHeroArt'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  GAME_HERO_BUCKET,
  GAME_HERO_FOCAL_DEFAULT,
  GAME_HERO_FRAME_ASPECT,
  GAME_HERO_MIME,
  GAME_HERO_MIN_WIDTH,
  parseHeroUploadRequest,
  resolveGameHero,
  type GameHero,
  type GameHeroRow,
} from '@/lib/games/hero'
import { createGameHeroUpload, processGameHero, removeGameHero } from '@/lib/actions/game-hero'
import { adminBtn } from '../../components/kit'
import { ImageCropDialog, type PixelRect } from '../../components/ImageCropDialog'
import { useFilePicker } from '../../components/useFilePicker'

type Busy = null | 'upload' | 'process' | 'remove'

export function HeroBackgroundField({
  gameId,
  gameSlug,
  initialRow,
}: {
  /** Null until the identity step has saved the game. */
  gameId: string | null
  gameSlug: string
  /** The game's stored hero columns (from fetchGameById). */
  initialRow: Omit<GameHeroRow, 'slug'> | null
}) {
  const [hero, setHero] = useState<GameHero>(() =>
    resolveGameHero(gameSlug, initialRow ? { slug: gameSlug, ...initialRow } : null, process.env.NEXT_PUBLIC_SUPABASE_URL),
  )
  const [busy, setBusy] = useState<Busy>(null)
  /** The picked file, waiting in the crop dialog. */
  const [pending, setPending] = useState<File | null>(null)

  const src = hero.kind === 'none' ? null : hero.src
  const apply = (next: GameHero) => setHero(next)

  const handleFile = (file: File) => {
    if (!gameId) {
      toast.error('Save the identity step first')
      return
    }
    const req = parseHeroUploadRequest(file)
    if (!req.ok) {
      toast.error(req.error)
      return
    }
    setPending(file)
  }

  const handleCropped = async (rect: PixelRect) => {
    const file = pending
    if (!gameId || !file) return
    const req = parseHeroUploadRequest(file)
    if (!req.ok) return
    setBusy('upload')
    try {
      const ticket = await createGameHeroUpload(gameId, { type: req.mime, size: file.size })
      if (!ticket.ok) {
        toast.error(ticket.error)
        return
      }
      const { error } = await createClient()
        .storage.from(GAME_HERO_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: req.mime })
      if (error) {
        toast.error(`Upload failed: ${error.message}`)
        return
      }
      setBusy('process')
      const res = await processGameHero(gameId, ticket.path, GAME_HERO_FOCAL_DEFAULT, rect)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      apply(res.hero)
      setPending(null)
      toast.success('Hero background saved')
    } catch (err) {
      toast.error(err instanceof Error && err.message ? `Upload failed: ${err.message}` : 'Upload failed')
    } finally {
      setBusy(null)
    }
  }
  const picker = useFilePicker(handleFile, GAME_HERO_MIME.join(','))

  const handleRemove = async () => {
    if (!gameId) return
    setBusy('remove')
    try {
      const res = await removeGameHero(gameId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      apply(res.hero)
      toast.success('Hero background removed')
    } finally {
      setBusy(null)
    }
  }

  const status =
    hero.kind === 'upload' ? 'Uploaded' : hero.kind === 'static' ? 'Built-In Art' : 'No Image'
  const uploading = busy === 'upload' || busy === 'process'

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[13.5px] font-semibold text-text-primary">Hero Background</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-tertiary">
          Wide JPG/PNG/WebP/AVIF, <strong className="font-semibold text-text-secondary">1920 px wide or more</strong>, max 6 MB.
          The game&rsquo;s one hero image: sits behind the top of every page of this game (marketplace pages,
          landing, values, calculators, guides, sell). Drawn darkened under the site&rsquo;s hero scrim, as
          previewed here. After you pick a file you choose which part to use; it is saved as a small AVIF.
        </p>
      </div>

      {src ? (
        <div className="relative w-full overflow-hidden rounded-md bg-[#1A1B1F]" style={{ aspectRatio: String(GAME_HERO_FRAME_ASPECT) }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of the stored hero */}
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover [filter:var(--hero-art-filter)]"
            style={{ objectPosition: `50% ${hero.focalY}%` }}
          />
          <GameHeroOverlays />
          <StatusChip>{uploading ? (busy === 'process' ? 'Processing…' : 'Uploading…') : status}</StatusChip>
        </div>
      ) : (
        <div
          className="relative w-full overflow-hidden rounded-md bg-[#1A1B1F]"
          style={{ aspectRatio: String(GAME_HERO_FRAME_ASPECT) }}
        >
          <div aria-hidden className="game-hero__ground game-hero__ground--neutral" />
          <GameHeroOverlays />
          <StatusChip>{uploading ? (busy === 'process' ? 'Processing…' : 'Uploading…') : 'Neutral Gradient'}</StatusChip>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={picker.open}
          disabled={!gameId || busy !== null}
          className={cn(adminBtn.secondary, 'shrink-0')}
        >
          {uploading ? (
            <CircleNotchIcon aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
          ) : (
            <UploadSimpleIcon aria-hidden weight="bold" className="h-4 w-4" />
          )}
          {uploading ? (busy === 'process' ? 'Processing…' : 'Uploading…') : hero.kind === 'upload' ? 'Replace Hero' : 'Upload Hero'}
        </button>
        {picker.input}

        {hero.kind === 'upload' && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={!gameId || busy !== null}
            className={cn(adminBtn.danger, 'shrink-0')}
          >
            {busy === 'remove' ? (
              <CircleNotchIcon aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            ) : (
              <TrashIcon aria-hidden weight="bold" className="h-4 w-4" />
            )}
            Remove Hero
          </button>
        )}
      </div>
      {!gameId && (
        <p className="text-[12px] text-text-tertiary">Save the identity step to upload a hero background.</p>
      )}

      <ImageCropDialog
        file={pending}
        aspect={GAME_HERO_FRAME_ASPECT}
        title="Choose the Hero Area"
        hint="This band sits behind the top of every page of the game. Drag the box to the part to show; drag a corner to resize."
        minWidth={GAME_HERO_MIN_WIDTH}
        busy={uploading}
        onCancel={() => setPending(null)}
        onConfirm={handleCropped}
      />
    </div>
  )
}

function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center rounded-md bg-black/55 px-2 py-1 text-[12px] font-semibold text-white backdrop-blur-sm [@media(prefers-reduced-transparency:reduce)]:bg-black/85 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none">
      {children}
    </span>
  )
}
