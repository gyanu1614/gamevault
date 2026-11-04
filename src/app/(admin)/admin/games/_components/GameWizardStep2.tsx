'use client'

/** GameWizard step 2: branding (logo, cover art, blog CTA banner, hero background). */

import { CircleNotch, ImageSquare, Trash, UploadSimple } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { PanelHead, adminBtn } from '../../components/kit'
import type { useFilePicker } from '../../components/useFilePicker'
import type { PixelRect } from '../../components/ImageCropDialog'
import { FrameCropDialog } from '@/components/ui/frame-crop-dialog'
import { CtaBandPreview } from './CtaBandPreview'
import { HeroBackgroundField } from './HeroBackgroundField'
import type { GameDetail } from '@/lib/actions/admin-game-wizard'

type FilePicker = ReturnType<typeof useFilePicker>

export function BrandingStep({
  game,
  gameId,
  name,
  slug,
  logoUrl,
  coverUrl,
  blogCtaUrl,
  isUploading,
  isUploadingCover,
  isUploadingBlogCta,
  pendingBlogCta,
  setPendingBlogCta,
  logoPicker,
  coverPicker,
  blogCtaPicker,
  handleDeleteLogo,
  handleDeleteCover,
  handleBlogCtaCropped,
}: {
  game: GameDetail | null
  gameId: string | null
  name: string
  slug: string
  logoUrl: string | null
  coverUrl: string | null
  blogCtaUrl: string | null
  isUploading: boolean
  isUploadingCover: boolean
  isUploadingBlogCta: boolean
  pendingBlogCta: File | null
  setPendingBlogCta: (file: File | null) => void
  logoPicker: FilePicker
  coverPicker: FilePicker
  blogCtaPicker: FilePicker
  handleDeleteLogo: () => void
  handleDeleteCover: () => void
  handleBlogCtaCropped: (rect: PixelRect) => Promise<void>
}) {
  return (
    <div className="space-y-5">
      <PanelHead title="Branding" className="mb-0" />
      <div>
        <div className="text-[13.5px] font-semibold text-text-primary">Logo</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-tertiary">Square PNG/WebP, 256×256 recommended. Max 2 MB.</p>
      </div>

      <div className="flex items-center gap-4 sm:gap-5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-overlay">
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <ImageSquare aria-hidden weight="bold" className="h-8 w-8 text-text-disabled" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <button type="button" onClick={logoPicker.open} disabled={isUploading} className={adminBtn.secondary}>
            {isUploading
              ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              : <UploadSimple aria-hidden weight="bold" className="h-4 w-4" />}
            {isUploading ? 'Uploading…' : logoUrl ? 'Replace Logo' : 'Upload Logo'}
          </button>
          {logoPicker.input}
          {logoUrl && (
            <button
              type="button"
              onClick={handleDeleteLogo}
              disabled={isUploading}
              className={adminBtn.danger}
            >
              <Trash aria-hidden weight="bold" className="h-4 w-4" />
              Remove Logo
            </button>
          )}
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      <div>
        <div className="text-[13.5px] font-semibold text-text-primary">Cover Art</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-tertiary">Portrait JPG/PNG/WebP, 600×800 recommended. Used on the Popular Games shelf. Max 2.5 MB.</p>
      </div>

      <div className="flex items-center gap-4 sm:gap-5">
        <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-overlay">
          {coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
          ) : (
            <ImageSquare aria-hidden weight="bold" className="h-8 w-8 text-text-disabled" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <button type="button" onClick={coverPicker.open} disabled={isUploadingCover} className={adminBtn.secondary}>
            {isUploadingCover
              ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              : <UploadSimple aria-hidden weight="bold" className="h-4 w-4" />}
            {isUploadingCover ? 'Uploading…' : coverUrl ? 'Replace Cover' : 'Upload Cover'}
          </button>
          {coverPicker.input}
          {coverUrl && (
            <button
              type="button"
              onClick={handleDeleteCover}
              disabled={isUploadingCover}
              className={adminBtn.danger}
            >
              <Trash aria-hidden weight="bold" className="h-4 w-4" />
              Remove Cover
            </button>
          )}
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      {/* Blog CTA banner — separate from cover art on purpose: this one
          is wide and has copy sitting on top of it. */}
      <div>
        <div className="text-[13.5px] font-semibold text-text-primary">Blog CTA Banner</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-tertiary">
          Wide JPG/PNG/WebP/AVIF, <strong className="font-semibold text-text-secondary">1600 px wide or more</strong>; you choose a 4:1 area after picking, and it is saved as a small AVIF.
          The game&rsquo;s one CTA image: sits behind every Buy / Sell band for this game
          (values, calculators, guides, the sell page). Keep the focal point off-centre-left
          — the copy covers the left third under a dark scrim. Max 2.5 MB.
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex h-24 w-full max-w-[384px] items-center justify-center overflow-hidden rounded-md bg-bg-overlay">
          {blogCtaUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={blogCtaUrl} alt="Blog CTA banner" className="h-full w-full object-cover" />
          ) : (
            <ImageSquare aria-hidden weight="bold" className="h-8 w-8 text-text-disabled" />
          )}
        </div>

        <button
          type="button"
          onClick={blogCtaPicker.open}
          disabled={isUploadingBlogCta}
          className={cn(adminBtn.secondary, 'shrink-0')}
        >
          {isUploadingBlogCta
            ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            : <UploadSimple aria-hidden weight="bold" className="h-4 w-4" />}
          {isUploadingBlogCta ? 'Uploading…' : blogCtaUrl ? 'Replace Banner' : 'Upload Banner'}
        </button>
        {blogCtaPicker.input}
      </div>
      {/* How the banner looks on the site: the real CTA band. */}
      {blogCtaUrl && <CtaBandPreview gameSlug={slug} gameName={name} src={blogCtaUrl} />}
      <FrameCropDialog
        file={pendingBlogCta}
        aspect={4}
        title="Place the Banner"
        hint="Drag the picture inside the frame and zoom to fit. Keep the subject right of centre: the copy covers the left third."
        minWidth={1200}
        busy={isUploadingBlogCta}
        saveLabel="Save Banner"
        onCancel={() => setPendingBlogCta(null)}
        onConfirm={({ rect }) => void handleBlogCtaCropped(rect)}
        renderPreview={(src) => <CtaBandPreview gameSlug={slug} gameName={name} src={src} />}
      />

      <div className="h-px bg-white/[0.06]" />

      {/* Hero background — the game's ONE hero image on every page of
          the game (GameHeroBackdrop). Saves on its own, like the
          uploads above. */}
      <HeroBackgroundField
        gameId={gameId}
        gameSlug={slug}
        initialRow={
          game
            ? {
                hero_bg_url: game.hero_bg_url ?? null,
                hero_bg_srcset: game.hero_bg_srcset ?? null,
                hero_bg_blur: game.hero_bg_blur ?? null,
                hero_bg_focal_y: game.hero_bg_focal_y ?? null,
                hero_bg_updated_at: game.hero_bg_updated_at ?? null,
              }
            : null
        }
      />
    </div>
  )
}
