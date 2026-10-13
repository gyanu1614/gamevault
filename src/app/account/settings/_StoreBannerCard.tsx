'use client'

/**
 * Settings → Seller → Shop Banner. Silver+ sellers upload a banner for their
 * public shop; Bronze sellers see the default art and what unlocks it.
 *
 * The browser only previews and pre-checks (type, 2.5 MB, width). The real
 * gate is the server action: it re-reads the seller's CURRENT rank, validates
 * the bytes, crops to 1500 × 400 WebP and uploads with the service role.
 *
 * Placing it (owner, 2026-10-12): after picking a file the seller drags and
 * zooms it inside a fixed 15 : 4 frame (FrameCropDialog, the same editor the
 * admin uses for game banners) with a live preview of the shop header. The
 * browser cuts that exact area to 1500 × 400; "Save Banner" uploads it.
 * A saved banner keeps its stored focal point; "Replace" places a new one.
 */

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ImageSquareIcon } from '@phosphor-icons/react/dist/csr/ImageSquare'
import { LockSimpleIcon } from '@phosphor-icons/react/dist/csr/LockSimple'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { UploadSimpleIcon } from '@phosphor-icons/react/dist/csr/UploadSimple'
import Link from '@/components/navigation/AppLink'
import { SettingsCard, accountBtn } from '@/components/account/AccountSurface'
import { StoreBannerArt } from '@/components/shop/StoreBannerArt'
import { useAuth } from '@/hooks/use-auth'
import { getMyStoreBanner, removeStoreBanner, uploadStoreBanner } from '@/lib/actions/store-banner'
import { FrameCropDialog } from '@/components/ui/frame-crop-dialog'
import {
  STORE_BANNER_FOCAL_DEFAULT,
  STORE_BANNER_FRAME_ASPECT,
  STORE_BANNER_HEIGHT,
  STORE_BANNER_MAX_BYTES,
  STORE_BANNER_MIME,
  STORE_BANNER_MIN_WIDTH,
  STORE_BANNER_WIDTH,
} from '@/lib/shop/store-banner'
import { imageTooLargeMessage, uploadErrorMessage } from '@/lib/uploads/image-upload'
import { tierLabel } from '@/lib/seller/tiers'
import { cn } from '@/lib/utils'

const QUERY_KEY = ['store-banner'] as const

