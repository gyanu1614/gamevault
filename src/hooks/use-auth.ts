'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

export interface AuthUser extends User {
  profile: Profile | null
  isApprovedSeller?: boolean
  sellerApplicationStatus?: 'pending' | 'under_review' | 'approved' | 'rejected' | null
}

// LocalStorage keys for caching
const CACHE_KEYS = {
  PROFILE: 'gamevault_user_profile',
  SELLER_STATUS: 'gamevault_seller_status',
  SELLER_APP_STATUS: 'gamevault_seller_app_status'
}

// Helper functions for localStorage caching
function getCachedProfile(userId: string): Profile | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEYS.PROFILE}_${userId}`)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

function setCachedProfile(userId: string, profile: Profile | null) {
  try {
    if (profile) {
      localStorage.setItem(`${CACHE_KEYS.PROFILE}_${userId}`, JSON.stringify(profile))
    } else {
      localStorage.removeItem(`${CACHE_KEYS.PROFILE}_${userId}`)
    }
  } catch {}
}

function getCachedSellerStatus(userId: string): { isApprovedSeller: boolean; status: string | null } | null {
  try {
    const isApproved = localStorage.getItem(`${CACHE_KEYS.SELLER_STATUS}_${userId}`)
    const status = localStorage.getItem(`${CACHE_KEYS.SELLER_APP_STATUS}_${userId}`)
    if (isApproved !== null) {
      return {
        isApprovedSeller: isApproved === 'true',
        status: status || null
      }
    }
    return null
  } catch {
    return null
  }
}

function setCachedSellerStatus(userId: string, isApprovedSeller: boolean, status: string | null) {
  try {
    localStorage.setItem(`${CACHE_KEYS.SELLER_STATUS}_${userId}`, String(isApprovedSeller))
    if (status) {
      localStorage.setItem(`${CACHE_KEYS.SELLER_APP_STATUS}_${userId}`, status)
    } else {
      localStorage.removeItem(`${CACHE_KEYS.SELLER_APP_STATUS}_${userId}`)
    }
  } catch {}
}

// Invalidate cache to force a fresh fetch
export function invalidateAuthCache(userId?: string) {
  if (userId) {
    try {
      localStorage.removeItem(`${CACHE_KEYS.PROFILE}_${userId}`)
      localStorage.removeItem(`${CACHE_KEYS.SELLER_STATUS}_${userId}`)
      localStorage.removeItem(`${CACHE_KEYS.SELLER_APP_STATUS}_${userId}`)
    } catch {}
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    // Get initial session with timeout
    const initAuth = async () => {
      try {
        // Set a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn('⚠️ Auth initialization timeout')
            setLoading(false)
          }
        }, 10000) // Increased from 5s to 10s

        // Get session first (faster than getUser)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        clearTimeout(timeoutId)

        if (!mounted) return

        if (sessionError) {
          console.error('❌ Session error:', sessionError)
          setUser(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          const userId = session.user.id

          // Get cached data first for instant load
          const cachedProfile = getCachedProfile(userId)
          const cachedSellerStatus = getCachedSellerStatus(userId)

          // Set user with cached data immediately
          if (cachedProfile || cachedSellerStatus) {
            setUser({
              ...session.user,
              profile: cachedProfile,
              isApprovedSeller: cachedSellerStatus?.isApprovedSeller || false,
              sellerApplicationStatus: cachedSellerStatus?.status as any || null
            })
          }

          // Try to get fresh profile with timeout protection
          try {
            const profilePromise = supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()

            const profileTimeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Profile fetch timeout')), 5000) // Increased from 3s to 5s
            )

            const { data: profile, error: profileError } = await Promise.race([
              profilePromise,
              profileTimeout,
            ]) as any

            if (profileError) {
              console.warn('⚠️ Profile fetch error:', profileError.message)
            }

            // Cache the profile if successfully fetched
            if (profile) {
              setCachedProfile(userId, profile)
            }

            // Check seller application status with increased timeout
            let isApprovedSeller = cachedSellerStatus?.isApprovedSeller || false
            let sellerApplicationStatus = cachedSellerStatus?.status || null

            try {
              const sellerAppPromise = supabase
                .from('seller_applications')
                .select('status')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

              const sellerTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Seller status timeout')), 5000) // Increased from 2s to 5s
              )

              const { data: sellerApp } = await Promise.race([
                sellerAppPromise,
                sellerTimeout
              ]) as any

              if (sellerApp) {
                sellerApplicationStatus = sellerApp.status
                isApprovedSeller = sellerApp.status === 'approved'
                // Cache the seller status
                setCachedSellerStatus(userId, isApprovedSeller, sellerApplicationStatus)
              }
            } catch (err) {
              // On timeout or error, keep the cached value instead of resetting to false
              console.warn('⚠️ Seller status check failed, using cached value:', err)
              // Don't reset - keep cached values
            }

            if (mounted) {
              setUser({
                ...session.user,
                profile: profile || cachedProfile || null,
                isApprovedSeller,
                sellerApplicationStatus
              })
            }
          } catch (profileErr) {
            console.warn('⚠️ Profile fetch failed, using cached data:', profileErr)
            if (mounted) {
              // Use cached data instead of resetting
              setUser({
                ...session.user,
                profile: cachedProfile || null,
                isApprovedSeller: cachedSellerStatus?.isApprovedSeller || false,
                sellerApplicationStatus: cachedSellerStatus?.status as any || null
              })
            }
          }
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error)
        if (mounted) {
          setUser(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        // Clear cached data on logout
        if (session?.user?.id) {
          try {
            localStorage.removeItem(`${CACHE_KEYS.PROFILE}_${session.user.id}`)
            localStorage.removeItem(`${CACHE_KEYS.SELLER_STATUS}_${session.user.id}`)
            localStorage.removeItem(`${CACHE_KEYS.SELLER_APP_STATUS}_${session.user.id}`)
          } catch {}
        }
        setUser(null)
        setLoading(false)
        return
      }

      if (session?.user) {
        const userId = session.user.id

        // Get cached data first
        const cachedProfile = getCachedProfile(userId)
        const cachedSellerStatus = getCachedSellerStatus(userId)

        // Set user with cached data immediately
        if (cachedProfile || cachedSellerStatus) {
          setUser({
            ...session.user,
            profile: cachedProfile,
            isApprovedSeller: cachedSellerStatus?.isApprovedSeller || false,
            sellerApplicationStatus: cachedSellerStatus?.status as any || null
          })
        }

        try {
          // Get profile with timeout
          const profilePromise = supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

          const profileTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile timeout')), 5000) // Increased from 3s to 5s
          )

          const { data: profile } = await Promise.race([
            profilePromise,
            profileTimeout,
          ]) as any

          // Cache the profile if successfully fetched
          if (profile) {
            setCachedProfile(userId, profile)
          }

          // Check seller application status with timeout
          let isApprovedSeller = cachedSellerStatus?.isApprovedSeller || false
          let sellerApplicationStatus = cachedSellerStatus?.status || null

          try {
            const sellerAppPromise = supabase
              .from('seller_applications')
              .select('status')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            const sellerTimeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Seller status timeout')), 5000) // Increased from 2s to 5s
            )

            const { data: sellerApp } = await Promise.race([
              sellerAppPromise,
              sellerTimeout
            ]) as any

            if (sellerApp) {
              sellerApplicationStatus = sellerApp.status
              isApprovedSeller = sellerApp.status === 'approved'
              // Cache the seller status
              setCachedSellerStatus(userId, isApprovedSeller, sellerApplicationStatus)
            }
          } catch (err) {
            // On timeout or error, keep the cached value instead of resetting to false
            console.warn('⚠️ Seller status check failed in auth change, using cached value:', err)
            // Don't reset - keep cached values
          }

          if (mounted) {
            setUser({
              ...session.user,
              profile: profile || cachedProfile || null,
              isApprovedSeller,
              sellerApplicationStatus
            })
          }
        } catch (error) {
          console.warn('⚠️ Profile fetch error in auth change, using cached data:', error)
          if (mounted) {
            // Use cached data instead of resetting
            setUser({
              ...session.user,
              profile: cachedProfile || null,
              isApprovedSeller: cachedSellerStatus?.isApprovedSeller || false,
              sellerApplicationStatus: cachedSellerStatus?.status as any || null
            })
          }
        }
      } else {
        setUser(null)
      }

      if (mounted) {
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return {
    user,
    profile: user?.profile || null,
    loading,
    isAuthenticated: !!user,
  }
}

// Hook for requiring authentication
export function useRequireAuth(redirectUrl = '/login') {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = redirectUrl
    }
  }, [user, loading, redirectUrl])

  return { user, loading }
}
