'use client'

/**
 * V43 — Trust band: 3 hover-revealed guarantee tiles (Money-back /
 * Quick delivery / 24-7 support). Shared across the item buy panel,
 * currency offer panels, and bundle pages.
 *
 * V48b — Flat lucide glyphs replaced with 3D art: chromeless tiles
 * (no border/surface — the icons float directly on the panel, each on
 * a drop shadow, lifting/scaling on hover). Swap art in
 * `public/icons/trust/` (transparent PNG, square).
 */

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const TRUST_ITEMS: Array<{
  key: string
  label: string
  /** Tooltip heading — fuller than the tile label. */
  title: string
  /** Tooltip body — one concrete, plain-English promise. */
  body: string
  img: string
  /** Backlight color — matches the icon art's own palette. */
  glow: string
}> = [
  {
    key: 'guarantee',
    label: 'Money-Back',
    title: 'Money-Back Guarantee',
    body: 'Every order is covered by SafeDrop Buyer Protection — the seller is only paid after you confirm delivery. No product? Full refund.',
    img: '/icons/trust/money-back.png',
    glow: '#4FA3F7',
  },
  {
    key: 'fast',
    label: 'Quick Delivery',
    title: 'Quick Delivery',
    body: 'Sellers are ranked by real delivery speed — most orders arrive within minutes of purchase.',
    img: '/icons/trust/quick-delivery.png',
    glow: '#8F7BF2',
  },
  {
    key: 'support',
    label: '24/7 Support',
    title: '24/7 Human Support',
    body: 'Real humans, around the clock. Open a ticket or live chat whenever an order needs help.',
    img: '/icons/trust/support.png',
    glow: '#8A79F5',
  },
]

export function TrustBand({ className }: { className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn('grid grid-cols-3 gap-2', className)}>
        {TRUST_ITEMS.map((item) => (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="group relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1.5 py-2"
              >
                {/* Rim glow — drop-shadow follows the PNG's alpha
                    silhouette, so the color hugs the icon's outline like
                    a soft stroke (no ambient blob). Tightens to the art,
                    brightens slightly on hover; the second shadow keeps
                    the dark grounding. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.img}
                  alt=""
                  aria-hidden
                  style={{ '--icon-glow': `${item.glow}8C` } as React.CSSProperties}
                  className="relative h-8 w-8 shrink-0 object-contain transition-all duration-300 [filter:drop-shadow(0_0_5px_var(--icon-glow))_drop-shadow(0_6px_7px_rgba(0,0,0,0.45))] group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:[filter:drop-shadow(0_0_9px_var(--icon-glow))_drop-shadow(0_6px_7px_rgba(0,0,0,0.45))]"
                />
                <span className="relative text-balance text-center text-[10.5px] font-semibold leading-tight text-text-secondary drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] group-hover:text-text-primary">
                  {item.label}
                </span>
              </button>
            </TooltipTrigger>
            {/* Rich tooltip card — accent-dot heading + plain-English
                promise on a frosted panel (not the bare black default). */}
            {/* side=bottom — the trust row sits directly under the Buy
                CTA, so a top-side popup would cover the button. Below
                the row there's only page margin. */}
            <TooltipContent
              side="bottom"
              sideOffset={8}
              className="max-w-[250px] rounded-xl border-border-strong bg-bg-overlay-2/95 px-3.5 py-3 backdrop-blur-md"
            >
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: item.glow, boxShadow: `0 0 6px ${item.glow}` }}
                />
                <span className="text-[12px] font-bold tracking-tight text-text-primary">
                  {item.title}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-text-secondary">
                {item.body}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
