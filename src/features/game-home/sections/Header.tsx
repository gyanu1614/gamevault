import { Gamepad2 } from 'lucide-react'
import { SellerPromptCard } from '@/components/seller/SellerPrompt'
import type { HeaderModel } from '../types'

/**
 * The game page header, the SAME as the category pages' (ItemsPageClient,
 * owner 2026-09-28): logo on the left, the game small on top, the big line
 * beside it, the seller prompt card on the right. The H1 reads
 * "{Game} Marketplace" to crawlers (the game name is in it, visually hidden,
 * exactly like "{Game} Items"). Under it, the live facts line the owner picked
 * (2026-10-24) as plain visible text.
 */
export function Header({ header }: { header: HeaderModel }) {
  const { gameName, gameImageUrl, itemNoun, facts } = header
  return (
    <header className="flex flex-wrap items-center gap-3.5 pt-2 sm:gap-5 sm:pt-3">
      {gameImageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={gameImageUrl} alt={`${gameName} logo`} width={72} height={72} className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-[72px] sm:w-[72px]" />
      ) : (
        <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-bg-overlay text-lime-text sm:h-[72px] sm:w-[72px]">
          <Gamepad2 className="h-6 w-6" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-text-secondary sm:text-[14px]">{gameName}</p>
        <h1
          className="font-black tracking-tight text-text-primary"
          style={{ fontSize: 'var(--fs-page-title)', lineHeight: 1.05, fontWeight: 'var(--fw-heading)', letterSpacing: '-0.02em' }}
        >
          <span className="sr-only">{gameName} </span>
          Marketplace
        </h1>
        {facts && (
          <p className="mt-2 tabular-nums text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
            {facts}
          </p>
        )}
      </div>
      {/* Seller prompt beside the title; its own row on phones (as on the category pages). */}
      <SellerPromptCard gameName={gameName} categoryLabel={itemNoun} className="w-full sm:ml-auto sm:w-auto sm:max-w-[520px]" />
    </header>
  )
}
