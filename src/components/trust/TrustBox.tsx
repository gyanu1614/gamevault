/**
 * TrustBox — lazy-loading Trustpilot review widget.
 *
 * Renders nothing unless NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID is set, so it
 * is safe to drop into any page before the Trustpilot account exists. The
 * third-party widget script (~30 KB) is NOT loaded on mount: it is injected
 * only when the widget first scrolls near the viewport (IntersectionObserver,
 * 200px rootMargin), keeping it off the critical path and protecting INP/LCP.
 * The script is injected once per page no matter how many TrustBoxes render.
 *
 * Not placed anywhere yet — intended for the homepage and money pages later.
 *
 * Usage:
 *   <TrustBox />                                  // Mini (stars + rating + count)
 *   <TrustBox templateId={TRUSTBOX_TEMPLATES.microCombo} height="20px" />
 *   <TrustBox templateId={TRUSTBOX_TEMPLATES.carousel} height="240px" />
 *
 * @param templateId  Trustpilot TrustBox template ID. Defaults to the Mini
 *                    TrustBox. See TRUSTBOX_TEMPLATES for common ones.
 * @param height      CSS height passed to data-style-height. Default '150px'.
 * @param width       CSS width passed to data-style-width. Default '100%'.
 * @param theme       Widget theme, 'light' | 'dark'. Default 'dark' (site bg).
 * @param locale      Widget locale. Default 'en-GB'.
 * @param className   Extra classes on the outer wrapper (spacing etc.).
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'

// Template constants live in a plain (non-client) module so server pages can
// import them without tripping the RSC client-manifest prerender bug. Import for
// internal use, and re-export so existing
// `import { TRUSTBOX_TEMPLATES } from '.../TrustBox'` keeps working.
import { TRUSTBOX_TEMPLATES } from './trustbox-templates'
export { TRUSTBOX_TEMPLATES, REVIEW_COLLECTOR_TOKEN } from './trustbox-templates'

const BUSINESS_UNIT_ID = process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID
const WIDGET_SCRIPT_SRC =
  'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js'

/** Inject the Trustpilot bootstrap script exactly once per page. */
let scriptPromise: Promise<void> | null = null
function loadTrustpilotScript(): Promise<void> {
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).Trustpilot) {
      resolve()
      return
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${WIDGET_SCRIPT_SRC}"]`
    )
    const script = existing ?? document.createElement('script')

    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener(
      'error',
      () => {
        scriptPromise = null // allow retry on a later mount
        reject(new Error('Failed to load Trustpilot widget script'))
      },
      { once: true }
    )

    if (!existing) {
      script.src = WIDGET_SCRIPT_SRC
      script.async = true
      document.head.appendChild(script)
    }
  })

  return scriptPromise
}

interface TrustBoxProps {
  templateId?: string
  /** data-token — required by the Review Collector template, unused by others. */
  token?: string
  height?: string
  width?: string
  theme?: 'light' | 'dark'
  locale?: string
  className?: string
}

export default function TrustBox({
  templateId = TRUSTBOX_TEMPLATES.mini,
  token,
  height = '150px',
  width = '100%',
  theme = 'dark',
  locale = 'en-GB',
  className,
}: TrustBoxProps) {
  const widgetRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  // Defer everything until the widget approaches the viewport.
  useEffect(() => {
    if (!BUSINESS_UNIT_ID) return
    const el = widgetRef.current
    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Once visible: load the script (shared, once) and hydrate this element.
  useEffect(() => {
    if (!shouldLoad) return
    let cancelled = false

    loadTrustpilotScript()
      .then(() => {
        if (cancelled) return
        const tp = (window as any).Trustpilot
        if (widgetRef.current && tp) {
          tp.loadFromElement(widgetRef.current, true)
        }
      })
      .catch((err) => console.warn('[TrustBox]', err))

    return () => {
      cancelled = true
    }
  }, [shouldLoad])

  // No Business Unit ID configured — render nothing at all.
  if (!BUSINESS_UNIT_ID) return null

  return (
    <div className={className}>
      <div
        ref={widgetRef}
        className="trustpilot-widget"
        data-locale={locale}
        data-template-id={templateId}
        data-businessunit-id={BUSINESS_UNIT_ID}
        data-token={token}
        data-style-height={height}
        data-style-width={width}
        data-theme={theme}
      >
        {/* Fallback link shown until the widget script hydrates this node */}
        <a
          href="https://www.trustpilot.com/review/dropmarket.gg"
          target="_blank"
          rel="noopener noreferrer"
        >
          Trustpilot
        </a>
      </div>
    </div>
  )
}
