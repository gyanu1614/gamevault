'use client'

/**
 * PaymentQr — the scannable code. Plain SVG drawn from qr.ts: black square
 * modules on white, 4-module quiet zone, level H under a small centre coin
 * mark on its own white plate. Vector, so it stays sharp at any pixel ratio;
 * nothing animates over it and no filter or opacity touches it.
 */

import { useMemo } from 'react'
import { drawQr } from './qr'

export function PaymentQr({
  payload,
  logo,
  label,
}: {
  /** Exactly what the wallet should read (qrPayload). */
  payload: string
  /** Same-origin coin mark (e.g. /crypto/usdt.svg) or null. */
  logo: string | null
  /** Accessible description, e.g. "QR code to pay 37.49 USDT". */
  label: string
}) {
  const qr = useMemo(() => drawQr(payload, { withLogo: !!logo }), [payload, logo])
  const mark = qr.logo ? qr.logo.plate - qr.logo.inset * 2 : 0

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${qr.side} ${qr.side}`}
      shapeRendering="crispEdges"
      className="block h-auto w-[240px] rounded-md sm:w-[260px]"
    >
      <title>{label}</title>
      <rect width={qr.side} height={qr.side} fill="#FFFFFF" />
      <path d={qr.path} fill="#000000" />
      {qr.logo && logo && (
        <g>
          <rect
            x={qr.logo.x}
            y={qr.logo.y}
            width={qr.logo.plate}
            height={qr.logo.plate}
            fill="#FFFFFF"
          />
          <image
            href={logo}
            x={qr.logo.x + qr.logo.inset}
            y={qr.logo.y + qr.logo.inset}
            width={mark}
            height={mark}
            preserveAspectRatio="xMidYMid meet"
            style={{ shapeRendering: 'auto' }}
          />
        </g>
      )}
    </svg>
  )
}
