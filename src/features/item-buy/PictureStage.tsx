'use client'

import { useState, type ReactNode } from 'react'
import { IconBolt, IconHeadset, IconShieldCheck, type Icon as TablerIcon } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'

/** Never blow the art up beyond this many times its own pixels (it blurs). */
const MAX_UPSCALE = 1.5

/**
 * The pet on a calm stage, with the trust strip fixed to its foot (owner,
 * 2026-10-27; Skinport's image stage + GameBoost's trust strip). The art sits
 * on a soft floor shadow and is capped near its real resolution once loaded,
 * so small catalogue art stays sharp. The picked trait's badges sit in the
 * corner. The promises are the site's own (TrustBand copy), each with a
 * blue icon; `trustpilot` is the server-rendered row, shown only with 10+
 * reviews.
 */
export function PictureStage({
  imageUrl,
  name,
  traitCode,
  trustpilot,
}: {
  imageUrl: string | null
  name: string
  /** Adopt Me shorthand of the trait on show ("NFR"), drawn as the game's badges. */
  traitCode: string | null
  trustpilot: ReactNode
}) {
  const [cap, setCap] = useState<number | null>(null)

  return (
    <div className="overflow-hidden rounded-lg bg-[#17181C] shadow-[0_30px_60px_-36px_rgba(0,0,0,0.9)]">
      <div className="relative grid aspect-[16/11] place-items-center bg-[linear-gradient(180deg,#1C1D22_0%,#141519_100%)] sm:aspect-[4/3] lg:aspect-[16/10]">
        {imageUrl ? (
          <div className="relative flex h-[62%] w-full items-end justify-center">
            <span aria-hidden className="absolute bottom-[-6%] h-[10%] w-[34%] rounded-[50%] bg-black/55 blur-md" />
            {/* eslint-disable-next-line @next/next/no-img-element -- catalogue art from storage, same as the value pages */}
            <img
              src={imageUrl}
              alt={name}
              width={512}
              height={512}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onLoad={(e) => setCap(e.currentTarget.naturalWidth * MAX_UPSCALE)}
              style={cap ? { maxWidth: cap, maxHeight: cap } : undefined}
              className="relative h-full w-auto object-contain"
            />
          </div>
        ) : (
          <span className="font-medium uppercase tracking-[0.14em] text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
            Picture Coming Soon
          </span>
        )}
        {traitCode ? <TraitMarks code={traitCode} size={28} className="absolute left-4 top-4" /> : null}
      </div>

      <ul className="grid grid-cols-3 bg-[#1A1B20] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <TrustItem icon={IconShieldCheck} label="Money-Back Guarantee" short="Money-Back" />
        <TrustItem icon={IconBolt} label="Quick Delivery" divider />
        <TrustItem icon={IconHeadset} label="24/7 Support" divider />
      </ul>
      {trustpilot}
    </div>
  )
}

/** One promise: a blue icon and its label; phones show the short label (TrustBand's tile wording) on one line. */
function TrustItem({ icon: Icon, label, short, divider = false }: { icon: TablerIcon; label: string; short?: string; divider?: boolean }) {
  return (
    <li
      className={cn(
        'flex min-h-[52px] items-center justify-center gap-2 px-2 py-2.5 sm:min-h-[64px] sm:gap-2.5 sm:px-4',
        divider && 'shadow-[inset_1px_0_0_rgba(255,255,255,0.05)]',
      )}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-info-bg text-info sm:h-8 sm:w-8">
        <Icon aria-hidden size={16} stroke={1.9} />
      </span>
      <span className="whitespace-nowrap text-[12px] font-semibold leading-tight text-text-primary sm:text-[13px]">
        {short ? (
          <>
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </span>
    </li>
  )
}
