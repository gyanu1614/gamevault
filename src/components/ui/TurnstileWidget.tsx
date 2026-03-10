'use client'

/**
 * P2.7 — Cloudflare Turnstile CAPTCHA widget
 *
 * Loads the Turnstile script lazily and renders the widget inside a ref'd div.
 * Props:
 *   onToken   — called with the CAPTCHA token when the challenge succeeds
 *   onExpire  — called when the token expires (caller should reset token state)
 *   onError   — called on widget error
 *   className — extra classes for the outer wrapper
 */

import Script from 'next/script'
import { useRef, useCallback } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render:  (container: HTMLElement, opts: Record<string, unknown>) => string
      reset:   (widgetId: string) => void
      remove:  (widgetId: string) => void
    }
  }
}

interface TurnstileWidgetProps {
  onToken:   (token: string) => void
  onExpire?: () => void
  onError?:  () => void
  className?: string
}

export function TurnstileWidget({ onToken, onExpire, onError, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef  = useRef<string | null>(null)

  const renderWidget = useCallback(() => {
    if (!window.turnstile || !containerRef.current || widgetIdRef.current !== null) return

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey:           process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? 'MISSING_SITE_KEY',
      callback:          onToken,
      'error-callback':  () => { onError?.(); widgetIdRef.current = null },
      'expired-callback': () => { onExpire?.(); widgetIdRef.current = null },
      theme:             'dark',
      size:              'normal',
    })
  }, [onToken, onExpire, onError])

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        onLoad={renderWidget}
      />
      <div ref={containerRef} className={className ?? 'flex justify-center'} />
    </>
  )
}
