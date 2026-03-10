/**
 * Trustpilot Widget Component
 *
 * Displays Trustpilot review widgets
 */

'use client'

import React, { useEffect, useRef } from 'react'
import Script from 'next/script'

interface TrustpilotWidgetProps {
  templateId: string
  businessUnitId?: string
  height?: string
  width?: string
  theme?: 'light' | 'dark'
  stars?: '1' | '2' | '3' | '4' | '5'
}

export default function TrustpilotWidget({
  templateId,
  businessUnitId = process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID || '',
  height = '140px',
  width = '100%',
  theme = 'dark',
  stars = '5',
}: TrustpilotWidgetProps) {
  const widgetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load Trustpilot widget when component mounts
    if (typeof window !== 'undefined' && (window as any).Trustpilot) {
      (window as any).Trustpilot.loadFromElement(widgetRef.current, true)
    }
  }, [])

  if (!businessUnitId) {
    return null // Don't render if business unit ID not configured
  }

  return (
    <>
      <Script
        src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
        strategy="lazyOnload"
        onLoad={() => {
          if (widgetRef.current && (window as any).Trustpilot) {
            (window as any).Trustpilot.loadFromElement(widgetRef.current, true)
          }
        }}
      />
      <div
        ref={widgetRef}
        className="trustpilot-widget"
        data-locale="en-US"
        data-template-id={templateId}
        data-businessunit-id={businessUnitId}
        data-style-height={height}
        data-style-width={width}
        data-theme={theme}
        data-stars={stars}
      />
    </>
  )
}

/**
 * Mini Trustpilot Widget - Shows rating and star count
 */
export function TrustpilotMini() {
  return (
    <TrustpilotWidget
      templateId="5419b6a8b0d04a076446a9ad"
      height="24px"
      width="auto"
    />
  )
}

/**
 * Trustpilot Mini Carousel - Shows recent reviews
 */
export function TrustpilotCarousel() {
  return (
    <TrustpilotWidget
      templateId="54ad5defc6454f065c28af8b"
      height="240px"
      width="100%"
    />
  )
}

/**
 * Trustpilot Grid - Shows review grid
 */
export function TrustpilotGrid() {
  return (
    <TrustpilotWidget
      templateId="539adbd6dec7e10e686debee"
      height="500px"
      width="100%"
    />
  )
}

/**
 * Trustpilot Quote - Shows single review quote
 */
export function TrustpilotQuote() {
  return (
    <TrustpilotWidget
      templateId="54ad5defc6454f065c28af8b"
      height="240px"
      width="100%"
    />
  )
}
