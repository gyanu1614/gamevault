'use client'

/**
 * Founding-seller signup — Screen 2a (forest split).
 * Left forest panel (Claim Your Spot + N/100 + perks) · right ivory form card.
 * Submit swaps the card's inner content to a "Submitted Successfully" state;
 * the panel is untouched. Pixel-matched to design-refs/founding-seller.
 */

import { useMemo, useRef, useState, useTransition, useEffect } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Percent, ArrowUp, Check, ChevronDown, X, ArrowRight, CircleCheck } from 'lucide-react'
import { submitEarlySeller } from '@/lib/actions/early-seller'
import type { FoundingProgress } from '@/lib/config/founding-seller'

export interface SignupGame {
  slug: string
  name: string
  logo: string
}

// ── Palette (from the design handoff) ─────────────────────────────
const C = {
  ivory: '#FAFAF7',
  paper: '#FFFFFF',
  forest: '#14432A',
  forest2: '#1B5E3A',
  forest3: '#0F3320',
  lime: '#A3E635',
  tint: '#F0F4EC',
  ink: '#1A1D19',
  ink2: '#5B6157',
  placeholder: '#9AA095',
  line: '#E4E5DE',
}

const VOLUME_BANDS = [
  { value: '0-500', label: '$0–500' },
  { value: '500-1k', label: '$500–1K' },
  { value: '1k-5k', label: '$1K–5K' },
  { value: '5k+', label: '$5K+' },
]

const CUSTOM = '__custom__'

