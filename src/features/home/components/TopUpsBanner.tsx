'use client'

/**
 * V17m — Top-Ups & Gift Cards backdrop banner.
 *
 * Faithfully recreates the design handoff (banner.html / 2400×600 4:1)
 * using pure CSS + an SVG mascot. Composition:
 *   • Two-stop radial backdrop (cool navy left, warm violet hint right)
 *   • Blue + gold "blooms" — large blurred color circles
 *   • Center vignette to protect overlaid heading text
 *   • Left cluster: mascot + props (cards, coins, sparkles)
 *   • Right cluster: fan of cards, coins, sparkles
 *   • Top/bottom darkening + inset edge shadows for seamless blend
 *
 * The art is authored at fixed 2400×600 then scaled to the container
 * width via a container query (`100cqw / 2400`). The outer stage uses
 * `aspect-ratio: 4 / 1` so height follows width automatically.
 *
 * All motion is ambient CSS animation and is suppressed under
 * `prefers-reduced-motion: reduce`.
 *
 * Drop this behind your section content; keep important text in the
 * center ~60% of the width so it sits on the dark negative space.
 */

export function TopUpsBanner() {
  return (
    <div className="tu-stage" aria-hidden>
      <div className="tu-art">
        <div className="tu-banner">
          {/* V17p — Mirror baked directly into the .tu-scale transform
              as an inline style. Inline styles trump any styled-jsx
              scoping mishap so this guarantees the flip applies. The
              composed transform: shift right by canvas-width → flip
              horizontally → scale down to container width. Read CSS
              transform functions left-to-right = applied LEFT first. */}
          <div
            className="tu-scale"
            style={{
              // Read CSS transforms right-to-left to understand effect
              // on the element. First scale down, then flip around the
              // top-left, then push back into view.
              transform:
                'scale(calc(100cqw / 2400)) scaleX(-1) translateX(-2400px)',
              transformOrigin: 'top left',
            }}
          >
            <div className="tu-mirror">
            <div className="tu-bloom-l" />
            <div className="tu-bloom-r" />

            {/* LEFT cluster — V59: props (cards/coins/sparkles) removed
                per design feedback; the raptor is the only art here. */}
            <div className="tu-cluster tu-left">
              {/* Character anchor — un-mirrored by .unflip so he faces
                  the content, floating on the same bob animation. */}
              <img
                src="/characters/raptor.webp"
                alt=""
                className="mascot unflip"
                width={210}
                height={519}
              />
            </div>

            </div>{/* /tu-mirror */}

            <div className="tu-vignette" />
            <div className="tu-topbot" />
            <div className="tu-edges" />
          </div>
        </div>
        {/* V17m-b — Text shield. Sits ABOVE the scaled-art layer so it
            isn't mirrored by the parent's scaleX(-1). Renders a dark
            wash that fades from solid on the left edge to transparent
            around 55%, plus a faint backdrop-blur so anything behind
            (mascot props that drift into the left zone) gets softened.
            This is what makes the heading and subtitle pop against the
            chibi mascot's busy art. */}
        <div className="tu-text-shield" aria-hidden />
      </div>

      {/* Scoped CSS. Lives inside the component so a single import is
          enough — no separate stylesheet to wire into globals.css. */}
      <style jsx>{`
        .tu-stage {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .tu-art {
          position: absolute;
          inset: 0;
          container-type: size;
        }
        .tu-banner {
          position: absolute;
          inset: 0;
          overflow: hidden;
          /* V17m-b — Background colors swapped: navy "main" anchor is
             now on the right (where the mascot will land) so the lit
             side of the composition follows the flipped art. */
          background:
            radial-gradient(140% 180% at 88% 50%, #15243f 0%, #0c1526 38%, #070b15 70%, #04060c 100%),
            radial-gradient(120% 160% at 12% 50%, #1a1b2e 0%, transparent 55%);
        }
        /* V17m-b — Text shield. Subtle dark wash on the left so the
           heading reads well over the prop fan, without blacking out
           the section. Tuned light: 50% opacity at the very edge,
           fading to transparent before 40%. No backdrop-blur (was
           too heavy and washed the whole section).
         */
        .tu-text-shield {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background: linear-gradient(
            90deg,
            rgba(4, 6, 12, 0.55) 0%,
            rgba(4, 6, 12, 0.25) 22%,
            transparent 42%
          );
        }
        /* V17p — .tu-scale's transform is set inline on the element so
           we only keep its non-transform properties here. */
        .tu-scale {
          position: absolute;
          top: 0;
          left: 0;
          width: 2400px;
          height: 600px;
        }
        /* Mobile — the width-scaled 2400×600 canvas collapses to a
           ~90-150px strip pinned to the top of the section on phones
           (raptor shrinks to ~30px). Below md we drop the scaled art
           layer entirely and keep only the full-bleed .tu-banner
           gradient + text shield, which still reads as a styled band. */
        @media (max-width: 767px) {
          .tu-scale {
            display: none;
          }
        }
        .tu-mirror {
          display: contents;
        }

        .tu-bloom-l {
          position: absolute;
          left: -6%;
          top: 50%;
          width: 780px;
          height: 780px;
          transform: translateY(-50%);
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(56, 132, 255, 0.3) 0%,
            rgba(56, 132, 255, 0.1) 38%,
            transparent 68%
          );
          filter: blur(8px);
        }
        .tu-bloom-r {
          position: absolute;
          right: -4%;
          top: 46%;
          width: 680px;
          height: 680px;
          transform: translateY(-50%);
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(255, 196, 84, 0.16) 0%,
            rgba(74, 120, 255, 0.12) 40%,
            transparent 70%
          );
          filter: blur(10px);
        }
        .tu-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            70% 120% at 50% 50%,
            rgba(4, 6, 12, 0.8) 0%,
            rgba(4, 6, 12, 0.45) 30%,
            transparent 60%
          );
        }
        .tu-topbot {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(4, 6, 12, 0.55) 0%,
            transparent 22%,
            transparent 78%,
            rgba(4, 6, 12, 0.65) 100%
          );
        }
        .tu-edges {
          position: absolute;
          inset: 0;
          box-shadow:
            inset 90px 0 120px -40px #04060c,
            inset -90px 0 120px -40px #04060c;
        }
        .tu-cluster {
          position: absolute;
          top: 0;
          height: 100%;
        }
        .tu-left {
          left: 0;
          width: 42%;
        }
        .tu-right {
          right: 0;
          width: 40%;
        }

        .mascot {
          position: absolute;
          left: 150px;
          bottom: 8px;
          width: 210px;
          height: 519px;
          animation: tu-bob 5s ease-in-out infinite;
          filter: drop-shadow(0 24px 40px rgba(20, 60, 160, 0.45));
        }
        .mascot.unflip {
          transform: scaleX(-1);
          animation: tu-bob-flip 5s ease-in-out infinite;
        }

        @keyframes tu-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        /* Flip-preserving bob — keyframe transforms REPLACE the base
           transform, so the mirrored mascot needs scaleX inside the
           keyframes too. */
        @keyframes tu-bob-flip {
          0%, 100% { transform: translateY(0) scaleX(-1); }
          50% { transform: translateY(-10px) scaleX(-1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mascot {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
