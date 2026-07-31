/**
 * Per-game theming for the content hub (blog / values / calculator).
 *
 * The content hub is a distinct visual world from the lime marketplace: near
 * black, hairline grids, one accent spent once per block. Every game shares the
 * same STRUCTURE and the same neutral tokens; what changes per game is the
 * accent family and the ambient backdrop.
 *
 * Deliberately namespaced `--ct-*` rather than overriding the global
 * `--color-*` tokens. Overriding the globals would retint every shared
 * marketplace component that appears inside a content page as a side effect;
 * a separate namespace keeps the blast radius to components that opt in.
 *
 * Adding a game = adding an entry here. Nothing else.
 */

export interface GameContentTheme {
  /** Display name used in breadcrumbs, headings and copy. */
  name: string
  /** 2-3 letter mark shown in the hero badge when a game has no logo. */
  initials: string
  /** Primary accent — buttons, active states, the featured badge. */
  accent: string
  /** Accent tuned for text on the dark ground (fails contrast as a fill). */
  accentText: string
  /** Border colour for accent-tinted blocks. */
  accentBorder: string
  /** Deep accent-tinted surface, used for art tiles and CTA grounds. */
  accentDeep: string
  /** Text colour that sits on top of a solid `accent` fill. */
  onAccent: string
  /**
   * Ambient hero backdrop — layered radial glows plus a faint vertical rule
   * pattern. Per game so each hub reads differently at a glance without
   * changing a single measurement.
   */
  ambient: string
  /** Hub H1. Overridden by `games.seo_h1` when an admin sets one. */
  heroTitle: string
  /** One-line positioning under the H1. */
  heroLead: string
  /**
   * The "what is this game and why do prices move" paragraph. Lives here
   * rather than in the DB so a new game hub reads complete on day one;
   * `games.seo_intro` overrides it once someone writes something better.
   */
  heroAbout: string
  /**
   * A representative worked example for the blog's calculator promo. MUST use
   * real items and the real variant/mutation vocabulary of THIS game — the
   * promo previously shipped a hardcoded Steal a Brainrot fixture on every
   * game's hub, so an Adopt Me visitor saw Brainrot names. Scoping it to the
   * theme means every game hub inherits a correct sample from its own entry.
   */
  calculatorExample: CalcPromoExample
}

/** Static worked-example for the blog calculator promo (see `calculatorExample`). */
export interface CalcPromoExample {
  /** Left side of the trade — "They offer". */
  offer: string
  /** Right side — "You give". */
  give: string
  /** Verdict letter shown in the badge: W / F / L. */
  letter: string
  /** Plain-language verdict line. */
  verdict: string
  /** Small qualifier under the verdict. */
  qualifier: string
}

/** Neutral tokens — identical across every game. */
export const CONTENT_NEUTRALS = {
  bg: '#0A0D0B',
  bgDeep: '#080B09',
  surface: '#0B0F0C',
  surface2: '#0E130F',
  hover: '#101710',
  line: '#1A211A',
  lineSoft: '#151B15',
  lineStrong: '#263026',
  text: '#F2F6F0',
  text2: '#D7DED4',
  textMuted: '#98A398',
  textDim: '#7C877C',
  textFaint: '#5E685E',
  /** Losses and price drops — muted clay, never pure red. */
  negative: '#C97B6B',
} as const

function ambientFor(rgb: string, angle: number, step: number): string {
  return [
    `radial-gradient(58% 52% at 12% 0%, rgba(${rgb},0.16), transparent 70%)`,
    `radial-gradient(38% 42% at 88% 6%, rgba(${rgb},0.07), transparent 72%)`,
    `repeating-linear-gradient(${angle}deg, rgba(255,255,255,0.012) 0 1px, transparent 1px ${step}px)`,
  ].join(', ')
}

/**
 * Fallback for games with no entry yet. Desaturated green-grey so an unthemed
 * hub reads as intentional rather than broken — but distinct enough from the
 * SAB forest that it's obvious a theme is missing.
 */
const DEFAULT_THEME: GameContentTheme = {
  name: 'DropMarket',
  initials: 'DM',
  accent: '#6E8C74',
  accentText: '#A9BCAD',
  accentBorder: '#252E26',
  accentDeep: '#0D110E',
  onAccent: '#080B09',
  ambient: ambientFor('110,140,116', 90, 44),
  heroTitle: 'Item values, trading and cash-out guides',
  heroLead:
    'What items are actually worth — priced from completed sales, not trading-server rumours.',
  heroAbout:
    'These guides track what buyers really pay, and what that means whether you are buying, selling or holding. Every value is built from completed sales and active listings on DropMarket, never from estimates.',
  // Neutral, game-agnostic fallback — no item names, so an unthemed game never
  // shows another game's items. Reads as an illustrative placeholder.
  calculatorExample: {
    offer: 'Their side of the trade',
    give: 'Your side of the trade',
    letter: 'F',
    verdict: 'See if the trade is fair',
    qualifier: 'Based on completed sales',
  },
}

