'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { z } from 'zod'
import { applyReferralAtSignup } from '@/lib/actions/referral'
import { generateDiceBearAvatar } from '@/lib/utils/avatar'

// Signup with username
export async function signup(formData: {
  email: string
  password: string
  username: string
  fullName?: string
  avatarData?: string
  referralCode?: string
}) {
  try {
    const supabase = await createClient()

    // Log environment check
    console.log('🔍 Checking Supabase connection...')
    console.log('URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

    // Check if username is already taken
    console.log('🔍 Checking if username exists:', formData.username)
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', formData.username)
      .single()

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine
      console.error('❌ Profile check error:', profileCheckError)
      return { error: `Database error: ${profileCheckError.message}` }
    }

    if (existingProfile) {
      return { error: 'Username is already taken' }
    }

    // Generate DiceBear avatar URL as placeholder
    // Avatar upload will happen post-auth in settings page
    const avatarUrl = generateDiceBearAvatar(formData.username)

    // Store avatar data in session if provided (to be uploaded after auth)
    const hasCustomAvatar = !!formData.avatarData

    // Create user with metadata
    // NOTE: Do NOT store avatar_url in metadata - it bloats session cookies causing HTTP 431
    // Avatar is stored in profiles table via database trigger instead
    console.log('🔍 Creating user account...')
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          username: formData.username,
          full_name: formData.fullName || null,
          has_pending_avatar: hasCustomAvatar, // Flag to trigger avatar upload after auth
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (error) {
      console.error('❌ Signup error:', error)
      return { error: `Signup failed: ${error.message}` }
    }

    console.log('✅ User created successfully:', data.user?.id)

    // Apply referral code if provided (fire-and-forget — non-critical)
    if (data.user?.id && formData.referralCode) {
      applyReferralAtSignup(data.user.id, formData.referralCode).catch(() => {
        // Non-critical — don't block signup if referral fails
      })
    }

    // The profile will be automatically created by the database trigger
    // User is now logged in automatically (no email confirmation required for login)
    revalidatePath('/', 'layout')
    return { data, error: null, success: true }
  } catch (err: any) {
    console.error('❌ Unexpected error in signup:', err)
    return { error: `Unexpected error: ${err.message || 'Unknown error'}` }
  }
}

// Login
export async function login(formData: { email: string; password: string }) {
  try {
    const supabase = await createClient()

    console.log('🔍 Attempting login for:', formData.email)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })

    if (error) {
      console.error('❌ Login error:', error)
      return { error: `Login failed: ${error.message}` }
    }

    console.log('✅ Login successful:', data.user?.id)

    revalidatePath('/', 'layout')
    return { data, error: null }
  } catch (err: any) {
    console.error('❌ Unexpected error in login:', err)
    return { error: `Unexpected error: ${err.message || 'Unknown error'}` }
  }
}

// Logout
export async function logout() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

// Get current user
export async function getCurrentUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  // Get profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return {
    ...user,
    profile,
  }
}

// Update profile
export async function updateProfile(formData: {
  username?: string
  fullName?: string
  bio?: string
  avatarUrl?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // If updating username, check if it's available
  if (formData.username) {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('username, id')
      .eq('username', formData.username)
      .single() as any

    if (existingProfile && existingProfile.id !== user.id) {
      return { error: 'Username is already taken' }
    }
  }

  const { data, error } = await (supabase
    .from('profiles')
    .update as any)({
      ...(formData.username && { username: formData.username }),
      ...(formData.fullName !== undefined && { full_name: formData.fullName }),
      ...(formData.bio !== undefined && { bio: formData.bio }),
      ...(formData.avatarUrl !== undefined && { avatar_url: formData.avatarUrl }),
    })
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { data, error: null }
}

// Request password reset
export async function resetPassword(email: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

// Update password
export async function updatePassword(newPassword: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

// Check if username is available
export async function checkUsernameAvailability(username: string) {
  try {
    if (!username || username.length < 3) {
      return { available: false, error: 'Username must be at least 3 characters' }
    }

    if (username.length > 30) {
      return { available: false, error: 'Username must be less than 30 characters' }
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return { available: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' }
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      return { available: false, error: 'Error checking username' }
    }

    return { available: !data, error: null }
  } catch (err: any) {
    return { available: false, error: 'Error checking username' }
  }
}

// Upload profile avatar
export async function uploadProfileAvatar(avatarData: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Convert base64 to buffer
    const base64Data = avatarData.split(',')[1]
    const buffer = Buffer.from(base64Data, 'base64')

    // File path: {user_id}/avatar.png
    const filePath = `${user.id}/avatar.png`

    // Upload to Supabase Storage with upsert (replace existing)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: 'image/png',
        upsert: true, // Replace existing avatar
      })

    if (uploadError) {
      console.error('❌ Avatar upload error:', uploadError)
      return { error: `Failed to upload avatar: ${uploadError.message}` }
    }

    // Get public URL with cache-busting timestamp
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(uploadData.path)

    // Add cache-busting query parameter to force browser refresh
    const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`

    // Update profile with new avatar URL
    const { error: updateError } = await (supabase
      .from('profiles')
      .update as any)({ avatar_url: cacheBustedUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Profile update error:', updateError)
      return { error: `Failed to update profile: ${updateError.message}` }
    }

    console.log('✅ Avatar uploaded successfully:', cacheBustedUrl)

    revalidatePath('/', 'layout')
    revalidatePath('/account/settings')
    return { success: true, avatarUrl: cacheBustedUrl }
  } catch (err: any) {
    console.error('❌ Unexpected error uploading avatar:', err)
    return { error: `Unexpected error: ${err.message || 'Unknown error'}` }
  }
}

// Register as seller
export async function registerAsSeller(formData: {
  businessName?: string
  paypalEmail?: string
}) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Check if user is already a seller
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('seller_tier')
      .eq('id', user.id)
      .maybeSingle() as any

    if (profileError) {
      console.error('❌ Profile check error:', profileError)
      return { error: `Profile lookup failed: ${profileError.message}` }
    }

    if (!profile) {
      return { error: 'Profile not found. Please try logging out and back in.' }
    }

    if (profile.seller_tier) {
      return { error: 'You are already a seller' }
    }

    // Update profile to make user a seller (bronze tier by default)
    const { data, error } = await (supabase
      .from('profiles')
      .update as any)({
        seller_tier: 'bronze',
        ...(formData.businessName && { business_name: formData.businessName }),
        ...(formData.paypalEmail && { paypal_email: formData.paypalEmail }),
      })
      .eq('id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('❌ Seller registration error:', error)
      return { error: `Failed to register as seller: ${error.message}` }
    }

    console.log('✅ User registered as seller:', user.id)

    revalidatePath('/', 'layout')
    return { data, error: null, success: true }
  } catch (err: any) {
    console.error('❌ Unexpected error in seller registration:', err)
    return { error: `Unexpected error: ${err.message || 'Unknown error'}` }
  }
}
