/**
 * SafeDropExplainer — animated "How SafeDrop Protects You" scene.
 *
 * Self-contained server component: one inline SVG + a co-located
 * <style> block of CSS keyframes. No framer-motion, no JS timeline,
 * no client bundle. Every animated group shares one 10s loop with
 * percentage windows so the three beats stay in sync:
 *
 *   Beat 1 (0–33%)  You Pay          — coin travels buyer → shield,
 *                                      shield pulses, lime ring expands
 *                                      ("Payment Covered")
 *   Beat 2 (33–66%) Seller Delivers  — package travels seller → buyer,
 *                                      passing behind the shield
 *                                      ("Item Delivered to You")
 *   Beat 3 (66–100%) You Confirm     — lime check pops at the buyer,
 *                                      lime coin travels shield → seller
 *                                      ("Released to the Seller")
 *
 * Only transform/opacity animate. Glyphs use the SilverIcon language
 * (grayscale gradients + soft top shine); lime #a3e635 is reserved for
 * the shield check, the coverage pulse, and the released coin.
 *
 * prefers-reduced-motion: every animation is disabled and a static
 * composed end-frame is revealed instead (check at the buyer, package
 * delivered, coin at the seller, all captions lit) so the story still
 * reads without motion.
 */

const CSS = `
.sde-anim {
  animation-duration: 10s;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  transform-box: fill-box;
  transform-origin: center;
}
.sde-traveler { opacity: 0; }
.sde-label { opacity: 0; }
.sde-rm { display: none; }

.sde-coin-pay   { animation-name: sde-coin-pay; }
.sde-shield-pulse { animation-name: sde-shield-pulse; }
.sde-ring       { animation-name: sde-ring; opacity: 0; }
.sde-package    { animation-name: sde-package; }
.sde-check-pop  { animation-name: sde-check-pop; opacity: 0; }
.sde-coin-release { animation-name: sde-coin-release; }
.sde-label-1    { animation-name: sde-label-1; }
.sde-label-2    { animation-name: sde-label-2; }
.sde-label-3    { animation-name: sde-label-3; }

@keyframes sde-coin-pay {
  0%   { transform: translate(0, 0); opacity: 0; }
  4%   { opacity: 1; }
  20%  { transform: translate(320px, 0); opacity: 1; }
  24%  { transform: translate(320px, 0); opacity: 0; }
  100% { transform: translate(320px, 0); opacity: 0; }
}
@keyframes sde-shield-pulse {
  0%, 18% { transform: scale(1); }
  22%     { transform: scale(1.06); }
  28%     { transform: scale(1); }
  100%    { transform: scale(1); }
}
@keyframes sde-ring {
  0%, 19% { transform: scale(0.35); opacity: 0; }
  22%     { opacity: 0.55; }
  34%     { transform: scale(1.55); opacity: 0; }
  100%    { transform: scale(1.55); opacity: 0; }
}
@keyframes sde-package {
  0%, 34% { transform: translate(0, 0); opacity: 0; }
  38%     { opacity: 1; }
  58%     { transform: translate(-640px, 0); opacity: 1; }
  62%     { transform: translate(-640px, 0); opacity: 0; }
  100%    { transform: translate(-640px, 0); opacity: 0; }
}
@keyframes sde-check-pop {
  0%, 66% { transform: scale(0); opacity: 0; }
  69%     { transform: scale(1.18); opacity: 1; }
  72%     { transform: scale(1); opacity: 1; }
  96%     { transform: scale(1); opacity: 1; }
  100%    { transform: scale(1); opacity: 0; }
}
@keyframes sde-coin-release {
  0%, 73% { transform: translate(0, 0); opacity: 0; }
  77%     { opacity: 1; }
  93%     { transform: translate(320px, 0); opacity: 1; }
  96%     { transform: translate(320px, 0); opacity: 0; }
  100%    { transform: translate(320px, 0); opacity: 0; }
}
@keyframes sde-label-1 {
  0%      { opacity: 0; }
  8%      { opacity: 1; }
  30%     { opacity: 1; }
  36%     { opacity: 0; }
  100%    { opacity: 0; }
}
@keyframes sde-label-2 {
  0%, 38% { opacity: 0; }
  44%     { opacity: 1; }
  62%     { opacity: 1; }
  68%     { opacity: 0; }
  100%    { opacity: 0; }
}
@keyframes sde-label-3 {
  0%, 74% { opacity: 0; }
  80%     { opacity: 1; }
  96%     { opacity: 1; }
  100%    { opacity: 0; }
}

/* Caption chips — the lime "active" layer sits on top of the gray base
   and only its opacity animates, on the same 10s clock. */
.sde-chip { position: relative; }
.sde-chip-active {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 9999px;
  border: 1px solid rgba(163, 230, 53, 0.28);
  background: rgba(163, 230, 53, 0.08);
  color: #a3e635;
  opacity: 0;
  animation-duration: 10s;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
}
.sde-chip-1 .sde-chip-active { animation-name: sde-chip-1; }
.sde-chip-2 .sde-chip-active { animation-name: sde-chip-2; }
.sde-chip-3 .sde-chip-active { animation-name: sde-chip-3; }
@keyframes sde-chip-1 {
  0%   { opacity: 1; }
  30%  { opacity: 1; }
  35%  { opacity: 0; }
  100% { opacity: 0; }
}
@keyframes sde-chip-2 {
  0%, 33% { opacity: 0; }
  38%     { opacity: 1; }
  63%     { opacity: 1; }
  68%     { opacity: 0; }
  100%    { opacity: 0; }
}
@keyframes sde-chip-3 {
  0%, 66% { opacity: 0; }
  71%     { opacity: 1; }
  97%     { opacity: 1; }
  100%    { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .sde-anim, .sde-chip-active { animation: none; }
  .sde-traveler { opacity: 0; }
  .sde-label { opacity: 1; }
  .sde-chip-active { opacity: 1; }
  .sde-rm { display: inline; }
}
`

