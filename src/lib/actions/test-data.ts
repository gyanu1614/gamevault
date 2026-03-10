'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from './admin-permissions'

const TEST_SLUGS = [
  'valorant-radiant-account-5000-vp-all-agents',
  'roblox-premium-account-level-250-100k-robux',
  'fortnite-og-account-rare-skins-stacked',
]

/**
 * Delete all test listings - Always run this first
 */
export async function deleteTestListings() {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
      }
    }

    console.log('🗑️ Deleting test listings...', TEST_SLUGS)

    // Delete by slug - RLS policies should allow this
    const { data: deletedListings, error } = await supabase
      .from('listings')
      .delete()
      .in('slug', TEST_SLUGS)
      .select('id, slug')

    if (error) {
      console.error('❌ Error deleting test listings:', error)
      return {
        success: false,
        error: `Failed to delete test listings: ${error.message}`,
      }
    }

    console.log('✅ Deleted listings:', deletedListings)

    return {
      success: true,
      message: `Deleted ${deletedListings?.length || 0} test listings`,
      data: deletedListings,
    }
  } catch (error: any) {
    console.error('Error in deleteTestListings:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete test listings',
    }
  }
}

/**
 * Create test listings for testing checkout
 * IMPORTANT: Always delete first, then create
 */
export async function createTestListings() {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
      }
    }

    // Get current user's profile
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id, username, role')
      .eq('id', user.id)
      .single()

    if (!currentProfile) {
      return {
        success: false,
        error: 'Profile not found',
      }
    }

    // Check if user is seller or admin
    if (currentProfile.role !== 'seller' && currentProfile.role !== 'admin' && currentProfile.role !== 'super_admin') {
      return {
        success: false,
        error: 'You must be a seller or admin to create test listings',
      }
    }

    console.log('👤 Current user:', { id: currentProfile.id, role: currentProfile.role })

    // STEP 1: Delete existing test listings first
    console.log('🗑️ Step 1: Deleting existing test listings...')
    const deleteResult = await deleteTestListings()
    if (!deleteResult.success) {
      console.warn('⚠️ Delete failed but continuing:', deleteResult.error)
    }

    // STEP 2: Determine seller ID and temporarily upgrade their tier
    let sellerId = currentProfile.id
    let originalTier = null

    if (currentProfile.role === 'admin' || currentProfile.role === 'super_admin') {
      const { data: sellers } = await supabase
        .from('profiles')
        .select('id, username, role, seller_tier')
        .eq('role', 'seller')
        .limit(1)

      if (sellers && sellers.length > 0) {
        sellerId = sellers[0].id
        originalTier = sellers[0].seller_tier
        console.log('👤 Using seller:', sellers[0].username, 'tier:', originalTier)
      } else {
        console.log('👤 No sellers found, using admin as seller')
      }
    } else {
      // Get current tier of the seller
      const { data: profile } = await supabase
        .from('profiles')
        .select('seller_tier')
        .eq('id', sellerId)
        .single()

      originalTier = profile?.seller_tier
    }

    // Temporarily upgrade seller to 'bronze' tier to bypass pre-moderation
    console.log('⬆️ Temporarily upgrading seller tier to bronze to bypass pre-moderation...')
    const { error: tierError } = await supabase
      .from('profiles')
      .update({ seller_tier: 'bronze' })
      .eq('id', sellerId)

    if (tierError) {
      console.error('⚠️ Failed to upgrade tier:', tierError)
    } else {
      console.log('✅ Seller tier upgraded to bronze')
    }

    // STEP 3: Get games and categories
    console.log('📦 Step 2: Fetching games and categories...')
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, slug, name')
      .order('name')

    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, slug, name')
      .order('name')

    if (gamesError || !games || games.length === 0) {
      return {
        success: false,
        error: `No games found: ${gamesError?.message || 'Unknown error'}`,
      }
    }

    if (categoriesError || !categories || categories.length === 0) {
      return {
        success: false,
        error: `No categories found: ${categoriesError?.message || 'Unknown error'}`,
      }
    }

    const robloxGame = games.find(g => g.slug === 'roblox')
    const fortniteGame = games.find(g => g.slug === 'fortnite')
    const valorantGame = games.find(g => g.slug === 'valorant')
    const accountsCategory = categories.find(c => c.slug === 'accounts')
    const currencyCategory = categories.find(c => c.slug === 'currency')

    if (!robloxGame || !fortniteGame || !valorantGame) {
      return {
        success: false,
        error: 'Required games not found. Need: roblox, fortnite, valorant',
      }
    }

    if (!accountsCategory || !currencyCategory) {
      return {
        success: false,
        error: 'Required categories not found. Need: accounts, currency',
      }
    }

    console.log('✅ Found games:', { robloxGame, fortniteGame, valorantGame })
    console.log('✅ Found categories:', { accountsCategory, currencyCategory })

    // STEP 4: Create test listings with ACTIVE status directly
    const testListings = [
      {
        seller_id: sellerId,
        game_id: valorantGame.id,
        category_id: accountsCategory.id,
        title: 'Valorant Radiant Account | 5000+ VP | All Agents',
        slug: 'valorant-radiant-account-5000-vp-all-agents',
        description: 'Rare Valorant account with Radiant rank, 5000+ VP, and all agents unlocked. Includes exclusive skins and battle pass rewards.',
        price: 149.99,
        quantity: 1,
        is_unlimited: false,
        delivery_method: 'manual',
        delivery_time: '1-6 hours',
        images: ['/placeholder-game.jpg'],
        status: 'active',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        views: 0,
        template_data: {
          rank: 'Radiant',
          valorantPoints: 5000,
          agents: 'All',
          skins: 'Premium Bundle',
        },
      },
      {
        seller_id: sellerId,
        game_id: robloxGame.id,
        category_id: currencyCategory.id,
        title: 'Roblox Premium Account | Level 250 | 100K Robux',
        slug: 'roblox-premium-account-level-250-100k-robux',
        description: 'High-level Roblox account with Premium subscription, 100K Robux, and tons of rare items.',
        price: 79.99,
        quantity: 5,
        is_unlimited: false,
        delivery_method: 'manual',
        delivery_time: '0-1 hours',
        images: ['/placeholder-game.jpg'],
        status: 'active',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        views: 0,
        template_data: {
          level: 250,
          robux: 100000,
          premium: true,
          items: 'Rare Limited Items',
        },
      },
      {
        seller_id: sellerId,
        game_id: fortniteGame.id,
        category_id: accountsCategory.id,
        title: 'Fortnite OG Account | Rare Skins | Stacked',
        slug: 'fortnite-og-account-rare-skins-stacked',
        description: 'OG Fortnite account with rare skins from Season 1-3, including Black Knight and Renegade Raider.',
        price: 599.99,
        quantity: 1,
        is_unlimited: false,
        delivery_method: 'manual',
        delivery_time: '1-24 hours',
        images: ['/placeholder-game.jpg'],
        status: 'active',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        views: 0,
        template_data: {
          skins: 'Black Knight, Renegade Raider, Skull Trooper',
          vbucks: 13500,
          season: 'OG (Season 1-3)',
        },
      },
    ]

    console.log('📝 Step 3: Inserting listings with ACTIVE status (bronze tier bypasses pre-moderation)...')

    const { data: createdListings, error } = await supabase
      .from('listings')
      .insert(testListings)
      .select()

    if (error) {
      console.error('❌ Error creating test listings:', error)
      return {
        success: false,
        error: `Failed to create test listings: ${error.message}`,
      }
    }

    console.log('✅ Successfully created listings:', createdListings)

    // STEP 4: Verify listings are active
    const { data: verifyListings } = await supabase
      .from('listings')
      .select('id, slug, status, game_id, category_id')
      .in('slug', TEST_SLUGS)

    console.log('🔍 Verification - Final status:', verifyListings)

    const allActive = verifyListings?.every(l => l.status === 'active')
    if (!allActive) {
      console.warn('⚠️ Not all listings are active:', verifyListings)
      return {
        success: false,
        error: 'Some listings were not set to active status. Check console for details.',
      }
    } else {
      console.log('✅ All listings are ACTIVE and ready!')
    }

    return {
      success: true,
      message: `Successfully created ${createdListings.length} test listings`,
      listings: createdListings,
    }
  } catch (error: any) {
    console.error('❌ Error in createTestListings:', error)
    return {
      success: false,
      error: error.message || 'Failed to create test listings',
    }
  }
}
