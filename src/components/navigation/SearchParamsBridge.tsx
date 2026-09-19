'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Reads the URL's search params on the client and hands them to the parent,
 * WITHOUT dragging the parent into the useSearchParams() static-rendering
 * bailout.
 *
 * On a statically rendered route, any client component that calls
 * useSearchParams() is client-rendered up to the nearest Suspense boundary —
 * the prerendered HTML holds only the fallback. Put the hook in a leaf that
 * renders nothing, wrap that leaf in its own boundary, and the parent's markup
 * (listings, calculator, filters) stays in the HTML while URL-driven state
 * arrives after hydration.
 *
 * Fires on mount and again whenever the params change (soft navigation).
 */
export function SearchParamsBridge({
  onParams,
}: {
  onParams: (params: URLSearchParams) => void
}) {
  return (
    <Suspense fallback={null}>
      <Reader onParams={onParams} />
    </Suspense>
  )
}

function Reader({ onParams }: { onParams: (params: URLSearchParams) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    onParams(new URLSearchParams(searchParams.toString()))
  }, [searchParams, onParams])
  return null
}
