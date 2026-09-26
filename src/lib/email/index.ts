import type { Resend } from 'resend'

import { assertEmailTransportAllowed } from './transport-guard'
import { DISCORD_INVITE_URL, FOUNDING_FEE_PERK_SENTENCE } from '@/lib/config/founding-seller'
import {
  emailShell,
  emailText,
  emailButton,
  emailBox,
  emailRow,
  emailOrderSummary,
  emailDetail,
  emailDetailAccent,
  emailItemRow,
  emailFooterNote,
  gameLogoUrl,
  EMAIL_TOKENS,
} from './shell'

// Lazily LOAD and construct the Resend client on first send, not at module
// load. `new Resend(undefined)` throws immediately, which would crash any page
// that merely imports this module (e.g. /admin/early-sellers) when
// RESEND_API_KEY isn't set — common in local dev. This defers that so pages
// render, and when the key is absent it no-ops the send (logs a warning)
// instead of throwing.
//
// The IMPORT is dynamic too (build audit 2026-09-22, §3): `resend` pulls in
// `svix`, which cost 106 s of module build time and was traced into every
// bundle that touches this module, even though it is only reachable on a real
// send. `import type` above keeps the types free. Combined with
// serverExternalPackages in next.config.js, svix/resend stay out of the
// function bundles.
let _client: Resend | null = null
async function getResendClient(): Promise<Resend | null> {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!_client) {
    const { Resend: ResendCtor } = await import('resend')
    _client = new ResendCtor(key)
  }
  return _client
}

const resend = {
  emails: {
    async send(payload: Parameters<Resend['emails']['send']>[0]) {
      // Never let a test run reach the real provider. Throws rather than
      // no-ops so a test can't silently "pass" while asserting nothing.
      assertEmailTransportAllowed(
        process.env,
        typeof (payload as { subject?: unknown }).subject === 'string'
          ? ((payload as { subject?: string }).subject as string)
          : undefined,
      )
      const client = await getResendClient()
      if (!client) {
        console.warn('[email] RESEND_API_KEY not set — skipping email send.')
        return { data: null, error: null }
      }
      return client.emails.send(payload)
    },
  },
}

const FROM_EMAIL = 'DropMarket <noreply@dropmarket.gg>'
// Replies to any transactional email land in the monitored support inbox
// (Spacemail alias) instead of bouncing off noreply@.
const REPLY_TO = 'support@dropmarket.gg'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Escape user-supplied text before interpolating into email HTML. Listing
 * titles, usernames and dispute reasons are attacker-controlled — without
 * this a seller could inject markup into buyers' inboxes.
 */
/** Low-level sender for templates that live in their own module (PR 7: fee notice). */
export async function sendTransactionalEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const { data, error } = await resend.emails.send({ from: FROM_EMAIL, replyTo: REPLY_TO, to, subject, html })
  return error ? { success: false as const, error } : { success: true as const, data }
}

/** escapeHtml for templates outside this module. */
export function escapeHtmlText(s: string): string {
  return escapeHtml(s)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ============================================
// APPLICATION EMAILS
// ============================================

export async function sendApplicationReceivedEmail({
  to,
  name,
  displayName,
  applicationId,
}: {
  to: string
  name: string
  displayName: string
  applicationId: string
}) {
  try {
    const body =
      emailText(`Thanks, ${escapeHtml(name)} — your seller application for <strong style="color:${EMAIL_TOKENS.INK};">&ldquo;${escapeHtml(displayName)}&rdquo;</strong> is in. It's under review now, and we'll email you the moment there's a decision. Nothing more for you to do right now.`) +
      emailBox({
        accent: true,
        title: 'What happens next',
        html: `We review your application within 2&ndash;3 business days &middot; we'll email you the decision &middot; you can check your status any time from your account.`,
      }) +
      emailBox({ title: 'Application reference', html: `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere;">${escapeHtml(applicationId)}</span>` }) +
      emailButton('View Application Status', `${APP_URL}/account/seller-status`) +
      emailFooterNote(`Questions in the meantime? Just reply to this email.`)

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to,
      subject: `We got your application, ${name}`,
      html: emailShell({
        preview: `Your seller application is in and under review.`,
        icon: 'application',
        heading: `Thanks, ${escapeHtml(name)} — we got it`,
        body,
      }),
    })

    if (error) {
      console.error('Failed to send application received email:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email service error:', error)
    return { success: false, error }
  }
}

export async function sendApplicationInReviewEmail({
  to,
  name,
}: {
  to: string
  name: string
}) {
  try {
    const body =
      emailText(`Good news, ${escapeHtml(name)} — our team has started reviewing your seller application. There's nothing you need to do right now; we'll email you the moment there's a decision.`) +
      emailBox({
        accent: true,
        title: 'What to expect',
        html: `Most decisions land within 24&ndash;48 hours &middot; we may reach out if anything needs clarifying &middot; you can track progress any time from your account.`,
      }) +
      emailButton('View Application Status', `${APP_URL}/account/seller-status`)

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to,
      subject: 'Your seller application is in review',
      html: emailShell({
        preview: 'We’ve started reviewing your seller application.',
        icon: 'review',
        heading: `We're reviewing your application`,
        body,
      }),
    })

    if (error) {
      console.error('Failed to send application in-review email:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email service error:', error)
    return { success: false, error }
  }
}

