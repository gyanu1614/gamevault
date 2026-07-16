'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadProfileAvatar } from '@/lib/actions/auth'
import { readPendingSignupAvatar, clearPendingSignupAvatar } from '@/lib/auth/pending-avatar'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

export interface AuthUser extends User {
  profile: Profile | null
  isApprovedSeller?: boolean
  sellerApplicationStatus?: 'pending' | 'under_review' | 'info_requested' | 'approved' | 'rejected' | null
}

// Columns we accept from a realtime `profiles` UPDATE payload. Realtime
// delivers every column of the changed row; blindly spreading it into the
// cached Profile could clobber join-derived fields or leak columns the client
// type doesn't expect (plan Risk 2). We merge only the identity-bearing keys
// the navbar/sidebar actually read.
const REALTIME_PROFILE_KEYS: (keyof Profile)[] = [
  'role',
  'shop_name',
  'shop_slug',
  'username',
  'avatar_url',
  'badges',
  'seller_tier',
  'seller_status',
  'full_name',
] as unknown as (keyof Profile)[]

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

// V65 — Profile fetch with timeout + retry.
//
// Two real-world failure modes made the navbar render the default avatar
// until a manual refresh:
//  1. Brand-new accounts: the `profiles` row is inserted by a DB trigger
//     and can commit AFTER the client's SIGNED_IN event — the first
//     `.single()` finds 0 rows.
//  2. The fetch racing a 5s timeout while the supabase auth lock is held
//     (see the deferred onAuthStateChange below).
// A couple of short retries covers both.
async function fetchProfileWithRetry(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tries = 3,
): Promise<Profile | null> {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      const profileTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      )
      const { data: profile } = await Promise.race([profilePromise, profileTimeout]) as any
      if (profile) return profile as Profile
    } catch (err) {
      console.warn(`⚠️ Profile fetch attempt ${attempt + 1} failed:`, err)
    }
    // brief backoff before retrying (new-account trigger latency)
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
  }
  return null
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

