'use client'

/**
 * Step 2 — country, what they sell (games + the categories per game),
 * Discord (optional), 18+. Reuses the seller app's GameMultiSelect and the
 * dark Combobox; the per-game categories are plain checkbox rows.
 */
import { useMemo, useState } from 'react'
import { Combobox } from '@/components/ui/combobox'
import { Checkbox } from '@/components/ui/checkbox'
import GameMultiSelect from '@/app/account/become-seller/components/shared/GameMultiSelect'
import { COUNTRIES } from '@/app/account/become-seller/data/countries'
import { SECTION_LABELS, SECTION_ORDER, type GameCategoryOptions, type SellerCategorySection } from '@/app/account/become-seller/_redesign/game-categories-shared'
import type { Game } from '@/lib/utils/games'
import { detailsSchema, type SellsEntry } from '@/lib/founding/onboarding'
import { saveFoundingDetails } from '@/lib/actions/founding-onboarding'
import { EXPECTED_VOLUMES } from '@/lib/founding/onboarding'
import { readFoundingSrc } from '@/lib/seo/founding-href'
import { Field, FormError, INPUT_CLS, PrimaryButton, StepActions, StepCard } from './ui'

// Flag images from flagcdn.com (public domain), 40px wide, lazy; shown as a
// 20×15 tile in the list and in the closed field.
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({
  value: c.iso2,
  label: c.name,
  icon_url: `https://flagcdn.com/w40/${c.iso2.toLowerCase()}.png`,
}))
const FLAG_CLS = 'h-[15px] w-5 rounded-[2px]'