export async function sendApplicationApprovedEmail({
  to,
  name,
  displayName,
}: {
  to: string
  name: string
  displayName: string
}) {
  try {
    const dos = [
      `<strong style="color:${EMAIL_TOKENS.INK};">Deliver exactly what you listed</strong> — within your stated delivery time`,
      `<strong style="color:${EMAIL_TOKENS.INK};">Keep all chat on DropMarket</strong> — it protects you in disputes`,
      `<strong style="color:${EMAIL_TOKENS.INK};">Mark orders delivered honestly</strong> — buyers confirm before you're paid`,
      `<strong style="color:${EMAIL_TOKENS.INK};">Keep your stock numbers real</strong>`,
    ]
    const donts = [
      `<strong style="color:${EMAIL_TOKENS.INK};">Never take payment outside DropMarket</strong> — instant ban`,
      `<strong style="color:${EMAIL_TOKENS.INK};">Never ask buyers for personal contact details</strong>`,
      `<strong style="color:${EMAIL_TOKENS.INK};">Never share login credentials</strong> except through the account-sale flow`,
      `<strong style="color:${EMAIL_TOKENS.INK};">Never deliver before payment is confirmed</strong>`,
    ]
    const listRows = (items: string[], mark: string, color: string) =>
      items
        .map(
          (t) =>
            `<tr><td valign="top" style="width:22px;color:${color};font-weight:700;font-size:14px;">${mark}</td><td style="padding-bottom:7px;font-size:13px;line-height:1.6;color:${EMAIL_TOKENS.INK_2};">${t}</td></tr>`,
        )
        .join('')

    const body =
      emailText(`Congratulations, ${escapeHtml(name)} — your seller application for <strong style="color:${EMAIL_TOKENS.INK};">&ldquo;${escapeHtml(displayName)}&rdquo;</strong> is approved! Your seller access is live. Set up your storefront and list your first item whenever you're ready.`) +
      emailBox({
        accent: true,
        title: "Seller do's",
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${listRows(dos, '✓', EMAIL_TOKENS.FOREST_2)}</table>`,
      }) +
      emailBox({
        title: "Seller don'ts",
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${listRows(donts, '✗', EMAIL_TOKENS.MUTED)}</table>`,
      }) +
      emailButton('Go to Your Dashboard', `${APP_URL}/account/dashboard`) +
      emailFooterNote(`Ready to sell? <a href="${APP_URL}/sell/new" style="color:${EMAIL_TOKENS.FOREST_2};font-weight:600;text-decoration:underline;">Create your first listing</a>.`)

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to,
      subject: `You're approved to sell, ${name}!`,
      html: emailShell({
        preview: 'Your seller application is approved — your access is live.',
        icon: 'sale',
        heading: `Congratulations, ${escapeHtml(name)}!`,
        body,
      }),
    })

    if (error) {
      console.error('Failed to send approval email:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email service error:', error)
    return { success: false, error }
  }
}

export async function sendApplicationRejectedEmail({
  to,
  name,
  displayName,
  reason,
}: {
  to: string
  name: string
  displayName: string
  reason: string
}) {
  try {
    const body =
      emailText(`Hi ${escapeHtml(name)}, we reviewed your seller application for <strong style="color:${EMAIL_TOKENS.INK};">&ldquo;${escapeHtml(displayName)}&rdquo;</strong> and we're not able to approve it right now.`) +
      emailBox({ title: 'Why', html: `<span style="overflow-wrap:anywhere;">${escapeHtml(reason)}</span>` }) +
      emailBox({
        accent: true,
        title: 'What you can do',
        html: `Take a look at the feedback above, sort out what's mentioned, and submit a fresh application — we'd genuinely like to have you.`,
      }) +
      emailButton('Apply Again', `${APP_URL}/account/become-seller`) +
      emailFooterNote(`Questions? Just reply to this email.`)

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to,
      subject: 'An update on your seller application',
      html: emailShell({
        preview: 'An update on your DropMarket seller application.',
        icon: 'rejected',
        heading: `Hi ${escapeHtml(name)}`,
        body,
      }),
    })

    if (error) {
      console.error('Failed to send rejection email:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email service error:', error)
    return { success: false, error }
  }
}

export async function sendInfoRequestedEmail({
  to,
  name,
  displayName,
  message,
}: {
  to: string
  name: string
  displayName: string
  message: string
}) {
  try {
    const body =
      emailText(`Hi ${escapeHtml(name)} — we're reviewing your seller application for <strong style="color:${EMAIL_TOKENS.INK};">&ldquo;${escapeHtml(displayName)}&rdquo;</strong> and need a little more from you to move forward.`) +
      emailBox({
        accent: true,
        title: 'Message from our review team',
        html: `<span style="white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(message)}</span>`,
      }) +
      emailButton('View Application Status', `${APP_URL}/account/seller-status`) +
      emailFooterNote(`Please reply within 7 days so we can keep things moving.`)

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to,
      subject: 'We need a bit more to finish your application',
      html: emailShell({
        preview: 'We need a little more information for your seller application.',
        icon: 'application',
        heading: 'One quick thing',
        body,
      }),
    })

    if (error) {
      console.error('Failed to send info request email:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email service error:', error)
    return { success: false, error }
  }
}

// ============================================
// DISPUTE EMAILS (Used in Part 4)
// ============================================

