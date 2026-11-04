# Game Home — Design References (researched 2026-10-23)

These are the design moves each section copies. Sizes were measured at 1440px on the live pages or read from the
component source. Pages that didn't load were skipped: G2G, LootBar, Skinport /sell, elvebredd, adoptmetradingvalues.

## How Buying Works (no cards)

**References**
- Aceternity Timeline: a scroll-drawn 2px line with a gradient progress stroke, its track masked at top and bottom.
- Linear home "FIG 0.1–0.3": columns split by hairlines, a mono micro-label, a big illustration, no boxes.

**Copy**
- 4 columns: icon 120–160px, title 18–20px/600, one muted line 14–15px at max-w ~240px.
- Connector: an SVG at icon-centre height. The track is white/8%; a green stroke draws in with scroll.
- Stagger: opacity 0→1 and y 20→0 over 0.5s, ~0.15s per step. Each icon springs from 0.9 to 1 when the line reaches it.
- Labels: mono "01"…"04", not badges.
- Phones: a vertical line on the left and 72px icons.

**Avoid:** boxed tiles; more than 4 steps.

## Start Selling

**References**
- GameBoost cashback tile: stacked "You earned $X" pills; the middle one bright, the outer ones faded.
- Eldorado /become-seller: "Start making money on Eldorado", one CTA, a 4-item trust strip.
- Etsy /sell: the fees used as headings.
- Fiverr: real stats.

**Copy**
- Split layout with no frame and a 10–15% radial glow behind the art.
- Left: H2, one line, one CTA, and real numbers as large thin numerals (fee %, payout time).
- Right: 3–5 real item renders (brand art, no silver) with price pills. They bob over 6–8s by ±6px, out of phase.
- Optional: "Listed · $X" toasts that cycle every ~2.5s, neighbours at 40% opacity.
- A count-up when the band enters view (1.2s).

**Avoid:** "verification" CTAs (owner rule); invented earnings.

## Guides Carousel

**References**
- Apple gallery: one slide per view, 28px radius, dots, crossfade.
- Aceternity Apple Cards Carousel.
- Embla tween examples (parallax / scale / opacity). Source constants: opacity 0.84, scale 0.52, parallax 0.2.

**Copy**
- Embla `align: 'center'`; slides ~80% wide on phones and ~62% on desktop, so the neighbours peek in.
- Parallax on the cover (inner layer ~115% wide) plus the opacity tween on neighbours.
- Title and meta sit on the cover, bottom-left, over a bottom gradient.

**Avoid:** a padded card around a smaller image (card in card).

## Tools Row

**References**
- Raycast "thousands more" reel: 20px radius, 56px gaps, snap, an edge fade of 64px left and 224px right.
- Magic UI Marquee and Aceternity Infinite Cards (both auto-move, so they're not suited to things people click).

**Copy**
- One Embla row (`dragFree`), with the larger fade on the right as the "there's more" hint.
- A 64–80px silver icon poking slightly above the tile, then the title and one line.
- Hover: lift 4px and rotate 4° on a spring.

**Avoid:** an auto-moving marquee for clickable tiles.

## Trust (no cards)

**References**
- Linear FIG hairline columns.
- GameBoost glossy 3D icons with a soft glow underneath.
- Stripe stats row: light-weight large numerals, no backgrounds.

**Copy**
- 3 columns split by 1px white/6% lines.
- 112–140px icons that bob (5–7s, ±6px, staggered).
- ONE green radial glow below each icon (~25%→0, blur ~40px) plus a faint floor shadow.
- Title 18–20px, one line, max-w 260px.

**Avoid:** a different glow colour per icon. Keep one hue so the silver reads as one material.

## FAQ + About

**FAQ**
- Raycast Pro: centred heading, a ~700px column, questions 16px/600, ~39px row padding, 1px separators, no fills.
- Build: Radix Accordion with a 200–250ms height animation.

**About**
- Eldorado `/adopt-me-pets` keeps all its keyword copy at the BOTTOM: "Buy Adopt Me Pets Cheap" plus a rating chip, a
  ~120-word intro, "What Are Adopt Me Pets?" with a rarity list, "Buy Adopt Me Items", "Adopt Me Shop", "Why buy on
  Eldorado?" (8 bullets) and "How to buy" (6 steps). It uses dense in-text links.
- Copy: those headings and 100–150-word paragraphs, but as alternating rows (art right → art left → centred text).
  Art is 280–360px renders with no frame; text max 560px wide; text fades in from ±24px.

**Avoid:** a full-width wall of text.

## Hero

**References**
- GameBoost `/steal-a-brainrot`: full-bleed art 1440×540 behind the nav with a bottom gradient. Its ~95% overlay is too
  heavy.

**Copy**
- Art 480–560px with `object-cover`, a bottom gradient to the ground, and a left vignette at ~60–70%.
- One slow scale from 1.06 to 1 on load (no loop, off under reduced motion).
- Logo 72–96px with `rounded-2xl` and a shadow; H1 40–48px/700 tight; one line at 70% white.

## 3D Icons

- **3dicons.co** is CC0 (github.com/realvjy/3dicons).
- **URL pattern:** `https://3dicons.sgp1.cdn.digitaloceanspaces.com/v1/{dynamic|front|iso}/{clay|color|gradient|premium}/{slug}-{angle}-{style}.png`
- **Slugs:**

  | Need | Slug |
  |---|---|
  | Search | `zoom` |
  | Card / wallet | `card`, `wallet` |
  | Gift | `gift` |
  | Check | `tick` |
  | Shield | `sheild` (sic) |
  | Lightning / rocket | `flash`, `rocket` |
  | Chat | `chat-bubble` |
  | Money | `money-bag`, `dollar` |
  | Tools row | `calculator`, `chart` |
  | Extras | `trophy`, `lock`, `crown`, `medal` |

- **Style:** try `clay` first under `SilverIcon` (the coloured styles may go muddy when grayscaled).
- **Rule:** self-host any picked icon under `public/icons/3d/`; never hotlink.
