/**
 * Public Seller Storefront
 *
 * Public-facing seller shop page with:
 * - Seller profile header with stats
 * - Tab navigation (Shop, Reviews, About)
 * - Shop: Seller's listings organized by games → categories
 * - Reviews: Seller's ratings and reviews
 * - About: Seller info, policies, response time
 */

import { SITE_URL } from '@/config/site'
import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import SellerStorefront from '@/components/shop/SellerStorefront'

// Public page — use service role to bypass RLS on seller_applications
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = getServiceClient()

  // Fetch seller data for rich metadata - try shop_slug first, then username
  let profile = null

  const shopSlugQuery = await supabase
    .from('profiles')
    .select(`
      *,
      seller_applications!seller_applications_user_id_fkey (
        status
      )
    `)
    .eq('shop_slug', slug)
    .single()

  if (shopSlugQuery.data) {
    profile = shopSlugQuery.data
  } else {
    const usernameQuery = await supabase
      .from('profiles')
      .select(`
        *,
        seller_applications!seller_applications_user_id_fkey (
          status
        )
      `)
      .eq('username', slug)
      .single()

    if (usernameQuery.data) {
      profile = usernameQuery.data
    }
  }

  // Check if seller is approved
  const hasApprovedApplication = profile?.seller_applications?.some(
    (app: any) => app.status === 'approved'
  )

  if (!profile || !hasApprovedApplication) {
    return {
      title: 'Shop Not Found',
      description: 'The requested seller shop could not be found.'
    }
  }

  // Get seller stats
  const { count: totalSales } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', profile.id)
    .eq('status', 'completed')

  const { data: ratingData } = await supabase
    .from('reviews')
    .select('rating')
    .eq('seller_id', profile.id)

  const avgRating = ratingData && ratingData.length > 0
    ? (ratingData.reduce((sum, r) => sum + r.rating, 0) / ratingData.length).toFixed(1)
    : '0.0'

  const businessName = profile.shop_name || profile.business_name || profile.username
  const description = `Shop for gaming accounts, items, and services from ${businessName}. ${totalSales || 0} sales • ${avgRating}/5 rating • Trusted DropMarket seller.`

  const shopUrl = `${SITE_URL}/shop/${slug}`
  const { getAvatarUrl: getAvatar } = await import('@/lib/utils/avatar')
  const avatarUrl = getAvatar(profile.avatar_url, slug)

  return {
    title: `${businessName}'s Shop`,
    description: description.slice(0, 160), // Optimal length for SEO
    keywords: [
      businessName,
      slug,
      'gaming marketplace',
      'game accounts',
      'gaming services',
      'trusted seller',
      'DropMarket seller'
    ],
    authors: [{ name: businessName }],
    creator: businessName,
    publisher: 'DropMarket',

    // Open Graph
    openGraph: {
      type: 'profile',
      url: shopUrl,
      title: `${businessName} - Gaming Marketplace Seller`,
      description,
      siteName: 'DropMarket',
      images: [
        {
          url: avatarUrl,
          width: 400,
          height: 400,
          alt: `${businessName} profile picture`,
        }
      ],
      locale: 'en_US',
    },

    // Twitter Card
    twitter: {
      card: 'summary',
      title: `${businessName}'s Shop`,
      description: description.slice(0, 200),
      images: [avatarUrl],
      creator: '@dropmarket', // Update with your actual Twitter handle
    },

    // Additional meta tags
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },

    // Canonical URL
    alternates: {
      canonical: shopUrl,
    },
  }
}

// ISR Configuration - Revalidate every 60 seconds
export const revalidate = 60

export default async function SellerShopPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = getServiceClient()

  // Get seller profile by shop_slug or username (for backward compatibility)
  let profile = null
  let error = null

  // Try by shop_slug first
  const shopSlugQuery = await supabase
    .from('profiles')
    .select(`
      *,
      seller_applications!seller_applications_user_id_fkey (
        status
      )
    `)
    .eq('shop_slug', slug)
    .single()

  if (shopSlugQuery.data) {
    profile = shopSlugQuery.data
  } else {
    // Fallback: try by username for backward compatibility
    const usernameQuery = await supabase
      .from('profiles')
      .select(`
        *,
        seller_applications!seller_applications_user_id_fkey (
          status
        )
      `)
      .eq('username', slug)
      .single()

    if (usernameQuery.data) {
      profile = usernameQuery.data
    } else {
      error = shopSlugQuery.error || usernameQuery.error
    }
  }

  // Check if seller is approved (has at least one approved application)
  const hasApprovedApplication = profile?.seller_applications?.some(
    (app: any) => app.status === 'approved'
  )

  if (error || !profile || !hasApprovedApplication) {
    notFound()
  }

  // Get seller's active listings
  const { data: listings } = await supabase
    .from('listings')
    .select(`
      *,
      game:games(name, slug, image_url),
      category:categories(name, slug)
    `)
    .eq('seller_id', profile.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Get seller's reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      *,
      buyer:profiles!reviews_buyer_id_fkey(username, avatar_url),
      order:orders(order_number)
    `)
    .eq('seller_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Calculate seller stats
  const { count: totalSales } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', profile.id)
    .eq('status', 'completed')

  const { data: ratingData } = await supabase
    .from('reviews')
    .select('rating')
    .eq('seller_id', profile.id)

  const avgRating = ratingData && ratingData.length > 0
    ? ratingData.reduce((sum, r) => sum + r.rating, 0) / ratingData.length
    : 0

  const positiveReviewsCount = ratingData?.filter(r => r.rating >= 4).length || 0
  const positivePercentage = ratingData && ratingData.length > 0
    ? (positiveReviewsCount / ratingData.length) * 100
    : 0

  const sellerData = {
    profile,
    listings: listings || [],
    reviews: reviews || [],
    stats: {
      totalSales: totalSales || 0,
      avgRating: Number(avgRating.toFixed(1)),
      totalReviews: ratingData?.length || 0,
      positivePercentage: Math.round(positivePercentage),
      activeListings: listings?.length || 0
    }
  }

  return <SellerStorefront seller={sellerData} />
}
