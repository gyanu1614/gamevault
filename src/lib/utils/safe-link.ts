/**
 * AUTH-013 — same-origin link filter for user-visible notification links.
 *
 * `notifications.link` is rendered as `<Link href>`. A link that is not a
 * rooted, same-origin path (absolute URL, protocol-relative `//host`,
 * `javascript:`/`data:` schemes, backslash tricks, control characters) would
 * carry the reader off-site — in-app phishing. This module is intentionally
 * pure (no server-only import) so it runs in both the write helpers and the
 * client components that render the links. One filter, used at BOTH ends.
 */

/** A rooted path on this origin: starts with a single '/', no scheme, no host, no control chars. */
export function isInternalPath(link: unknown): link is string {
  if (typeof link !== 'string' || link.length === 0 || link.length > 2048) return false
  if (link.charCodeAt(0) !== 0x2f) return false // must start with '/' (rejects schemes and relative paths)
  const second = link.charCodeAt(1)
  if (second === 0x2f || second === 0x5c) return false // '//host' and '/\host' are protocol-relative to browsers
  for (let i = 0; i < link.length; i++) {
    const c = link.charCodeAt(i)
    // control characters, DEL, and whitespace enable URL/header splitting tricks
    if (c < 0x20 || c === 0x7f || c === 0x20 || c === 0xa0) return false
  }
  return true
}

/** The link if it is internal, otherwise a harmless '#'. */
export function safeInternalPath(link: unknown): string {
  return isInternalPath(link) ? link : '#'
}
