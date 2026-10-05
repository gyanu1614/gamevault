'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDisputeById } from '@/lib/actions/admin-disputes'
import { createClient } from '@/lib/supabase/client'
import Link from '@/components/navigation/AppLink'
import { CaretDown, CaretLeft, ChatsCircle, CheckCircle, Scales, WarningOctagon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import ChatInterface from '@/components/chat/ChatInterface'
import { useAuth } from '@/hooks/use-auth'
import { useEffect, useState } from 'react'
import ResolveDisputeModal from '@/components/admin/disputes/ResolveDisputeModal'
import EscalateDisputeModal from '@/components/admin/disputes/EscalateDisputeModal'
import EscalationBanner from '@/components/admin/disputes/EscalationBanner'
import DisputeResolutionCard from '@/components/admin/disputes/DisputeResolutionCard'
import { AdminEmpty, AdminPanel, StatusBadge, adminBtn, type ChipTone } from '../../components/kit'
import { DisputeSkeleton } from './_DisputeSkeleton'

export default function DisputeDetailPage() {
  const params = useParams()
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
      return
    }

    const fetchConversation = async () => {
      const supabase = createClient()


      // Get order details
      const { data: orderData, error: orderError } = (await supabase
        .from('orders')
        // Shared order columns only: '*' on orders is refused to a session
        // client (orders column grant).
        .select(`
          id,
          order_number,
          total_amount,
          status,
          created_at,
          chat_active_until,
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


        if (conv) {
          setConversationId(conv.id)
        }
      }
    }

    fetchConversation()
  }, [dispute?.transaction_id])

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatAmount = (amount: number, currency: string = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  const STATUS: Record<string, { label: string; tone: ChipTone }> = {
    open: { label: 'Open', tone: 'warning' },
    under_review: { label: 'Under Review', tone: 'info' },
    escalated: { label: 'Escalated', tone: 'error' },
    resolved_buyer_favor: { label: 'Resolved – Buyer', tone: 'success' },
    resolved_seller_favor: { label: 'Resolved – Seller', tone: 'success' },
    resolved_partial: { label: 'Resolved – Partial', tone: 'success' },
    closed: { label: 'Closed', tone: 'neutral' },
  }

  if (isLoading) {
    return <DisputeSkeleton />
  }

  if (!dispute) {
    return <AdminEmpty icon={Scales} title="Dispute not found" hint="It may have been removed, or the link is wrong." />
  }

  const resolved = dispute.status.startsWith('resolved_') || dispute.status === 'closed'
  const st = STATUS[dispute.status] ?? STATUS.open
  const ref = `#${dispute.id.slice(0, 8).toUpperCase()}`

  return (
    <div className="space-y-5">
      <Link
        href="/admin/disputes"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
        Disputes
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Main */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {resolved && (
            <DisputeResolutionCard
              status={dispute.status}
              resolutionType={dispute.resolution_type}
              resolvedAmount={dispute.resolved_amount}
              resolutionNotes={dispute.resolution_notes}
              resolvedBy={
                dispute.resolved_by_user
                  ? { username: dispute.resolved_by_username, full_name: dispute.resolved_by_name }
                  : undefined
              }
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

          {dispute.status === 'escalated' && dispute.escalated_at && (
            <EscalationBanner
              escalatedBy={
                dispute.escalated_by
                  ? { username: dispute.escalated_by_username || 'Admin', full_name: dispute.escalated_by_name }
                  : undefined
              }
              escalatedAt={dispute.escalated_at}
              escalationReason={dispute.escalation_reason}
            />
          )}

          {!resolved && (
            <AdminPanel pad={false} className="overflow-hidden">
              <div className="flex items-start gap-4 border-b border-white/[0.06] p-4 sm:p-6">
                {order?.listing?.images && order.listing.images.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.listing.images[0]}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-md object-cover sm:h-20 sm:w-20"
                  />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-white/[0.05] text-text-tertiary sm:h-20 sm:w-20">
                    <Scales aria-hidden weight="bold" className="h-7 w-7" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h1 className="line-clamp-2 text-[18px] font-bold leading-tight text-text-primary sm:text-[20px]">
                        {order?.listing?.title || 'Order Item'}
                      </h1>
                      <p className="mt-1 text-[12.5px] text-text-tertiary">
                        Order{' '}
                        {order?.id ? (
                          <Link href={`/admin/orders/${order.id}`} className="font-mono text-text-secondary underline-offset-4 hover:underline">
                            #{order.order_number || dispute.transaction_id?.slice(0, 8).toUpperCase()}
                          </Link>
                        ) : (
                          <span className="font-mono">#{dispute.transaction_id?.slice(0, 8).toUpperCase()}</span>
                        )}
                      </p>
                    </div>
                    <StatusBadge status={st.label} tone={st.tone} className="px-2.5 py-1 text-[12.5px]" />
                  </div>
                  <span className="mt-2 inline-flex rounded-full bg-error-bg px-2.5 py-0.5 text-[12px] font-semibold capitalize text-error">
                    {dispute.reason?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="space-y-5 p-4 sm:p-6">
                <div>
                  <p className="text-[12.5px] font-medium text-text-tertiary">What the Buyer Says</p>
                  <p className="mt-1 text-[14px] font-medium text-text-primary">{dispute.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-secondary">{dispute.description}</p>
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-bg-overlay px-3.5 py-3">
                    <dt className="text-[12px] text-text-tertiary">Disputed Amount</dt>
                    <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-text-primary">
                      {formatAmount(dispute.disputed_amount, dispute.currency)}
                    </dd>
                  </div>
                  <div className="rounded-md bg-bg-overlay px-3.5 py-3">
                    <dt className="text-[12px] text-text-tertiary">Opened</dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-text-primary">{formatDate(dispute.created_at)}</dd>
                  </div>
                </dl>
              </div>
            </AdminPanel>
          )}

          {/* Order conversation — the admin can step in */}
          <AdminPanel pad={false} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setIsChatCollapsed(!isChatCollapsed)}
              aria-expanded={!isChatCollapsed}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] sm:px-5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/[0.05] text-text-primary">
                <ChatsCircle aria-hidden weight="bold" className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-text-primary">Order Conversation</span>
                <span className="block text-[12.5px] text-text-tertiary">Admin view — you can read and reply</span>
              </span>
              <CaretDown
                aria-hidden
                weight="bold"
                className={cn('h-4 w-4 shrink-0 text-text-tertiary transition-transform', !isChatCollapsed && 'rotate-180')}
              />
            </button>

            {!isChatCollapsed && (
              <div className="h-[560px] border-t border-white/[0.06] sm:h-[600px]">
                {conversationId && user && order ? (
                  <ChatInterface conversationId={conversationId} currentUserId={user.id} order={order} className="h-full" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[13.5px] text-text-tertiary">
                    Loading conversation…
                  </div>
                )}
              </div>
            )}
          </AdminPanel>
        </div>

        {/* Side */}
        <div className="min-w-0 space-y-5">
          <AdminPanel pad={false}>
            <div className="divide-y divide-white/[0.06]">
              {[
                { role: 'Buyer', name: dispute.buyer_name || dispute.buyer_username, email: dispute.buyer_email },
                { role: 'Seller', name: dispute.seller_name || dispute.seller_username, email: dispute.seller_email },
              ].map((p) => (
                <div key={p.role} className="p-4 sm:p-5">
                  <p className="mb-2.5 text-[12.5px] font-medium text-text-tertiary">{p.role}</p>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[14px] font-bold text-text-primary">
                      {(p.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-text-primary">{p.name}</p>
                      {p.email && <p className="truncate text-[12.5px] text-text-tertiary">{p.email}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel>
            {resolved ? (
              <>
                <h2 className="mb-3 text-[15px] font-semibold text-text-primary">Resolution</h2>
                <dl className="space-y-2">
                  <div className="rounded-md bg-bg-overlay px-3.5 py-3">
                    <dt className="text-[12px] text-text-tertiary">Dispute Reference</dt>
                    <dd className="mt-0.5 font-mono text-[13.5px] font-semibold text-text-primary">{ref}</dd>
                  </div>
                  {dispute.resolved_by_user && (
                    <div className="rounded-md bg-bg-overlay px-3.5 py-3">
                      <dt className="text-[12px] text-text-tertiary">Resolved By</dt>
                      <dd className="mt-0.5 text-[13.5px] font-medium text-text-primary">
                        {dispute.resolved_by_name || dispute.resolved_by_username || 'Admin'}
                        {dispute.resolved_at && (
                          <span className="block text-[12px] font-normal text-text-tertiary">{formatDate(dispute.resolved_at)}</span>
                        )}
                      </dd>
                    </div>
                  )}
                  {dispute.resolution_type && (
                    <div className="rounded-md bg-bg-overlay px-3.5 py-3">
                      <dt className="text-[12px] text-text-tertiary">Resolution Type</dt>
                      <dd className="mt-0.5 text-[13.5px] font-medium capitalize text-text-primary">
                        {dispute.resolution_type.replace(/_/g, ' ')}
                      </dd>
                    </div>
                  )}
                  {dispute.resolved_amount !== undefined && dispute.resolved_amount > 0 && (
                    <div className="rounded-md bg-bg-overlay px-3.5 py-3">
                      <dt className="text-[12px] text-text-tertiary">Refund Amount</dt>
                      <dd className="mt-0.5 text-[16px] font-bold tabular-nums text-success">
                        {formatAmount(dispute.resolved_amount, dispute.currency)}
                      </dd>
                    </div>
                  )}
                </dl>
              </>
            ) : dispute.status === 'escalated' ? (
              <>
                <h2 className="mb-3 text-[15px] font-semibold text-text-primary">Escalation</h2>
                <p className="flex items-start gap-2 rounded-md bg-warning-bg px-3.5 py-3 text-[13px] text-warning">
                  <WarningOctagon aria-hidden weight="bold" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block font-semibold">Escalated to a senior admin</span>
                    <span className="text-text-secondary">Waiting for senior review.</span>
                  </span>
                </p>
                <p className="mt-3 text-[12.5px] text-text-tertiary">
                  Reference <span className="font-mono text-text-secondary">{ref}</span>
                </p>
              </>
            ) : (
              <>
                <h2 className="mb-3 text-[15px] font-semibold text-text-primary">Actions</h2>
                <div className="space-y-2">
                  <button type="button" onClick={() => setShowResolveModal(true)} className={cn(adminBtn.primary, 'w-full')}>
                    <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
                    Resolve Dispute
                  </button>
                  <button type="button" onClick={() => setShowEscalateModal(true)} className={cn(adminBtn.danger, 'w-full')}>
                    <WarningOctagon aria-hidden weight="bold" className="h-4 w-4" />
                    Escalate to Senior
                  </button>
                </div>
                <p className="mt-4 border-t border-white/[0.06] pt-3 text-[12.5px] text-text-tertiary">
                  Reference <span className="font-mono text-text-secondary">{ref}</span>
                </p>
              </>
            )}
          </AdminPanel>
        </div>
      </div>

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
