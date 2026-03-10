'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDisputeById } from '@/lib/actions/admin-disputes'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  AlertTriangle,
  DollarSign,
  Calendar,
  User,
  CheckCircle,
  AlertOctagon,
  Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ChatInterface from '@/components/chat/ChatInterface'
import { useAuth } from '@/hooks/use-auth'
import { useEffect, useState } from 'react'
import ResolveDisputeModal from '@/components/admin/disputes/ResolveDisputeModal'
import EscalateDisputeModal from '@/components/admin/disputes/EscalateDisputeModal'
import EscalationBanner from '@/components/admin/disputes/EscalationBanner'

export default function DisputeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const disputeId = params.id as string
  const { user } = useAuth()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [order, setOrder] = useState<any>(null)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [showEscalateModal, setShowEscalateModal] = useState(false)

  // Fetch dispute data
  const { data, isLoading } = useQuery({
    queryKey: ['dispute', disputeId],
    queryFn: async () => await getDisputeById(disputeId),
  })

  const dispute = (data?.success ? data.dispute : null) as any

  // Fetch conversation for this order
  useEffect(() => {
    if (!dispute?.transaction_id) {
      console.log('❌ No transaction_id in dispute:', dispute)
      return
    }

    const fetchConversation = async () => {
      const supabase = createClient()

      console.log('🔍 Fetching order for transaction_id:', dispute.transaction_id)

      // Get order details
      const { data: orderData, error: orderError } = (await supabase
        .from('orders')
        .select(`
          *,
          listing:listing_id (
            title,
            images,
            game_id
          ),
          buyer:buyer_id (
            id,
            username,
            avatar_url
          ),
          seller:seller_id (
            id,
            username,
            avatar_url
          )
        `)
        .eq('id', dispute.transaction_id)
        .single()) as any

      if (orderError) {
        console.error('❌ Error fetching order:', orderError)
        return
      }

      console.log('✅ Order data:', orderData)

      if (orderData) {
        setOrder({
          id: orderData.id,
          order_number: orderData.order_number,
          listing: orderData.listing,
          total_amount: orderData.total_amount,
          status: orderData.status,
          created_at: orderData.created_at,
          chat_active_until: orderData.chat_active_until,
          buyer: orderData.buyer,
          seller: orderData.seller
        })

        // Get conversation
        const { data: conv, error: convError } = (await supabase
          .from('conversations')
          .select('id')
          .eq('order_id', dispute.transaction_id)
          .single()) as any

        if (convError) {
          console.error('❌ Error fetching conversation:', convError)
          return
        }

        console.log('✅ Conversation found:', conv)

        if (conv) {
          setConversationId(conv.id)
        }
      }
    }

    fetchConversation()
  }, [dispute?.transaction_id])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAmount = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      open: { label: 'Open', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      under_review: { label: 'Under Review', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      escalated: { label: 'Escalated', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
      resolved_buyer_favor: { label: 'Resolved - Buyer', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
      resolved_seller_favor: { label: 'Resolved - Seller', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
      resolved_partial: { label: 'Resolved - Partial', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
      closed: { label: 'Closed', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.open

    return (
      <span className={cn(
        "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border",
        config.className
      )}>
        {config.label}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-violet-500 border-r-transparent"></div>
      </div>
    )
  }

  if (!dispute) {
    return (
      <div className="p-6">
        <div className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl p-12 text-center">
          <AlertTriangle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-white">Dispute not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Disputes
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Order Chat */}
        <div className="lg:col-span-2 space-y-6">
          {/* Escalation Banner - Show when dispute is escalated */}
          {dispute.status === 'escalated' && dispute.escalated_at && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <EscalationBanner
                escalatedBy={dispute.escalated_by ? {
                  username: dispute.escalated_by_username || 'Admin',
                  full_name: dispute.escalated_by_name
                } : undefined}
                escalatedAt={dispute.escalated_at}
                escalationReason={dispute.escalation_reason}
              />
            </motion.div>
          )}

          {/* Dispute Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  {order?.listing?.title || 'Order'} (#{order?.order_number || dispute.transaction_id?.slice(0, 8).toUpperCase()})
                </h1>
                <p className="text-sm text-gray-400 mb-1">
                  <span className="font-medium text-gray-300">Dispute Reason:</span> {dispute.title}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  Category: {dispute.reason?.replace(/_/g, ' ')}
                </p>
              </div>
              {getStatusBadge(dispute.status)}
            </div>

            <p className="text-gray-300 leading-relaxed text-sm">{dispute.description}</p>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/[0.1]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Disputed Amount</p>
                  <p className="text-sm font-medium text-white">
                    {formatAmount(dispute.disputed_amount, dispute.currency)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-sm font-medium text-white">
                    {formatDate(dispute.created_at)}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Order Conversation - Admin Can Intervene */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl overflow-hidden"
          >
            <div className="bg-violet-500/10 border-b border-violet-500/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-400" />
                <div>
                  <div className="text-sm font-semibold text-violet-400">
                    Order Conversation - Admin View
                  </div>
                  <div className="text-xs text-gray-400">
                    You can view and participate in this conversation
                  </div>
                </div>
              </div>
            </div>

            <div className="h-[600px]">
              {conversationId && user && order ? (
                <ChatInterface
                  conversationId={conversationId}
                  currentUserId={user.id}
                  order={order}
                  className="h-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm text-gray-400">Loading conversation...</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Sidebar - Right Side */}
        <div className="space-y-6">
          {/* Parties */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl p-6"
          >
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Parties
            </h3>

            {/* Buyer */}
            <div className="mb-4 pb-4 border-b border-white/[0.1]">
              <p className="text-xs text-gray-500 mb-2">Buyer</p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {dispute.buyer_name || dispute.buyer_username}
                  </p>
                  <p className="text-xs text-gray-500">{dispute.buyer_email}</p>
                </div>
              </div>
            </div>

            {/* Seller */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Seller</p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {dispute.seller_name || dispute.seller_username}
                  </p>
                  <p className="text-xs text-gray-500">{dispute.seller_email}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl p-6 space-y-3"
          >
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Actions
            </h3>

            <Button
              variant="outline"
              className="w-full justify-start border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-400"
              onClick={() => setShowResolveModal(true)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Resolve Dispute
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400"
              onClick={() => setShowEscalateModal(true)}
            >
              <AlertOctagon className="h-4 w-4 mr-2" />
              Escalate to Senior
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Resolve Dispute Modal */}
      {dispute && order && (
        <ResolveDisputeModal
          isOpen={showResolveModal}
          onClose={() => setShowResolveModal(false)}
          dispute={{
            id: dispute.id,
            title: dispute.title,
            disputed_amount: dispute.disputed_amount,
            currency: dispute.currency,
            buyer_username: dispute.buyer_username,
            seller_username: dispute.seller_username,
          }}
        />
      )}

      {/* Escalate Dispute Modal */}
      {dispute && (
        <EscalateDisputeModal
          isOpen={showEscalateModal}
          onClose={() => setShowEscalateModal(false)}
          dispute={{
            id: dispute.id,
            title: dispute.title,
            buyer_username: dispute.buyer_username,
            seller_username: dispute.seller_username,
          }}
        />
      )}
    </div>
  )
}
