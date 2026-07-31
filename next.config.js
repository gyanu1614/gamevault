/** @type {import('next').NextConfig} */
const nextConfig = {
  // Verification builds (agent/CI) set NEXT_DIST_DIR to keep their output OUT
  // of .next — a `next build` racing the running `next dev` corrupts the dev
  // chunk cache (ChunkLoadError / "missing required error components").
  distDir: process.env.NEXT_DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
  ignoreDuringBuilds: true,
},
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },
  // V21/P7.d — Permanent redirect for the legacy `/marketplace/*`
  // URL space. The canonical buyer routes are
  // `/{gameSlug}/{categorySlug}/{listingSlug}` now (handled by the
  // (marketplace) route group). This rule catches old bookmarks,
  // indexed Google pages, stale admin links, and any straggling
  // revalidatePath calls so we don't 404 external traffic or break
  // SEO during the transition.
  async redirects() {
    return [
      // The per-game content hub moved from /[game]/blogs to /[game]/blog, so
      // the whole site uses the singular form (the site-wide index was already
      // /blog). These URLs are in the sitemap and may be indexed, so both the
      // hub and every article 301 to their new home rather than 404ing.
      {
        source: '/:game/blogs',
        destination: '/:game/blog',
        permanent: true,
      },
      {
        source: '/:game/blogs/:slug',
        destination: '/:game/blog/:slug',
        permanent: true,
      },
      // Category slugs canonicalized to the buy-{x} SEO pattern (was bare
      // items/accounts/currency on legacy games). 301 the old bare URLs → the
      // canonical buy- URL so Google consolidates on the ranking-friendly slug.
      // Renamed games: adopt-me, blox-fruits, blade-ball, brookhaven-rp,
      // murder-mystery-2, gta-vi, steal-a-brainrot (accounts only).
      {
        source: '/:game(adopt-me|blox-fruits|blade-ball|brookhaven-rp|murder-mystery-2|gta-vi)/items',
        destination: '/:game/buy-items',
        permanent: true,
      },
      {
        source: '/:game(adopt-me|blox-fruits|blade-ball|brookhaven-rp|steal-a-brainrot)/accounts',
        destination: '/:game/buy-accounts',
        permanent: true,
      },
      {
        source: '/blade-ball/currency',
        destination: '/blade-ball/buy-currency',
        permanent: true,
      },
      // Blog posts migrated from flat /blog/[slug] to nested /[game]/blogs/[slug]
      // (DB-backed CMS). 301 the old flat URLs so Google moves the ranking to
      // the canonical nested URL — no duplicate content. General (non-game)
      // posts stay at /blog. One-time set for the imported posts.
      {
        source: '/blog/steal-a-brainrot-trading-guide',
        destination: '/steal-a-brainrot/blogs/steal-a-brainrot-trading-guide',
        permanent: true,
      },
      {
        source: '/blog/spot-overpriced-brainrots',
        destination: '/steal-a-brainrot/blogs/spot-overpriced-brainrots',
        permanent: true,
      },
      {
        source: '/blog/steal-a-brainrot-trading-values-explained',
        destination: '/steal-a-brainrot/blogs/steal-a-brainrot-trading-values-explained',
        permanent: true,
      },
      {
        source: '/blog/how-to-sell-roblox-brainrots-for-real-money',
        destination: '/steal-a-brainrot/blogs/how-to-sell-roblox-brainrots-for-real-money',
        permanent: true,
      },
      {
        source: '/blog/adopt-me-pet-values-explained',
        destination: '/adopt-me/blogs/adopt-me-pet-values-explained',
        permanent: true,
      },
      {
        source: '/blog/is-it-safe-to-buy-game-accounts',
        destination: '/valorant/blogs/is-it-safe-to-buy-game-accounts',
        permanent: true,
      },
      {
        // Merged the value + trade calculators into one /calculator page with
        // Cash / Trade tabs. 301 the old routes so their SEO equity moves over.
        source: '/steal-a-brainrot/value-calculator',
        destination: '/steal-a-brainrot/calculator',
        permanent: true,
      },
      {
        source: '/steal-a-brainrot/trade-calculator',
        destination: '/steal-a-brainrot/calculator?tab=trade',
        permanent: true,
      },
      {
        source: '/marketplace',
        destination: '/',
        permanent: true,
      },
      {
        source: '/marketplace/:rest*',
        destination: '/:rest*',
        permanent: true,
      },
      {
        // Blog slug rebrand: custody-free URL (outcome-language rule).
        source: '/blog/how-safedrop-escrow-works',
        destination: '/blog/how-safedrop-buyer-protection-works',
        permanent: true,
      },
      {
        // Legacy protection-brand URL. Must live here, not in a page:
        // permanentRedirect() in the statically prerendered route shipped
        // a 308 with no Location header, so crawlers hit a dead end.
        source: '/vaultshield',
        destination: '/safedrop',
        permanent: true,
      },
      {
        // The legal pages live in the (legal) route group, which adds no URL
        // segment — so /legal/terms never existed, only /terms. The mobile
        // footer linked the /legal/* form on every page, so Google has very
        // likely crawled these 404s. Recovers them, plus any external links
        // or bookmarks that picked them up.
        source: '/legal/:path*',
        destination: '/:path*',
        permanent: true,
      },
      {
        // /sell was linked from two blog posts and the category empty state
        // but never existed — only /sell/new, /sell/bulk, /sell/edit. The
        // (sell) layout guards auth, so logged-out visitors get bounced to
        // /login with a return path rather than seeing the wizard.
        source: '/sell',
        destination: '/sell/new',
        permanent: false,
      },
      {
        // GSC soft-404 cleanup (2026-07-30). Google has a set of `/game/*`
        // URLs it keeps re-crawling — /game/roblox, /game/cs2,
        // /game/fortnite/items. That prefix never existed in this codebase;
        // the canonical hub is /{gameSlug}. The mapping is exact, so 301
        // rather than 404 and let the equity move over. Unknown games fall
        // through to a real 404 at /{slug}, which is the right answer.
        source: '/game/:path*',
        destination: '/:path*',
        permanent: true,
      },
      {
        // Same cleanup: the one legacy /currency/* URL with a true modern
        // equivalent. The rest of /currency/* and all of /topup/* have no
        // matching page, so they now return a clean 404 + noindex — which is
        // what Google wants for a dead URL. Redirecting those to the homepage
        // would just be a soft 404 again.
        source: '/currency/apex-coins',
        destination: '/apex-legends/buy-currency',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
