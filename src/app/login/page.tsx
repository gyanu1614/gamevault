'use client'

import { useState, Suspense } from 'react'
import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { login } from '@/lib/actions/auth'
import { verifyTurnstileToken } from '@/lib/actions/verify-turnstile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { SpinnerLoader } from '@/components/ui/spinner-loader'
import { TurnstileWidget } from '@/components/ui/TurnstileWidget'
import { createClient } from '@/lib/supabase/client'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error,           setError]           = useState<string | null>(null)
  const [loading,         setLoading]         = useState(false)
  const [turnstileToken,  setTurnstileToken]  = useState<string>('')
  const formRef = React.useRef<HTMLDivElement>(null)

  const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Scroll to top when there's an error
  React.useEffect(() => {
    if (error || Object.keys(errors).length > 0) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [error, errors])

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    setLoading(true)

    try {
      // P2.7 — Verify Turnstile CAPTCHA before login
      if (turnstileEnabled) {
        const captcha = await verifyTurnstileToken(turnstileToken)
        if (!captcha.success) {
          setError(captcha.error || 'CAPTCHA verification failed. Please try again.')
          setLoading(false)
          setTurnstileToken('')
          return
        }
      }

      // Run login AND minimum animation time in parallel
      const [result] = await Promise.all([
        // The actual login
        login({
          email: data.email,
          password: data.password,
        }),
        // Minimum time to show the spinner (1.5 seconds for smoother UX)
        new Promise(resolve => setTimeout(resolve, 1500))
      ])

      if (result.error) {
        setError(result.error)
        setLoading(false)
      } else {
        // Verify the session is established
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          // Check for redirect parameter
          const redirectParam = searchParams?.get('redirect')

          // Simple redirect - let middleware/homepage handle role-based routing
          window.location.href = redirectParam || '/'
        } else {
          // If session is not ready yet, wait a bit more and try again
          await new Promise(resolve => setTimeout(resolve, 500))
          const redirectParam = searchParams?.get('redirect')
          window.location.href = redirectParam || '/'
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <>
      {loading && <SpinnerLoader size="large" />}

      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div ref={formRef} className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <span className="text-2xl font-bold text-primary-foreground">G</span>
            </div>
            <h1 className="mt-6 text-3xl font-bold">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Log in to your GameVault account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                {error}
              </Alert>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                autoComplete="email"
                {...register('email')}
                aria-invalid={errors.email ? 'true' : 'false'}
                disabled={loading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
                aria-invalid={errors.password ? 'true' : 'false'}
                disabled={loading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* P2.7 — Turnstile CAPTCHA */}
            {turnstileEnabled && (
              <TurnstileWidget
                onToken={setTurnstileToken}
                onExpire={() => setTurnstileToken('')}
              />
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 rounded-lg bg-white text-black hover:bg-white/90 font-medium transition-all duration-200"
              disabled={isSubmitting || loading || (turnstileEnabled && !turnstileToken)}
            >
              {isSubmitting || loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Log in'
              )}
            </Button>

            {/* Signup Link */}
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Don't have an account? </span>
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                New to GameVault?
              </span>
            </div>
          </div>

          {/* Benefits */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="mb-2 font-semibold">Why join GameVault?</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>✓ Lowest fees: 6.9-10.4% vs competitors' 17-26%</li>
              <li>✓ 30-day buyer protection</li>
              <li>✓ Instant delivery on most items</li>
              <li>✓ Trusted by 3,500+ sellers</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}

function LoginLoadingFallback() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary animate-pulse">
            <span className="text-2xl font-bold text-primary-foreground">G</span>
          </div>
          <div className="mt-6 h-9 w-48 mx-auto bg-muted/50 rounded animate-pulse"></div>
          <div className="mt-2 h-5 w-64 mx-auto bg-muted/30 rounded animate-pulse"></div>
        </div>
        <div className="space-y-6">
          <div className="h-10 bg-muted/50 rounded animate-pulse"></div>
          <div className="h-10 bg-muted/50 rounded animate-pulse"></div>
          <div className="h-12 bg-muted/50 rounded animate-pulse"></div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginForm />
    </Suspense>
  )
}