export function StoreBannerCard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await getMyStoreBanner()
      if (!res.ok) throw new Error(res.error)
      return res.data
    },
    staleTime: 60_000,
  })

  const inputRef = useRef<HTMLInputElement>(null)
  /** The picked file, open in the banner editor. */
  const [cropFile, setCropFile] = useState<File | null>(null)
  /** The placed banner (already cut to 1500 × 400), not saved yet. */
  const [pending, setPending] = useState<{ dataUrl: string; name: string } | null>(null)
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null)

  const canUpload = data?.canUpload === true
  const previewUrl = pending?.dataUrl ?? data?.bannerUrl ?? null
  const seed = user?.id ?? 'preview'
  // A placed banner is already the exact area, so it shows centred.
  const focalY = pending ? STORE_BANNER_FOCAL_DEFAULT : (data?.focalY ?? STORE_BANNER_FOCAL_DEFAULT)

  const onPick = (file: File | undefined) => {
    if (!file) return
    if (!(STORE_BANNER_MIME as readonly string[]).includes(file.type)) {
      toast.error('Use a JPG, PNG or WebP image.')
      return
    }
    const tooBig = imageTooLargeMessage(file, STORE_BANNER_MAX_BYTES, 'Banner')
    if (tooBig) {
      toast.error(tooBig)
      return
    }
    setCropFile(file)
  }

  const save = async () => {
    if (!pending) return
    setBusy('save')
    try {
      const res = await uploadStoreBanner(pending.dataUrl, STORE_BANNER_FOCAL_DEFAULT)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      // Refetch first, so the preview swaps straight to the stored banner.
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      setPending(null)
      toast.success('Banner saved. It shows on your shop within a minute.')
    } catch (err) {
      toast.error(uploadErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('remove')
    try {
      const res = await removeStoreBanner()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Banner removed.')
    } catch (err) {
      toast.error(uploadErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <SettingsCard
      title="Shop Banner"
      description="The wide image across the top of your public shop."
      aside={
        data?.shopHref ? (
          <Link
            href={data.shopHref}
            prefetch={false}
            className="text-[13px] font-medium text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
          >
            View Shop
          </Link>
        ) : null
      }
      footerHint={
        canUpload
          ? `JPG, PNG or WebP up to 2.5 MB, at least ${STORE_BANNER_MIN_WIDTH} px wide. You place it in a ${STORE_BANNER_WIDTH} × ${STORE_BANNER_HEIGHT} frame.`
          : data
            ? `Your rank: ${data.tierLabel}. Sellers rank up with completed sales and good reviews.`
            : null
      }
      footerAction={
        canUpload ? (
          <>
            {pending ? (
              <button type="button" onClick={() => setPending(null)} disabled={!!busy} className={accountBtn.secondary}>
                Cancel
              </button>
            ) : data?.bannerUrl ? (
              <button type="button" onClick={() => void remove()} disabled={!!busy} className={accountBtn.danger}>
                <TrashIcon size={15} aria-hidden />
                {busy === 'remove' ? 'Removing…' : 'Remove'}
              </button>
            ) : null}
            {pending ? (
              <button type="button" onClick={() => void save()} disabled={!!busy} className={accountBtn.primary}>
                {busy === 'save' ? 'Saving…' : 'Save Banner'}
              </button>
            ) : (
              <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy} className={accountBtn.secondary}>
                <UploadSimpleIcon size={15} aria-hidden />
                {data?.bannerUrl ? 'Replace' : 'Upload Banner'}
              </button>
            )}
          </>
        ) : !isLoading && data ? (
          <Link href="/account/tiers" prefetch={false} className={accountBtn.secondary}>
            See Ranks
          </Link>
        ) : null
      }
    >
      {isLoading ? (
        <div className="skeleton w-full rounded-md" style={{ aspectRatio: String(STORE_BANNER_FRAME_ASPECT) }} aria-hidden />
      ) : (
        <div className="space-y-3">
          {canUpload && previewUrl ? (
            // How it shows on the shop: the real banner art, melt and all.
            <StoreBannerArt
              banner={{ kind: 'custom', url: previewUrl, focalY }}
              seed={seed}
              className="w-full rounded-md"
              style={{ aspectRatio: String(STORE_BANNER_FRAME_ASPECT) }}
            >
              {pending && (
                <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[12px] font-semibold text-white backdrop-blur-sm">
                  <ImageSquareIcon size={13} weight="bold" aria-hidden />
                  Preview — Not Saved
                </span>
              )}
            </StoreBannerArt>
          ) : (
            <StoreBannerArt
              banner={{ kind: 'default' }}
              seed={seed}
              className={cn('w-full rounded-md', !canUpload && 'opacity-80')}
              style={{ aspectRatio: String(STORE_BANNER_FRAME_ASPECT) }}
            >
              {!canUpload && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[12px] font-semibold text-white backdrop-blur-sm">
                  <LockSimpleIcon size={13} weight="bold" aria-hidden />
                  Default Banner
                </span>
              )}
            </StoreBannerArt>
          )}

          {!canUpload && data && (
            <p className="flex items-start gap-2 rounded-md bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-text-secondary">
              <LockSimpleIcon size={15} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-text-tertiary" />
              <span>
                Reach {tierLabel('silver')} to upload a banner.{' '}
                {data.bannerUrl
                  ? 'Your saved banner shows on your shop again once you are back at Silver.'
                  : 'Until then your shop shows this banner, made just for your shop.'}
              </span>
            </p>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={STORE_BANNER_MIME.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              onPick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <FrameCropDialog
            file={cropFile}
            aspect={STORE_BANNER_WIDTH / STORE_BANNER_HEIGHT}
            title="Place Your Banner"
            hint="Drag the picture inside the frame and zoom to fit."
            minWidth={STORE_BANNER_MIN_WIDTH}
            outputWidth={STORE_BANNER_WIDTH}
            saveLabel="Use This Banner"
            onCancel={() => setCropFile(null)}
            onConfirm={({ dataUrl }) => {
              if (dataUrl) setPending({ dataUrl, name: cropFile?.name ?? 'banner' })
              setCropFile(null)
            }}
            renderPreview={(src) =>
              src ? (
                <StoreBannerArt
                  banner={{ kind: 'custom', url: src, focalY: STORE_BANNER_FOCAL_DEFAULT }}
                  seed={seed}
                  className="w-full rounded-md"
                  style={{ aspectRatio: String(STORE_BANNER_FRAME_ASPECT) }}
                />
              ) : (
                <div className="skeleton w-full rounded-md" style={{ aspectRatio: String(STORE_BANNER_FRAME_ASPECT) }} aria-hidden />
              )
            }
          />
        </div>
      )}
    </SettingsCard>
  )
}
