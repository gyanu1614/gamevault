# DropMarket

## Skill usage (apply automatically, never ask)
- UI/component work → design-taste-frontend (primary) + frontend-design; apple-design for motion, gestures, touch feel; ui-ux-pro-max only for palette/font choices; review with web-design-guidelines before finishing
- Any React/Next code → vercel-react-best-practices
- Unsure about a library API → context7 first, never guess
- New feature or bug → superpowers (brainstorm → plan → TDD → verify)
- Payment, auth, or user-data code → security-guidance must pass before finishing
- Pages, metadata, listings → seo (router) and its sub-skills
- Be concise. Prefer grep/glob over reading whole files. Show evidence, not claims.

## Homepage surface rule
Homepage sections share one page surface. A section may vary perceived depth through ambient light, character art with fade masks on every edge, or vertical rhythm — never through a border, a box, or its own background colour. Any image either carries a fade mask on all edges or is a contained component whose clipping reads as local. Card, chip, and input borders are component-level and unaffected.

## Section authoring contract
The `.page-rhythm` container (globals.css) owns vertical rhythm (gap-20 sm:gap-32) and the content measure (max-w-7xl + px-4 sm:px-6 lg:px-8). Every section is a direct child and inherits both.

- **Sections contain content only.** No vertical padding, no margin, no max-width, no horizontal padding, no `overflow-hidden`, no border, no background colour. If a section needs any of these, the need is in the wrong place — fix the container or the component inside it.
- **Full-bleed is opt-in.** Mark a direct child `data-bleed` to escape the measure. Only the pre-footer CTA band and background artwork qualify.
- **Section headers are one row** *when they carry an action link*: heading left-aligned, link right-aligned, same row, baseline-aligned. A section with **no** action link centres its title instead — it reads as a page-level title rather than a list header.
- **Section titles are the one place type may scale with the viewport** — a modest `clamp()`. Everything else stays fixed px.
- **Background artwork is oversized and offset** so it exits at least one edge, sits behind content, and carries a fade mask on *every* edge — never a hard crop from a parent's `overflow-hidden`. Horizontal bleed that would cause page-level scroll is contained with `overflow-x-clip` (x-axis only; `clip` keeps y visible so ambient light still crosses section boundaries).
- **Card, chip and input borders are component-level** and unaffected by any of the above.

## Artwork
- **The image carries its own normalising filter. The gradient assumes a normalised input and is NOT tuned per image.** Art is swapped per game, so a gradient tuned to one screenshot breaks on the next — a bright plate blows out, a dark one vanishes. The `<img>` gets `HERO_ART_NORMALISE` (`brightness(0.4) saturate(0.6)`, defined in `HeroArtLayer.tsx`) so every source lands at a similar value first. **If a plate reads wrong, adjust the filter — never the gradient stops.**
- Fade stack, in order: darken the art → tint toward base with a blended layer → gradient overlay → clip.
- The gradient must reach the page background **token**, never an approximate hex, well before the clip point, so the clip edge is invisible.
- The art is heavily suppressed everywhere and merely *least* covered at its brightest point — never more than ~10% visible.
- Art is oversized and positioned to exit at least one edge. Never sized to fit its container.
- Any effects layer (grain, glow, noise, sheen) sits **inside** the fading stack, or it paints past the boundary and creates a seam. This has bitten us: a sheen ending at the clip produced a measured +8/channel step.
- Verify boundaries by sampling pixels either side — they must be identical.
