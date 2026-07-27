/**
 * ContentDisclaimer — the legal-safe footer note for value / blog / seller
 * content pages. Positions DropMarket as a neutral facilitator (never a
 * reseller) and disclaims affiliation + value-guarantees, mirroring the wording
 * live competitors (Eldorado, PlayerAuctions, Rolimons) use. See the
 * legal-safe-content-phrasing memo.
 *
 * NOT legal advice — have counsel review before publishing high-risk pages.
 */

const PUBLISHER_BY_GAME: Record<string, string> = {
  'steal-a-brainrot': 'Roblox Corporation',
  'grow-a-garden': 'Roblox Corporation',
  'adopt-me': 'Roblox Corporation',
  'blox-fruits': 'Roblox Corporation',
  'mm2': 'Roblox Corporation',
}

/** Best-effort publisher name; defaults to the game's own rights holder. */
function publisherFor(gameSlug?: string | null): string {
  if (gameSlug && PUBLISHER_BY_GAME[gameSlug]) return PUBLISHER_BY_GAME[gameSlug]
  return 'their respective owners'
}

export function ContentDisclaimer({
  gameName,
  gameSlug,
  /** Include the value-estimate clause (value/price pages only). */
  includeValueNote = true,
}: {
  gameName?: string
  gameSlug?: string | null
  includeValueNote?: boolean
}) {
  const publisher = publisherFor(gameSlug)
  const game = gameName || 'The game'

  return (
    <aside className="mt-10 rounded-lg border border-white/[0.07] bg-white/[0.02] px-5 py-4 text-[12px] leading-relaxed text-[#8B978F]">
      <p>
        DropMarket is an independent player-to-player marketplace that connects buyers and sellers
        and provides SafeDrop escrow protection — we do not own the items listed and do not buy,
        sell, or resell game content ourselves. Sellers set their own prices; buyers and sellers are
        solely responsible for reviewing and complying with the applicable game&apos;s Terms of
        Service.
      </p>
      {includeValueNote && (
        <p className="mt-2">
          Values shown are community-based estimates for reference only, compiled from publicly
          available data and marketplace activity. They are not offers, appraisals, or guarantees of
          price, and actual trade values vary. Provided &ldquo;as is&rdquo; — verify independently
          before trading.
        </p>
      )}
      <p className="mt-2">
        {game} and its related marks and logos are trademarks of {publisher}. DropMarket is not
        endorsed by, sponsored by, or affiliated with {publisher}.
      </p>
    </aside>
  )
}
