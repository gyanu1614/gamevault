'use client'

import { useState, useEffect } from 'react'
import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { signup, checkUsernameAvailability } from '@/lib/actions/auth'
import { verifyTurnstileToken } from '@/lib/actions/verify-turnstile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { MultiStepLoader } from '@/components/ui/multi-step-loader'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { TurnstileWidget } from '@/components/ui/TurnstileWidget'
import { createClient } from '@/lib/supabase/client'

const signupSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(1, 'Full name is required').optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type SignupFormData = z.infer<typeof signupSchema>

const loadingStates = [
  { text: "⚡ Initializing your account..." },
  { text: "🎮 Almost there..." },
  { text: "✨ We are ready!" },
]

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [referralCode,   setReferralCode]   = useState('')
  const [error,          setError]          = useState<string | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const formRef = React.useRef<HTMLDivElement>(null)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // Pre-fill referral code from ?ref= URL param
  useEffect(() => {
    const ref = searchParams?.get('ref')
    if (ref) setReferralCode(ref.toUpperCase())
  }, [searchParams])
  const [usernameValue, setUsernameValue] = useState('')
  const checkIdRef = React.useRef(0)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  // Scroll to top when there's an error
  React.useEffect(() => {
    if (error || Object.keys(errors).length > 0) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [error, errors])

  // Real-time username validation with debouncing
  React.useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === 'username') {
        const username = value.username || ''
        setUsernameValue(username)

        // Reset status if username is too short
        if (username.length < 3) {
          setUsernameStatus('idle')
          return
        }

        // Check if it matches the validation pattern
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          setUsernameStatus('idle')
          return
        }

        // Increment check ID to invalidate previous checks
        checkIdRef.current += 1
        const currentCheckId = checkIdRef.current

        // Set checking status
        setUsernameStatus('checking')

        // Debounce the API call
        const timeoutId = setTimeout(async () => {
          const checkStartTime = Date.now()

          // Run the check
          const result = await checkUsernameAvailability(username)

          // Calculate how long the check took
          const checkDuration = Date.now() - checkStartTime

          // Ensure minimum checking time of 500ms for better UX
          const minimumCheckTime = 500
          const remainingTime = Math.max(0, minimumCheckTime - checkDuration)

          // Wait for the remaining time before updating status
          setTimeout(() => {
            // Only update if this is still the current check
            if (currentCheckId === checkIdRef.current) {
              if (result.available) {
                setUsernameStatus('available')
              } else {
                setUsernameStatus('taken')
              }
            }
          }, remainingTime)
        }, 800) // Wait 800ms after user stops typing

        return () => clearTimeout(timeoutId)
      }
    })

    return () => subscription.unsubscribe()
  }, [watch])

  const onSubmit = async (data: SignupFormData) => {
    setError(null)
    setLoading(true)

    try {
      // P2.7 — Verify Turnstile CAPTCHA before signup
      if (turnstileEnabled) {
        const captcha = await verifyTurnstileToken(turnstileToken)
        if (!captcha.success) {
          setError(captcha.error || 'CAPTCHA verification failed. Please try again.')
          setLoading(false)
          setTurnstileToken('')
          return
        }
      }

      // Convert avatar file to base64 if exists
      let avatarData: string | undefined
      if (avatarFile) {
        avatarData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(avatarFile)
        })
      }

      // Run signup AND minimum animation time in parallel
      const [result] = await Promise.all([
        // The actual signup
        signup({
          email: data.email,
          password: data.password,
          username: data.username,
          fullName: data.fullName,
          avatarData,
          referralCode: referralCode || undefined,
        }),
        // Minimum time to show the full loader animation (3 steps * 1000ms)
        new Promise(resolve => setTimeout(resolve, 3000))
      ])

      if (result.error) {
        setError(result.error)
        setLoading(false)
        // Reset Turnstile on error
        if (turnstileEnabled) {
          setTurnstileToken('')
        }
      } else {
        // Simple redirect after signup - direct navigation
        window.location.href = '/'
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
      setLoading(false)
      // Reset Turnstile on error
      if (turnstileEnabled) {
        setTurnstileToken('')
      }
    }
  }

  return (
    <>
      <MultiStepLoader loadingStates={loadingStates} loading={loading} duration={1000} loop={false} />

      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div ref={formRef} className="w-full max-w-2xl space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <span className="text-2xl font-bold text-primary-foreground">G</span>
            </div>
            <h1 className="mt-6 text-3xl font-bold">Create your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Start buying and selling gaming items with the lowest fees
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                {error}
              </Alert>
            )}

            {/* Avatar Upload */}
            <div className="flex justify-center">
              <AvatarUpload
                onChange={setAvatarFile}
                username={usernameValue}
              />
            </div>

            {/* Two Column Grid for Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    placeholder="johndoe"
                    autoComplete="username"
                    {...register('username')}
                    aria-invalid={errors.username ? 'true' : 'false'}
                    disabled={loading}
                    className="pr-10"
                  />
                  {/* Status icon */}
                  {usernameStatus === 'checking' && usernameValue.length >= 3 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {usernameStatus === 'available' && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                  {usernameStatus === 'taken' && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                {errors.username && (
                  <p className="text-sm text-destructive">{errors.username.message}</p>
                )}
                {usernameStatus === 'taken' && !errors.username && (
                  <p className="text-sm text-destructive">This username is already taken</p>
                )}
              </div>

              {/* Full Name (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Full Name <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  autoComplete="name"
                  {...register('fullName')}
                  disabled={loading}
                />
              </div>

              {/* Email - Full Width */}
              <div className="space-y-2 md:col-span-2">
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...register('password')}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  disabled={loading}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                  disabled={loading}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            {/* Referral Code (optional) */}
            <div className="space-y-2">
              <Label htmlFor="referralCode">
                Referral Code <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="referralCode"
                type="text"
                placeholder="e.g. JOH4F2A1"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value.toUpperCase())}
                disabled={loading}
                className="uppercase tracking-widest"
              />
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
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>

            {/* Terms */}
            <p className="text-center text-sm text-muted-foreground">
              By signing up, you agree to our{' '}
              <Link href="/terms" className="underline hover:text-primary">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline hover:text-primary">
                Privacy Policy
              </Link>
            </p>

            {/* Login Link */}
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link href="/login" className="font-medium text-primary hover:underline">
                Log in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
