import { IconHeadset, IconShieldCheck, type Icon as TablerIcon } from '@tabler/icons-react'
import { TrustpilotGate, TrustpilotShowcase } from '@/components/trust/TrustpilotShowcase'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'

/**
 * The pet's picture in a box with the trust strip under it (owner,
 * 2026-10-26, GameBoost as the reference). The two promises are the site's
 * own (TrustBand: Money-Back Guarantee under SafeDrop Protection, 24/7 human
 * support); the Trustpilot row is Trustpilot's real widget and appears only
 * once the profile has 10+ reviews — no score we did not earn. The art sits
 * on the plain card surface (house rule: real art, no decorative glow).
 */
export function PictureBox({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return (
    <figure className={cn('overflow-hidden rounded-lg', MARKET_CARD)}>
      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden sm:aspect-[5/4]">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- catalogue art from storage, same as the value pages */
          <img
            src={imageUrl}
            alt={name}
            width={480}
            height={480}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="h-[64%] w-[64%] object-contain drop-shadow-[0_22px_32px_rgba(0,0,0,0.5)]"
          />
        ) : (
          <span className="font-medium uppercase tracking-wider text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
            No Image Yet
          </span>
        )}
      </div>
      <figcaption className="sr-only">{name}</figcaption>

      <div className="grid grid-cols-2 bg-[#24252B] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <TrustCell icon={IconShieldCheck} label="Money-Back Guarantee" />
        <TrustCell icon={IconHeadset} label="24/7 Support" className="shadow-[inset_1px_0_0_rgba(255,255,255,0.05)]" />
      </div>
      <TrustpilotGate>
        <div className="flex min-h-[52px] items-center justify-center bg-[#1F2025] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <TrustpilotShowcase />
        </div>
      </TrustpilotGate>
    </figure>
  )
}

function TrustCell({ icon: Icon, label, className }: { icon: TablerIcon; label: string; className?: string }) {
  return (
    <div className={cn('flex min-h-[56px] items-center gap-3 px-4 py-3 sm:px-5', className)}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-lime-tint-bg text-lime-text">
        <Icon aria-hidden size={17} stroke={1.9} />
      </span>
      <span className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-meta)' }}>
        {label}
      </span>
    </div>
  )
}
