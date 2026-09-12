# Game marks

One SVG per game, named for its slug: `steal-a-brainrot.svg`, `adopt-me.svg`.
`GameMark` (`src/components/icons/GameMark.tsx`) resolves the file from the slug.

## Spec

- **Silhouette only.** The file is rendered as a CSS mask, so only its alpha
  matters — every colour, gradient and stroke inside it is discarded and
  replaced with one flat fill. A multi-colour source will not break the tile,
  but keep the art a single solid shape so what you see in the file is what
  ships.
- **Square viewBox**, trimmed tight to the shape. The mark is scaled to 56% of
  the tile with `mask-size: contain`, so any padding baked into the viewBox
  makes the mark render smaller than every other game's.
- **Fills, not strokes.** A stroked path scales its outline with the mask and
  goes hairline at 24px. Convert strokes to filled outlines before exporting.
- **No `<text>`.** Convert type to paths; the mask does not load webfonts.

## Colour

Marks carry no colour of their own. Each game's tile background is `games.mark_bg`
(one hex), and the fill is derived from it by WCAG contrast — white at 92% or
near-black, whichever scores higher. Set `games.mark_fill` (`light` | `dark`)
only to override that pick; it wins outright.
