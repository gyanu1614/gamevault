'use client'

import { useState } from 'react'
import { X, Send, Loader2, MessageCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { messagesApi } from '@/lib/api/seller-compatible'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

interface ContactSellerModalProps {
  isOpen: boolean
  onClose: () => void
  sellerId: string
  sellerUsername: string
  listingTitle: string
  listingId: string
}

export function ContactSellerModal({
  isOpen,
  onClose,
  sellerId,
  sellerUsername,
  listingTitle,
  listingId,
}: ContactSellerModalProps) {
  const { user } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    if (!user) {
      toast.error('Please sign in to contact the seller')
      return
    }

    setIsSending(true)

    try {
      // Create/get conversation and send first message
      const { conversationId } = await messagesApi.startConversation(sellerId, message.trim())

      toast.success('Message sent successfully!')
      setMessage('')
      onClose()

      // Invalidate conversations cache so new conversation appears immediately
      queryClient.invalidateQueries({ queryKey: ['seller', 'messages', 'conversations'] })

      // Redirect to messages page
      router.push('/account/messages')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Enhanced Backdrop with stronger blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50"
            style={{ backdropFilter: 'blur(20px)' }}
          />

          {/* Modal Container - Perfectly Centered */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-lg pointer-events-auto"
            >
              <div className="rounded-2xl border border-border-default bg-[#1a1a1a]/95 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border-subtle bg-black/20">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-lime via-purple-600 to-lime-700 shadow-lg shadow-purple-500/30">
                      <MessageCircle className="h-6 w-6 text-text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-text-primary">Contact Seller</h2>
                      <p className="text-sm text-text-secondary">{sellerUsername}</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-bg-raised-hover transition-all text-text-secondary hover:text-text-primary"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5 bg-black/10">
                  {/* Listing Info */}
                  <div className="rounded-xl border border-border-subtle bg-black/40 p-4 backdrop-blur-sm">
                    <p className="text-xs font-medium text-text-secondary mb-1.5">About</p>
                    <p className="text-sm font-medium text-text-primary">{listingTitle}</p>
                  </div>

                  {/* Message Input */}
                  <div>
                    <label htmlFor="message" className="block text-sm font-semibold text-text-primary mb-2.5">
                      Your Message
                    </label>
                    <textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Hi! I'm interested in this listing. Can you provide more details?"
                      rows={5}
                      className="w-full rounded-xl border border-border-default bg-black/40 p-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none transition-all"
                    />
                    <p className="mt-2 text-xs text-text-tertiary">
                      Press Enter to send • Shift+Enter for new line
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-border-subtle bg-black/20">
                  <button
                    onClick={onClose}
                    disabled={isSending}
                    className="px-5 py-2.5 rounded-xl border border-border-default bg-black/40 text-sm font-medium text-text-primary hover:bg-bg-raised-hover transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={isSending || !message.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-lime to-lime-600 text-text-primary text-sm font-semibold hover:from-lime hover:to-lime-700 transition-all shadow-lg shadow-violet-500/30 disabled:opacity-50 disabled:shadow-none"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
