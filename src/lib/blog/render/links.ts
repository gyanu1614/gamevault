/**
 * Where a link in a post goes. Our own domain (absolute or relative) is an
 * internal path — same tab, followed — the old renderer sent every absolute
 * dropmarket.gg link out as nofollow in a new tab. Other sites open in a new
 * tab. Anything that is not http(s), a path or an anchor is dropped.
 */
const OWN_HOSTS = new Set(['dropmarket.gg', 'www.dropmarket.gg'])

export type LinkKind = { internal: string } | { external: string } | { unsafe: true }

export function classifyHref(href: string): LinkKind {
  const h = href.trim()
  if (h.startsWith('/') || h.startsWith('#')) return { internal: h }
  try {
    const url = new URL(h)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { unsafe: true }
    if (OWN_HOSTS.has(url.hostname)) return { internal: `${url.pathname}${url.search}${url.hash}` || '/' }
    return { external: url.toString() }
  } catch {
    return { unsafe: true }
  }
}

/**
 * Game pages written without the game ("/values", "/calculator/…") point at
 * the post's own game; they only exist under /<game>/. Site pages ("/sell",
 * "/fees") are left as they are.
 */
const GAME_TOOLS = /^\/(values|calculator|neon-calculator|price-index|inventory|chromas|boxes|codes|events|free-items)(?=[/?#]|$)/

export function gamePath(path: string, gameSlug?: string | null): string {
  return gameSlug && GAME_TOOLS.test(path) ? `/${gameSlug}${path}` : path
}
