'use client'

/**
 * MarkDeliveredModal: the seller's Mark As Delivered, in the shared
 * OrderModal shell. The seller adds one proof photo (private
 * delivery-evidence bucket, the order's own folder) and confirms; the photo
 * is posted to the order chat as "Delivery Evidence" and an Order Delivered
 * notice follows for the buyer.
 */

import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle2, Image as ImageIcon, Loader2, PackageCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OrderModal, modalButton } from './_OrderModal'
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

  // Reset whenever the modal opens fresh.
  useEffect(() => {
    if (open) {
      setFile(null)
      setPreview(null)
      setStage('pick')
      setProgress(0)
      setUploadedPath(null)
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
      // The proof photo's storage path is saved on the order and posted to
      // the order chat ("Delivery Evidence"), followed by an Order Delivered
      // notice for the buyer.
      const res = await markOrderAsDelivered(orderId, undefined, uploadedPath ?? undefined)
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
    <OrderModal
      open={open}
      onOpenChange={onOpenChange}
      icon={PackageCheck}
      title="Mark As Delivered"
      description="Add a screenshot or photo of the delivery. It goes into the chat for the buyer, then they confirm."
      footer={
        <>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={stage === 'submitting'}
            className={modalButton('ghost')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={stage !== 'uploaded'}
            className={modalButton('primary')}
          >
            {stage === 'submitting' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Submitting
              </>
            ) : stage === 'done' ? (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Delivered
              </>
            ) : (
              'Confirm Delivery'
            )}
          </button>
        </>
      }
    >
      {/* Upload zone */}
      {stage === 'pick' && (
        <div
          {...getRootProps()}
          className={cn(
            'mt-3.5 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center transition-colors hover:border-white/25',
            isDragActive && 'border-lime-tint-border bg-lime-tint-bg',
          )}
        >
          <input {...getInputProps()} />
          <span className="grid h-9 w-9 place-items-center rounded-[9px] bg-lime-tint-bg text-lime-text">
            <Upload className="h-4 w-4" aria-hidden />
          </span>
          <div className="text-[13px] font-semibold text-text-primary">
            {isDragActive ? 'Drop The Image Here' : 'Click Or Drag An Image'}
          </div>
          <div className="text-[12px] text-text-tertiary">PNG, JPG or WEBP, up to 10 MB</div>
        </div>
      )}

      {/* Uploading / uploaded preview */}
      {(stage === 'uploading' || stage === 'uploaded' || stage === 'submitting' || stage === 'done') && (
        <div className="mt-3.5 rounded-[10px] border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="flex items-center gap-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-12 w-12 flex-shrink-0 rounded-[8px] object-cover ring-1 ring-white/10" />
            ) : (
              <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-[8px] bg-white/[0.05] text-text-tertiary">
                <ImageIcon className="h-5 w-5" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-text-primary">{file?.name ?? 'Image'}</div>
              <div className="mt-0.5 text-[12px] text-text-tertiary">
                {stage === 'uploading'
                  ? `Uploading ${Math.round(progress)}%`
                  : stage === 'uploaded'
                    ? 'Ready to confirm'
                    : stage === 'submitting'
                      ? 'Submitting'
                      : 'Delivered'}
              </div>
            </div>
            {(stage === 'uploaded' || stage === 'done') && (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-lime-text" aria-hidden />
            )}
            {stage === 'uploaded' && (
              <button
                type="button"
                onClick={reset}
                className="rounded-[7px] p-1.5 text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-lime-text transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </OrderModal>
  )
}
