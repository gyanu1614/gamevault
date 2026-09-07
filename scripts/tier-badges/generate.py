import os, sys
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

STYLE = ("3D game achievement rank badge, mobile-game UI asset, glossy faceted "
         "central gemstone with a small embedded star at its center, subtle rim "
         "light, soft ambient glow, crisp clean edges, centered composition, "
         "TRANSPARENT background (alpha, no backdrop), no text, no letters, "
         "square 1:1 icon, high detail.")

BADGES = {
 "quartz": "A plain milky-white translucent faceted hexagonal quartz crystal badge with a subtle silver star at its center, clean and minimal, soft white inner glow, thin pale-silver rim. NO wings, NO laurels, NO crown. The simplest entry-rank badge.",
 "amethyst": "A purple amethyst crystal badge: six-pointed faceted violet gem with a silver star at center, flanked by two small delicate silver laurel leaves at the base, violet inner glow, polished silver frame. Slightly more ornate than a plain crystal.",
 "ruby": "A deep-red ruby crystal badge: faceted red gem with a gold star at center, wrapped in a golden laurel wreath around the lower half, warm red glow, ornate gold trim. Grander than the amethyst tier.",
 "sapphire": "A deep-blue sapphire crystal badge: faceted blue gem with a silver star at center, framed by a pair of outstretched silver-white feathered wings and a full silver laurel wreath, cool blue glow, refined metallic detailing. Premium high-rank look.",
 "diamond": "The ultimate rank: a brilliant white and ice-blue diamond badge, dazzling faceted gem with a radiant star at center, crowned with an ornate golden crown on top, flanked by large radiant feathered wings, surrounded by sparkles and light rays, prismatic rainbow glints. The most detailed and majestic badge of the set.",
}

MODEL = sys.argv[1] if len(sys.argv) > 1 else "gemini-3-pro-image"
only = sys.argv[2:] if len(sys.argv) > 2 else list(BADGES)

for tier in only:
    prompt = f"{BADGES[tier]}\n\nStyle: {STYLE}"
    try:
        resp = client.models.generate_content(model=MODEL, contents=prompt)
        saved = False
        for part in resp.candidates[0].content.parts:
            if getattr(part, "inline_data", None) and part.inline_data.data:
                path = f"public/tiers/{tier}.png"
                with open(path, "wb") as f:
                    f.write(part.inline_data.data)
                print(f"✓ {tier} -> {path} ({len(part.inline_data.data)} bytes)")
                saved = True
        if not saved:
            print(f"✗ {tier}: no image in response")
    except Exception as e:
        print(f"✗ {tier}: {str(e)[:200]}")
