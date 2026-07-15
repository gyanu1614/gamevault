import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'DropMarket <noreply@dropmarket.gg>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Escape user-supplied text before interpolating into email HTML. Listing
 * titles, usernames and dispute reasons are attacker-controlled — without
 * this a seller could inject markup into buyers' inboxes.
 */
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
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: '🎉 Your Seller Application has been Approved!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
                Drop<span style="color: #a3e635;">Market</span>
              </h1>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 64px;">🎉</span>
            </div>

            <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
              Congratulations, ${escapeHtml(name)}!
            </h2>

            <p style="font-size: 16px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
              Your seller application for <strong style="color: #ffffff;">"${escapeHtml(displayName)}"</strong> has been approved! You can now start listing your gaming items on DropMarket.
            </p>

            <div style="background: rgba(163, 230, 53, 0.08); border: 1px solid rgba(163, 230, 53, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="font-size: 16px; font-weight: 600; color: #a3e635; margin: 0 0 12px 0;">
                ✅ What's Next?
              </h3>
              <ul style="margin: 0; padding-left: 20px; color: #a1a1aa; font-size: 14px; line-height: 1.8;">
                <li>Set up your seller profile</li>
                <li>Create your first listing</li>
                <li>Connect your payment method</li>
                <li>Start selling!</li>
              </ul>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${APP_URL}/seller/dashboard" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
                Go to Seller Dashboard
              </a>
            </div>

            <p style="font-size: 14px; color: #71717a; text-align: center; margin: 0;">
              Welcome to the DropMarket seller community!
            </p>

          </div>

          <p style="font-size: 12px; color: #52525b; text-align: center; margin-top: 24px;">
            © 2026 DropMarket. All rights reserved.
          </p>
        </body>
        </html>
      `,
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
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Update on Your Seller Application - DropMarket',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
                Drop<span style="color: #a3e635;">Market</span>
              </h1>
            </div>

            <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
              Hi ${escapeHtml(name)},
            </h2>

            <p style="font-size: 16px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
              We've reviewed your seller application for <strong style="color: #ffffff;">"${escapeHtml(displayName)}"</strong> and unfortunately, we're unable to approve it at this time.
            </p>

            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="font-size: 16px; font-weight: 600; color: #ef4444; margin: 0 0 12px 0;">
                Reason for Rejection
              </h3>
              <p style="margin: 0; color: #fca5a5; font-size: 14px; line-height: 1.6;">
                ${escapeHtml(reason)}
              </p>
            </div>

            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="font-size: 16px; font-weight: 600; color: #a3e635; margin: 0 0 12px 0;">
                What Can You Do?
              </h3>
              <ul style="margin: 0; padding-left: 20px; color: #a1a1aa; font-size: 14px; line-height: 1.8;">
                <li>Review the feedback above</li>
                <li>Address the issues mentioned</li>
                <li>Submit a new application</li>
              </ul>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${APP_URL}/account/become-seller" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
                Apply Again
              </a>
            </div>

            <p style="font-size: 14px; color: #71717a; text-align: center; margin: 0;">
              If you have questions, please contact our support team.
            </p>

          </div>
        </body>
        </html>
      `,
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
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Action Required: Additional Information Needed - DropMarket',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
                Drop<span style="color: #a3e635;">Market</span>
              </h1>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 64px;">📋</span>
            </div>

            <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
              Hi ${escapeHtml(name)}, We Need More Information
            </h2>

            <p style="font-size: 16px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
              We're reviewing your seller application for <strong style="color: #ffffff;">"${escapeHtml(displayName)}"</strong> and need some additional information to proceed.
            </p>

            <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="font-size: 16px; font-weight: 600; color: #fbbf24; margin: 0 0 12px 0;">
                📝 Message from our Review Team
              </h3>
              <p style="margin: 0; color: #fef3c7; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
                ${escapeHtml(message)}
              </p>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${APP_URL}/seller/application-status" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
                View Application Status
              </a>
            </div>

            <p style="font-size: 14px; color: #71717a; text-align: center; margin: 0;">
              Please respond within 7 days to avoid delays.
            </p>

          </div>
        </body>
        </html>
      `,
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
  /** Human order reference (e.g. GV-123456) shown in the email. */
  disputeId: string
  /** Order UUID — the CTA links to the order page (no public /disputes route). */
  orderId: string
  role: 'buyer' | 'seller'
  reason: string
}) {
  const subject = role === 'buyer'
    ? 'Your Dispute Has Been Submitted - DropMarket'
    : 'A Dispute Has Been Filed Against Your Transaction - DropMarket'

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <h2 style="font-size: 20px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
            Hi ${escapeHtml(name)}, ${role === 'buyer' ? 'Your Dispute Has Been Opened' : 'A Dispute Requires Your Attention'}
          </h2>

          <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; color: #a1a1aa; font-size: 14px;">
              <strong>Order Reference:</strong> #${escapeHtml(disputeId)}
            </p>
            <p style="margin: 0; color: #a1a1aa; font-size: 14px;">
              <strong>Reason:</strong> ${escapeHtml(reason)}
            </p>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
            Our team will review this dispute within 24-48 hours. Please share any additional evidence in the order chat.
          </p>

          <div style="text-align: center;">
            <a href="${APP_URL}/account/orders/${orderId}" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              View Order &amp; Dispute
            </a>
          </div>

        </div>
      </body>
      </html>
    `,
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
    to,
    subject: 'Your Dispute Has Been Resolved - DropMarket',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background: rgba(163, 230, 53, 0.12); border: 1px solid rgba(163, 230, 53, 0.4); font-size: 28px;">&#10003;</div>
          </div>

          <h2 style="font-size: 20px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
            Dispute Resolved
          </h2>

          <p style="font-size: 16px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
            Hi ${escapeHtml(name)}, your dispute (${disputeId.slice(0, 8)}) has been resolved.
          </p>

          <div style="background: rgba(163, 230, 53, 0.08); border: 1px solid rgba(163, 230, 53, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; color: #a3e635; font-size: 16px; font-weight: 600;">
              Resolution: ${resolution.replace(/_/g, ' ')}
            </p>
            ${amount ? `<p style="margin: 0; color: #a1a1aa; font-size: 14px;">Refund Amount: $${amount.toFixed(2)}</p>` : ''}
          </div>

          <div style="text-align: center;">
            <a href="${APP_URL}${orderId ? `/account/orders/${orderId}` : '/account/orders'}" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              View Details
            </a>
          </div>

        </div>
      </body>
      </html>
    `,
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
  quantity: number
  totalAmount: number
  sellerPayout: number
  orderId: string
  orderNumber?: string
}) {
  const displayOrderId = orderNumber || orderId.slice(0, 8).toUpperCase()
  const orderUrl = `${APP_URL}/account/orders/${orderId}`

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `New Order Received — ${listingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 64px;">🛒</span>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 8px 0;">
            New Order Received!
          </h2>
          <p style="font-size: 16px; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            Hi ${escapeHtml(sellerName)}, <strong style="color: #ffffff;">${escapeHtml(buyerName)}</strong> just purchased your listing.
          </p>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Order #</td>
                <td style="color: #ffffff; font-weight: 700; text-align: right; letter-spacing: 1px;">${displayOrderId}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Listing</td>
                <td style="color: #ffffff; text-align: right;">${escapeHtml(listingTitle)}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Quantity</td>
                <td style="color: #ffffff; text-align: right;">${quantity}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Order Total</td>
                <td style="color: #ffffff; text-align: right;">$${totalAmount.toFixed(2)}</td>
              </tr>
              <tr style="border-top: 1px solid rgba(255,255,255,0.1);">
                <td style="color: #a3e635; font-weight: 700; padding: 10px 0 4px 0;">Your Payout</td>
                <td style="color: #a3e635; font-weight: 700; font-size: 18px; text-align: right; padding: 10px 0 4px 0;">$${sellerPayout.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
              <strong style="color: #a3e635;">Next step:</strong> Head to your order dashboard and deliver the item to the buyer. You'll be paid out once the buyer confirms receipt — or automatically when the order's protection window closes.
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${orderUrl}" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              View Order & Deliver
            </a>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            You are receiving this because you are a seller on DropMarket.<br>
            Manage your notifications in <a href="${APP_URL}/account/settings" style="color: #a3e635;">account settings</a>.
          </p>

        </div>
      </body>
      </html>
    `,
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
  totalPaid,
  autoReleased = false,
}: {
  to: string
  name: string
  orderId: string
  orderNumber: string
  listingTitle: string
  totalPaid: number
  /** True when the protection window expired without buyer confirmation. */
  autoReleased?: boolean
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    // Trustpilot Automatic Feedback Service: BCC'ing the unique AFS address
    // makes Trustpilot send this buyer a verified-review invitation ~7 days
    // later (free-plan feature, no API needed). Inactive when env is unset.
    ...(process.env.TRUSTPILOT_BCC_EMAIL ? { bcc: process.env.TRUSTPILOT_BCC_EMAIL } : {}),
    subject: `Order Complete — ${listingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background: rgba(163, 230, 53, 0.12); border: 1px solid rgba(163, 230, 53, 0.4); font-size: 28px;">&#10003;</div>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 12px 0;">
            Order Complete
          </h2>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            ${
              autoReleased
                ? `Hi ${escapeHtml(name)} — your protection window ended with no issues reported, so this order completed automatically.`
                : `Thanks, ${escapeHtml(name)} — you've confirmed delivery, and your order is all wrapped up.`
            }
          </p>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Order</td>
                <td style="color: #ffffff; text-align: right; font-weight: 600;">#${orderNumber}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Item</td>
                <td style="color: #ffffff; text-align: right;">${escapeHtml(listingTitle)}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Total Paid</td>
                <td style="color: #ffffff; text-align: right; font-weight: 600;">$${totalPaid.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            ${
              autoReleased
                ? 'This order was covered by SafeDrop Buyer Protection for its full protection window — the seller is only paid out now that the window has closed.'
                : 'This order was covered by SafeDrop Buyer Protection from checkout until you confirmed delivery — the seller is only paid out now that you have.'
            }
          </p>

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${APP_URL}/account/orders/${orderId}" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              View Your Order
            </a>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            Questions about this order? <a href="${APP_URL}/support" style="color: #a3e635;">Contact support</a>.
          </p>

        </div>
      </body>
      </html>
    `,
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendOrderPaidEmail({
  to,
  name,
  orderId,
  orderNumber,
  listingTitle,
  totalPaid,
}: {
  to: string
  name: string
  orderId: string
  orderNumber: string
  listingTitle: string
  totalPaid: number
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Order Confirmed — ${listingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 12px 0;">
            Payment Received
          </h2>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            Thanks, ${escapeHtml(name)} — your payment is confirmed and the seller has been told to start delivery.
          </p>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Order</td>
                <td style="color: #ffffff; text-align: right; font-weight: 600;">#${orderNumber}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Item</td>
                <td style="color: #ffffff; text-align: right;">${escapeHtml(listingTitle)}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Total Paid</td>
                <td style="color: #ffffff; text-align: right; font-weight: 600;">$${totalPaid.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            You're covered by SafeDrop Buyer Protection — the seller isn't paid out until your order completes, and you're entitled to a full refund if your order never arrives.
          </p>

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${APP_URL}/account/orders/${orderId}" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              Track Your Order
            </a>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            Questions about this order? <a href="${APP_URL}/support" style="color: #a3e635;">Contact support</a>.
          </p>

        </div>
      </body>
      </html>
    `,
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendOrderDeliveredEmail({
  to,
  name,
  orderId,
  orderNumber,
  listingTitle,
  windowHours,
  confirmBy,
}: {
  to: string
  name: string
  orderId: string
  orderNumber: string
  listingTitle: string
  windowHours: number
  /** ISO timestamp when the protection window auto-releases. */
  confirmBy: string
}) {
  const confirmByText = new Date(confirmBy).toUTCString().replace(' GMT', ' UTC')
  const windowText =
    windowHours % 24 === 0 ? `${windowHours / 24} day${windowHours === 24 ? '' : 's'}` : `${windowHours} hours`

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Your Order Was Delivered — Confirm Receipt`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 12px 0;">
            Delivery Marked Complete
          </h2>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            Hi ${escapeHtml(name)} — the seller marked order <strong style="color: #ffffff;">#${orderNumber}</strong> (${escapeHtml(listingTitle)}) as delivered. Please check you received everything as described.
          </p>

          <div style="background: rgba(163, 230, 53, 0.08); border: 1px solid rgba(163, 230, 53, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
            <p style="margin: 0 0 4px 0; color: #a1a1aa; font-size: 13px;">Your Protection Window</p>
            <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600;">${windowText} — until ${confirmByText}</p>
            <p style="margin: 8px 0 0 0; color: #a1a1aa; font-size: 13px; line-height: 1.6;">
              Confirm receipt once you're happy, or open a dispute if something's wrong. If you do nothing, the order completes automatically when the window ends.
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${APP_URL}/account/orders/${orderId}" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              Review &amp; Confirm Delivery
            </a>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            Something not right? <a href="${APP_URL}/account/orders/${orderId}" style="color: #a3e635;">Open a dispute</a> before the window closes — SafeDrop Buyer Protection has you covered.
          </p>

        </div>
      </body>
      </html>
    `,
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendOrderRefundedEmail({
  to,
  name,
  orderNumber,
  listingTitle,
  amount,
  destination,
  pending = false,
}: {
  to: string
  name: string
  orderNumber: string
  listingTitle: string
  amount: number
  /** Where the money went, e.g. 'your original payment method'. */
  destination: string
  /** True when no automatic refund rail ran (e.g. crypto payment) and
   *  support will arrange the refund — the email must not claim the
   *  money already moved. */
  pending?: boolean
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: pending
      ? `Order Cancelled — Refund Being Arranged (#${orderNumber})`
      : `Refund Processed — Order #${orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 12px 0;">
            ${pending ? 'Order Cancelled' : 'Refund Processed'}
          </h2>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            ${
              pending
                ? `Hi ${escapeHtml(name)} — order <strong style="color: #ffffff;">#${orderNumber}</strong> (${escapeHtml(listingTitle)}) has been cancelled, and our team is arranging your refund in line with the Refund &amp; Dispute Policy.`
                : `Hi ${escapeHtml(name)} — order <strong style="color: #ffffff;">#${orderNumber}</strong> (${escapeHtml(listingTitle)}) has been cancelled and refunded.`
            }
          </p>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Refund Amount</td>
                <td style="color: #ffffff; text-align: right; font-weight: 600;">$${amount.toFixed(2)}</td>
              </tr>
              ${
                pending
                  ? ''
                  : `<tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Refunded To</td>
                <td style="color: #ffffff; text-align: right;">${destination}</td>
              </tr>`
              }
            </table>
          </div>

          <p style="font-size: 13px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            ${
              pending
                ? 'You will get a confirmation email as soon as your refund is issued. If you have any questions in the meantime, support is one click away.'
                : 'Refunds to a payment method typically arrive within 5–10 business days depending on your provider.'
            }
          </p>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            Didn't expect this refund? <a href="${APP_URL}/support" style="color: #a3e635;">Contact support</a>.
          </p>

        </div>
      </body>
      </html>
    `,
  })

  return error ? { success: false, error } : { success: true, data }
}

export async function sendOrderCompletedSellerEmail({
  to,
  name,
  orderId,
  orderNumber,
  listingTitle,
  payout,
  autoReleased = false,
}: {
  to: string
  name: string
  orderId: string
  orderNumber: string
  listingTitle: string
  payout: number
  autoReleased?: boolean
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Order Complete — $${payout.toFixed(2)} Payout on the Way`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background: rgba(163, 230, 53, 0.12); border: 1px solid rgba(163, 230, 53, 0.4); font-size: 28px;">&#10003;</div>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 12px 0;">
            Sale Complete
          </h2>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            ${
              autoReleased
                ? `Hi ${escapeHtml(name)} — the protection window on order <strong style="color: #ffffff;">#${orderNumber}</strong> closed with no issues, so it completed automatically.`
                : `Hi ${escapeHtml(name)} — the buyer confirmed delivery on order <strong style="color: #ffffff;">#${orderNumber}</strong>.`
            }
          </p>

          <div style="background: rgba(163, 230, 53, 0.08); border: 1px solid rgba(163, 230, 53, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
            <p style="margin: 0 0 4px 0; color: #a1a1aa; font-size: 13px;">${escapeHtml(listingTitle)}</p>
            <p style="margin: 0; color: #a3e635; font-size: 24px; font-weight: 700;">+$${payout.toFixed(2)}</p>
            <p style="margin: 6px 0 0 0; color: #a1a1aa; font-size: 13px;">${autoReleased ? 'payout being processed' : 'added to your seller balance'}</p>
          </div>

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${APP_URL}/account/orders/${orderId}" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              View Order
            </a>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            Withdraw anytime from your <a href="${APP_URL}/account/wallet" style="color: #a3e635;">wallet</a> once you reach the payout minimum.
          </p>

        </div>
      </body>
      </html>
    `,
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
    to,
    subject: `Your Listing Is Live — ${listingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background: rgba(163, 230, 53, 0.12); border: 1px solid rgba(163, 230, 53, 0.4); font-size: 28px;">&#10003;</div>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 12px 0;">
            Listing Approved
          </h2>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            Hi ${escapeHtml(name)} — <strong style="color: #ffffff;">${escapeHtml(listingTitle)}</strong> passed review and is now live for buyers.
          </p>

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${APP_URL}${listingPath || '/account/listings'}" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              View Your Listing
            </a>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            Manage all your offers from your <a href="${APP_URL}/account/listings" style="color: #a3e635;">seller dashboard</a>.
          </p>

        </div>
      </body>
      </html>
    `,
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
    to,
    subject: changesRequested
      ? `Changes Requested — ${listingTitle}`
      : `Listing Not Approved — ${listingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 12px 0;">
            ${changesRequested ? 'Changes Requested' : 'Listing Not Approved'}
          </h2>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
            Hi ${escapeHtml(name)} — <strong style="color: #ffffff;">${escapeHtml(listingTitle)}</strong> ${changesRequested ? 'needs a few changes before it can go live.' : "didn't pass review this time."}
          </p>

          <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #ef4444; margin: 0 0 8px 0;">
              ${changesRequested ? 'What Needs Changing' : 'Reason'}
            </h3>
            <p style="margin: 0; color: #fca5a5; font-size: 14px; line-height: 1.6;">
              ${escapeHtml(reason)}
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${APP_URL}/account/listings" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              ${changesRequested ? 'Edit Your Listing' : 'Review Your Listings'}
            </a>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            Questions about moderation? <a href="${APP_URL}/support" style="color: #a3e635;">Contact support</a>.
          </p>

        </div>
      </body>
      </html>
    `,
  })

  return error ? { success: false, error } : { success: true, data }
}

// ============================================
// PAYOUT & ACCOUNT EMAILS
// ============================================

export async function sendWithdrawalProcessedEmail({
  to,
  name,
  amount,
  method,
  status,
  reason,
}: {
  to: string
  name: string
  amount: number
  /** Display name of the withdrawal method, e.g. 'Bank Transfer'. */
  method: string
  status: 'approved' | 'rejected'
  /** Rejection reason (required when status is 'rejected'). */
  reason?: string
}) {
  const approved = status === 'approved'
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: approved
      ? `Withdrawal Approved — $${amount.toFixed(2)} on the Way`
      : `Withdrawal Request Declined`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 12px 0;">
            ${approved ? 'Withdrawal Approved' : 'Withdrawal Declined'}
          </h2>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
            ${
              approved
                ? `Hi ${escapeHtml(name)} — your withdrawal has been approved and is being processed to your payout method.`
                : `Hi ${escapeHtml(name)} — we couldn't process your withdrawal request this time. The funds remain in your seller balance.`
            }
          </p>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Amount</td>
                <td style="color: #ffffff; text-align: right; font-weight: 600;">$${amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Method</td>
                <td style="color: #ffffff; text-align: right;">${escapeHtml(method)}</td>
              </tr>
            </table>
          </div>

          ${
            !approved && reason
              ? `<div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="margin: 0; color: #fca5a5; font-size: 14px; line-height: 1.6;"><strong style="color: #ef4444;">Reason:</strong> ${escapeHtml(reason)}</p>
          </div>`
              : ''
          }

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${APP_URL}/account/wallet" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              View Your Wallet
            </a>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            ${approved ? 'Arrival time depends on your payout method — typically 1–5 business days.' : `Questions? <a href="${APP_URL}/support" style="color: #a3e635;">Contact support</a>.`}
          </p>

        </div>
      </body>
      </html>
    `,
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
    to,
    subject: `Your DropMarket Account — Track Order #${orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 12px 0;">
            Welcome to DropMarket
          </h2>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
            We created an account for this email so you can track order <strong style="color: #ffffff;">#${orderNumber}</strong>, chat with your seller, and get delivery updates.
          </p>

          <div style="background: rgba(163, 230, 53, 0.08); border: 1px solid rgba(163, 230, 53, 0.3); border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
              We've sent you a separate email with a <strong style="color: #ffffff;">password setup link</strong> — click it to claim your account. It expires, so if it lapses just use "Forgot?" on the login page.
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${APP_URL}/account/orders/${orderId}" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              Track Your Order
            </a>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            Didn't buy anything on DropMarket? <a href="${APP_URL}/support" style="color: #a3e635;">Let us know</a>.
          </p>

        </div>
      </body>
      </html>
    `,
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
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `New Message From ${senderName} — Order #${orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 12px 0;">
            New Message
          </h2>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
            Hi ${escapeHtml(name)} — <strong style="color: #ffffff;">${escapeHtml(senderName)}</strong> sent you a message about order <strong style="color: #ffffff;">#${orderNumber}</strong>:
          </p>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3px solid #a3e635; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="margin: 0; color: #d4d4d8; font-size: 14px; line-height: 1.6; font-style: italic;">
              "${escapeHtml(truncated)}"
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${APP_URL}/account/orders/${orderId}" style="display: inline-block; background: #a3e635; color: #0a0a0f; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 700; font-size: 15px;">
              Reply Now
            </a>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            You get this email only for the first unread message in a conversation — replies while you're away won't flood your inbox.
          </p>

        </div>
      </body>
      </html>
    `,
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
    to,
    subject: `How was your DropMarket experience? Leave us a review`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; color: #ffffff;">
              Drop<span style="color: #a3e635;">Market</span>
            </h1>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 48px; line-height: 1;">&#11088;&#11088;&#11088;&#11088;&#11088;</div>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
            How was your experience, ${escapeHtml(name)}?
          </h2>

          <p style="font-size: 16px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
            We hope you enjoyed your purchase on DropMarket. Your feedback helps us improve and helps other gamers make informed decisions.
          </p>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
            <p style="margin: 0; color: #a1a1aa; font-size: 14px;">Order Reference</p>
            <p style="margin: 4px 0 0 0; color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: 2px;">#${shortOrderId}</p>
          </div>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            It only takes 60 seconds and means the world to us. Share your honest experience on Trustpilot.
          </p>

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${reviewUrl}" style="display: inline-block; background: #00b67a; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-weight: 700; font-size: 18px; letter-spacing: 0.5px;">
              Write a Review on Trustpilot
            </a>
          </div>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #a3e635; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px;">
              Why Your Review Matters
            </h3>
            <ul style="margin: 0; padding-left: 20px; color: #a1a1aa; font-size: 14px; line-height: 1.8;">
              <li>Helps other gamers shop safely</li>
              <li>Improves our marketplace for everyone</li>
              <li>Recognises great sellers for their work</li>
              <li>Takes less than 60 seconds to write</li>
            </ul>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            You are receiving this because you recently completed an order on DropMarket.<br>
            If you did not make a purchase, please <a href="${APP_URL}/support" style="color: #a3e635;">contact support</a>.
          </p>

        </div>
      </body>
      </html>
    `,
  })

  return error ? { success: false, error } : { success: true, data }
}