export default function FoundingSignupClient({
  progress,
  games,
}: {
  progress?: FoundingProgress | null
  games: SignupGame[]
}) {
  const src = useSearchParams().get('src') || undefined

  // Form state
  const [email, setEmail] = useState('')
  const [discord, setDiscord] = useState('')
  const [sells, setSells] = useState('')
  const [volume, setVolume] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([]) // game slugs (+ CUSTOM)
  const [customGame, setCustomGame] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [alreadyOnList, setAlreadyOnList] = useState(false)
  const [pending, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)

  const count = progress?.count ?? 22
  const cap = progress?.cap ?? 100
  const percent = progress?.percent ?? Math.round((count / cap) * 100)

  // Close dropdown on outside click.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const hasCustom = selected.includes(CUSTOM)
  const selectedGames = useMemo(
    () => games.filter((g) => selected.includes(g.slug)),
    [games, selected],
  )

  function toggleGame(slug: string) {
    setSelected((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]))
  }

  function submit() {
    setError(null)
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email so we can send your invite.')
      return
    }
    // Build the games payload: slugs + a 'custom:<name>' entry when present.
    const gamesPayload = [
      ...selected.filter((s) => s !== CUSTOM),
      ...(hasCustom && customGame.trim() ? [`custom:${customGame.trim()}`] : []),
    ]
    startTransition(() => {
      void (async () => {
        const res = await submitEarlySeller({
          username: email.trim().split('@')[0], // handle derived from email; admin can rename
          email: email.trim(),
          discord: discord.trim() || undefined,
          sells: sells.trim() || undefined,
          monthlyVolume: volume || undefined,
          games: gamesPayload.length ? gamesPayload : undefined,
          source: src,
        })
        if (res.ok) {
          setSubmitted(true)
        } else if (res.alreadyOnList) {
          setAlreadyOnList(true)
          setSubmitted(true)
        } else {
          setError(res.error ?? 'Something went wrong. Try again.')
        }
      })()
    })
  }

  return (
    <div
      className="flex min-h-screen w-full flex-col lg:h-screen lg:flex-row lg:overflow-hidden"
      style={{ backgroundColor: C.ivory }}
    >
      {/* ══════════ LEFT FOREST PANEL ══════════ */}
      <aside
        className="relative flex w-full flex-col overflow-hidden px-8 py-10 lg:w-[38%] lg:p-12"
        style={{ backgroundColor: C.forest3 }}
      >
        <Image src="/assets/heroes/sell.avif" alt="" fill priority sizes="38vw" className="object-cover" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `linear-gradient(105deg, ${C.forest} 42%, rgba(20,67,42,0.78))` }}
        />
        <div className="relative z-10 flex h-full flex-col justify-between gap-8">
          {/* logo + eyebrow + heading */}
          <div>
            <div className="mb-8 flex items-center gap-2.5">
              <span className="inline-block h-[26px] w-[26px] rotate-45 rounded-[5px]" style={{ backgroundColor: C.lime }} />
              <span className="text-[21px] tracking-tight text-white">
                <span className="font-extrabold">Drop</span><span className="font-medium">Market</span>
              </span>
            </div>
            <p className="mb-3 text-[13px] font-bold uppercase" style={{ letterSpacing: '3px', color: C.lime }}>
              Founding Seller
            </p>
            <h1 className="text-[38px] font-extrabold leading-[1.08] text-white lg:text-[46px]" style={{ letterSpacing: '-1px' }}>
              Claim Your Spot
            </h1>
            <p className="mt-4 max-w-[340px] text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>
              Be one of the first 100 sellers on DropMarket — lower fees for life, early access, and a badge buyers can see.
            </p>
          </div>

          {/* stat block */}
          <div>
            <div className="text-[40px] font-extrabold leading-none text-white">
              {count}<span className="font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}> / {cap}</span>
            </div>
            <div className="mt-2 text-[13px] font-semibold uppercase" style={{ letterSpacing: '1.5px', color: 'rgba(255,255,255,0.65)' }}>
              Founding Spots
            </div>
            <div className="mt-3.5 h-1 w-[78%] overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
              <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: C.lime }} />
            </div>
          </div>

          {/* perks */}
          <ul className="flex flex-col gap-[18px]">
            {[
              { Icon: Percent, label: '2% lower fees, locked for life' },
              { Icon: ArrowUp, label: 'List before the public launch' },
              { Icon: Check, label: 'Founding badge on your storefront' },
            ].map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-[1.5px]"
                  style={{ borderColor: C.lime }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: C.lime }} strokeWidth={2.4} />
                </span>
                <span className="text-[15px] font-medium text-white">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ══════════ RIGHT IVORY PANEL ══════════ */}
      <main className="flex w-full flex-1 items-center justify-center px-5 py-10 lg:w-[62%] lg:overflow-y-auto lg:px-8">
        <div className="w-full max-w-[500px]">
          {submitted ? (
            <div
              className="rounded-xl border p-7 sm:p-8"
              style={{ backgroundColor: C.paper, borderColor: C.line, boxShadow: '0 12px 32px rgba(15,51,32,0.06)' }}
            >
              <SubmittedState alreadyOnList={alreadyOnList} />
            </div>
          ) : (
            <>
              {/* Heading OUTSIDE the card */}
              <div className="mb-5">
                <h2 className="text-[26px] font-extrabold" style={{ color: C.ink, letterSpacing: '-0.5px' }}>
                  Apply In Under A Minute
                </h2>
                <p className="mt-1.5 text-[14px]" style={{ color: C.ink2 }}>
                  We review applications daily. No card needed.
                </p>
              </div>

              <div
                className="flex flex-col gap-[18px] rounded-xl border p-6 sm:p-7"
                style={{ backgroundColor: C.paper, borderColor: C.line, boxShadow: '0 12px 32px rgba(15,51,32,0.06)' }}
              >
                <Field label="Email" hint="We’ll send your seller link here.">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = C.forest)}
                    onBlur={(e) => (e.target.style.borderColor = C.line)}
                  />
                </Field>

                <Field label="Discord" optional>
                  <input
                    value={discord}
                    onChange={(e) => setDiscord(e.target.value)}
                    placeholder="username"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = C.forest)}
                    onBlur={(e) => (e.target.style.borderColor = C.line)}
                  />
                </Field>

                <Field label="Any Past Selling Experience?" optional>
                  <input
                    value={sells}
                    onChange={(e) => setSells(e.target.value)}
                    placeholder="e.g. Eldorado, G2G, Discord — where you sell now"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = C.forest)}
                    onBlur={(e) => (e.target.style.borderColor = C.line)}
                  />
                </Field>

                {/* Games multi-select */}
                <Field label="Games You Sell">
                  <div ref={menuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((o) => !o)}
                      className="flex min-h-[48px] w-full flex-wrap items-center gap-1.5 rounded-[10px] border px-3 py-2 pr-9 text-left"
                      style={{ borderColor: menuOpen ? C.forest : C.line, backgroundColor: C.paper }}
                    >
                      {selectedGames.length === 0 && !hasCustom ? (
                        <span className="text-[15px]" style={{ color: C.placeholder }}>Select the games you sell</span>
                      ) : (
                        <>
                          {selectedGames.map((g) => (
                            <Tag key={g.slug} logo={g.logo} label={g.name} onRemove={() => toggleGame(g.slug)} />
                          ))}
                          {hasCustom && <Tag label={customGame.trim() || 'Custom'} onRemove={() => toggleGame(CUSTOM)} />}
                        </>
                      )}
                      <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.ink2 }} />
                    </button>

                    {menuOpen && (
                      <div
                        className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[264px] overflow-y-auto rounded-[10px] border bg-white p-1.5"
                        style={{ borderColor: C.line, boxShadow: '0 16px 40px rgba(15,51,32,0.14)' }}
                      >
                        {games.map((g) => {
                          const on = selected.includes(g.slug)
                          return (
                            <button
                              key={g.slug}
                              type="button"
                              onClick={() => toggleGame(g.slug)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left"
                              style={{ backgroundColor: on ? C.tint : 'transparent' }}
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md">
                                <Image src={g.logo} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
                              </span>
                              <span className="flex-1 text-[14px] font-semibold" style={{ color: on ? C.forest : C.ink }}>{g.name}</span>
                              {on && <Check className="h-4 w-4" style={{ color: C.forest2 }} strokeWidth={2.5} />}
                            </button>
                          )
                        })}
                        {/* Custom */}
                        <button
                          type="button"
                          onClick={() => toggleGame(CUSTOM)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left"
                          style={{ backgroundColor: hasCustom ? C.tint : 'transparent' }}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: C.line, color: C.ink2 }}>+</span>
                          <span className="flex-1 text-[14px] font-semibold" style={{ color: hasCustom ? C.forest : C.ink }}>Custom</span>
                          {hasCustom && <Check className="h-4 w-4" style={{ color: C.forest2 }} strokeWidth={2.5} />}
                        </button>
                      </div>
                    )}
                  </div>
                  {hasCustom && (
                    <input
                      value={customGame}
                      onChange={(e) => setCustomGame(e.target.value)}
                      placeholder="Which game?"
                      style={{ ...inputStyle, marginTop: 10 }}
                      onFocus={(e) => (e.target.style.borderColor = C.forest)}
                      onBlur={(e) => (e.target.style.borderColor = C.line)}
                    />
                  )}
                </Field>

                {/* Monthly volume pills */}
                <Field label="Monthly Volume">
                  <div className="grid grid-cols-4 gap-2">
                    {VOLUME_BANDS.map((b) => {
                      const on = volume === b.value
                      return (
                        <button
                          key={b.value}
                          type="button"
                          onClick={() => setVolume(on ? null : b.value)}
                          className="h-[42px] rounded-full text-[14px] font-semibold transition-colors"
                          style={{
                            backgroundColor: on ? C.forest : C.paper,
                            color: on ? '#fff' : C.ink,
                            border: `1px solid ${on ? C.forest : C.line}`,
                          }}
                        >
                          {b.label}
                        </button>
                      )
                    })}
                  </div>
                </Field>

                {error && <p className="text-[13px] font-medium" style={{ color: '#b42318' }}>{error}</p>}

                <button
                  type="button"
                  onClick={submit}
                  disabled={pending}
                  className="group flex h-[54px] w-full items-center justify-center gap-2 rounded-[10px] text-[16px] font-bold text-white transition-colors disabled:opacity-70"
                  style={{ backgroundColor: C.forest, boxShadow: '0 10px 24px rgba(15,51,32,0.18)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.forest2)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = C.forest)}
                >
                  {pending ? 'Submitting…' : 'Become a Seller'}
                  <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5" style={{ color: C.lime }} strokeWidth={2.5} />
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Bits ──────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 10,
  border: `1px solid ${C.line}`,
  padding: '0 14px',
  fontSize: 15,
  color: C.ink,
  outline: 'none',
  backgroundColor: C.paper,
}

function Field({ label, optional, hint, children }: { label: string; optional?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-semibold" style={{ color: C.ink }}>
        {label}{optional && <span className="font-medium" style={{ color: C.ink2 }}> (Optional)</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[12px]" style={{ color: C.ink2 }}>{hint}</p>}
    </div>
  )
}

function Tag({ logo, label, onRemove }: { logo?: string; label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-[5px] text-[13px] font-semibold"
      style={{ backgroundColor: C.tint, borderColor: C.line, color: C.forest }}
    >
      {logo && <Image src={logo} alt="" width={16} height={16} className="h-4 w-4 object-contain" />}
      {label}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemove() } }}
        className="ml-0.5 cursor-pointer"
      >
        <X className="h-3.5 w-3.5" style={{ color: C.ink2 }} strokeWidth={2.5} />
      </span>
    </span>
  )
}

