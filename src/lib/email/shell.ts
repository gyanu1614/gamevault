/**
 * Shared email design shell — one consistent, human, forest-branded look for
 * every DropMarket email. Matched EXACTLY to the Supabase "Confirm signup" auth
 * template (the well-liked one) so transactional emails and auth emails are one
 * system: same 600px white card, same logo lockup, same forest button, same
 * "button not working?" fallback, same tokens.
 *
 * Tokens (from the Supabase template / seller-application palette):
 *   forest #14432A / #1B5E3A · lime #A3E635 · ink #1A1D19 / #5B6157
 *   hairline #E4E5DE · muted #8A9187 · canvas #FAFAF7
 *
 * Everything is inline-styled — the only thing email clients render reliably.
 */

const FOREST = '#14432A'
const FOREST_2 = '#1B5E3A'
const LIME = '#A3E635'
const INK = '#1A1D19'
const INK_2 = '#5B6157'
const MUTED = '#8A9187'
const LINE = '#E4E5DE'
const IVORY = '#FAFAF7'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export interface EmailShellOptions {
  /** Preheader — the grey preview line shown in the inbox list. */
  preview?: string
  /** Optional emoji shown before the heading (subtle energy; omit to match auth template exactly). */
  badgeEmoji?: string
  /** Optional small uppercase eyebrow over the heading (e.g. 'FOUNDING SELLER'). */
  eyebrow?: string
  /** The heading (rendered forest green, weight 600, like the auth template). */
  heading: string
  /** The inner content HTML (built from the block helpers below). */
  body: string
}

/**
 * Wrap content in the branded email document — a byte-faithful match to the
 * Supabase confirm template: 40px 20px body padding, 600px white card with 40px
 * inner padding, logo lockup, then the caller's heading + body.
 */
export function emailShell({
  preview,
  badgeEmoji,
  eyebrow,
  heading,
  body,
}: EmailShellOptions): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
</head>
<body style="font-family:${FONT};background-color:${IVORY};color:${INK};margin:0;padding:40px 20px;">
  ${preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>` : ''}
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid ${LINE};border-radius:12px;padding:40px;box-shadow:0 1px 2px rgba(20,67,42,0.04);">

    <div style="text-align:center;margin-bottom:32px;">
      <img src="${APP_URL}/brand/logo-mark-ink.png" alt="DropMarket" width="40" height="40" style="display:inline-block;width:40px;height:40px;vertical-align:middle;margin-right:10px;" />
      <span style="display:inline-block;vertical-align:middle;font-size:26px;font-weight:800;letter-spacing:-0.02em;color:${FOREST};">Drop<span style="color:${FOREST_2};">Market</span></span>
    </div>

    ${badgeEmoji ? `<div style="text-align:center;margin:0 0 16px;"><span style="display:inline-block;width:52px;height:52px;line-height:52px;text-align:center;font-size:24px;background:#F2F4EC;border-radius:50%;">${badgeEmoji}</span></div>` : ''}

    ${eyebrow ? `<p style="font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-align:center;color:${FOREST_2};margin:0 0 10px 0;">${eyebrow}</p>` : ''}

    <h2 style="font-size:24px;font-weight:600;text-align:center;margin:0 0 16px 0;letter-spacing:-0.01em;color:${FOREST};">${heading}</h2>

    ${body}

    <div style="border-top:1px solid ${LINE};margin:24px 0 20px 0;"></div>

    <p style="font-size:12px;color:${MUTED};text-align:center;margin:0;line-height:1.6;">
      Need a hand? Just reply to this email — a real person reads it.
    </p>

  </div>
</body>
</html>`
}

/** A paragraph of body copy — centered, matching the template. */
export function emailText(html: string): string {
  return `<p style="font-size:15px;line-height:1.6;color:${INK_2};text-align:center;margin:0 0 24px 0;">${html}</p>`
}

/** A left-aligned paragraph, for detail-heavy copy that reads better ranged-left. */
export function emailTextLeft(html: string): string {
  return `<p style="font-size:15px;line-height:1.6;color:${INK_2};margin:0 0 20px 0;">${html}</p>`
}

/**
 * The primary CTA button + its "button not working?" fallback line, exactly like
 * the auth template. Pass the same href; the fallback repeats it as a link.
 */
export function emailButton(label: string, href: string): string {
  return `<div style="text-align:center;margin-bottom:20px;">
    <a href="${href}" style="display:inline-block;background:${FOREST};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">${label}</a>
  </div>
  <p style="font-size:12px;line-height:1.6;color:${MUTED};text-align:center;margin:0 0 4px 0;">
    Button not working? <a href="${href}" style="color:${FOREST_2};font-weight:600;text-decoration:underline;">Open it here</a>.
  </p>`
}

/** A soft-tinted callout box (perks, order summary). Title optional; accent = lime tint. */
export function emailBox(opts: { title?: string; html: string; accent?: boolean }): string {
  const bg = opts.accent ? 'rgba(163,230,53,0.10)' : '#F7F8F3'
  const border = opts.accent ? 'rgba(20,67,42,0.16)' : LINE
  return `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:18px 20px;margin:0 0 24px 0;">
    ${opts.title ? `<p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${FOREST_2};">${opts.title}</p>` : ''}
    <div style="font-size:14px;line-height:1.65;color:${INK_2};">${opts.html}</div>
  </div>`
}

/** A labelled row for order/detail summaries: label left, value right. */
export function emailRow(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr>
    <td style="font-family:${FONT};font-size:14px;color:${INK_2};">${label}</td>
    <td style="font-family:${FONT};font-size:14px;font-weight:600;color:${INK};text-align:right;">${value}</td>
  </tr></table>`
}

/** A subtle centered secondary line (e.g. a soft link or reassurance). */
export function emailSubtle(html: string): string {
  return `<p style="font-size:12px;line-height:1.6;color:${MUTED};text-align:center;margin:0 0 4px 0;">${html}</p>`
}

/**
 * A common order-summary box (Order / Item / a set of amount rows), used across
 * the order-lifecycle emails. `rows` is [label, value] pairs; the last row can
 * be emphasised via `highlightLast`.
 */
export function emailOrderSummary(rows: Array<[string, string]>, highlightLast = false): string {
  const inner = rows
    .map(([label, value], i) => {
      const isLast = i === rows.length - 1
      const emph = isLast && highlightLast
      const topBorder = emph ? `border-top:1px solid ${LINE};` : ''
      const pad = emph ? 'padding-top:10px;' : ''
      const labelStyle = emph
        ? `font-size:15px;font-weight:700;color:${FOREST_2};`
        : `font-size:14px;color:${INK_2};`
      const valueStyle = emph
        ? `font-size:16px;font-weight:800;color:${FOREST_2};`
        : `font-size:14px;font-weight:600;color:${INK};`
      return `<tr>
        <td style="font-family:${FONT};${labelStyle}${topBorder}${pad}padding-bottom:8px;">${label}</td>
        <td style="font-family:${FONT};${valueStyle}${topBorder}${pad}text-align:right;padding-bottom:8px;overflow-wrap:anywhere;">${value}</td>
      </tr>`
    })
    .join('')
  return emailBox({ html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table>` })
}

export const EMAIL_TOKENS = { FOREST, FOREST_2, LIME, INK, INK_2, MUTED, LINE, IVORY, FONT, APP_URL }
