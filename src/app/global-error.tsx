'use client'

/**
 * Last-resort error boundary — catches render errors in the ROOT layout
 * itself, which app/error.tsx cannot (that one renders *inside* the layout).
 *
 * Because it replaces the whole document, it must ship its own <html>/<body>,
 * and it cannot rely on globals.css or any provider having mounted. Styles are
 * therefore inline and self-contained, matching the near-black/lime chrome
 * rather than Next's unstyled default screen.
 */

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: 'app/global-error' },
      contexts: error?.digest
        ? { nextjs: { digest: error.digest } }
        : undefined,
    })

    // An error boundary is very often the last thing that renders before the
    // user hits reload or leaves, which kills the page and any send still in
    // flight. Flushing pushes the event out now instead of hoping the tab
    // survives long enough. Not awaited — useEffect must stay synchronous,
    // and the flush itself is what matters, not its result. Bounded at 2s;
    // void marks the dangling promise as deliberate.
    void Sentry.flush(2000)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem 1rem',
          textAlign: 'center',
          backgroundColor: '#0A0B0A',
          color: '#F5F6F5',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
          }}
        >
          Something Went Wrong
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth: '28rem',
            fontSize: '0.9375rem',
            lineHeight: 1.6,
            color: '#9BA29B',
          }}
        >
          The page failed to load. Our team has been notified — please try
          again.
        </p>

        {error?.digest && (
          <p
            style={{
              margin: 0,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.75rem',
              color: '#9BA29B',
            }}
          >
            Error ID: {error.digest}
          </p>
        )}

        <a
          href="/"
          style={{
            marginTop: '0.5rem',
            display: 'inline-flex',
            minHeight: '48px',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.5rem',
            backgroundColor: '#C6F24E',
            padding: '0 2rem',
            fontWeight: 600,
            color: '#0A0B0A',
            textDecoration: 'none',
          }}
        >
          Browse Marketplace
        </a>
      </body>
    </html>
  )
}
