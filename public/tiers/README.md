# Seller tier badges

Drop 5 badge images here, named EXACTLY (lowercase, .png):

    quartz.png     Tier 1  — plainest (entry)
    amethyst.png   Tier 2
    ruby.png       Tier 3
    sapphire.png   Tier 4
    diamond.png    Tier 5  — grandest (top)

## Specs
- **Transparent background** (PNG alpha). No dark box behind the badge.
- **Square** (1:1), ~512×512px. Same framing/scale across all 5 so they line up.
- Badge centred, art fills most of the frame with a little padding.
- Keep the visual language consistent across the set (same style, escalating
  ornamentation): plain crystal → +laurels → +wreath → +wings → +crown+wings.

## Suggested colors (match the tier identity)
- quartz  = white / translucent crystal
- amethyst = purple
- ruby    = red
- sapphire = deep blue
- diamond = white / ice-blue (most dazzling)

Once the 5 files are here, the app renders them automatically (with a gentle
float + shine animation) everywhere a tier badge shows — storefront, navbar,
listing pages, /account/tiers, etc. No further code changes needed.

If a file is missing for a tier, that tier gracefully falls back to the flat
lucide icon, so a partial set won't break anything.
