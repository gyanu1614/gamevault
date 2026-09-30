import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrder } from '@/lib/actions/orders'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr/CaretLeft'
import { CaretRight } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { Scales } from '@phosphor-icons/react/dist/ssr/Scales'
import { cn } from '@/lib/utils'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { AdminOrderActions } from './_AdminOrderActions'
import { AdminPanel, StatusBadge } from '../../components/kit'
import { GameTile } from '../../components/GameTile'
import { PAYOUT_LABEL, PAYOUT_TONE } from '../payout'

interface PageProps {
  params: Promise<{ orderId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params
  return {
    title: `Order ${orderId}`,
    description: 'Admin order details',
  }
}

const usd = (n: number) => `$${n.toFixed(2)}`
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** " (8%)" for a percent snapshot; empty when the order has none. */
function pctLabel(rate: unknown): string {
  if (rate == null || rate === '') return ''
  const n = Number(rate)
  return Number.isFinite(n) ? ` (${Number(n.toFixed(2))}%)` : ''
}

function adminOrderMoney(order: any) {
  const subtotal = Number(order.subtotal ?? 0)
  const sellerPayout = Number(order.seller_payout ?? 0)
  return {
    subtotal,
    buyerFee: Number(order.platform_fee ?? 0),
    processingFee: Number(order.payment_processing_fee ?? 0),
    promoDiscount: Number(order.promo_discount ?? 0),
    total: Number(order.total_amount ?? 0),
    sellerFee: Math.max(0, Math.round((subtotal - sellerPayout) * 100) / 100),
    sellerPayout,
  }
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { orderId } = await params
  const supabase = await createClient()

  const orderResult = await getOrder(orderId)
  if (!orderResult.success || !orderResult.order) notFound()

  const order = orderResult.order

  // STATE-007 — buyer, seller, game and category all key off the already-loaded
  // order and none consumes another, so they run as one fan-out instead of
  // four serial round-trips. The two conditional reads resolve to null when
  // the listing carries no game/category.
  const [{ data: buyer }, { data: seller }, gameRes, categoryRes, { data: openDispute }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, email, avatar_url')
      .eq('id', order.buyer_id)
      .single() as any,
    supabase
      .from('profiles')
      .select('id, username, email, avatar_url, shop_name')
      .eq('id', order.seller_id)
      .single() as any,
    order.listing?.game_id
      ? (supabase
          .from('games')
          .select('id, name, slug, image_url, emoji')
          .eq('id', order.listing.game_id)
          .single() as any)
      : Promise.resolve({ data: null }),
    order.listing?.game_category_id
      ? (supabase
          .from('game_categories')
          .select('id, name, slug')
          .eq('id', order.listing.game_category_id)
          .single() as any)
      : Promise.resolve({ data: null }),
    // PR 7 — the open dispute (if any) drives the money controls below.
    supabase
      .from('disputes')
      .select('id')
      .eq('transaction_id', orderId)
      .not('status', 'in', '("resolved_buyer_favor","resolved_seller_favor","resolved_partial","closed")')
      .maybeSingle() as any,
  ])

  const money = adminOrderMoney(order)

  const game = (gameRes as any).data as
    | { id: string; name: string; slug: string; image_url: string | null; emoji: string }
    | null
  const category = (categoryRes as any).data as { id: string; name: string; slug: string } | null

