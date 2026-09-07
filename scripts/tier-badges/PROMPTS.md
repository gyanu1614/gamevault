# Tier badge generation prompts

5 ornate floating gemstone-medallion badges, one per seller tier, escalating in
detail and grandeur. Game-UI achievement-badge style (like the reference strip):
a central faceted gemstone with a small inset star, clean rendering, soft inner
glow, on a **transparent background**, centered, square 1:1, no text.

Style anchors (apply to ALL): "3D game achievement rank badge, mobile-game UI
asset, glossy faceted central gemstone with a small embedded star at its center,
subtle rim light, soft ambient glow, crisp vector-clean edges, centered
composition, transparent background, no text, no letters, square icon."

Model: gemini-2.5-flash-image (flash) for the set; try gemini-3-pro-image-preview
for the top 1-2 if flash detail is weak.

## Per tier (low → high, ornamentation escalates)

1. **quartz** — Entry. "a plain milky-white translucent faceted hexagonal quartz
   crystal badge with a subtle silver star at its center, clean and minimal, soft
   white inner glow, thin pale-silver rim, NO wings NO laurels NO crown."

2. **amethyst** — "a purple amethyst crystal badge, six-pointed faceted gem with a
   silver star at center, flanked by two small delicate silver laurel leaves at
   the base, violet inner glow, polished silver frame."

3. **ruby** — "a deep-red ruby crystal badge, faceted gem with a gold star at
   center, wrapped in a golden laurel wreath around the lower half, warm red glow,
   ornate gold trim, slightly larger and grander than the amethyst tier."

4. **sapphire** — "a deep-blue sapphire crystal badge, faceted gem with a silver
   star at center, framed by a pair of outstretched silver-white feathered wings
   and a full silver laurel wreath, cool blue glow, refined metallic detailing,
   premium high-rank look."

5. **diamond** — "the ultimate rank: a brilliant white-and-ice-blue diamond badge,
   dazzling faceted gem with a radiant star at center, crowned with an ornate
   golden crown on top, flanked by large radiant feathered wings, surrounded by
   sparkles and light rays, prismatic rainbow glints, the most detailed and
   majestic badge of the set."

## Output
- Save to public/tiers/{tier}.png (transparent, square, ~512px).
- Consistent framing/scale across all 5 so they line up in a row.