function SubmittedState({ alreadyOnList }: { alreadyOnList: boolean }) {
  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: C.lime }}>
          <CircleCheck className="h-8 w-8" style={{ color: C.forest3 }} strokeWidth={2.5} />
        </span>
        <h2 className="mt-5 text-[26px] font-extrabold" style={{ color: C.ink, letterSpacing: '-0.4px' }}>
          {alreadyOnList ? "You're Already In" : 'Check Your Email'}
        </h2>
        <p className="mt-2 max-w-[380px] text-[15px] leading-relaxed" style={{ color: C.ink2 }}>
          {alreadyOnList
            ? 'You already have a founding-seller invite. Open the magic link in your inbox to pick up where you left off.'
            : 'We just sent your founding-seller link. Open it to confirm your email instantly and start setting up your storefront.'}
        </p>
      </div>

      <div className="my-6 border-t" style={{ borderColor: C.line }} />

      {/* One clear next step — the whole action is "open the link". */}
      <div
        className="flex items-start gap-3 rounded-[12px] p-4"
        style={{ backgroundColor: C.tint, border: `1px solid ${C.line}` }}
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: C.forest }}>
          <ArrowRight className="h-3.5 w-3.5" style={{ color: C.lime }} strokeWidth={2.75} />
        </span>
        <p className="text-[14px] leading-relaxed" style={{ color: C.ink }}>
          <span className="font-semibold">Open the magic link in your email</span> — your email is confirmed instantly and your founding-seller setup opens.
        </p>
      </div>

      <p className="mt-4 text-center text-[12.5px]" style={{ color: C.ink2 }}>
        Didn’t get it? Check spam, or give it a minute.
      </p>
    </div>
  )
}
