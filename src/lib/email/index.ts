import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'DropMarket <noreply@dropmarket.gg>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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
          <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px;">

            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 28px; font-weight: bold; margin: 0; background: linear-gradient(90deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                DropMarket
              </h1>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 64px;">🎉</span>
            </div>

            <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
              Congratulations, ${name}!
            </h2>

            <p style="font-size: 16px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
              Your seller application for <strong style="color: #ffffff;">"${displayName}"</strong> has been approved! You can now start listing your gaming items on DropMarket.
            </p>

            <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h3 style="font-size: 16px; font-weight: 600; color: #22c55e; margin: 0 0 12px 0;">
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
              <a href="${APP_URL}/seller/dashboard" style="display: inline-block; background: linear-gradient(90deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
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
          <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px;">

            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 28px; font-weight: bold; margin: 0; background: linear-gradient(90deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                DropMarket
              </h1>
            </div>

            <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
              Hi ${name},
            </h2>

            <p style="font-size: 16px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
              We've reviewed your seller application for <strong style="color: #ffffff;">"${displayName}"</strong> and unfortunately, we're unable to approve it at this time.
            </p>

            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h3 style="font-size: 16px; font-weight: 600; color: #ef4444; margin: 0 0 12px 0;">
                Reason for Rejection
              </h3>
              <p style="margin: 0; color: #fca5a5; font-size: 14px; line-height: 1.6;">
                ${reason}
              </p>
            </div>

            <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h3 style="font-size: 16px; font-weight: 600; color: #818cf8; margin: 0 0 12px 0;">
                What Can You Do?
              </h3>
              <ul style="margin: 0; padding-left: 20px; color: #a1a1aa; font-size: 14px; line-height: 1.8;">
                <li>Review the feedback above</li>
                <li>Address the issues mentioned</li>
                <li>Submit a new application</li>
              </ul>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${APP_URL}/account/become-seller" style="display: inline-block; background: #C6FF3D; color: #0A0A0F; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
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
          <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px;">

            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 28px; font-weight: bold; margin: 0; background: linear-gradient(90deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                DropMarket
              </h1>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 64px;">📋</span>
            </div>

            <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
              Hi ${name}, We Need More Information
            </h2>

            <p style="font-size: 16px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
              We're reviewing your seller application for <strong style="color: #ffffff;">"${displayName}"</strong> and need some additional information to proceed.
            </p>

            <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h3 style="font-size: 16px; font-weight: 600; color: #fbbf24; margin: 0 0 12px 0;">
                📝 Message from our Review Team
              </h3>
              <p style="margin: 0; color: #fef3c7; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
                ${message}
              </p>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${APP_URL}/seller/application-status" style="display: inline-block; background: linear-gradient(90deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
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
  role,
  reason,
}: {
  to: string
  name: string
  disputeId: string
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
        <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; background: linear-gradient(90deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              DropMarket
            </h1>
          </div>

          <h2 style="font-size: 20px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
            Hi ${name}, ${role === 'buyer' ? 'Your Dispute Has Been Opened' : 'A Dispute Requires Your Attention'}
          </h2>

          <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; color: #a1a1aa; font-size: 14px;">
              <strong>Dispute ID:</strong> ${disputeId.slice(0, 8)}
            </p>
            <p style="margin: 0; color: #a1a1aa; font-size: 14px;">
              <strong>Reason:</strong> ${reason.replace(/_/g, ' ')}
            </p>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
            Our team will review this dispute within 24-48 hours. Please provide any additional evidence through the dispute portal.
          </p>

          <div style="text-align: center;">
            <a href="${APP_URL}/disputes/${disputeId}" style="display: inline-block; background: linear-gradient(90deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              View Dispute
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
  resolution,
  amount,
}: {
  to: string
  name: string
  disputeId: string
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
        <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; background: linear-gradient(90deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              DropMarket
            </h1>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 64px;">✅</span>
          </div>

          <h2 style="font-size: 20px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
            Dispute Resolved
          </h2>

          <p style="font-size: 16px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
            Hi ${name}, your dispute (${disputeId.slice(0, 8)}) has been resolved.
          </p>

          <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; color: #22c55e; font-size: 16px; font-weight: 600;">
              Resolution: ${resolution.replace(/_/g, ' ')}
            </p>
            ${amount ? `<p style="margin: 0; color: #a1a1aa; font-size: 14px;">Refund Amount: $${amount.toFixed(2)}</p>` : ''}
          </div>

          <div style="text-align: center;">
            <a href="${APP_URL}/disputes/${disputeId}" style="display: inline-block; background: linear-gradient(90deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
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
        <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; background: linear-gradient(90deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              DropMarket
            </h1>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 64px;">🛒</span>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 8px 0;">
            New Order Received!
          </h2>
          <p style="font-size: 16px; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            Hi ${sellerName}, <strong style="color: #ffffff;">${buyerName}</strong> just purchased your listing.
          </p>

          <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Order #</td>
                <td style="color: #ffffff; font-weight: 700; text-align: right; letter-spacing: 1px;">${displayOrderId}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Listing</td>
                <td style="color: #ffffff; text-align: right;">${listingTitle}</td>
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
                <td style="color: #22c55e; font-weight: 700; padding: 10px 0 4px 0;">Your Payout</td>
                <td style="color: #22c55e; font-weight: 700; font-size: 18px; text-align: right; padding: 10px 0 4px 0;">$${sellerPayout.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
              <strong style="color: #818cf8;">Next step:</strong> Head to your order dashboard and deliver the item to the buyer. You'll be paid out once the buyer confirms receipt — or automatically when the order's protection window closes.
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${orderUrl}" style="display: inline-block; background: linear-gradient(90deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              View Order & Deliver
            </a>
          </div>

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            You are receiving this because you are a seller on DropMarket.<br>
            Manage your notifications in <a href="${APP_URL}/account/settings" style="color: #6366f1;">account settings</a>.
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
            Thanks, ${name} — you've confirmed delivery, and your order is all wrapped up.
          </p>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Order</td>
                <td style="color: #ffffff; text-align: right; font-weight: 600;">#${orderNumber}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Item</td>
                <td style="color: #ffffff; text-align: right;">${listingTitle}</td>
              </tr>
              <tr>
                <td style="color: #a1a1aa; padding: 6px 0;">Total Paid</td>
                <td style="color: #ffffff; text-align: right; font-weight: 600;">$${totalPaid.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            This order was covered by SafeDrop Buyer Protection from checkout until you confirmed delivery — the seller is only paid out now that you have.
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
        <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px;">

          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0; background: linear-gradient(90deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              DropMarket
            </h1>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 48px; line-height: 1;">&#11088;&#11088;&#11088;&#11088;&#11088;</div>
          </div>

          <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
            How was your experience, ${name}?
          </h2>

          <p style="font-size: 16px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 24px 0;">
            We hope you enjoyed your purchase on DropMarket. Your feedback helps us improve and helps other gamers make informed decisions.
          </p>

          <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
            <p style="margin: 0; color: #a1a1aa; font-size: 14px;">Order Reference</p>
            <p style="margin: 4px 0 0 0; color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: 2px;">#${shortOrderId}</p>
          </div>

          <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa; text-align: center; margin: 0 0 28px 0;">
            It only takes 60 seconds and means the world to us. Share your honest experience on Trustpilot.
          </p>

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${reviewUrl}" style="display: inline-block; background: linear-gradient(90deg, #00b67a, #00a06c); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 18px; letter-spacing: 0.5px;">
              Write a Review on Trustpilot
            </a>
          </div>

          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #6366f1; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px;">
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
            If you did not make a purchase, please <a href="${APP_URL}/support" style="color: #6366f1;">contact support</a>.
          </p>

        </div>
      </body>
      </html>
    `,
  })

  return error ? { success: false, error } : { success: true, data }
}
