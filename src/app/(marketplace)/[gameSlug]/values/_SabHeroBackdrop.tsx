/**
 * Shared SAB "DropMarket Values" hero backdrop. Matches the GameBoost approach:
 * a DESATURATED image (so no bright colored areas fight the content) under a
 * HEAVY near-black gradient (only ~5-10% of the image shows through as pure
 * atmosphere), fading fully into the page background toward the bottom.
 *
 * Renders the fixed backdrop layer + opens a `relative z-10` content wrapper,
 * so wrap the page's content in `<SabHeroBackdrop>{children}</SabHeroBackdrop>`.
 */
export function SabHeroBackdrop({
  height = 480,
  children,
}: {
  /** Band height in px — taller for content-heavy pages. */
  height?: number
  children: React.ReactNode
}) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden"
        style={{ height }}
      >
        {/* Image — lightly desaturated but clearly visible; it should read as
            real atmosphere behind the hero, not vanish into the background. */}
        <div
          className="absolute inset-0 bg-[center_top] bg-no-repeat opacity-[0.85] [background-size:cover] [filter:grayscale(0.35)]"
          style={{ backgroundImage: "url('/assets/heroes/steal-a-brainrot.avif')" }}
        />
        {/* Near-black scrim, lighter at the top so the image shows through, then
            deepening to solid so content stays crisp and it fades into the page. */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0C0F0E]/[0.45] via-[#0C0F0E]/[0.78] to-[#0C0F0E]" />
        {/* Soft edge vignette. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 15%, transparent 35%, rgba(12,15,14,0.45) 100%)',
          }}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </>
  )
}
