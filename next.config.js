/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ]
  },
}

module.exports = nextConfig