export function StepDetails({
  games,
  categories,
  initial,
  discordHint,
  onBack,
  onSaved,
}: {
  games: Game[]
  categories: GameCategoryOptions[]
  initial: { country: string | null; sells: SellsEntry[]; discord: string | null; isAdult: boolean; fullName?: string | null; addressLine?: string | null; city?: string | null; expectedVolume?: string | null } | null
  /** Discord username from a Discord sign-in; used only while nothing is saved. */
  discordHint?: string | null
  onBack: () => void
  onSaved: () => Promise<void>
}) {
  const bySlug = useMemo(() => new Map(games.map((g) => [g.slug, g])), [games])
  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games])
  const sectionsFor = useMemo(() => new Map(categories.map((c) => [c.gameSlug, c.sections])), [categories])

  const [country, setCountry] = useState(initial?.country ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => (initial?.sells ?? []).map((s) => bySlug.get(s.game)?.id).filter((x): x is string => Boolean(x)),
  )
  const [cats, setCats] = useState<Record<string, SellerCategorySection[]>>(
    () => Object.fromEntries((initial?.sells ?? []).map((s) => [s.game, s.categories as SellerCategorySection[]])),
  )
  const [discord, setDiscord] = useState(initial?.discord ?? discordHint ?? '')
  const [isAdult, setIsAdult] = useState(initial?.isAdult ?? false)
  const [fullName, setFullName] = useState(initial?.fullName ?? '')
  const [addressLine, setAddressLine] = useState(initial?.addressLine ?? '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [expectedVolume, setExpectedVolume] = useState(initial?.expectedVolume ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selectedGames = selectedIds.map((id) => byId.get(id)).filter((g): g is Game => Boolean(g))

  const toggleCat = (slug: string, section: SellerCategorySection) =>
    setCats((prev) => {
      const cur = prev[slug] ?? []
      const next = cur.includes(section) ? cur.filter((c) => c !== section) : [...cur, section]
      return { ...prev, [slug]: SECTION_ORDER.filter((s) => next.includes(s)) }
    })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const sells = selectedGames.map((g) => ({ game: g.slug, categories: cats[g.slug] ?? [] }))
    const missing = sells.find((s) => s.categories.length === 0)
    if (!country) return setError('Pick your country.')
    if (sells.length === 0) return setError('Pick at least one game you sell.')
    if (missing) return setError(`Pick what you sell in ${bySlug.get(missing.game)?.name ?? 'that game'}.`)
    if (!isAdult) return setError('You must be 18 or older to sell on DropMarket.')
    const source = typeof window !== 'undefined' ? readFoundingSrc(window.location.hash, new URLSearchParams(window.location.search)) : undefined
    const parsed = detailsSchema.safeParse({ country, sells, discord, isAdult, source, fullName, addressLine, city, expectedVolume })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form.')
    setBusy(true)
    try {
      const res = await saveFoundingDetails(parsed.data)
      if (!res.success) return setError(res.error ?? 'Could not save. Try again.')
      await onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepCard title="A Few Details" lead="What you sell and who you are. Buyers see the games; your name and address stay with our team.">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Games You Sell" hint="Pick every game you trade in. You can add more later.">
          <GameMultiSelect games={games} selected={selectedIds} onChange={setSelectedIds} placeholder="Search And Select Games…" tone="neutral" />
        </Field>

        {selectedGames.length > 0 && (
          <div className="border-t border-white/[0.07]">
            {selectedGames.map((g, i) => {
              const sections = sectionsFor.get(g.slug) ?? SECTION_ORDER
              return (
                <div key={g.id} className={i > 0 ? 'border-t border-white/[0.07] py-3' : 'py-3'}>
                  <div className="flex items-center gap-2.5">
                    {g.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- catalogue art, unoptimized site-wide */
                      <img src={g.image_url} alt="" width={24} height={24} className="h-6 w-6 shrink-0 rounded-[6px] object-cover" />
                    ) : (
                      <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-bg-overlay text-caption text-text-tertiary">{g.name[0]}</span>
                    )}
                    <p className="text-body-sm font-medium text-text-primary">{g.name}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                    {sections.map((s) => {
                      const id = `cat-${g.slug}-${s}`
                      const on = (cats[g.slug] ?? []).includes(s)
                      return (
                        <label key={s} htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 text-body-sm text-text-secondary">
                          <Checkbox id={id} checked={on} onCheckedChange={() => toggleCat(g.slug, s)} />
                          {SECTION_LABELS[s]}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <Field label="Expected Monthly Sales" htmlFor="f-volume" hint="A rough guess is fine. It helps us set your limits.">
          <select id="f-volume" value={expectedVolume} onChange={(e) => setExpectedVolume(e.target.value)} className={INPUT_CLS}>
            <option value="" disabled>Choose a range</option>
            {EXPECTED_VOLUMES.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Full Name" htmlFor="f-name" hint="As on your ID. Only our team sees it.">
          <input id="f-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT_CLS} placeholder="Alex Johnson" autoComplete="name" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Address" htmlFor="f-address">
            <input id="f-address" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} className={INPUT_CLS} placeholder="12 Market Street" autoComplete="address-line1" />
          </Field>
          <Field label="City" htmlFor="f-city">
            <input id="f-city" value={city} onChange={(e) => setCity(e.target.value)} className={INPUT_CLS} placeholder="London" autoComplete="address-level2" />
          </Field>
        </div>

        <Field label="Country" hint="Used for payouts and tax rules later.">
          <Combobox value={country} onChange={setCountry} options={COUNTRY_OPTIONS} placeholder="Choose your country" tone="neutral" ariaLabel="Country" iconInTrigger iconClassName={FLAG_CLS} />
        </Field>

        <Field label="Discord Username" optional htmlFor="f-discord" hint="So buyers and our team can reach you fast.">
          <input id="f-discord" value={discord} onChange={(e) => setDiscord(e.target.value)} className={INPUT_CLS} placeholder="yourname" autoComplete="off" />
        </Field>

        <label htmlFor="f-adult" className="flex cursor-pointer items-start gap-3 py-1">
          <Checkbox id="f-adult" checked={isAdult} onCheckedChange={(v) => setIsAdult(v === true)} className="mt-0.5" />
          <span className="text-body-sm text-text-secondary">
            <span className="font-medium text-text-primary">I&apos;m 18 or older.</span> You need to be an adult to sell on DropMarket.
          </span>
        </label>

        <FormError message={error} />
        <StepActions onBack={onBack}>
          <PrimaryButton busy={busy}>Continue</PrimaryButton>
        </StepActions>
      </form>
    </StepCard>
  )
}