const THEMES: Record<string, GameContentTheme> = {
  'steal-a-brainrot': {
    name: 'Steal a Brainrot',
    initials: 'SAB',
    accent: '#3FA35C',
    accentText: '#8FBF9C',
    accentBorder: '#23331F',
    accentDeep: '#0D140E',
    onAccent: '#08110B',
    ambient: ambientFor('63,163,92', 90, 44),
    heroTitle: 'Steal a Brainrot values, trading and cash-out guides',
    heroLead:
      'Everything worth knowing about what Brainrots are actually worth — priced from completed sales, not trading-server rumours.',
    heroAbout:
      'Steal a Brainrot is a Roblox base-building game where players steal and defend Brainrots that generate income per second. Almost all trading happens around Secrets and mutated variants, and prices move whenever an event adds or retires supply. These guides track what people really pay, and what that means if you are buying, selling or holding.',
    // SAB items + SAB mutation vocabulary (Default / Lava …).
    calculatorExample: {
      offer: 'Antonio · Default — $149.99',
      give: 'Bunny and Eggy · Lava — $183.72',
      letter: 'L',
      verdict: 'You come out behind',
      qualifier: 'Based on completed sales',
    },
  },
  'adopt-me': {
    name: 'Adopt Me',
    initials: 'AM',
    accent: '#B07BC9',
    accentText: '#CBA8DA',
    accentBorder: '#2E2338',
    accentDeep: '#120E15',
    onAccent: '#0B0810',
    ambient: ambientFor('176,123,201', 135, 40),
    heroTitle: 'Adopt Me pet values, neons and trading guides',
    // No "completed sales" claim: at launch Adopt Me cash values are derived
    // estimates (the marketplace has no Adopt Me sales history yet). The lead
    // stays honest — trade value + an estimated cash value — until real orders
    // replace the estimates. Update this once sales data exists.
    heroLead:
      'What pets are worth in trade — and an estimated cash value in real money, with the demand shifts that move them.',
    heroAbout:
      'Adopt Me is a Roblox pet-collecting and trading game where value is driven almost entirely by event exclusivity and age rather than in-game cost. Legendary event pets, neons and megas carry most of the trading volume, and prices swing hard whenever an old pet is rereleased. These guides track what buyers pay and what that means before you accept an offer.',
    // Adopt Me pets + the Adopt Me variant vocabulary (Fly Ride / Neon Fly
    // Ride) — never SAB items or SAB mutations. Prices omitted on purpose: at
    // launch Adopt Me cash values are derived estimates, so a concrete dollar
    // figure here would misrepresent them as observed. The variant names alone
    // carry the point of the promo (pick a variant, check the trade).
    calculatorExample: {
      offer: 'Frost Dragon · Neon Fly Ride',
      give: 'Shadow Dragon · Fly Ride',
      letter: 'F',
      verdict: 'Check if this trade is fair',
      qualifier: 'Cash values estimated until sales land',
    },
  },
}

export function getGameContentTheme(gameSlug: string): GameContentTheme {
  return THEMES[gameSlug] ?? DEFAULT_THEME
}

/** True when the game has a real theme rather than the fallback. */
export function hasGameContentTheme(gameSlug: string): boolean {
  return gameSlug in THEMES
}

/**
 * The theme as CSS custom properties, to spread onto a wrapper's `style`.
 * Neutrals are included so a content page never depends on a global that some
 * other surface might change.
 */
export function contentThemeVars(
  theme: GameContentTheme,
): Record<string, string> {
  return {
    '--ct-bg': CONTENT_NEUTRALS.bg,
    '--ct-bg-deep': CONTENT_NEUTRALS.bgDeep,
    '--ct-surface': CONTENT_NEUTRALS.surface,
    '--ct-surface-2': CONTENT_NEUTRALS.surface2,
    '--ct-hover': CONTENT_NEUTRALS.hover,
    '--ct-line': CONTENT_NEUTRALS.line,
    '--ct-line-soft': CONTENT_NEUTRALS.lineSoft,
    '--ct-line-strong': CONTENT_NEUTRALS.lineStrong,
    '--ct-text': CONTENT_NEUTRALS.text,
    '--ct-text-2': CONTENT_NEUTRALS.text2,
    '--ct-text-muted': CONTENT_NEUTRALS.textMuted,
    '--ct-text-dim': CONTENT_NEUTRALS.textDim,
    '--ct-text-faint': CONTENT_NEUTRALS.textFaint,
    '--ct-negative': CONTENT_NEUTRALS.negative,
    '--ct-accent': theme.accent,
    '--ct-accent-text': theme.accentText,
    '--ct-accent-border': theme.accentBorder,
    '--ct-accent-deep': theme.accentDeep,
    '--ct-on-accent': theme.onAccent,
    '--ct-ambient': theme.ambient,
  }
}
