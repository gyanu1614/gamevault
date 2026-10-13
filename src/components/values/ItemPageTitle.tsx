/**
 * The ONE value item page title (owner, 2026-10-12): the item's name as the
 * big title, "Value in <Game>" as one line under it — "Bat Dragon Value in
 * Adopt Me" in one heading wrapped badly ("…in Adopt / Me"). Both parts stay
 * inside the <h1>, so search engines still read the full query phrase.
 * Server-safe.
 */
export function ItemPageTitle({ name, game }: { name: string; game: string }) {
  return (
    <h1 className="text-text-primary">
      <span className="block text-balance text-[30px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-display">{name}</span>{' '}
      <span className="mt-1.5 block text-body-lg font-medium text-text-secondary sm:mt-2 sm:text-subheading">Value in {game}</span>
    </h1>
  )
}
