

// ─── Step 1: category picker ────────────────────────────────────────────────

// R12 — Category tile theme per slug: icon + gradient bg + accent ring.
// Each category gets a distinct gradient tint so the grid reads as a
// well-branded chooser rather than 'five generic dark cards'.
/**
 * Masks the shared house category glyph (public/icons/categories/*.svg),
 * the same set the homepage hero chips and the navbar use. Masking rather
 * than <img> lets the glyph take its colour from the plate it sits on.
 */
export function categoryGlyphStyle(icon: string): React.CSSProperties {
  const url = `url(/icons/categories/${icon}.svg)`
  return {
    maskImage: url,
    WebkitMaskImage: url,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  }
}

export const CATEGORY_THEME: Record<
  string,
  {
    /** Slug of the house SVG under public/icons/categories. */
    icon: string
    iconBg: string    // gradient classes for the icon plate
    ring: string      // hover/active ring accent
    /**
     * R15 — concrete one-line example shown on the tile instead of the DB
     * description. The DB descriptions ran long and got truncated; short
     * concrete examples (e.g. "Robux, V-Bucks, gold") read faster and
     * always fit on one line at this card size.
     */
    example: string
  }
> = {
  currency: {
    icon: 'currency',
    iconBg: 'bg-gradient-to-br from-amber-400/30 via-yellow-500/20 to-orange-500/20',
    ring: 'group-hover:border-amber-400/40',
    example: 'Robux, Gold',
  },
  items: {
    icon: 'items',
    iconBg: 'bg-gradient-to-br from-rose-500/30 via-pink-500/20 to-red-500/20',
    ring: 'group-hover:border-rose-400/40',
    example: 'Pets, Skins, Knives',
  },
  accounts: {
    icon: 'accounts',
    iconBg: 'bg-gradient-to-br from-sky-400/30 via-blue-500/20 to-indigo-500/20',
    ring: 'group-hover:border-sky-400/40',
    example: 'Ranked, Progression',
  },
  'top-up': {
    icon: 'top-up',
    iconBg: 'bg-gradient-to-br from-yellow-300/30 via-amber-400/25 to-yellow-500/20',
    ring: 'group-hover:border-yellow-400/40',
    example: 'Crystals, UC, Crew',
  },
  boosting: {
    icon: 'boosting',
    iconBg: 'bg-gradient-to-br from-[rgba(86,184,127,0.25)] via-[rgba(86,184,127,0.15)] to-emerald-500/15',
    ring: 'group-hover:border-lime-tint-border',
    example: 'Rank Pushes, Win Boosts',
  },
}