  const timeline = [
    { label: 'Order Created', at: order.created_at as string | null },
    { label: 'Delivered', at: order.delivered_at as string | null },
    { label: 'Completed', at: order.completed_at as string | null },
  ].filter((t) => t.at)

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Orders
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold leading-tight tracking-tight text-text-primary sm:text-[28px]">
              {order.order_number}
            </h1>
            <p className="mt-1 break-all font-mono text-[12px] text-text-tertiary">{order.id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={order.status} className="px-2.5 py-1 text-[12.5px]" />
            <StatusBadge
              status={PAYOUT_LABEL[order.escrow_status] ?? order.escrow_status}
              tone={PAYOUT_TONE[order.escrow_status]}
              className="px-2.5 py-1 text-[12.5px]"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Main */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {order.listing && (
            <AdminPanel>
              <div className="flex items-center gap-4">
                <GameTile src={game?.image_url} name={game?.name} className="h-14 w-14 text-[18px]" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[16px] font-semibold leading-snug text-text-primary">{order.listing.title}</h2>
                  <p className="mt-1 text-[13px] text-text-tertiary">
                    {[game?.name, category?.name].filter(Boolean).join(' · ')}
                    {game || category ? ' · ' : ''}Quantity {order.quantity}
                  </p>
                </div>
              </div>
            </AdminPanel>
          )}

          {/* platform_fee is the BUYER's marketplace fee (on top of the
              price); the seller's fee is subtotal − seller_payout at the
              snapshotted seller_commission_pct. Rates are percents. */}
          <AdminPanel pad={false}>
            <h2 className="px-5 pb-2 pt-5 text-[15px] font-semibold text-text-primary sm:px-6">Money</h2>
            <dl className="divide-y divide-white/[0.06] px-5 pb-2 sm:px-6">
              <MoneyRow label="Item Price" value={usd(money.subtotal)} />
              <MoneyRow label={`Buyer Fee${pctLabel(order.platform_fee_rate)}`} value={`+${usd(money.buyerFee)}`} />
              {money.processingFee > 0 && (
                <MoneyRow label={`Processing Fee${pctLabel(order.payment_processing_fee_rate)}`} value={`+${usd(money.processingFee)}`} />
              )}
              {money.promoDiscount > 0 && <MoneyRow label="Promo Discount" value={`-${usd(money.promoDiscount)}`} />}
              <MoneyRow label="Buyer Paid" value={usd(money.total)} strong />
              <MoneyRow
                label={`Seller Fee${pctLabel(order.seller_commission_pct)}`}
                value={`-${usd(money.sellerFee)}`}
                valueClass="text-warning"
              />
              <MoneyRow label="Seller Payout" value={usd(money.sellerPayout)} strong valueClass="text-success" />
            </dl>
          </AdminPanel>

          <AdminPanel>
            <h2 className="mb-4 text-[15px] font-semibold text-text-primary">Timeline</h2>
            <ol
              className={cn(
                'relative space-y-4',
                timeline.length > 1 &&
                  'before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-white/[0.08]',
              )}
            >
              {timeline.map((t, i) => (
                <li key={t.label} className="relative flex items-start gap-3 pl-6">
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-0 top-1 h-[11px] w-[11px] rounded-full ring-4 ring-bg-raised',
                      i === timeline.length - 1 ? 'bg-text-primary' : 'bg-white/[0.25]',
                    )}
                  />
                  <div>
                    <p className="text-[13.5px] font-medium text-text-primary">{t.label}</p>
                    <p className="text-[12.5px] text-text-tertiary">{when(t.at!)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </AdminPanel>
        </div>

        {/* Side */}
        <div className="min-w-0 space-y-5">
          {(buyer || seller) && (
            <AdminPanel pad={false}>
              <div className="divide-y divide-white/[0.06]">
                {buyer && (
                  <Party
                    role="Buyer"
                    avatar={getAvatarUrl(buyer.avatar_url, buyer.username)}
                    name={buyer.username}
                    email={buyer.email}
                    // No admin user page exists; the orders search matches usernames.
                    href={`/admin/orders?search=${encodeURIComponent(buyer.username ?? '')}`}
                    linkLabel="Buyer’s Orders"
                  />
                )}
                {seller && (
                  <Party
                    role="Seller"
                    avatar={getAvatarUrl(seller.avatar_url, seller.username)}
                    name={seller.shop_name || seller.username}
                    email={seller.email}
                    href={`/admin/active-sellers/${seller.id}`}
                    linkLabel="Seller Profile"
                  />
                )}
              </div>
            </AdminPanel>
          )}

          {/* PR 7 — Money controls: mark disputed / resolve */}
          <AdminOrderActions
            orderId={order.id}
            status={order.status}
            totalAmount={Number(order.total_amount ?? 0)}
            sellerPayout={Number(order.seller_payout ?? 0)}
            openDisputeId={(openDispute as any)?.id ?? null}
          />

          {/* orders has no dispute_id column: the open dispute is read above by transaction_id. */}
          {(openDispute as any)?.id && (
            <Link
              href={`/admin/disputes/${(openDispute as any).id}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-error-bg px-4 py-3.5 text-[13.5px] font-semibold text-error transition-[filter] hover:brightness-125"
            >
              <span className="inline-flex items-center gap-2">
                <Scales aria-hidden weight="bold" className="h-4 w-4" />
                Open Dispute
              </span>
              <CaretRight aria-hidden weight="bold" className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function MoneyRow({
  label,
  value,
  strong,
  valueClass,
}: {
  label: string
  value: string
  strong?: boolean
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className={cn('text-[13.5px]', strong ? 'font-semibold text-text-primary' : 'text-text-secondary')}>{label}</dt>
      <dd className={cn('text-[13.5px] tabular-nums text-text-primary', strong && 'text-[15px] font-bold', valueClass)}>{value}</dd>
    </div>
  )
}

function Party({
  role,
  avatar,
  name,
  email,
  href,
  linkLabel,
}: {
  role: string
  avatar: string
  name: string
  email: string | null
  href: string
  linkLabel: string
}) {
  return (
    <div className="p-5">
      <p className="mb-3 text-[12.5px] font-medium text-text-tertiary">{role}</p>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-text-primary">{name}</p>
          {email && <p className="truncate text-[12.5px] text-text-tertiary">{email}</p>}
        </div>
      </div>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
      >
        {linkLabel}
        <CaretRight aria-hidden weight="bold" className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
