'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Package, Loader2, ImagePlus, X, CheckCircle2 } from 'lucide-react'
import { markOrderAsDelivered } from '@/lib/actions/orders'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface MarkAsDeliveredButtonProps {
  orderId: string
  requiresEvidence: boolean
  hasEvidence: boolean
  conversationId?: string
}

export default function MarkAsDeliveredButton({
  orderId,
  requiresEvidence,
  hasEvidence,
  conversationId,
}: MarkAsDeliveredButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    const invalid = files.filter(f => !validTypes.includes(f.type))
    if (invalid.length) {
      toast.error('Only images (PNG, JPG, WebP, GIF) are allowed')
      return
    }

    const oversized = files.filter(f => f.size > 10 * 1024 * 1024)
    if (oversized.length) {
      toast.error('Images must be under 10MB each')
      return
    }

    const newFiles = [...selectedFiles, ...files].slice(0, 4) // max 4
    setSelectedFiles(newFiles)

    // Generate previews
    const newPreviews: string[] = []
    let loaded = 0
    newFiles.forEach((file, i) => {
      if (i < previews.length) {
        newPreviews[i] = previews[i]
        loaded++
        if (loaded === newFiles.length) setPreviews(newPreviews)
      } else {
        const reader = new FileReader()
        reader.onload = (ev) => {
          newPreviews[i] = ev.target?.result as string
          loaded++
          if (loaded === newFiles.length) setPreviews([...newPreviews])
        }
        reader.readAsDataURL(file)
      }
    })
    if (newFiles.length === 0) setPreviews([])

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleMarkAsDelivered = async () => {
    if (requiresEvidence && !hasEvidence && selectedFiles.length === 0) {
      toast.error('Please upload at least one delivery proof image')
      return
    }

    setIsLoading(true)

    try {
      // 1. Mark order as delivered
      const result = await markOrderAsDelivered(orderId)
      if (!result.success) {
        toast.error(result.error || 'Failed to mark order as delivered')
        return
      }

      // 2. Upload images and send as chat message
      if (selectedFiles.length > 0 && conversationId) {
        setUploading(true)
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Not authenticated')

          // Upload each file to Supabase Storage
          const uploadedUrls: string[] = []
          for (const file of selectedFiles) {
            const ext = file.name.split('.').pop()
            const path = `${orderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
            const { error: uploadError } = await supabase.storage
              .from('delivery-evidence')
              .upload(path, file, { upsert: false })

            if (uploadError) {
              console.error('Upload error:', uploadError)
              continue
            }

            // Use signed URL (long expiry) since bucket is private
            const { data: signedData } = await supabase.storage
              .from('delivery-evidence')
              .createSignedUrl(path, 315360000) // ~10 years

            if (signedData?.signedUrl) {
              uploadedUrls.push(signedData.signedUrl)
            }
          }

          // Send as a chat message with attachments
          if (uploadedUrls.length > 0) {
            await (supabase.from('messages').insert as any)({
              conversation_id: conversationId,
              sender_id: user.id,
              content: `I've marked your order as delivered! Here's the delivery proof. Please confirm receipt within 48 hours.`,
              attachments: uploadedUrls,
              is_read: false,
            })

            await (supabase
              .from('conversations')
              .update as any)({ last_message_at: new Date().toISOString() })
              .eq('id', conversationId)
          }
        } catch (uploadErr) {
          console.error('Error uploading evidence:', uploadErr)
          toast.warning('Order delivered but proof upload failed')
        } finally {
          setUploading(false)
        }
      } else if (conversationId) {
        // No images — still send a delivery message
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await (supabase.from('messages').insert as any)({
              conversation_id: conversationId,
              sender_id: user.id,
              content: `I've marked your order as delivered! The 48-hour auto-release timer has started. Please confirm receipt when you receive the item.`,
              attachments: [],
              is_read: false,
            })
            await (supabase
              .from('conversations')
              .update as any)({ last_message_at: new Date().toISOString() })
              .eq('id', conversationId)
          }
        } catch (msgErr) {
          console.error('Error sending delivery message:', msgErr)
        }
      }

      toast.success('Order marked as delivered! Auto-release timer started.')
      setShowModal(false)
      router.refresh()
    } catch (error) {
      console.error('Error marking order as delivered:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setShowModal(false)
      setSelectedFiles([])
      setPreviews([])
    }
  }

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      // Save current scroll position
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, parseInt(scrollY || '0') * -1)
    }

    return () => {
      // Cleanup on unmount
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
    }
  }, [showModal])

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full py-2.5 border border-white/[0.15] bg-white/[0.07] hover:bg-white/[0.11] hover:border-white/[0.22] text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
      >
        <Package className="w-4 h-4 text-violet-400" />
        Mark as Delivered
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.1] rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-1">Mark Order as Delivered</h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              This starts the 48-hour auto-release timer. The buyer has 48h to confirm receipt or open a dispute.
            </p>

            {/* Evidence required warning */}
            {requiresEvidence && !hasEvidence && selectedFiles.length === 0 && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400">
                ⚠ You must upload at least one delivery proof image before marking as delivered.
              </div>
            )}

            {/* Proof upload section */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-[0.08em]">
                  Delivery Proof
                </span>
                <span className="text-[10px] text-gray-600">
                  {selectedFiles.length}/4 images · optional
                </span>
              </div>

              {/* Preview grid */}
              {previews.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {previews.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.03] group">
                      <Image src={src} alt={`proof ${i + 1}`} fill className="object-cover" />
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              {selectedFiles.length < 4 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/40 transition-all flex flex-col items-center gap-1.5 text-gray-600 hover:text-gray-400"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-xs">Click to add proof images</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Info row */}
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-violet-500/[0.06] border border-violet-500/15 px-3.5 py-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Proof images will be sent directly to the buyer in chat as your delivery confirmation.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-sm text-gray-400 font-medium transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsDelivered}
                disabled={isLoading || uploading || (requiresEvidence && !hasEvidence && selectedFiles.length === 0)}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.15] bg-white/[0.07] hover:bg-white/[0.11] text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading || uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploading ? 'Uploading...' : 'Confirming...'}
                  </>
                ) : (
                  'Confirm Delivery'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