// V22 — Shared auth state.
//
// PREVIOUSLY this hook ran standalone in every one of ~39 consumers, so the
// session lookup + profile fetch + onAuthStateChange subscription all fired
// N times per page (the same profile fetched in parallel by sidebar, header,
// page, gate…). Now the logic lives in ONE `AuthProvider` and every consumer
// reads the shared context — a single fetch + single subscription per app.
type AuthContextValue = {
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function useAuthState(): AuthContextValue {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  // Beta A — flush the signup avatar stash exactly once per authenticated
  // session (strict mode double-invokes effects in dev).
  const avatarFlushRef = useRef(false)

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

          // Try to get fresh profile (retry covers new-account trigger lag)
          try {
            const profile = await fetchProfileWithRetry(supabase, userId)

            // Cache the profile if successfully fetched
            if (profile) {
              setCachedProfile(userId, profile)
            }

            // V22 — Seller status resolution, optimized.
            //
            // `profiles.role` is the source of truth for APPROVED sellers:
            // admin approval sets `profiles.role = 'seller'` (see
            // admin-seller-review.ts), so an approved seller is fully known
            // from the profile row we just fetched — no second round-trip.
            //
            // Only NON-approved users need the seller_applications query (to
            // surface a pending/rejected application in the navbar). That's
            // the rare path; approved sellers (the hot path that hits the
            // seller dashboard/orders/offers) skip it entirely.
            let isApprovedSeller = cachedSellerStatus?.isApprovedSeller || false
            let sellerApplicationStatus = cachedSellerStatus?.status || null

            if ((profile as any)?.role === 'seller') {
              isApprovedSeller = true
              sellerApplicationStatus = 'approved'
              setCachedSellerStatus(userId, true, 'approved')
            } else {
              // Not an approved seller — check for a pending/rejected app once.
              isApprovedSeller = false
              try {
                const sellerAppPromise = supabase
                  .from('seller_applications')
                  .select('status')
                  .eq('user_id', userId)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .single()

                const sellerTimeout = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Seller status timeout')), 5000)
                )

                const { data: sellerApp } = await Promise.race([
                  sellerAppPromise,
                  sellerTimeout,
                ]) as any

                if (sellerApp) {
                  sellerApplicationStatus = sellerApp.status
                  isApprovedSeller = sellerApp.status === 'approved'
                  setCachedSellerStatus(userId, isApprovedSeller, sellerApplicationStatus)
                } else {
                  setCachedSellerStatus(userId, false, null)
                }
              } catch (err) {
                // On timeout/error keep cached value instead of resetting.
                console.warn('⚠️ Seller status check failed, using cached value:', err)
              }
            }

            if (mounted) {
              setUser({
                ...session.user,
                profile: profile || cachedProfile || null,
                isApprovedSeller,
                sellerApplicationStatus: sellerApplicationStatus as "under_review" | "pending" | "info_requested" | "approved" | "rejected" | null | undefined
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

    // Listen for auth changes.
    //
    // V65 — The async work is DEFERRED with setTimeout(0): supabase-js
    // holds its auth lock while onAuthStateChange callbacks run, and
    // awaiting a supabase query inside the callback deadlocks against
    // that lock (documented gotcha). The query then lost the race to our
    // 5s timeout, we fell back to the cached/null profile, and the navbar
    // showed the default avatar until a later event (~1 min) retried.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

      setTimeout(async () => {
      if (!mounted) return
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
          // Get profile (retry covers new-account trigger lag)
          const profile = await fetchProfileWithRetry(supabase, userId)

          // Cache the profile if successfully fetched
          if (profile) {
            setCachedProfile(userId, profile)
          }

          // Seller status — MUST mirror initAuth's logic (they were divergent,
          // which caused the post-login bug: an approved seller showed as a
          // buyer ("Become a Seller", no Seller Dashboard) until a refresh ran
          // initAuth). profiles.role is the source of truth for APPROVED sellers
          // (admin approval sets role='seller'); only non-approved users need
          // the seller_applications lookup.
          let isApprovedSeller = cachedSellerStatus?.isApprovedSeller || false
          let sellerApplicationStatus = cachedSellerStatus?.status || null

          if ((profile as any)?.role === 'seller') {
            isApprovedSeller = true
            sellerApplicationStatus = 'approved'
            setCachedSellerStatus(userId, true, 'approved')
          } else {
            try {
              const sellerAppPromise = supabase
                .from('seller_applications')
                .select('status')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

              const sellerTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Seller status timeout')), 5000)
              )

              const { data: sellerApp } = await Promise.race([
                sellerAppPromise,
                sellerTimeout
              ]) as any

              if (sellerApp) {
                sellerApplicationStatus = sellerApp.status
                isApprovedSeller = sellerApp.status === 'approved'
                setCachedSellerStatus(userId, isApprovedSeller, sellerApplicationStatus)
              }
            } catch (err) {
              // On timeout/error keep the cached value instead of resetting.
              console.warn('⚠️ Seller status check failed in auth change, using cached value:', err)
            }
          }

          if (mounted) {
            setUser({
              ...session.user,
              profile: profile || cachedProfile || null,
              isApprovedSeller,
              sellerApplicationStatus: sellerApplicationStatus as "under_review" | "pending" | "info_requested" | "approved" | "rejected" | null | undefined
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
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Beta A — flush a pending signup avatar on the first authenticated session.
  //
  // When Supabase "Confirm email" is ON, signup returns no session, so the
  // avatar the user picked is stashed in localStorage (see
  // src/lib/auth/pending-avatar.ts). Once the confirmed user signs in, upload
  // it via the existing authenticated action and update state+cache in place
  // so the navbar flips without waiting for a refetch. Bounded by the stash's
  // 7-day TTL; email-scoped so a shared device never applies one user's avatar
  // to another.
  useEffect(() => {
    if (!user || avatarFlushRef.current) return
    avatarFlushRef.current = true

    const userId = user.id
    const userEmail = user.email

    ;(async () => {
      const stash = readPendingSignupAvatar()
      if (!stash) return

      // Shared-device safety: only apply if the stash was created for THIS user.
      if (stash.email.toLowerCase() !== userEmail?.toLowerCase()) {
        clearPendingSignupAvatar()
        return
      }

      try {
        const res = await uploadProfileAvatar(stash.dataUrl)
        if (res && 'success' in res && res.success && res.avatarUrl) {
          clearPendingSignupAvatar()
          const newUrl = res.avatarUrl
          setUser((prev) =>
            prev && prev.id === userId
              ? {
                  ...prev,
                  profile: prev.profile
                    ? { ...prev.profile, avatar_url: newUrl }
                    : prev.profile,
                }
              : prev
          )
          const cached = getCachedProfile(userId)
          if (cached) {
            setCachedProfile(userId, { ...cached, avatar_url: newUrl } as Profile)
          }
        } else {
          // Upload failed — leave the stash for the next session (TTL-bounded)
          // and allow a retry.
          avatarFlushRef.current = false
        }
      } catch (err) {
        console.warn('⚠️ Pending avatar flush failed, will retry next session:', err)
        avatarFlushRef.current = false
      }
    })()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Beta C — Reactive approval without a refresh.
  //
  // The gamevault_* localStorage cache is only ever trusted for paint-before-
  // fetch, NEVER as final state. This effect keeps a live, authoritative view
  // for NON-APPROVED sessions so the "Become a Seller" CTA flips to a seller
  // menu and the identity card swaps username→shop_name the instant an admin
  // approves — no page reload, no redirect loop.
  //
  // Primary path: a realtime channel with two postgres_changes listeners
  //   (a) seller_applications UPDATE  → new sellerApplicationStatus (pending/
  //       under_review/info_requested/approved/…)
  //   (b) profiles UPDATE             → delivers role='seller' AND the fresh
  //       shop_name/shop_slug together, so approval propagates atomically.
  // Requires those tables in the supabase_realtime publication (see
  // supabase/migrations/*_realtime_seller_lifecycle.sql). If the publication
  // change is skipped the channel silently receives nothing, so a
  // visibilitychange + 60s poll fallback re-fetches the profile as a safety net.
  //
  // Scope: only authenticated, not-yet-approved users, and it tears down the
  // moment approval lands — no permanent extra websocket per anonymous visitor.
  const userId = user?.id
  const isApprovedSeller = user?.isApprovedSeller || false
  useEffect(() => {
    if (!userId || isApprovedSeller) return

    let active = true

    const mergeProfilePayload = (raw: Record<string, unknown>) => {
      if (!active) return
      const patch: Partial<Profile> = {}
      for (const key of REALTIME_PROFILE_KEYS) {
        if (key in raw) {
          ;(patch as Record<string, unknown>)[key as string] = raw[key as string]
        }
      }
      const nowApproved = (raw as any).role === 'seller'
      setUser((prev) => {
        if (!prev || prev.id !== userId) return prev
        const nextProfile = { ...(prev.profile || {}), ...patch } as Profile
        setCachedProfile(userId, nextProfile)
        if (nowApproved) setCachedSellerStatus(userId, true, 'approved')
        return {
          ...prev,
          profile: nextProfile,
          isApprovedSeller: nowApproved || prev.isApprovedSeller,
          sellerApplicationStatus: nowApproved
            ? 'approved'
            : prev.sellerApplicationStatus,
        }
      })
    }

    const applyAppStatus = (status: string | null) => {
      if (!active || !status) return
      const approved = status === 'approved'
      setCachedSellerStatus(userId, approved, status)
      setUser((prev) => {
        if (!prev || prev.id !== userId) return prev
        return {
          ...prev,
          isApprovedSeller: approved || prev.isApprovedSeller,
          sellerApplicationStatus: status as AuthUser['sellerApplicationStatus'],
        }
      })
    }

    const channel = supabase
      .channel(`seller-app:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'seller_applications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => applyAppStatus((payload.new as any)?.status ?? null)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => mergeProfilePayload(payload.new as Record<string, unknown>)
      )
      .subscribe()

    // Fallback: re-fetch the profile on tab focus + a slow poll, so a missed
    // realtime window (publication not enabled / websocket dropped) still
    // resolves approval without a hard reload.
    const refetch = async () => {
      if (!active) return
      const profile = await fetchProfileWithRetry(supabase, userId, 1)
      if (profile) mergeProfilePayload(profile as unknown as Record<string, unknown>)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisible)
    const pollId = setInterval(refetch, 60000)

    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(pollId)
      channel.unsubscribe()
    }
    // Deliberately NOT keyed on isApprovedSeller: the channel updates it via
    // the setUser callback, so re-subscribing on its change would tear the
    // channel down at the exact moment the approval events arrive and could
    // drop the profiles(shop_name) update — the stale-navbar race. The channel
    // lives for the whole authenticated session and self-updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, supabase])

  return {
    user,
    profile: user?.profile || null,
    loading,
    isAuthenticated: !!user,
  }
}

/**
 * AuthProvider — mount once near the app root. Runs the session lookup +
 * profile fetch + auth-change subscription a single time and shares the
 * result with every `useAuth()` consumer via context.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useAuthState()
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * useAuth — reads the shared auth context. Must be used under <AuthProvider/>
 * (mounted once at the app root in providers.tsx).
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth must be used within <AuthProvider>')
  }
  return ctx
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