export async function sendDisputeOpenedEmail({
  to,
  name,
  disputeId,
  orderId,
  role,
  reason,
}: {
  to: string
  name: string
  /** Human order reference (e.g. DM-ABCD-EFGH; older orders GV-123456) shown in the email. */
  disputeId: string
  /** Order UUID — the CTA links to the order page (no public /disputes route). */
  orderId: string
  role: 'buyer' | 'seller'
  reason: string
}) {
  const subject = role === 'buyer'
    ? 'Your dispute has been submitted'
    : 'A dispute needs your attention'

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject,
    html: emailShell({
      preview: `Order #${disputeId} — we'll review this dispute within 24–48 hours.`,
      icon: 'dispute',
      heading: role === 'buyer' ? 'Your dispute is open' : 'A dispute needs your attention',
      body:
        emailText(`Hi ${escapeHtml(name)} — our team will review this within 24&ndash;48 hours. Add any evidence you have in the order chat so we can sort it fairly.`) +
        emailOrderSummary([
          ['Order reference', `#${escapeHtml(disputeId)}`],
          ['Reason', escapeHtml(reason)],
        ]) +
        emailButton('View Order & Dispute', `${APP_URL}/account/orders/${orderId}`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendDisputeResolvedEmail({
  to,
  name,
  disputeId,
  orderId,
  resolution,
  amount,
}: {
  to: string
  name: string
  disputeId: string
  /** Order UUID — CTA links to the order page (no public /disputes route). */
  orderId?: string
  resolution: string
  amount?: number
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: 'Your dispute has been resolved',
    html: emailShell({
      preview: `Your dispute has been resolved.`,
      icon: 'dispute',
      heading: 'Dispute resolved',
      body:
        emailText(`Hi ${escapeHtml(name)} — your dispute (${escapeHtml(disputeId.slice(0, 8))}) has been resolved.`) +
        emailOrderSummary(
          amount
            ? [
                ['Resolution', escapeHtml(resolution.replace(/_/g, ' '))],
                ['Refund amount', `$${amount.toFixed(2)}`],
              ]
            : [['Resolution', escapeHtml(resolution.replace(/_/g, ' '))]],
        ) +
        emailButton('View Details', `${APP_URL}${orderId ? `/account/orders/${orderId}` : '/account/orders'}`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

// ============================================
// ORDER EMAILS
// ============================================

export async function sendNewOrderNotificationEmail({
  to,
  sellerName,
  buyerName,
  listingTitle,
  gameSlug,
  quantity,
  totalAmount,
  sellerPayout,
  orderId,
  orderNumber,
}: {
  to: string
  sellerName: string
  buyerName: string
  listingTitle: string
  /** Game slug — drives the item-row logo. Optional; falls back to a neutral mark. */
  gameSlug?: string | null
  quantity: number
  totalAmount: number
  sellerPayout: number
  orderId: string
  orderNumber?: string
}) {
  const displayOrderId = orderNumber || orderId.slice(0, 8).toUpperCase()
  const orderUrl = `${APP_URL}/account/orders/${orderId}`

  const body =
    emailText(`Nice one, ${escapeHtml(sellerName)} — <strong class="dm-strong" style="color:${EMAIL_TOKENS.INK};">${escapeHtml(buyerName)}</strong> just bought your listing.`) +
    emailDetail('Quantity', `x${quantity}`) +
    emailDetail('Order total', `$${totalAmount.toFixed(2)}`) +
    emailDetailAccent('Your payout', `$${sellerPayout.toFixed(2)}`) +
    emailItemRow({
      gameLogoUrl: gameLogoUrl(gameSlug),
      itemName: escapeHtml(listingTitle),
      subline: `Order #${displayOrderId}`,
    }) +
    emailText(`Deliver the item from your order page — you get paid the moment they confirm, or automatically when the protection window closes.`) +
    emailButton('View Order & Deliver →', orderUrl) +
    emailFooterNote(`Need a hand? Just reply to this email — a real person reads it.`)

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: `You made a sale — ${listingTitle}`,
    html: emailShell({
      preview: `${buyerName} bought your listing. Your payout: $${sellerPayout.toFixed(2)}.`,
      icon: 'sale',
      heading: 'You Made A Sale',
      body,
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

// ============================================
// ORDER EMAILS
// ============================================

export async function sendOrderCompletionEmail({
  to,
  name,
  orderId,
  orderNumber,
  listingTitle,
  gameSlug,
  totalPaid,
  autoReleased = false,
}: {
  to: string
  name: string
  orderId: string
  orderNumber: string
  listingTitle: string
  gameSlug?: string | null
  totalPaid: number
  /** True when the protection window expired without buyer confirmation. */
  autoReleased?: boolean
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    // Trustpilot Automatic Feedback Service: BCC'ing the unique AFS address
    // makes Trustpilot send this buyer a verified-review invitation ~7 days
    // later (free-plan feature, no API needed). Inactive when env is unset.
    ...(process.env.TRUSTPILOT_BCC_EMAIL ? { bcc: process.env.TRUSTPILOT_BCC_EMAIL } : {}),
    subject: `Order complete — ${listingTitle}`,
    html: emailShell({
      preview: `Your order #${orderNumber} is complete.`,
      icon: 'ordered',
      heading: 'Order Complete',
      body:
        emailText(
          autoReleased
            ? `Hi ${escapeHtml(name)} — your protection window ended with no issues reported, so this order completed automatically.`
            : `Thanks, ${escapeHtml(name)} — you've confirmed delivery, and your order is all wrapped up.`,
        ) +
        emailDetail('Total paid', `$${totalPaid.toFixed(2)}`) +
        emailItemRow({ gameLogoUrl: gameLogoUrl(gameSlug), itemName: escapeHtml(listingTitle), subline: `Order #${orderNumber}` }) +
        emailText(
          autoReleased
            ? `This order was covered by SafeDrop for its full protection window — the window has closed and the order is complete.`
            : `This order was covered by SafeDrop from checkout until you confirmed delivery — the order is now complete.`,
        ) +
        emailButton('View Your Order →', `${APP_URL}/account/orders/${orderId}`) +
        emailFooterNote(`Questions about this order? Just reply — a real person reads it.`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendOrderPaidEmail({
  to,
  name,
  orderId,
  orderNumber,
  listingTitle,
  gameSlug,
  totalPaid,
}: {
  to: string
  name: string
  orderId: string
  orderNumber: string
  listingTitle: string
  gameSlug?: string | null
  totalPaid: number
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: `Order confirmed — ${listingTitle}`,
    html: emailShell({
      preview: `Payment confirmed for order #${orderNumber}.`,
      icon: 'ordered',
      heading: 'Payment Received',
      body:
        emailText(`Thanks, ${escapeHtml(name)} — your payment is confirmed and the seller's been told to start delivery.`) +
        emailDetail('Total paid', `$${totalPaid.toFixed(2)}`) +
        emailItemRow({ gameLogoUrl: gameLogoUrl(gameSlug), itemName: escapeHtml(listingTitle), subline: `Order #${orderNumber}` }) +
        emailText(`You're covered by SafeDrop Buyer Protection — Item Guaranteed or Full Refund. If it never arrives, you get a full refund.`) +
        emailButton('Track Your Order →', `${APP_URL}/account/orders/${orderId}`) +
        emailFooterNote(`Questions about this order? Just reply — a real person reads it.`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendOrderDeliveredEmail({
  to,
  name,
  orderId,
  orderNumber,
  listingTitle,
  gameSlug,
  windowHours,
  confirmBy,
}: {
  to: string
  name: string
  orderId: string
  orderNumber: string
  listingTitle: string
  gameSlug?: string | null
  windowHours: number
  /** ISO timestamp when the protection window auto-releases. */
  confirmBy: string
}) {
  const confirmByText = new Date(confirmBy).toUTCString().replace(' GMT', ' UTC')
  const windowText =
    windowHours % 24 === 0 ? `${windowHours / 24} day${windowHours === 24 ? '' : 's'}` : `${windowHours} hours`

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: `Your order was delivered — confirm receipt`,
    html: emailShell({
      preview: `The seller delivered order #${orderNumber} — please confirm.`,
      icon: 'delivered',
      heading: 'Order Delivered',
      body:
        emailText(`Hi ${escapeHtml(name)} — the seller marked your order as delivered. Have a quick check that you got everything as described.`) +
        emailItemRow({ gameLogoUrl: gameLogoUrl(gameSlug), itemName: escapeHtml(listingTitle), subline: `Order #${orderNumber}` }) +
        emailBox({
          accent: true,
          title: 'Your protection window',
          html: `<strong class="dm-strong" style="color:${EMAIL_TOKENS.INK};">${windowText}</strong> — until ${confirmByText}.<br>Confirm receipt once you're happy, or open a dispute if something's off. Do nothing and the order completes automatically when the window ends.`,
        }) +
        emailButton('Review & Confirm Delivery →', `${APP_URL}/account/orders/${orderId}`) +
        emailFooterNote(`Something not right? <a href="${APP_URL}/account/orders/${orderId}" style="color:${EMAIL_TOKENS.FOREST_2};font-weight:600;text-decoration:underline;">Open a dispute</a> before the window closes — SafeDrop has you covered.`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendOrderRefundedEmail({
  to,
  name,
  orderNumber,
  listingTitle,
  gameSlug,
  amount,
  destination,
  pending = false,
}: {
  to: string
  name: string
  orderNumber: string
  listingTitle: string
  gameSlug?: string | null
  amount: number
  /** Where the money went, e.g. 'your original payment method'. */
  destination: string
  /** True when no automatic refund rail ran (e.g. crypto payment) and
   *  support will arrange the refund — the email must not claim the
   *  money already moved. */
  pending?: boolean
}) {
  // Store-credit refunds land instantly; only external rails have the
  // 5–10 business day caveat.
  const toWallet = destination.toLowerCase().includes('wallet')
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: pending
      ? `Order cancelled — refund being arranged (#${orderNumber})`
      : `Refund processed — order #${orderNumber}`,
    html: emailShell({
      preview: pending ? `Your refund for order #${orderNumber} is being arranged.` : `$${amount.toFixed(2)} refunded for order #${orderNumber}.`,
      icon: 'refunded',
      heading: pending ? 'Order Cancelled' : 'Refund Processed',
      body:
        emailText(
          pending
            ? `Hi ${escapeHtml(name)} — your order was cancelled, and our team is arranging your refund per the Refund &amp; Dispute Policy.`
            : `Hi ${escapeHtml(name)} — your order was cancelled and refunded.`,
        ) +
        emailDetail('Refund amount', `$${amount.toFixed(2)}`) +
        (pending ? '' : emailDetail('Refunded to', destination)) +
        emailItemRow({ gameLogoUrl: gameLogoUrl(gameSlug), itemName: escapeHtml(listingTitle), subline: `Order #${orderNumber}` }) +
        (!pending && toWallet ? emailButton('Go to Your Wallet →', `${APP_URL}/account/wallet`) : '') +
        emailText(
          pending
            ? `You'll get a confirmation the moment your refund is issued. Any questions in the meantime, support is one click away.`
            : toWallet
              ? `Your store credit is available instantly — spend it on your next order or withdraw it from your wallet.`
              : `Refunds to a payment method usually arrive within 5&ndash;10 business days, depending on your provider.`,
        ),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendOrderCompletedSellerEmail({
  to,
  name,
  orderId,
  orderNumber,
  listingTitle,
  gameSlug,
  payout,
  autoReleased = false,
}: {
  to: string
  name: string
  orderId: string
  orderNumber: string
  listingTitle: string
  gameSlug?: string | null
  payout: number
  autoReleased?: boolean
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: `Sale complete — $${payout.toFixed(2)} added to your balance`,
    html: emailShell({
      preview: `+$${payout.toFixed(2)} added to your seller balance.`,
      icon: 'payout',
      heading: 'Sale Complete',
      body:
        emailText(
          autoReleased
            ? `Hi ${escapeHtml(name)} — the protection window closed with no issues, so this sale completed automatically.`
            : `Hi ${escapeHtml(name)} — the buyer confirmed delivery. This one's done.`,
        ) +
        emailItemRow({ gameLogoUrl: gameLogoUrl(gameSlug), itemName: escapeHtml(listingTitle), subline: `Order #${orderNumber}` }) +
        emailBox({
          accent: true,
          html: `<div style="text-align:center;"><div class="dm-accent" style="font-size:22px;font-weight:800;color:${EMAIL_TOKENS.FOREST_2};">+$${payout.toFixed(2)}</div><div class="dm-body" style="font-size:12.5px;color:${EMAIL_TOKENS.INK_2};margin-top:4px;">added to your seller balance — withdraw any time</div></div>`,
        }) +
        emailButton('View Order →', `${APP_URL}/account/orders/${orderId}`) +
        emailFooterNote(`Withdraw any time from your <a href="${APP_URL}/account/wallet" style="color:${EMAIL_TOKENS.FOREST_2};font-weight:600;text-decoration:underline;">wallet</a> once you hit the payout minimum.`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

// ============================================
// LISTING MODERATION EMAILS
// ============================================

export async function sendListingApprovedEmail({
  to,
  name,
  listingTitle,
  listingPath,
}: {
  to: string
  name: string
  listingTitle: string
  /** Site-relative path to the live listing (falls back to seller listings). */
  listingPath?: string
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: `Your listing is live — ${listingTitle}`,
    html: emailShell({
      preview: `${listingTitle} passed review and is live.`,
      icon: 'listinglive',
      heading: 'Your listing is live',
      body:
        emailText(`Hi ${escapeHtml(name)} — <strong style="color:${EMAIL_TOKENS.INK};">${escapeHtml(listingTitle)}</strong> passed review and is now live for buyers.`) +
        emailButton('View Your Listing', `${APP_URL}${listingPath || '/account/listings'}`) +
        emailFooterNote(`Manage all your offers from your <a href="${APP_URL}/account/listings" style="color:${EMAIL_TOKENS.FOREST_2};font-weight:600;text-decoration:underline;">seller dashboard</a>.`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendListingRejectedEmail({
  to,
  name,
  listingTitle,
  reason,
  changesRequested = false,
}: {
  to: string
  name: string
  listingTitle: string
  reason: string
  /** True when the moderator asked for edits rather than rejecting outright. */
  changesRequested?: boolean
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: changesRequested
      ? `Changes requested — ${listingTitle}`
      : `Listing not approved — ${listingTitle}`,
    html: emailShell({
      preview: changesRequested ? `${listingTitle} needs a few changes.` : `${listingTitle} didn't pass review.`,
      icon: changesRequested ? 'changes' : 'rejected',
      heading: changesRequested ? 'A few changes needed' : 'Listing not approved',
      body:
        emailText(`Hi ${escapeHtml(name)} — <strong style="color:${EMAIL_TOKENS.INK};">${escapeHtml(listingTitle)}</strong> ${changesRequested ? 'needs a few tweaks before it can go live.' : "didn't pass review this time."}`) +
        emailBox({ title: changesRequested ? 'What to change' : 'Why', html: `<span style="overflow-wrap:anywhere;">${escapeHtml(reason)}</span>` }) +
        emailButton(changesRequested ? 'Edit Your Listing' : 'Review Your Listings', `${APP_URL}/account/listings`) +
        emailFooterNote(`Questions about moderation? Just reply to this email.`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

// ============================================
// PAYOUT & ACCOUNT EMAILS
// ============================================

/**
 * Generic ad-hoc notice from the admin team to a user (seller-management
 * hub "Send Email"). Subject and body are admin-typed free text — escaped,
 * with newlines preserved as line breaks.
 */
export async function sendAdminNoticeEmail({
  to,
  name,
  subject,
  bodyText,
}: {
  to: string
  name: string
  /** Email subject line (plain text). */
  subject: string
  /** Plain-text body — escaped; newlines become <br>. */
  bodyText: string
}) {
  const safeBody = escapeHtml(bodyText).replace(/\r?\n/g, '<br>')
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject,
    html: emailShell({
      preview: `A message from the DropMarket team.`,
      icon: 'notice',
      heading: 'A note from DropMarket',
      body:
        emailText(`Hi ${escapeHtml(name)},`) +
        emailText(`<span style="overflow-wrap:anywhere;">${safeBody}</span>`) +
        emailFooterNote(`Questions? Just reply to this email — it reaches our support team.`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendWithdrawalProcessedEmail({
  to,
  name,
  amount,
  method,
  status,
  reason,
  txReference,
  net,
  fee,
}: {
  to: string
  name: string
  amount: number
  /** Display name of the withdrawal method, e.g. 'Bank Transfer'. */
  method: string
  status: 'requested' | 'approved' | 'rejected' | 'completed'
  /** Rejection reason (required when status is 'rejected'). */
  reason?: string
  /** On-chain tx hash / Payoneer reference (shown when status is 'completed'). */
  txReference?: string
  /** PR 7: the quoted net / fee, shown when known. */
  net?: number
  fee?: number
}) {
  const requested = status === 'requested'
  const approved = status === 'approved'
  const completed = status === 'completed'
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: completed
      ? `Withdrawal sent — $${(net ?? amount).toFixed(2)} paid out`
      : approved
        ? `Withdrawal approved — $${(net ?? amount).toFixed(2)} on the way`
        : requested
          ? `Withdrawal requested — $${amount.toFixed(2)}`
          : `Withdrawal request declined`,
    html: emailShell({
      preview: completed
        ? `$${(net ?? amount).toFixed(2)} has been sent to your ${method}.`
        : approved
          ? `$${(net ?? amount).toFixed(2)} is on the way to your ${method}.`
          : requested
            ? `We received your withdrawal request for $${amount.toFixed(2)}.`
            : `We couldn't process your withdrawal this time.`,
      icon: completed || approved || requested ? 'payout' : 'rejected',
      heading: completed ? 'Withdrawal sent' : approved ? 'Withdrawal approved' : requested ? 'Withdrawal requested' : 'Withdrawal declined',
      body:
        emailText(
          completed
            ? `Hi ${escapeHtml(name)} — your withdrawal has been sent to your payout method. Depending on the method, it can take a little while to land.`
            : approved
              ? `Hi ${escapeHtml(name)} — your withdrawal is approved and on its way to your payout method.`
              : requested
                ? `Hi ${escapeHtml(name)} — we received your withdrawal request. The amount is set aside from your balance while our team reviews it, usually within 1&ndash;2 business days.`
                : `Hi ${escapeHtml(name)} — we couldn't process your withdrawal this time. Your funds stay safe in your seller balance.`,
        ) +
        emailOrderSummary([
          ['Amount', `$${amount.toFixed(2)}`],
          ...(fee != null ? ([['Fee', `-$${fee.toFixed(2)}`]] as [string, string][]) : []),
          ...(net != null ? ([['You receive', `$${net.toFixed(2)}`]] as [string, string][]) : []),
          ['Method', escapeHtml(method)],
          ...(completed && txReference
            ? ([['Reference', escapeHtml(txReference)]] as [string, string][])
            : []),
        ]) +
        (!approved && !completed && !requested && reason ? emailBox({ title: 'Why', html: `<span style="overflow-wrap:anywhere;">${escapeHtml(reason)}</span>` }) : '') +
        emailButton('View Your Wallet', `${APP_URL}/account/wallet`) +
        emailFooterNote(
          completed
            ? `Sent from our side — arrival depends on your payout method, usually within 1&ndash;5 business days.`
            : approved
              ? `Arrival depends on your payout method — usually 1&ndash;5 business days.`
              : requested
                ? `Changed your mind? You can cancel the request from your wallet while it is pending.`
                : `Questions? Just reply to this email.`,
        ),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendGuestWelcomeEmail({
  to,
  orderNumber,
  orderId,
}: {
  to: string
  orderNumber: string
  orderId: string
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: `Track your order #${orderNumber} on DropMarket`,
    html: emailShell({
      preview: `We set up an account so you can track order #${orderNumber}.`,
      icon: 'welcome',
      heading: 'Welcome to DropMarket',
      body:
        emailText(`We set up an account for this email so you can track order <strong style="color:${EMAIL_TOKENS.INK};">#${orderNumber}</strong>, chat with your seller, and get delivery updates.`) +
        emailBox({
          html: `We've also sent a separate email with a <strong style="color:${EMAIL_TOKENS.INK};">password setup link</strong> — click it to claim your account. If it expires, just use &ldquo;Forgot?&rdquo; on the login page.`,
        }) +
        emailButton('Track Your Order', `${APP_URL}/account/orders/${orderId}`) +
        emailFooterNote(`Didn't buy anything on DropMarket? Just reply and let us know.`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendNewMessageEmail({
  to,
  name,
  senderName,
  orderNumber,
  orderId,
  preview,
}: {
  to: string
  name: string
  senderName: string
  orderNumber: string
  orderId: string
  /** First ~120 chars of the message body. */
  preview: string
}) {
  const truncated = preview.length > 120 ? `${preview.slice(0, 117)}...` : preview
  const body =
    emailText(`Hi ${escapeHtml(name)}, <strong style="color:${EMAIL_TOKENS.INK};">${escapeHtml(senderName)}</strong> just messaged you about order <strong style="color:${EMAIL_TOKENS.INK};">#${orderNumber}</strong>:`) +
    emailBox({ html: `<span style="font-style:italic;overflow-wrap:anywhere;">&ldquo;${escapeHtml(truncated)}&rdquo;</span>` }) +
    emailButton('Reply Now', `${APP_URL}/account/orders/${orderId}`) +
    emailFooterNote(`We only email you for the first unread message in a chat, so replies won't flood your inbox.`)

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: `${senderName} messaged you about order #${orderNumber}`,
    html: emailShell({
      preview: `${senderName}: ${truncated}`,
      icon: 'message',
      heading: 'You have a new message',
      body,
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

// ============================================
// TRUSTPILOT EMAILS
// ============================================

export async function sendTrustpilotInvitationEmail({
  to,
  name,
  orderId,
  reviewUrl,
}: {
  to: string
  name: string
  orderId: string
  reviewUrl: string
}) {
  const shortOrderId = orderId.slice(0, 8).toUpperCase()

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: `How was your DropMarket order, ${name}?`,
    html: emailShell({
      preview: `Your review helps other gamers shop safely — 60 seconds.`,
      icon: 'star',
      heading: `How was it, ${escapeHtml(name)}?`,
      body:
        emailText(`We hope your order went great. A quick, honest review helps other gamers shop safely — and it recognises the sellers doing good work.`) +
        emailOrderSummary([['Order reference', `#${shortOrderId}`]]) +
        emailButton('Write a Review on Trustpilot', reviewUrl) +
        emailFooterNote(`It takes less than 60 seconds and means the world to us.`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

// ============================================
// FOUNDING-SELLER WAITLIST (beta)
// ============================================

/**
 * Where new founding-seller signups are announced. Defaults to the monitored
 * support inbox — the same alias every transactional email already replies to.
 */
const EARLY_SELLER_NOTIFY_TO =
  process.env.EARLY_SELLER_NOTIFY_TO || 'support@dropmarket.gg'

/**
 * Founding-seller DISCORD invite — the second of the two emails a new signup
 * gets (the first being their personal Founding HQ magic-link). Single, focused
 * purpose: get them into the founding Discord so they can ask questions and hear
 * updates while they set up. Deliberately NOT a "you're on the list" email —
 * the HQ invite already welcomes them; this one just opens the community door.
 */
export async function sendEarlySellerDiscordInviteEmail({
  to,
  username,
}: {
  to: string
  username: string
}) {
  const safeUsername = escapeHtml(username)

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: `Join the founding-seller Discord, ${username}`,
    html: emailShell({
      preview: `Come meet the other founding sellers on Discord.`,
      icon: 'welcome',
      heading: `Come Say Hi On Discord`,
      body:
        emailText(`Hey ${safeUsername} — while you get your storefront set up, come join the other founding sellers in our Discord. It's the fastest way to get help, hear about first-access drops, and talk pricing with people selling the same games.`) +
        emailButton('Join the Founding Discord', DISCORD_INVITE_URL) +
        emailFooterNote(`Already checked your inbox for your Founding HQ link? That's the one that opens your seller setup. See you inside.`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

/**
 * @deprecated Renamed to sendEarlySellerDiscordInviteEmail. Kept as a thin alias
 * so any older caller keeps compiling; new code should call the Discord invite.
 */
export const sendEarlySellerWelcomeEmail = sendEarlySellerDiscordInviteEmail

/**
 * Personalized "claim your spot" email — the entry point into the Founding
 * Seller HQ. Sent 1:1 to a waitlist applicant; the CTA is their private
 * magic-link (id + HMAC token) into /founding, where they see their status,
 * notices, perks, and the door to start selling. Discord is a secondary CTA so
 * this is one of the three founding Discord touchpoints (submit + email + HQ).
 *
 * The caller builds `hqUrl` (via foundingTokenFor + the app origin); this
 * function only renders + sends, so the token secret never touches email code.
 */
export async function sendFoundingHqInviteEmail({
  to,
  username,
  hqUrl,
  joinNumber,
}: {
  to: string
  username: string
  hqUrl: string
  /** Their founding number, if known — e.g. 12 → "you're founder #12". */
  joinNumber?: number
}) {
  const safeUsername = escapeHtml(username)
  const rank = joinNumber
    ? `You're founding seller <strong style="color:${EMAIL_TOKENS.INK};">#${joinNumber}</strong> — one of the first hundred on DropMarket.`
    : `You're one of the first hundred sellers on DropMarket.`

  // Point 1 — the application/HQ magic-link, framed as an approval moment.
  const point1 =
    emailNumberedBlock({
      n: 1,
      title: 'Your Founding Seller application is ready',
      html:
        `Everything's set on our side. Open your private setup page to pick your store name, get verified, and post your first listing — you get ${FOUNDING_FEE_PERK_SENTENCE} and a founding badge on your storefront.` +
        emailButton('Open My Seller Setup', hqUrl),
    })

  // Point 2 — the Discord invite, with the blurple logo tile.
  const point2 = emailDiscordBlock({
    n: 2,
    title: "Join DropMarket's Discord",
    html: `Meet the other founding sellers, ask us anything, and get first word on drops and price news. It's the fastest way to get going.`,
    href: DISCORD_INVITE_URL,
  })

  const body =
    emailText(`Hi ${safeUsername}, thanks for putting your name in as a founding seller. ${rank} Here's how to get set up:`) +
    point1 +
    point2 +
    emailFooterNote(`This setup link is personal to you — please don't forward it. Questions? Just reply to this email and a real person will help.`)

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: `DropMarket — Your Founding Seller Application Is Ready`,
    html: emailShell({
      preview: 'Your seller setup is ready — open it to claim your store and start selling.',
      icon: 'founding',
      heading: `You're In, ${safeUsername}`,
      body,
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

/**
 * A numbered step block for the founding email — a lime number chip + a bold
 * title + body/CTA, in a soft card. Keeps the "two clear points" layout tidy.
 */
function emailNumberedBlock({ n, title, html }: { n: number; title: string; html: string }): string {
  const { FOREST, LIME, INK, INK_2, LINE, FONT } = EMAIL_TOKENS
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 16px;"><tr>
    <td class="dm-thumbrow" style="background:#F7F8F3;border:1px solid ${LINE};border-radius:12px;padding:18px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;padding-right:12px;">
          <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;background:${LIME};color:${FOREST};font-family:${FONT};font-weight:800;font-size:14px;">${n}</span>
        </td>
        <td style="vertical-align:top;">
          <p class="dm-strong" style="margin:2px 0 6px;font-family:${FONT};font-size:15.5px;font-weight:700;color:${INK};">${title}</p>
          <div class="dm-body" style="font-family:${FONT};font-size:14px;line-height:1.6;color:${INK_2};">${html}</div>
        </td>
      </tr></table>
    </td>
  </tr></table>`
}

/**
 * The Discord invite block — a blurple logo tile, title/body, and a blurple
 * "Join" button so it reads unmistakably as Discord.
 */
function emailDiscordBlock({ n, title, html, href }: { n: number; title: string; html: string; href: string }): string {
  const { INK, INK_2, LINE, LIME, FOREST, FONT, APP_URL } = EMAIL_TOKENS
  const BLURPLE = '#5865F2'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 16px;"><tr>
    <td class="dm-thumbrow" style="background:#F7F8F3;border:1px solid ${LINE};border-radius:12px;padding:18px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;padding-right:12px;">
          <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;background:${LIME};color:${FOREST};font-family:${FONT};font-weight:800;font-size:14px;">${n}</span>
        </td>
        <td style="vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr>
            <td style="padding-right:10px;vertical-align:middle;">
              <img src="${EMAIL_TOKENS.ASSET_URL}/email-icons/discord.png" width="34" height="34" alt="Discord" style="display:block;width:34px;height:34px;border-radius:9px;">
            </td>
            <td style="vertical-align:middle;">
              <p class="dm-strong" style="margin:0;font-family:${FONT};font-size:15.5px;font-weight:700;color:${INK};">${title}</p>
            </td>
          </tr></table>
          <div class="dm-body" style="font-family:${FONT};font-size:14px;line-height:1.6;color:${INK_2};margin:0 0 12px;">${html}</div>
          <a href="${href}" style="display:inline-block;background:${BLURPLE};color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-family:${FONT};font-weight:700;font-size:13.5px;">Join the Discord</a>
        </td>
      </tr></table>
    </td>
  </tr></table>`
}

/** Internal ping so a new waitlist signup doesn't need the admin table polled. */
export async function sendEarlySellerAdminNotificationEmail({
  username,
  email,
  discord,
  sells,
  note,
}: {
  username: string
  email: string
  discord?: string | null
  sells?: string | null
  note?: string | null
}) {
  // Every field here is attacker-controlled free text from a public form.
  const rows: Array<[string, string]> = [['Username', escapeHtml(username)], ['Email', escapeHtml(email)]]
  if (discord) rows.push(['Discord', escapeHtml(discord)])
  if (sells) rows.push(['Sells', escapeHtml(sells)])
  if (note) rows.push(['Note', escapeHtml(note)])

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to: EARLY_SELLER_NOTIFY_TO,
    subject: `New founding-seller signup: ${username}`,
    html: emailShell({
      preview: `New waitlist entry: ${username}`,
      icon: 'founding',
      heading: 'New founding-seller signup',
      body:
        emailText(`A new waitlist entry was added to the Founding Sellers table.`) +
        emailOrderSummary(rows) +
        emailButton('Open Founding Sellers', `${APP_URL}/admin/early-sellers`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

/**
 * PR 7 — halfway reminder inside the SafeDrop Protection window. Sent at most
 * once per order (the claim is atomic in order_confirm_reminders_claim).
 */
export async function sendOrderConfirmReminderEmail({
  to,
  name,
  orderId,
  orderNumber,
  listingTitle,
  gameSlug,
  autoCompleteAt,
}: {
  to: string
  name: string
  orderId: string
  orderNumber: string
  listingTitle: string
  gameSlug?: string | null
  /** ISO timestamp when the order completes automatically. */
  autoCompleteAt: string
}) {
  const completesText = new Date(autoCompleteAt).toUTCString().replace(' GMT', ' UTC')

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: `Did you receive order #${orderNumber}? Please confirm`,
    html: emailShell({
      preview: `A quick check on order #${orderNumber} — confirm receipt or tell us what went wrong.`,
      icon: 'delivered',
      heading: 'Please confirm your order',
      body:
        emailText(`Hi ${escapeHtml(name)} — the seller marked order #${orderNumber} as delivered a little while ago. If everything arrived as described, please confirm receipt to complete the order.`) +
        emailItemRow({ gameLogoUrl: gameLogoUrl(gameSlug), itemName: escapeHtml(listingTitle), subline: `Order #${orderNumber}` }) +
        emailBox({
          accent: true,
          title: 'SafeDrop Protection',
          html: `You are covered until <strong class="dm-strong" style="color:${EMAIL_TOKENS.INK};">${completesText}</strong>. If you do nothing, the order completes automatically then. Something not right? Open a dispute from the order page before that time and we will look into it for you.`,
        }) +
        emailButton('Confirm Receipt →', `${APP_URL}/account/orders/${orderId}`) +
        emailFooterNote(`Not what you ordered? <a href="${APP_URL}/account/orders/${orderId}" style="color:${EMAIL_TOKENS.FOREST_2};font-weight:600;text-decoration:underline;">Open a dispute</a> — Item Guaranteed or Full Refund.`),
    }),
  })

  return error ? { success: false, error } : { success: true, data }
}

/**
 * PR 7 — payout details changed (security notice). Withdrawals are paused
 * for the freeze window so the account owner can react to an unexpected change.
 */
export async function sendPayoutDetailsChangedEmail({
  to,
  name,
  kind,
  summary,
  freezeUntil,
}: {
  to: string
  name: string
  kind: 'crypto' | 'payoneer'
  /** Human summary of the new destination (masked address / email). */
  summary: string
  /** ISO timestamp when withdrawals reopen, or null when no freeze applies. */
  freezeUntil: string | null
}) {
  const untilText = freezeUntil ? new Date(freezeUntil).toUTCString().replace(' GMT', ' UTC') : null
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to,
    subject: 'Your payout details were changed',
    html: emailShell({
      preview: `Your ${kind === 'crypto' ? 'crypto payout address' : 'Payoneer email'} was updated.`,
      icon: 'payout',
      heading: 'Payout details changed',
      body:
        emailText(`Hi ${escapeHtml(name)} — the ${kind === 'crypto' ? 'crypto payout address' : 'Payoneer email'} on your DropMarket seller account was just updated.`) +
        emailOrderSummary([['New destination', escapeHtml(summary)]]) +
        (untilText
          ? emailBox({
              accent: true,
              title: 'Withdrawals paused briefly',
              html: `For your security, withdrawals are paused until <strong class="dm-strong" style="color:${EMAIL_TOKENS.INK};">${untilText}</strong> whenever payout details change.`,
            })
          : '') +
        emailButton('Review Payout Settings →', `${APP_URL}/account/settings?tab=payouts`) +
        emailFooterNote(`Didn't make this change? Reset your password and <a href="mailto:${REPLY_TO}" style="color:${EMAIL_TOKENS.FOREST_2};font-weight:600;text-decoration:underline;">contact support</a> straight away — nothing can be withdrawn during the pause.`),
    }),
  })
  return error ? { success: false, error } : { success: true, data }
}

/**
 * GRO-08 — after approval, the drafts the applicant built during review were
 * submitted automatically. One email lists what went live / into review and
 * what still needs finishing.
 */
export async function sendApplicantDraftsSubmittedEmail({
  to,
  name,
  submitted,
  skipped,
}: {
  to: string
  name: string
  submitted: Array<{ title: string; status: 'active' | 'pending_approval' }>
  skipped: Array<{ title: string; reason: string }>
}) {
  try {
    const row = (title: string, note: string, color: string) =>
      `<tr><td style="padding:6px 0;font-size:13px;line-height:1.5;color:${EMAIL_TOKENS.INK};border-bottom:1px solid ${EMAIL_TOKENS.LINE};">${escapeHtml(title)}<br><span style="font-size:12px;color:${color};">${escapeHtml(note)}</span></td></tr>`
    const submittedRows = submitted
      .map((s) => row(s.title, s.status === 'active' ? 'Live now' : 'Submitted for review', EMAIL_TOKENS.FOREST_2))
      .join('')
    const skippedRows = skipped.map((s) => row(s.title, `Still a draft — ${s.reason}`, EMAIL_TOKENS.MUTED)).join('')

    const body =
      emailText(
        `Hi ${escapeHtml(name)} — you\'re approved, and the ${submitted.length + skipped.length === 1 ? 'listing' : 'listings'} you drafted while your application was under review ${submitted.length > 0 ? 'went out automatically' : 'are waiting for you'}.`,
      ) +
      (submitted.length > 0
        ? emailBox({ accent: true, title: `Submitted (${submitted.length})`, html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${submittedRows}</table>` })
        : '') +
      (skipped.length > 0
        ? emailBox({ title: `Needs a finishing touch (${skipped.length})`, html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${skippedRows}</table>` })
        : '') +
      emailButton('Open My Listings', `${APP_URL}/account/listings`) +
      emailFooterNote('Listings marked "Submitted for review" go live once our team has checked them.')

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to,
      subject:
        submitted.length > 0
          ? `Your ${submitted.length} draft ${submitted.length === 1 ? 'listing is' : 'listings are'} on their way`
          : 'Your draft listings are waiting for you',
      html: emailShell({
        preview: 'Your drafts from the application period were submitted.',
        icon: 'sale',
        heading: 'Your drafts are moving',
        body,
      }),
    })
    if (error) {
      console.error('Failed to send drafts-submitted email:', error)
      return { success: false, error }
    }
    return { success: true, data }
  } catch (error) {
    console.error('Email service error:', error)
    return { success: false, error }
  }
}
