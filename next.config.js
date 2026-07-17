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
    ]
  },
}

module.exports = nextConfig
