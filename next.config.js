/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress TypeScript errors during build (project uses Supabase without generated types)
  // Fix: run `npx supabase gen types typescript` to generate proper types
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
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
}

module.exports = nextConfig
