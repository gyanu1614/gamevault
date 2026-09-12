# Rank icons (small glyphs)

Drop 5 icon files here, named EXACTLY (lowercase, .png):

    bronze.png
    silver.png
    gold.png
    diamond.png
    legendary.png

These are the SMALL rank glyphs (rank cards on /account/tiers, compact rows).
The big ornate medallions live one folder up in `public/tiers/` and are a
separate art set — keep both.

## Best format
- **PNG with REAL alpha transparency** (export "transparent background" —
  never art with a checkerboard pattern baked into the pixels; that
  checkerboard renders literally).
- **Square (1:1), 128×128 px** (rendered at 24–32 px, so 128 gives crisp
  retina at 4×; anything 96–256 is fine). Keep all 5 the same framing/scale.
- Small padding inside the canvas (~8%) so glyphs don't touch the edge.
- If your source is vector, SVG works too — but then the filename must still
  be referenced as .png, so export to PNG for drop-in use.
- Keep file size small (< 50 KB each); run through TinyPNG/squoosh if needed.

Once a file exists it is used automatically wherever RankIcon renders; a
missing file gracefully falls back to the flat colored glyph, so a partial
set won't break anything.
