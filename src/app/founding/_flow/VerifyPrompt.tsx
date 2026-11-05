'use client'

/**
 * The one mention of ID on the signup page (owner, 2026-11-05): "nice modal... once
 * they can list but small not dominant". A small card in the corner after the store
 * opens, never over the page, no dimmed background, nothing to get past. It says
 * plainly that it is optional, and once closed it stays closed on this device.
 */

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SealCheckIcon } from '@phosphor-icons/react/dist/csr/SealCheck'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { IconTile, accountBtn } from '@/components/account/AccountSurface'
import { openIdentityCheck, useIdentityCheck } from '@/components/account/IdentityCheck'
import { safeLocal } from '@/lib/safe-storage'
import { cn } from '@/lib/utils'

/** Long enough for the page to land first. */
const SHOW_AFTER_MS = 900

export function VerifyPrompt({ userId }: { userId: string }) {
  const { state, available } = useIdentityCheck()
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const key = `dm.founding.verifyPrompt:${userId}`

  useEffect(() => {
    if (state !== 'not_started' || !available || safeLocal.get(key)) return
    const timer = setTimeout(() => setOpen(true), SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [state, available, key])

  const close = () => {
    setOpen(false)
    safeLocal.set(key, '1')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-labelledby="verify-prompt-title"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          onKeyDown={(e) => { if (e.key === 'Escape') close() }}
          className="fixed inset-x-4 bottom-4 z-40 rounded-lg bg-[#1D1E23] p-4 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.85),inset_0_0_0_1px_rgba(255,255,255,0.07)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[340px]"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-md text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <XIcon size={16} weight="bold" aria-hidden />
          </button>

          <div className="flex items-start gap-3 pr-7">
            <IconTile tone="trust">
              <SealCheckIcon size={22} weight="duotone" />
            </IconTile>
            <div className="min-w-0">
              <h2 id="verify-prompt-title" className="text-[14px] font-semibold text-text-primary">Get Verified</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
                Add the verified badge to your store. Optional: you can list and sell without it.
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                close()
                openIdentityCheck()
              }}
              className={cn(accountBtn.primary, 'h-9 flex-1')}
            >
              Verify Identity
            </button>
            <button type="button" onClick={close} className={cn(accountBtn.secondary, 'h-9')}>
              Later
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
