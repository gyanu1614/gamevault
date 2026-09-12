# Seller rank badges

Drop 5 badge images here, named EXACTLY (lowercase, .png):

    bronze.png     Rank 1  — plainest (entry)
    silver.png     Rank 2
    gold.png       Rank 3
    diamond.png    Rank 4
    legendary.png  Rank 5  — grandest (top)

## Current state (post gemstone → rank rename)
The gemstone-era art was renamed by ladder position as a PLACEHOLDER:

- `bronze.png`    = old quartz art (white crystal — needs a bronze/copper re-render)
- `silver.png`    = REMOVED (old amethyst art had a fake checkerboard "transparency" baked into the pixels — falls back to the flat lucide Medal icon until a real silver/steel render exists)
- `legendary.png` = old diamond art (ice-white — close enough until a lime-glow re-render)
- `gold.png`      = MISSING (tier falls back to the flat lucide Trophy icon)
- `diamond.png`   = MISSING (tier falls back to the flat lucide Diamond icon)

## Specs
- **Transparent background** (PNG alpha). No dark box behind the badge.
- **Square** (1:1), ~512×512px. Same framing/scale across all 5 so they line up.
- Badge centred, art fills most of the frame with a little padding.
- Keep the visual language consistent across the set (same style, escalating
  ornamentation): plain medal → +laurels → +wreath → +wings → +crown+wings.

## Colors (match the rank identity in src/lib/seller/tiers.ts)
- bronze    = warm copper / orange
- silver    = cool steel / white
- gold      = yellow gold
- diamond   = ice blue / cyan
- legendary = lime glow (the site's prestige accent, most dazzling)

Once the 5 files are here, the app renders them automatically (with a gentle
float + shine animation) everywhere a rank badge shows — storefront, navbar,
listing pages, /account/tiers, etc. No further code changes needed.

If a file is missing for a rank, that rank gracefully falls back to the flat
lucide icon, so a partial set won't break anything.
