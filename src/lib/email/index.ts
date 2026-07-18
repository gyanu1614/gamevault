import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to,
      subject: 'We Received Your Seller Application',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#f4f4f5;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
            <tr><td align="center" style="padding:36px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
                <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                  <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                  <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                    <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Thanks, ${escapeHtml(name)} — We Got It</h1>
                    <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;overflow-wrap:anywhere;">Your seller application for <strong style="color:#ffffff;">"${escapeHtml(displayName)}"</strong> is in. It's now under review — we'll email you the moment there's an update, so there's nothing more you need to do right now.</p>
                    <div style="background:rgba(163, 230, 53, 0.08);border:1px solid rgba(163, 230, 53, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#a3e635;">What Happens Next?</p>
                      <ul style="margin:0;padding-left:18px;color:#a1a1aa;font-size:13px;line-height:1.7;">
                        <li>Our team reviews your application within 2-3 business days</li>
                        <li>Keep an eye on your inbox for the decision</li>
                        <li>Check your status any time from your account</li>
                      </ul>
                    </div>
                    <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.08);border-radius:8px;padding:12px 16px;margin:0 0 18px;text-align:left;">
                      <p style="margin:0 0 4px;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Application Reference</p>
                      <p style="margin:0;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#ffffff;overflow-wrap:anywhere;">${escapeHtml(applicationId)}</p>
                    </div>
                    <a href="${APP_URL}/account/seller-status" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">View Application Status</a>
                  </div>
                </td></tr>
                <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                  Questions in the meantime? Just reply to this email.<br>
                  © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
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
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to,
      subject: 'Your Seller Application Is In Review',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#f4f4f5;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
            <tr><td align="center" style="padding:36px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
                <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                  <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                  <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                    <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Good News, ${escapeHtml(name)} — Review Has Started</h1>
                    <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;">Our team has started reviewing your seller application. There's nothing you need to do right now — we'll email you as soon as there's a decision.</p>
                    <div style="background:rgba(163, 230, 53, 0.08);border:1px solid rgba(163, 230, 53, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#a3e635;">What To Expect</p>
                      <ul style="margin:0;padding-left:18px;color:#a1a1aa;font-size:13px;line-height:1.7;">
                        <li>Most decisions land within 24-48 hours</li>
                        <li>We may reach out if anything needs clarifying</li>
                        <li>Track progress any time from your account</li>
                      </ul>
                    </div>
                    <a href="${APP_URL}/account/seller-status" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">View Application Status</a>
                  </div>
                </td></tr>
                <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                  Questions in the meantime? Just reply to this email.<br>
                  © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
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
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to,
      subject: '🎉 Your Seller Application has been Approved!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#f4f4f5;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
            <tr><td align="center" style="padding:36px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
                <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                  <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                  <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                    <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Congratulations, ${escapeHtml(name)}!</h1>
                    <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;overflow-wrap:anywhere;">Your seller application for <strong style="color:#ffffff;">"${escapeHtml(displayName)}"</strong> has been approved! Your seller access is now live — head to your dashboard to set up your storefront and list your gaming items on DropMarket.</p>
                    <div style="background:rgba(163, 230, 53, 0.08);border:1px solid rgba(163, 230, 53, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#a3e635;">What's Next?</p>
                      <ul style="margin:0;padding-left:18px;color:#a1a1aa;font-size:13px;line-height:1.7;">
                        <li>Set up your seller profile</li>
                        <li>Create your first listing</li>
                        <li>Connect your payment method</li>
                        <li>Start selling!</li>
                      </ul>
                    </div>
                    <div style="background:rgba(163, 230, 53, 0.08);border:1px solid rgba(163, 230, 53, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 12px;text-align:left;">
                      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3e635;">Seller Do's</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.6;color:#a1a1aa;">
                        <tr><td valign="top" style="width:20px;color:#a3e635;font-weight:700;">✓</td><td style="padding-bottom:6px;"><strong style="color:#e4e4e7;">Deliver Exactly What You Listed</strong> — in-game or in-platform, within your delivery time</td></tr>
                        <tr><td valign="top" style="width:20px;color:#a3e635;font-weight:700;">✓</td><td style="padding-bottom:6px;"><strong style="color:#e4e4e7;">Keep All Chat On DropMarket</strong> — it protects you in disputes</td></tr>
                        <tr><td valign="top" style="width:20px;color:#a3e635;font-weight:700;">✓</td><td style="padding-bottom:6px;"><strong style="color:#e4e4e7;">Mark Orders Delivered Honestly</strong> — buyers confirm receipt before you're paid</td></tr>
                        <tr><td valign="top" style="width:20px;color:#a3e635;font-weight:700;">✓</td><td><strong style="color:#e4e4e7;">Keep Your Stock Numbers Real</strong></td></tr>
                      </table>
                    </div>
                    <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.12);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#f4f4f5;">Seller Don'ts</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.6;color:#a1a1aa;">
                        <tr><td valign="top" style="width:20px;color:#71717a;font-weight:700;">✗</td><td style="padding-bottom:6px;"><strong style="color:#e4e4e7;">Never Take Payment Outside DropMarket</strong> — instant ban</td></tr>
                        <tr><td valign="top" style="width:20px;color:#71717a;font-weight:700;">✗</td><td style="padding-bottom:6px;"><strong style="color:#e4e4e7;">Never Ask Buyers For Personal Contact Details</strong></td></tr>
                        <tr><td valign="top" style="width:20px;color:#71717a;font-weight:700;">✗</td><td style="padding-bottom:6px;"><strong style="color:#e4e4e7;">Never Share Login Credentials Except Through The Account-Sale Flow</strong></td></tr>
                        <tr><td valign="top" style="width:20px;color:#71717a;font-weight:700;">✗</td><td><strong style="color:#e4e4e7;">Never Deliver Before Payment Is Confirmed</strong></td></tr>
                      </table>
                    </div>
                    <a href="${APP_URL}/account/dashboard" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">Go to Seller Dashboard</a>
                    <p style="margin:14px 0 0;font-size:13px;color:#a1a1aa;">Ready to sell? <a href="${APP_URL}/account/listings" style="color:#a3e635;text-decoration:none;font-weight:600;">Create Your First Listing</a></p>
                  </div>
                </td></tr>
                <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                  Welcome to the DropMarket seller community!<br>
                  © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
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
      replyTo: REPLY_TO,
      to,
      subject: 'Update on Your Seller Application - DropMarket',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#f4f4f5;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
            <tr><td align="center" style="padding:36px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
                <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                  <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                  <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                    <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Hi ${escapeHtml(name)},</h1>
                    <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;overflow-wrap:anywhere;">We've reviewed your seller application for <strong style="color:#ffffff;">"${escapeHtml(displayName)}"</strong> and unfortunately, we're unable to approve it at this time.</p>
                    <div style="background:rgba(239, 68, 68, 0.1);border:1px solid rgba(239, 68, 68, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#ef4444;">Reason for Rejection</p>
                      <p style="margin:0;color:#fca5a5;font-size:13px;line-height:1.6;overflow-wrap:anywhere;">${escapeHtml(reason)}</p>
                    </div>
                    <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.08);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#a3e635;">What Can You Do?</p>
                      <ul style="margin:0;padding-left:18px;color:#a1a1aa;font-size:13px;line-height:1.7;">
                        <li>Review the feedback above</li>
                        <li>Address the issues mentioned</li>
                        <li>Submit a new application</li>
                      </ul>
                    </div>
                    <a href="${APP_URL}/account/become-seller" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">Apply Again</a>
                  </div>
                </td></tr>
                <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                  If you have questions, please contact our support team.<br>
                  © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
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
      replyTo: REPLY_TO,
      to,
      subject: 'Action Required: Additional Information Needed - DropMarket',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#f4f4f5;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
            <tr><td align="center" style="padding:36px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
                <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                  <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                  <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                    <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Hi ${escapeHtml(name)}, We Need More Information</h1>
                    <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;overflow-wrap:anywhere;">We're reviewing your seller application for <strong style="color:#ffffff;">"${escapeHtml(displayName)}"</strong> and need some additional information to proceed.</p>
                    <div style="background:rgba(251, 191, 36, 0.1);border:1px solid rgba(251, 191, 36, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#fbbf24;">Message from our Review Team</p>
                      <p style="margin:0;color:#fef3c7;font-size:13px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(message)}</p>
                    </div>
                    <a href="${APP_URL}/account/seller-status" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">View Application Status</a>
                  </div>
                </td></tr>
                <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                  Please respond within 7 days to avoid delays.<br>
                  © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
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
    replyTo: REPLY_TO,
    to,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Hi ${escapeHtml(name)}, ${role === 'buyer' ? 'Your Dispute Has Been Opened' : 'A Dispute Requires Your Attention'}</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;">Our team will review this dispute within 24-48 hours. Please share any additional evidence in the order chat.</p>
                  <div style="background:rgba(251, 191, 36, 0.1);border:1px solid rgba(251, 191, 36, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <p style="margin:0 0 5px;color:#a1a1aa;font-size:13px;line-height:1.6;overflow-wrap:anywhere;"><strong style="color:#fbbf24;">Order Reference:</strong> #${escapeHtml(disputeId)}</p>
                    <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.6;overflow-wrap:anywhere;"><strong style="color:#fbbf24;">Reason:</strong> ${escapeHtml(reason)}</p>
                  </div>
                  <a href="${APP_URL}/account/orders/${orderId}" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">View Order &amp; Dispute</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
    to,
    subject: 'Your Dispute Has Been Resolved - DropMarket',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Dispute Resolved</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;overflow-wrap:anywhere;">Hi ${escapeHtml(name)}, your dispute (${disputeId.slice(0, 8)}) has been resolved.</p>
                  <div style="background:rgba(163, 230, 53, 0.08);border:1px solid rgba(163, 230, 53, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <p style="margin:0${amount ? ' 0 5px' : ''};color:#a3e635;font-size:13px;font-weight:600;">Resolution: ${resolution.replace(/_/g, ' ')}</p>
                    ${amount ? `<p style="margin:0;color:#a1a1aa;font-size:13px;">Refund Amount: $${amount.toFixed(2)}</p>` : ''}
                  </div>
                  <a href="${APP_URL}${orderId ? `/account/orders/${orderId}` : '/account/orders'}" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">View Details</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
    to,
    subject: `New Order Received — ${listingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">New Order Received!</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;">Hi ${escapeHtml(sellerName)}, <strong style="color:#ffffff;">${escapeHtml(buyerName)}</strong> just purchased your listing.</p>
                  <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.08);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Order #</td>
                        <td style="color:#ffffff;font-weight:700;text-align:right;letter-spacing:1px;padding:4px 0;">${displayOrderId}</td>
                      </tr>
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Listing</td>
                        <td style="color:#ffffff;text-align:right;padding:4px 0;overflow-wrap:anywhere;">${escapeHtml(listingTitle)}</td>
                      </tr>
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Quantity</td>
                        <td style="color:#ffffff;text-align:right;padding:4px 0;">${quantity}</td>
                      </tr>
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Order Total</td>
                        <td style="color:#ffffff;text-align:right;padding:4px 0;">$${totalAmount.toFixed(2)}</td>
                      </tr>
                      <tr style="border-top:1px solid rgba(255,255,255,0.1);">
                        <td style="color:#a3e635;font-weight:700;padding:8px 0 2px;">Your Payout</td>
                        <td style="color:#a3e635;font-weight:700;font-size:15px;text-align:right;padding:8px 0 2px;">$${sellerPayout.toFixed(2)}</td>
                      </tr>
                    </table>
                  </div>
                  <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.08);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.6;"><strong style="color:#a3e635;">Next step:</strong> Head to your order dashboard and deliver the item to the buyer. You'll be paid out once the buyer confirms receipt — or automatically when the order's protection window closes.</p>
                  </div>
                  <a href="${orderUrl}" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">View Order & Deliver</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                You are receiving this because you are a seller on DropMarket. Manage your notifications in <a href="${APP_URL}/account/settings" style="color:#71717a;">account settings</a>.<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
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
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Order Complete</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;">
                    ${
                      autoReleased
                        ? `Hi ${escapeHtml(name)} — your protection window ended with no issues reported, so this order completed automatically.`
                        : `Thanks, ${escapeHtml(name)} — you've confirmed delivery, and your order is all wrapped up.`
                    }
                  </p>
                  <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.08);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Order</td>
                        <td style="color:#ffffff;text-align:right;font-weight:600;padding:4px 0;">#${orderNumber}</td>
                      </tr>
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Item</td>
                        <td style="color:#ffffff;text-align:right;padding:4px 0;overflow-wrap:anywhere;">${escapeHtml(listingTitle)}</td>
                      </tr>
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Total Paid</td>
                        <td style="color:#ffffff;text-align:right;font-weight:600;padding:4px 0;">$${totalPaid.toFixed(2)}</td>
                      </tr>
                    </table>
                  </div>
                  <p style="margin:0 0 18px;font-size:11px;line-height:1.6;color:#71717a;">
                    ${
                      autoReleased
                        ? 'This order was covered by SafeDrop Buyer Protection for its full protection window — the seller is only paid out now that the window has closed.'
                        : 'This order was covered by SafeDrop Buyer Protection from checkout until you confirmed delivery — the seller is only paid out now that you have.'
                    }
                  </p>
                  <a href="${APP_URL}/account/orders/${orderId}" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">View Your Order</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                Questions about this order? <a href="${APP_URL}/support" style="color:#71717a;">Contact support</a>.<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
    to,
    subject: `Order Confirmed — ${listingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Payment Received</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;">Thanks, ${escapeHtml(name)} — your payment is confirmed and the seller has been told to start delivery.</p>
                  <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.08);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Order</td>
                        <td style="color:#ffffff;text-align:right;font-weight:600;padding:4px 0;">#${orderNumber}</td>
                      </tr>
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Item</td>
                        <td style="color:#ffffff;text-align:right;padding:4px 0;overflow-wrap:anywhere;">${escapeHtml(listingTitle)}</td>
                      </tr>
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Total Paid</td>
                        <td style="color:#ffffff;text-align:right;font-weight:600;padding:4px 0;">$${totalPaid.toFixed(2)}</td>
                      </tr>
                    </table>
                  </div>
                  <p style="margin:0 0 18px;font-size:11px;line-height:1.6;color:#71717a;">You're covered by SafeDrop Buyer Protection — the seller isn't paid out until your order completes, and you're entitled to a full refund if your order never arrives.</p>
                  <a href="${APP_URL}/account/orders/${orderId}" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">Track Your Order</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                Questions about this order? <a href="${APP_URL}/support" style="color:#71717a;">Contact support</a>.<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
    to,
    subject: `Your Order Was Delivered — Confirm Receipt`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Delivery Marked Complete</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;overflow-wrap:anywhere;">Hi ${escapeHtml(name)} — the seller marked order <strong style="color:#ffffff;">#${orderNumber}</strong> (${escapeHtml(listingTitle)}) as delivered. Please check you received everything as described.</p>
                  <div style="background:rgba(163, 230, 53, 0.08);border:1px solid rgba(163, 230, 53, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:center;">
                    <p style="margin:0 0 4px;color:#a1a1aa;font-size:11px;">Your Protection Window</p>
                    <p style="margin:0;color:#ffffff;font-size:14px;font-weight:600;">${windowText} — until ${confirmByText}</p>
                    <p style="margin:6px 0 0;color:#a1a1aa;font-size:12px;line-height:1.6;">Confirm receipt once you're happy, or open a dispute if something's wrong. If you do nothing, the order completes automatically when the window ends.</p>
                  </div>
                  <a href="${APP_URL}/account/orders/${orderId}" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">Review &amp; Confirm Delivery</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                Something not right? <a href="${APP_URL}/account/orders/${orderId}" style="color:#71717a;">Open a dispute</a> before the window closes — SafeDrop Buyer Protection has you covered.<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
  // Store-credit refunds land instantly; only external rails have the
  // 5–10 business day caveat.
  const toWallet = destination.toLowerCase().includes('wallet')
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
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
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">${pending ? 'Order Cancelled' : 'Refund Processed'}</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;overflow-wrap:anywhere;">
                    ${
                      pending
                        ? `Hi ${escapeHtml(name)} — order <strong style="color:#ffffff;">#${orderNumber}</strong> (${escapeHtml(listingTitle)}) has been cancelled, and our team is arranging your refund in line with the Refund &amp; Dispute Policy.`
                        : `Hi ${escapeHtml(name)} — order <strong style="color:#ffffff;">#${orderNumber}</strong> (${escapeHtml(listingTitle)}) has been cancelled and refunded.`
                    }
                  </p>
                  <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.08);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Refund Amount</td>
                        <td style="color:#ffffff;text-align:right;font-weight:600;padding:4px 0;">$${amount.toFixed(2)}</td>
                      </tr>
                      ${
                        pending
                          ? ''
                          : `<tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Refunded To</td>
                        <td style="color:#ffffff;text-align:right;padding:4px 0;">${destination}</td>
                      </tr>`
                      }
                    </table>
                  </div>
                  ${
                    !pending && toWallet
                      ? `<a href="${APP_URL}/account/wallet" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;margin:0 0 16px;">Go To Wallet</a>`
                      : ''
                  }
                  <p style="margin:0;font-size:11px;line-height:1.6;color:#71717a;">
                    ${
                      pending
                        ? 'You will get a confirmation email as soon as your refund is issued. If you have any questions in the meantime, support is one click away.'
                        : toWallet
                        ? 'Your store credit is available instantly — spend it on your next order or withdraw it from your wallet.'
                        : 'Refunds to a payment method typically arrive within 5–10 business days depending on your provider.'
                    }
                  </p>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                Didn't expect this refund? <a href="${APP_URL}/support" style="color:#71717a;">Contact support</a>.<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
    to,
    subject: `Order Complete — $${payout.toFixed(2)} Added To Your Seller Balance`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Sale Complete</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;">
                    ${
                      autoReleased
                        ? `Hi ${escapeHtml(name)} — the protection window on order <strong style="color:#ffffff;">#${orderNumber}</strong> closed with no issues, so it completed automatically.`
                        : `Hi ${escapeHtml(name)} — the buyer confirmed delivery on order <strong style="color:#ffffff;">#${orderNumber}</strong>.`
                    }
                  </p>
                  <div style="background:rgba(163, 230, 53, 0.08);border:1px solid rgba(163, 230, 53, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:center;">
                    <p style="margin:0 0 4px;color:#a1a1aa;font-size:12px;overflow-wrap:anywhere;">${escapeHtml(listingTitle)}</p>
                    <p style="margin:0;color:#a3e635;font-size:20px;font-weight:700;">+$${payout.toFixed(2)}</p>
                    <p style="margin:4px 0 0;color:#a1a1aa;font-size:12px;">added to your seller balance — withdraw any time</p>
                  </div>
                  <a href="${APP_URL}/account/orders/${orderId}" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">View Order</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                Withdraw anytime from your <a href="${APP_URL}/account/wallet" style="color:#71717a;">wallet</a> once you reach the payout minimum.<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
    to,
    subject: `Your Listing Is Live — ${listingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Listing Approved</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;overflow-wrap:anywhere;">Hi ${escapeHtml(name)} — <strong style="color:#ffffff;">${escapeHtml(listingTitle)}</strong> passed review and is now live for buyers.</p>
                  <a href="${APP_URL}${listingPath || '/account/listings'}" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">View Your Listing</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                Manage all your offers from your <a href="${APP_URL}/account/listings" style="color:#71717a;">seller dashboard</a>.<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
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
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">${changesRequested ? 'Changes Requested' : 'Listing Not Approved'}</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;overflow-wrap:anywhere;">Hi ${escapeHtml(name)} — <strong style="color:#ffffff;">${escapeHtml(listingTitle)}</strong> ${changesRequested ? 'needs a few changes before it can go live.' : "didn't pass review this time."}</p>
                  <div style="background:rgba(239, 68, 68, 0.08);border:1px solid rgba(239, 68, 68, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#ef4444;">${changesRequested ? 'What Needs Changing' : 'Reason'}</p>
                    <p style="margin:0;color:#fca5a5;font-size:13px;line-height:1.6;overflow-wrap:anywhere;">${escapeHtml(reason)}</p>
                  </div>
                  <a href="${APP_URL}/account/listings" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">${changesRequested ? 'Edit Your Listing' : 'Review Your Listings'}</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                Questions about moderation? <a href="${APP_URL}/support" style="color:#71717a;">Contact support</a>.<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
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
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">${approved ? 'Withdrawal Approved' : 'Withdrawal Declined'}</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;">
                    ${
                      approved
                        ? `Hi ${escapeHtml(name)} — your withdrawal has been approved and is being processed to your payout method.`
                        : `Hi ${escapeHtml(name)} — we couldn't process your withdrawal request this time. The funds remain in your seller balance.`
                    }
                  </p>
                  <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.08);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Amount</td>
                        <td style="color:#ffffff;text-align:right;font-weight:600;padding:4px 0;">$${amount.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style="color:#a1a1aa;padding:4px 0;">Method</td>
                        <td style="color:#ffffff;text-align:right;padding:4px 0;overflow-wrap:anywhere;">${escapeHtml(method)}</td>
                      </tr>
                    </table>
                  </div>
                  ${
                    !approved && reason
                      ? `<div style="background:rgba(239, 68, 68, 0.08);border:1px solid rgba(239, 68, 68, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <p style="margin:0;color:#fca5a5;font-size:13px;line-height:1.6;overflow-wrap:anywhere;"><strong style="color:#ef4444;">Reason:</strong> ${escapeHtml(reason)}</p>
                  </div>`
                      : ''
                  }
                  <a href="${APP_URL}/account/wallet" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">View Your Wallet</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                ${approved ? 'Arrival time depends on your payout method — typically 1–5 business days.' : `Questions? <a href="${APP_URL}/support" style="color:#71717a;">Contact support</a>.`}<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
    to,
    subject: `Your DropMarket Account — Track Order #${orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Welcome to DropMarket</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;">We created an account for this email so you can track order <strong style="color:#ffffff;">#${orderNumber}</strong>, chat with your seller, and get delivery updates.</p>
                  <div style="background:rgba(163, 230, 53, 0.08);border:1px solid rgba(163, 230, 53, 0.3);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.6;">We've sent you a separate email with a <strong style="color:#ffffff;">password setup link</strong> — click it to claim your account. It expires, so if it lapses just use "Forgot?" on the login page.</p>
                  </div>
                  <a href="${APP_URL}/account/orders/${orderId}" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">Track Your Order</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                Didn't buy anything on DropMarket? <a href="${APP_URL}/support" style="color:#71717a;">Let us know</a>.<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
    to,
    subject: `New Message From ${senderName} — Order #${orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">New Message</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;">Hi ${escapeHtml(name)} — <strong style="color:#ffffff;">${escapeHtml(senderName)}</strong> sent you a message about order <strong style="color:#ffffff;">#${orderNumber}</strong>:</p>
                  <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.08);border-left:3px solid #a3e635;border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <p style="margin:0;color:#d4d4d8;font-size:13px;line-height:1.6;font-style:italic;overflow-wrap:anywhere;">"${escapeHtml(truncated)}"</p>
                  </div>
                  <a href="${APP_URL}/account/orders/${orderId}" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">Reply Now</a>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                You get this email only for the first unread message in a conversation — replies while you're away won't flood your inbox.<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
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
    replyTo: REPLY_TO,
    to,
    subject: `How was your DropMarket experience? Leave us a review`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
          <tr><td align="center" style="padding:36px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
              <tr><td style="background-color:#0f1013;border-radius:10px;overflow:hidden;">
                <img src="https://dropmarket.gg/section-bg/cta-band.jpg" alt="" width="480" style="display:block;width:100%;height:96px;object-fit:cover;">
                <div style="padding:26px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
                  <p style="margin:0 0 16px;font-size:19px;font-weight:800;color:#ffffff;">Drop<span style="color:#a3e635;">Market</span></p>
                  <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">How was your experience, ${escapeHtml(name)}?</h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#a1a1aa;">We hope you enjoyed your purchase on DropMarket. Your feedback helps us improve and helps other gamers make informed decisions.</p>
                  <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.08);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:center;">
                    <p style="margin:0;color:#a1a1aa;font-size:11px;">Order Reference</p>
                    <p style="margin:4px 0 0;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:2px;">#${shortOrderId}</p>
                  </div>
                  <div style="background:rgba(255, 255, 255, 0.03);border:1px solid rgba(255, 255, 255, 0.08);border-radius:8px;padding:14px 16px;margin:0 0 18px;text-align:left;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#a3e635;">Why Your Review Matters</p>
                    <ul style="margin:0;padding-left:18px;color:#a1a1aa;font-size:13px;line-height:1.7;">
                      <li>Helps other gamers shop safely</li>
                      <li>Improves our marketplace for everyone</li>
                      <li>Recognises great sellers for their work</li>
                      <li>Takes less than 60 seconds to write</li>
                    </ul>
                  </div>
                  <a href="${reviewUrl}" style="display:inline-block;background-color:#a3e635;color:#0a0a0f;text-decoration:none;padding:11px 28px;border-radius:6px;font-weight:700;font-size:14px;">Write a Review on Trustpilot</a>
                  <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:#71717a;">It only takes 60 seconds and means the world to us. Share your honest experience on Trustpilot.</p>
                </div>
              </td></tr>
              <tr><td align="center" style="padding:14px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:#a1a1aa;">
                You are receiving this because you recently completed an order on DropMarket. If you did not make a purchase, please <a href="${APP_URL}/support" style="color:#71717a;">contact support</a>.<br>
                © 2026 DropMarket · <a href="${APP_URL}/support" style="color:#71717a;">Support</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  })

  return error ? { success: false, error } : { success: true, data }
}
