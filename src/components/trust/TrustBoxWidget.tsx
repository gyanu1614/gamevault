'use client'

/**
 * Trustpilot's own TrustBox, loaded after the page is interactive. Rendered
 * only by <TrustpilotShowcase> once the profile has 10+ reviews; the template
 * is the free showcase widget chosen in the Trustpilot dashboard
 * (NEXT_PUBLIC_TRUSTBOX_TEMPLATE_ID). Until the script runs, the inner link
 * is the fallback: our profile, no score.
 */
import Script from 'next/script'
import { useEffect, useRef } from 'react'

import { TRUSTPILOT_PROFILE_URL } from '@/lib/trustpilot/links'

const BOOTSTRAP = 'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js'

declare global {
  interface Window {
    Trustpilot?: { loadFromElement(el: HTMLElement, forceReload?: boolean): void }
  }
}

export function TrustBoxWidget({ templateId, businessUnitId, className }: { templateId: string; businessUnitId: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  const load = () => {
    if (ref.current && window.Trustpilot) window.Trustpilot.loadFromElement(ref.current, true)
  }
  // A client-side navigation back to the page: the script is already there.
  useEffect(load, [])

  return (
    <>
      <Script src={BOOTSTRAP} strategy="lazyOnload" onLoad={load} />
      <div
        ref={ref}
        className={['trustpilot-widget', className].filter(Boolean).join(' ')}
        data-locale="en-US"
        data-template-id={templateId}
        data-businessunit-id={businessUnitId}
        data-style-height="24px"
        data-style-width="100%"
        data-theme="dark"
      >
        <a href={TRUSTPILOT_PROFILE_URL} target="_blank" rel="noopener noreferrer" className="text-[13px] text-text-secondary">
          Trustpilot
        </a>
      </div>
    </>
  )
}
