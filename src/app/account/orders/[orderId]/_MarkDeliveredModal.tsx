'use client'

/**
 * MarkDeliveredModal — V21/P4.d
 *
 * Centered shadcn Dialog with backdrop blur (the Dialog component
 * already supplies the blur via its overlay). Flow:
 *   1. Upload zone (react-dropzone). Click or drag-drop one image.
 *   2. Once a file is picked, an upload progress bar runs while the
 *      file is sent to Supabase storage.
 *   3. Once upload is 100%, the Confirm button activates.
 *   4. Confirm calls startDelivering (if status === 'paid') + then
 *      markOrderAsDelivered, then closes the modal.
 *
 * Visual brief:
 *   - 480px max, centered, padded.
 *   - Title "Mark As Delivered" + small caption beneath.
 *   - Lime accent on the upload zone border + on the Confirm CTA.
 */

import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle2, Image as ImageIcon, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { markOrderAsDelivered, startDelivering } from '@/lib/actions/orders'
import { toast } from 'sonner'

interface MarkDeliveredModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  /** Current order status so we know whether to call startDelivering first. */
  orderStatus: string
  /** Called after a successful submit so the parent can refresh. */
  onDelivered?: () => void
}

type Stage = 'pick' | 'uploading' | 'uploaded' | 'submitting' | 'done'

export function MarkDeliveredModal({
  open,
  onOpenChange,
  orderId,
  orderStatus,
  onDelivered,
}: MarkDeliveredModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('pick')
  const [progress, setProgress] = useState(0)
  const [uploadedPath, setUploadedPath] = useState<string | null>(null)
  const [note, setNote] = useState('')

  // Reset whenever the modal opens fresh.
  useEffect(() => {
    if (open) {
      setFile(null)
      setPreview(null)
      setStage('pick')
      setProgress(0)
      setUploadedPath(null)
      setNote('')
    }
  }, [open])

  // Tear down the preview blob URL so we don't leak memory.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
    void uploadFile(f)
  }, [preview])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    multiple: false,
    disabled: stage !== 'pick',
  })

  async function uploadFile(f: File) {
    setStage('uploading')
    setProgress(0)
    try {
      const supabase = createClient()
      const path = `${orderId}/${Date.now()}-${f.name.replace(/[^a-z0-9.]/gi, '_')}`
      // Supabase JS doesn't expose granular upload progress in v2, so
      // we simulate it with a soft tick while the network call runs.
      // For a real progress bar we'd switch to a signed URL + fetch.
      let ticker = 0
      const interval = setInterval(() => {
        ticker = Math.min(90, ticker + 6 + Math.random() * 6)
        setProgress(ticker)
      }, 120)
      const { data, error } = await supabase.storage
        .from('delivery-evidence')
        .upload(path, f, { upsert: false, cacheControl: '3600' })
      clearInterval(interval)
      if (error) throw error
      setProgress(100)
      setUploadedPath(data?.path ?? path)
      setStage('uploaded')
    } catch (e: any) {
      console.error('Upload failed', e)
      toast.error(e?.message ?? 'Upload failed')
      setStage('pick')
      setProgress(0)
    }
  }

  async function handleConfirm() {
    if (stage !== 'uploaded') return
    setStage('submitting')
    try {
      // Flip paid → delivering if needed (idempotent failure tolerated).
      if (orderStatus === 'paid') {
        await startDelivering(orderId).catch(() => {})
      }
      const res = await markOrderAsDelivered(orderId, note.trim() || undefined)
      if (!res.success) {
        toast.error(res.error ?? 'Could not mark as delivered')
        setStage('uploaded')
        return
      }
      setStage('done')
      toast.success('Order marked as delivered')
      onDelivered?.()
      // Small delay so the user sees the success state before close.
      setTimeout(() => onOpenChange(false), 700)
    } catch (e: any) {
      console.error('markOrderAsDelivered failed', e)
      toast.error(e?.message ?? 'Could not mark as delivered')
      setStage('uploaded')
    }
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setProgress(0)
    setUploadedPath(null)
    setStage('pick')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] border-border-default bg-bg-raised">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold tracking-tight">Mark As Delivered</DialogTitle>
          <DialogDescription className="text-[13px] text-text-secondary">
            Upload a screenshot or photo as delivery proof, then confirm. The buyer will be notified.
          </DialogDescription>
        </DialogHeader>

        {/* Upload zone */}
        {stage === 'pick' && (
          <div
            {...getRootProps()}
            className={cn(
              'mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-border-default bg-bg-overlay/60 p-8 text-center transition-colors',
              isDragActive && 'border-lime/60 bg-lime/[0.04]',
            )}
          >
            <input {...getInputProps()} />
            <span className="grid h-10 w-10 place-items-center rounded-full bg-lime/[0.12] text-lime-text">
              <Upload className="h-4 w-4" />
            </span>
            <div className="text-[13.5px] font-semibold text-text-primary">
              {isDragActive ? 'Drop The File Here' : 'Click Or Drag An Image To Upload'}
            </div>
            <div className="text-[11.5px] text-text-tertiary">
              PNG, JPG, or WEBP · up to 10 MB
            </div>
          </div>
        )}

        {/* Uploading / uploaded preview */}
        {(stage === 'uploading' || stage === 'uploaded' || stage === 'submitting' || stage === 'done') && (
          <div className="mt-2 rounded-[12px] border border-border-default bg-bg-overlay/60 p-4">
            <div className="flex items-center gap-3">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  className="h-14 w-14 flex-shrink-0 rounded-[8px] object-cover ring-1 ring-white/10"
                />
              ) : (
                <span className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-[8px] bg-white/[0.05] text-text-tertiary">
                  <ImageIcon className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-text-primary">
                  {file?.name ?? 'Image'}
                </div>
                <div className="mt-0.5 text-[11.5px] text-text-tertiary">
                  {stage === 'uploading'
                    ? `Uploading — ${Math.round(progress)}%`
                    : stage === 'uploaded'
                    ? 'Ready to confirm'
                    : stage === 'submitting'
                    ? 'Submitting…'
                    : 'Delivered'}
                </div>
              </div>
              {(stage === 'uploaded' || stage === 'done') && (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-lime-text" />
              )}
              {stage === 'uploaded' && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-[7px] p-1.5 text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-lime-pressed to-lime transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Optional note */}
        {stage === 'uploaded' && (
          <label className="mt-2 block">
            <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
              Note To Buyer · Optional
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="E.g. Sent the gift link — check Epic Games inbox."
              className="w-full resize-none rounded-[10px] border border-border-default bg-bg-overlay/60 px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-lime/40 focus:outline-none"
            />
          </label>
        )}

        {/* Footer actions */}
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={stage === 'submitting'}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={stage !== 'uploaded'}
            className="bg-lime text-text-inverse hover:bg-lime-hover"
          >
            {stage === 'submitting' ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : stage === 'done' ? (
              <>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Delivered
              </>
            ) : (
              'Confirm Delivery'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
