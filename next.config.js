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
    ]
  },
}

module.exports = nextConfig