export function SafeDropExplainer() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-2 py-4 sm:px-6 sm:py-6">
        <svg
          viewBox="0 0 960 400"
          role="img"
          aria-label="How SafeDrop protects you: you pay and your payment is covered, the seller delivers your item, and once you confirm delivery the payment is released to the seller."
          className="h-auto w-full"
        >
          <defs>
            <linearGradient id="sdeSilver" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f3f4f6" />
              <stop offset="55%" stopColor="#9ca3af" />
              <stop offset="100%" stopColor="#6b7280" />
            </linearGradient>
            <linearGradient id="sdeSilverSoft" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e5e7eb" />
              <stop offset="100%" stopColor="#9ca3af" />
            </linearGradient>
            <linearGradient id="sdeShine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sdeLimeCoin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d9f99d" />
              <stop offset="100%" stopColor="#a3e635" />
            </linearGradient>
            <clipPath id="sdeShieldClip">
              <path d="M480 148 L522 163 V204 C522 232 504 252 480 262 C456 252 438 232 438 204 V163 Z" />
            </clipPath>
          </defs>

          {/* Rail */}
          <line
            x1="200" y1="210" x2="760" y2="210"
            stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round"
          />

          {/* ============ Beat 2 — package (behind the shield) ============ */}
          <g className="sde-anim sde-traveler sde-package">
            {/* motion ticks */}
            <g stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeLinecap="round">
              <line x1="828" y1="202" x2="840" y2="202" />
              <line x1="832" y1="212" x2="846" y2="212" />
            </g>
            <g transform="translate(800, 210)">
              <rect x="-16" y="-14" width="32" height="28" rx="5" fill="url(#sdeSilverSoft)" />
              <rect x="-16" y="-14" width="32" height="10" rx="5" fill="url(#sdeShine)" />
              <line x1="0" y1="-14" x2="0" y2="14" stroke="#4b5563" strokeWidth="2.5" />
              <line x1="-16" y1="0" x2="16" y2="0" stroke="#4b5563" strokeWidth="1.5" opacity="0.5" />
            </g>
          </g>

          {/* ============ Beat 1 — payment coin ============ */}
          <g className="sde-anim sde-traveler sde-coin-pay">
            <g transform="translate(160, 210)">
              <circle r="15" fill="url(#sdeSilver)" />
              <circle r="15" fill="url(#sdeShine)" opacity="0.6" />
              <circle r="10" fill="none" stroke="#374151" strokeWidth="2" />
              <path d="M0 -5 V5 M-3.5 -2.5 H2 A2.6 2.6 0 0 1 2 2.5 H-3.5" stroke="#374151" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </g>
          </g>

          {/* ============ Beat 3 — released coin (lime = success) ============ */}
          <g className="sde-anim sde-traveler sde-coin-release">
            {/* lime trail */}
            <g stroke="#a3e635" strokeWidth="2.5" strokeLinecap="round" opacity="0.45">
              <line x1="452" y1="210" x2="462" y2="210" />
              <line x1="438" y1="210" x2="444" y2="210" />
            </g>
            <g transform="translate(480, 210)">
              <circle r="15" fill="url(#sdeLimeCoin)" />
              <circle r="15" fill="url(#sdeShine)" opacity="0.5" />
              <circle r="10" fill="none" stroke="#3f6212" strokeWidth="2" />
              <path d="M0 -5 V5 M-3.5 -2.5 H2 A2.6 2.6 0 0 1 2 2.5 H-3.5" stroke="#3f6212" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </g>
          </g>

          {/* ============ Buyer node ============ */}
          <g>
            <circle cx="160" cy="210" r="44" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
            <g stroke="url(#sdeSilverSoft)" strokeWidth="3" fill="none" strokeLinecap="round">
              <circle cx="160" cy="198" r="10" />
              <path d="M141 232 C141 219 149 214 160 214 C171 214 179 219 179 232" />
            </g>
            <text x="160" y="286" textAnchor="middle" fill="#9aa3b6" fontSize="14" fontWeight="600" letterSpacing="0.08em">YOU</text>

            {/* Beat 3 — confirm check pops here */}
            <g className="sde-anim sde-check-pop">
              <g transform="translate(194, 176)">
                <circle r="14" fill="#a3e635" />
                <path d="M-6 0 L-2 5 L7 -5" stroke="#1a2e05" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>

            {/* Reduced-motion: delivered package parked at the buyer */}
            <g className="sde-rm">
              <g transform="translate(118, 168)">
                <rect x="-14" y="-12" width="28" height="24" rx="4" fill="url(#sdeSilverSoft)" />
                <line x1="0" y1="-12" x2="0" y2="12" stroke="#4b5563" strokeWidth="2" />
              </g>
            </g>
          </g>

          {/* ============ SafeDrop shield node (drawn above travelers) ============ */}
          <g>
            {/* coverage pulse ring */}
            <g className="sde-anim sde-ring">
              <circle cx="480" cy="205" r="66" fill="none" stroke="#a3e635" strokeWidth="2" />
            </g>
            <g className="sde-anim sde-shield-pulse">
              <path
                d="M480 148 L522 163 V204 C522 232 504 252 480 262 C456 252 438 232 438 204 V163 Z"
                fill="url(#sdeSilver)"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.5"
              />
              {/* masked top shine */}
              <rect x="438" y="148" width="84" height="44" fill="url(#sdeShine)" clipPath="url(#sdeShieldClip)" />
              <path d="M462 205 L474 218 L500 190" stroke="#a3e635" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <text x="480" y="296" textAnchor="middle" fill="#9aa3b6" fontSize="14" fontWeight="600" letterSpacing="0.08em">SAFEDROP</text>
          </g>

          {/* ============ Seller node ============ */}
          <g>
            <circle cx="800" cy="210" r="44" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
            <g stroke="url(#sdeSilverSoft)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* storefront */}
              <path d="M783 206 V228 H817 V206" />
              <path d="M780 206 L784 192 H816 L820 206" />
              <path d="M780 206 C780 210 784 213 788 213 C792 213 796 210 796 206 C796 210 800 213 804 213 C808 213 812 210 812 206 C812 210 816 213 820 213" strokeWidth="2.5" />
              <path d="M795 228 V217 H805 V228" strokeWidth="2.5" />
            </g>
            <text x="800" y="286" textAnchor="middle" fill="#9aa3b6" fontSize="14" fontWeight="600" letterSpacing="0.08em">SELLER</text>

            {/* Reduced-motion: released lime coin parked at the seller */}
            <g className="sde-rm">
              <g transform="translate(842, 172)">
                <circle r="13" fill="url(#sdeLimeCoin)" />
                <circle r="8.5" fill="none" stroke="#3f6212" strokeWidth="2" />
              </g>
            </g>
          </g>

          {/* ============ Beat labels ============ */}
          <text className="sde-anim sde-label sde-label-1" x="480" y="112" textAnchor="middle" fill="#ffffff" fontSize="19" fontWeight="700">
            Payment Covered
          </text>
          <text className="sde-anim sde-label sde-label-2" x="240" y="150" textAnchor="middle" fill="#ffffff" fontSize="19" fontWeight="700">
            Item Delivered to You
          </text>
          <text className="sde-anim sde-label sde-label-3" x="726" y="150" textAnchor="middle" fill="#ffffff" fontSize="19" fontWeight="700">
            Released to the Seller
          </text>
        </svg>

        {/* Caption chips — pure-CSS sync with the SVG loop */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {(
            [
              ['1', 'You Pay'],
              ['2', 'Seller Delivers'],
              ['3', 'You Confirm'],
            ] as const
          ).map(([n, label], i) => (
            <div key={n} className={`sde-chip sde-chip-${i + 1}`}>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-gray-400 sm:text-sm">
                <span aria-hidden>{n}</span>
                <span aria-hidden className="opacity-50">·</span>
                {label}
              </span>
              <span aria-hidden className="sde-chip-active text-[13px] font-semibold sm:text-sm">
                <span>{n}</span>
                <span className="opacity-60">·</span>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
