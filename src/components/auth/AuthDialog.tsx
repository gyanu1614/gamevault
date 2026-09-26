'use client'

/**
 * V24 — Auth modal, "Forest Ledger" edition: context + provider.
 *
 * Any button anywhere in the app opens it with
 * `useAuthDialog().open('login' | 'signup')`.
 *
 * PERF-005 — this module is imported by providers.tsx, i.e. the ROOT LAYOUT, so
 * whatever it pulls in ships on first paint for every route. The 1,147-line
 * dialog body (framer-motion + react-hook-form + zod + sonner + lucide +
 * AvatarUpload's 131 kB of @dicebear) therefore lives in AuthDialogBody.tsx and
 * is fetched with next/dynamic only once the dialog is first opened. The
 * context, the hook and the open/close state stay eager — a few hundred bytes,
 * and every consumer needs them synchronously.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

import type { AuthMode } from '@/components/auth/authDialogStyles'

export type { AuthMode }

// ssr:false — the modal is never part of the first paint, and this keeps its
// chunk out of the server bundle for every route the provider wraps.
const AuthDialogBody = dynamic(() => import('@/components/auth/AuthDialogBody'), {
  ssr: false,
})

/* ──────────────────────────────────────────────────────────────────
   Context
   ────────────────────────────────────────────────────────────────── */


interface AuthDialogOpenOpts {
  /** Where to send the user after a successful login/signup.
   *  Defaults to staying on the current page (just refresh). */
  redirect?: string
}

interface AuthDialogContextValue {
  open: (mode?: AuthMode, opts?: AuthDialogOpenOpts) => void
  close: () => void
  isOpen: boolean
}

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null)

export function useAuthDialog() {
  const ctx = useContext(AuthDialogContext)
  if (!ctx) {
    throw new Error('useAuthDialog must be used inside <AuthDialogProvider>')
  }
  return ctx
}

/* ──────────────────────────────────────────────────────────────────
   Provider + Dialog shell
   ────────────────────────────────────────────────────────────────── */

export function AuthDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>('login')
  // V17 — Caller-supplied post-auth redirect target. Lives in a ref so
  // updates between renders never re-trigger the dialog effect chain.
  const redirectRef = useRef<string | null>(null)

  const open = useCallback((next: AuthMode = 'login', opts?: AuthDialogOpenOpts) => {
    setMode(next)
    redirectRef.current = opts?.redirect ?? null
    setIsOpen(true)
  }, [])
  const close = useCallback(() => setIsOpen(false), [])

  // Mount the lazy body only after the dialog has been opened at least once.
  // Rendering it unconditionally would make next/dynamic request the chunk on
  // mount, which is exactly the first-paint cost this split removes. Once
  // mounted it stays mounted, so close/reopen keeps the enter/exit animation.
  const [hasOpened, setHasOpened] = useState(false)
  useEffect(() => {
    if (isOpen) setHasOpened(true)
  }, [isOpen])

  return (
    <AuthDialogContext.Provider value={{ open, close, isOpen }}>
      {children}
      {hasOpened && (
        <AuthDialogBody
          open={isOpen}
          onOpenChange={setIsOpen}
          mode={mode}
          onModeChange={setMode}
          redirectRef={redirectRef}
        />
      )}
    </AuthDialogContext.Provider>
  )
}

export function useOpenAuthOnMount(mode: AuthMode, opts?: AuthDialogOpenOpts) {
  const { open } = useAuthDialog()
  // Pluck redirect into a local so the effect dep array stays stable.
  const redirect = opts?.redirect
  useEffect(() => {
    open(mode, redirect ? { redirect } : undefined)
  }, [mode, open, redirect])
}
