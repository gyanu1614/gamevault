# Per-game CTA background heroes

Drop an image here named after the game's slug and it becomes the background of
the "Skip the grind — buy the … item you want" band at the bottom of EVERY page
in that game's content hub (blog, values, per-pet, calculator …).

## How to use
1. Add a file named `{gameSlug}.jpg` — e.g.
   - `steal-a-brainrot.jpg`  → shows on all Steal a Brainrot hub pages
   - `adopt-me.jpg`          → shows on all Adopt Me hub pages
2. That's it. No admin, no database, no rebuild config — the component reads
   `/cta-heroes/{gameSlug}.jpg` directly.

## Notes
- Format: `.jpg` (the component references `.jpg`). A wide, ~1600×500 image
  works best (it's `object-cover`, shown at ~28% opacity behind a left-weighted
  dark scrim, so text on the left stays readable).
- If no file exists for a game, the band shows a clean dark gradient instead —
  it always looks finished, the image is a pure enhancement.
- To change an image, just replace the file with the same name.
