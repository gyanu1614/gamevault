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

            {/* LEFT cluster */}
            <div className="tu-cluster tu-left">
              <div className="far">
                <div className="coin" style={{ left: 260, top: 80, width: 46, height: 46, animation: 'tu-bob-up 5s ease-in-out .7s infinite' }} />
                <div
                  className="card gold"
                  style={{ left: 250, top: 380, width: 110, height: 70, ['--r' as any]: '18deg', animation: 'tu-bob-up 6s ease-in-out 1.4s infinite' }}
                >
                  <div className="sheen" />
                  <div className="chip" />
                  <div className="stripe" />
                </div>
              </div>
              <div className="coin" style={{ left: 90, top: 120, width: 70, height: 70, animation: 'tu-bob-up 5s ease-in-out .3s infinite' }} />
              <div className="coin" style={{ left: 50, top: 360, width: 54, height: 54, animation: 'tu-bob-down 5s ease-in-out 1.1s infinite' }} />
              <div
                className="card blue"
                style={{ left: 40, top: 220, width: 150, height: 96, ['--r' as any]: '-16deg', animation: 'tu-bob-down 5s ease-in-out .5s infinite' }}
              >
                <div className="sheen" />
                <div className="chip" />
                <div className="stripe" />
              </div>
              <div className="sparkle" style={{ left: 180, top: 90, width: 26, height: 26, animation: 'tu-spark 2s ease-in-out .2s infinite' }} />
              <div className="sparkle" style={{ left: 120, top: 470, width: 20, height: 20, animation: 'tu-spark 3s ease-in-out .9s infinite' }} />

              {/* Mascot — rendered as <img> so we don't have to inline
                  the ~7KB SVG in every render. The file lives at
                  /public/section-bg/topups-mascot.svg. */}
              <img
                src="/section-bg/topups-mascot.svg"
                alt=""
                className="mascot"
                width={430}
                height={505}
              />
            </div>

            {/* RIGHT cluster */}
            <div className="tu-cluster tu-right">
              <div className="far">
                <div
                  className="card gold"
                  style={{ left: 610, top: 250, width: 120, height: 76, ['--r' as any]: '-6deg', animation: 'tu-bob-down 6s ease-in-out 1.6s infinite' }}
                >
                  <div className="sheen" />
                  <div className="chip" />
                  <div className="stripe" />
                </div>
                <div className="coin" style={{ left: 820, top: 380, width: 44, height: 44, animation: 'tu-bob-down 5s ease-in-out 1.2s infinite' }} />
                <div className="coin" style={{ left: 620, top: 110, width: 40, height: 40, animation: 'tu-bob-up 5s ease-in-out .9s infinite' }} />
              </div>
              <div
                className="card blue"
                style={{ left: 620, top: 120, width: 168, height: 108, ['--r' as any]: '14deg', animation: 'tu-bob-up 5s ease-in-out .2s infinite' }}
              >
                <div className="sheen" />
                <div className="chip" />
                <div className="stripe" />
              </div>
              <div
                className="card gold"
                style={{ left: 720, top: 300, width: 150, height: 96, ['--r' as any]: '-10deg', animation: 'tu-bob-down 5s ease-in-out .8s infinite' }}
              >
                <div className="sheen" />
                <div className="chip" />
                <div className="stripe" />
              </div>
              <div
                className="card blue"
                style={{ left: 540, top: 360, width: 140, height: 90, ['--r' as any]: '8deg', animation: 'tu-bob-up 5s ease-in-out 1.3s infinite' }}
              >
                <div className="sheen" />
                <div className="chip" />
                <div className="stripe" />
              </div>
              <div className="coin" style={{ left: 840, top: 210, width: 66, height: 66, animation: 'tu-bob-down 5s ease-in-out .4s infinite' }} />
              <div className="coin" style={{ left: 560, top: 200, width: 50, height: 50, animation: 'tu-bob-up 5s ease-in-out 1s infinite' }} />
              <div className="coin" style={{ left: 700, top: 470, width: 58, height: 58, animation: 'tu-bob-up 5s ease-in-out .6s infinite' }} />
              <div className="sparkle" style={{ left: 660, top: 80, width: 28, height: 28, animation: 'tu-spark 2s ease-in-out .5s infinite' }} />
              <div className="sparkle" style={{ left: 880, top: 360, width: 22, height: 22, animation: 'tu-spark 3s ease-in-out 1.2s infinite' }} />
              <div className="sparkle" style={{ left: 520, top: 470, width: 18, height: 18, animation: 'tu-spark 2s ease-in-out .3s infinite' }} />
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

        /* Card prop */
        .card {
          position: absolute;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          box-shadow:
            0 18px 40px -8px rgba(74, 140, 255, 0.6),
            0 2px 0 rgba(255, 255, 255, 0.5) inset,
            0 -10px 24px -6px rgba(0, 0, 0, 0.4) inset;
        }
        .card.gold {
          background: linear-gradient(135deg, #ffe9a8 0%, #f6c84a 50%, #e8a23a 100%);
          box-shadow:
            0 18px 40px -8px rgba(255, 196, 84, 0.55),
            0 2px 0 rgba(255, 255, 255, 0.5) inset,
            0 -10px 24px -6px rgba(0, 0, 0, 0.4) inset;
        }
        .card.blue {
          background: linear-gradient(135deg, #7fd0ff 0%, #3f7bff 48%, #6a3cff 100%);
        }
        .card :global(.sheen) {
          position: absolute;
          inset: 0;
          border-radius: 18px;
          background: linear-gradient(
            115deg,
            rgba(255, 255, 255, 0.55) 0%,
            rgba(255, 255, 255, 0.05) 30%,
            transparent 55%
          );
        }
        .card :global(.chip) {
          position: absolute;
          left: 14%;
          top: 24%;
          width: 22%;
          height: 34%;
          border-radius: 6px;
          background: linear-gradient(135deg, #fff6d8, #e9b84a);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
        }
        .card :global(.stripe) {
          position: absolute;
          left: 12%;
          bottom: 16%;
          width: 62%;
          height: 8%;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.7);
        }

        /* Coin prop */
        .coin {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(
            circle at 35% 28%,
            #fff2c0 0%,
            #ffcf5a 38%,
            #e09a26 72%,
            #a86a12 100%
          );
          box-shadow:
            0 10px 24px -6px rgba(255, 180, 60, 0.6),
            0 1px 0 rgba(255, 255, 255, 0.7) inset;
        }
        .coin::after {
          content: '';
          position: absolute;
          inset: 18%;
          border-radius: 50%;
          border: 2px solid rgba(180, 110, 20, 0.55);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25) inset;
        }

        /* Sparkle prop */
        .sparkle {
          position: absolute;
        }
        .sparkle::before,
        .sparkle::after {
          content: '';
          position: absolute;
          border-radius: 40%;
          background: #fff;
        }
        .sparkle::before {
          left: 45%;
          top: 0;
          width: 10%;
          height: 100%;
        }
        .sparkle::after {
          top: 45%;
          left: 0;
          height: 10%;
          width: 100%;
        }

        /* Far-layer parallax — blurred and half opacity behind the
           sharp props for fake depth. */
        .far {
          filter: blur(5px);
          opacity: 0.5;
        }

        .mascot {
          position: absolute;
          left: 120px;
          bottom: 18px;
          width: 430px;
          height: 505px;
          animation: tu-bob 5s ease-in-out infinite;
          filter: drop-shadow(0 24px 40px rgba(20, 60, 160, 0.45));
        }

        @keyframes tu-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes tu-bob-up {
          0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); }
          50% { transform: translateY(-14px) rotate(var(--r, 0deg)); }
        }
        @keyframes tu-bob-down {
          0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); }
          50% { transform: translateY(12px) rotate(var(--r, 0deg)); }
        }
        @keyframes tu-spark {
          0%, 100% { opacity: 0.2; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        @media (prefers-reduced-motion: reduce) {
          .mascot, .card, .coin, .sparkle {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
