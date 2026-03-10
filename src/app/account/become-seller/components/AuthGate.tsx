/**
 * AuthGate Component
 *
 * Protects the seller registration route by requiring authentication.
 * Redirects unauthenticated users to the login page.
 *
 * Usage:
 * Wrap the registration page content with this component.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'

interface AuthGateProps {
  children: React.ReactNode
}

export default function AuthGate({ children }: AuthGateProps) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Wait for auth to load
    if (!loading) {
      if (!user) {
        // User is not authenticated, redirect to login
        router.push('/login?redirect=/account/become-seller')
      } else {
        // User is authenticated, allow access
        setIsChecking(false)
      }
    }
  }, [user, loading, router])

  // Show loading state while checking authentication
  if (loading || isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-sm text-gray-400">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  // User is authenticated, render children
  return <>{children}</>
}
