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
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ChatInterface from '@/components/chat/ChatInterface'
import { useAuth } from '@/hooks/use-auth'
import { useEffect, useState } from 'react'
import ResolveDisputeModal from '@/components/admin/disputes/ResolveDisputeModal'
import EscalateDisputeModal from '@/components/admin/disputes/EscalateDisputeModal'
import EscalationBanner from '@/components/admin/disputes/EscalationBanner'
import DisputeResolutionCard from '@/components/admin/disputes/DisputeResolutionCard'

export default function DisputeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const disputeId = params.id as string
  const { user } = useAuth()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [order, setOrder] = useState<any>(null)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [showEscalateModal, setShowEscalateModal] = useState(false)
  const [isChatCollapsed, setIsChatCollapsed] = useState(false) // Will be set to true for resolved disputes

  // Fetch dispute data
  const { data, isLoading } = useQuery({
    queryKey: ['dispute', disputeId],
    queryFn: async () => await getDisputeById(disputeId),
  })

  const dispute = (data?.success ? data.dispute : null) as any

  // Set chat collapsed state for resolved disputes
  useEffect(() => {
    if (dispute && (dispute.status.startsWith('resolved_') || dispute.status === 'closed')) {
      setIsChatCollapsed(true)
    }
  }, [dispute?.status])

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
          {/* Resolution Card - Show when dispute is resolved - Merged with order details */}
          {(dispute.status.startsWith('resolved_') || dispute.status === 'closed') && (
            <DisputeResolutionCard
              status={dispute.status}
              resolutionType={dispute.resolution_type}
              resolvedAmount={dispute.resolved_amount}
              resolutionNotes={dispute.resolution_notes}
              resolvedBy={dispute.resolved_by_user ? {
                username: dispute.resolved_by_username,
                full_name: dispute.resolved_by_name
              } : undefined}
              resolvedAt={dispute.resolved_at}
              currency={dispute.currency}
              buyerUsername={dispute.buyer_username}
              sellerUsername={dispute.seller_username}
              orderNumber={order?.order_number || dispute.transaction_id?.slice(0, 8).toUpperCase()}
              disputeReason={dispute.reason}
              disputeDescription={dispute.description}
              disputedAmount={dispute.disputed_amount}
              disputeCreatedAt={dispute.created_at}
              listingTitle={order?.listing?.title}
              listingImage={order?.listing?.images?.[0]}
            />
          )}

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

          {/* Dispute Header - Hide for resolved disputes (info is in DisputeResolutionCard) */}
          {!(dispute.status.startsWith('resolved_') || dispute.status === 'closed') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl overflow-hidden"
          >
            {/* Product Visual Header */}
            <div className="relative bg-gradient-to-br from-white/[0.02] to-white/[0.01] border-b border-white/[0.05] p-6">
              <div className="flex items-start gap-4">
                {/* Listing Image */}
                {order?.listing?.images && order.listing.images.length > 0 ? (
                  <img
                    src={order.listing.images[0]}
                    alt={order?.listing?.title}
                    className="w-20 h-20 rounded-xl object-cover border border-white/[0.1] flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-8 w-8 text-gray-600" />
                  </div>
                )}

                {/* Order Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <h1 className="text-xl font-bold text-white mb-1 line-clamp-1">
                        {order?.listing?.title || 'Order Item'}
                      </h1>
                      <p className="text-xs text-gray-500 font-medium">
                        Order #{order?.order_number || dispute.transaction_id?.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    {getStatusBadge(dispute.status)}
                  </div>

                  {/* Dispute Reason Badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 mt-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs font-medium text-red-400 capitalize">
                      {dispute.reason?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dispute Details */}
            <div className="p-6 space-y-6">
              {/* Dispute Description */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Dispute Reason
                </h3>
                <p className="text-sm font-medium text-white mb-2">
                  {dispute.title}
                </p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {dispute.description}
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="h-5 w-5 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Disputed Amount</p>
                    <p className="text-sm font-semibold text-white">
                      {formatAmount(dispute.disputed_amount, dispute.currency)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-xs font-medium text-white">
                      {formatDate(dispute.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          )}

          {/* Order Conversation - Admin Can Intervene */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl overflow-hidden"
          >
            <div
              className="bg-violet-500/10 border-b border-violet-500/30 px-4 py-3 cursor-pointer hover:bg-violet-500/15 transition-colors"
              onClick={() => setIsChatCollapsed(!isChatCollapsed)}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-400" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-violet-400">
                    Order Conversation - Admin View
                  </div>
                  <div className="text-xs text-gray-400">
                    You can view and participate in this conversation
                  </div>
                </div>
                {isChatCollapsed ? (
                  <ChevronDown className="w-5 h-5 text-violet-400 flex-shrink-0" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-violet-400 flex-shrink-0" />
                )}
              </div>
            </div>

            {!isChatCollapsed && (
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
            )}
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

          {/* Actions or Resolution Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-xl p-6 space-y-4"
          >
            {dispute.status.startsWith('resolved_') || dispute.status === 'closed' ? (
              <>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Resolution Details
                </h3>

                {/* Dispute Reference ID */}
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                  <p className="text-xs text-gray-500 mb-1">Dispute Reference ID</p>
                  <p className="text-sm font-mono font-medium text-white">
                    #{dispute.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Use this ID to reference this case</p>
                </div>

                {/* Resolved By */}
                {dispute.resolved_by_user && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-3.5 w-3.5 text-gray-500" />
                      <p className="text-xs text-gray-500">Resolved By</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {dispute.resolved_by_name || dispute.resolved_by_username || 'Admin'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {dispute.resolved_at ? formatDate(dispute.resolved_at) : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resolution Type */}
                {dispute.resolution_type && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                    <p className="text-xs text-gray-500 mb-1">Resolution Type</p>
                    <p className="text-sm font-medium text-white capitalize">
                      {dispute.resolution_type.replace(/_/g, ' ')}
                    </p>
                  </div>
                )}

                {/* Refund Amount */}
                {dispute.resolved_amount !== undefined && dispute.resolved_amount > 0 && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-3.5 w-3.5 text-gray-500" />
                      <p className="text-xs text-gray-500">Refund Amount</p>
                    </div>
                    <p className="text-lg font-bold text-green-400">
                      {formatAmount(dispute.resolved_amount, dispute.currency)}
                    </p>
                  </div>
                )}
              </>
            ) : dispute.status === 'escalated' ? (
              <>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Escalation Info
                </h3>
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-orange-400" />
                    <div>
                      <p className="text-sm font-medium text-orange-400">Escalated to Senior Admin</p>
                      <p className="text-xs text-gray-400 mt-1">Requires senior admin review</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
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

                {/* Dispute Reference ID */}
                <div className="mt-4 pt-4 border-t border-white/[0.05]">
                  <p className="text-xs text-gray-500 mb-1">Dispute Reference</p>
                  <p className="text-xs font-mono font-medium text-gray-400">
                    #{dispute.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </>
            )}
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
