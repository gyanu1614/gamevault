/**
 * StepAccountGames — Step 1 of the "Forest Ledger" seller-application redesign:
 * "Account & Games".
 *
 * Collects, in one lean screen:
 *   • Account basics the server action still reads off step1 — an 18+ confirm
 *     and the seller type (Individual / Business).
 *   • The games the seller will trade in (searchable multi-select over the DB
 *     catalog) and, for EACH selected game, WHICH category sections they'll sell
 *     in (Items / Accounts / Currency / Top-Up / Boosting) — the real sections
 *     that game supports, derived server-side via getGameCategories and handed in
 *     as `sectionsByGameId`. Stored as per-game categorySlugs into gamesCategories.
 *   • An "Other games" free-text for catalog gaps.
 *   • Expected monthly volume (one low-friction select, useful for admin).
 *
 * The screen is fully in the LIGHT Forest Ledger visual world — it does NOT reuse
 * the site's dark-glass GameMultiSelect. It reads/writes step1Schema via RHF so
 * the adapter → submitSellerApplication payload contract is untouched: this
 * component only produces a valid Step1FormData (incl. gamesCategories).
 */

'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Popover from '@radix-ui/react-popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'cmdk'
import {
  Gamepad2,
  User,
  Building2,
  Check,
  ChevronDown,
  Search,
  X,
  ArrowRight,
} from 'lucide-react'

import { step1Schema, type Step1FormData, type GameCategorySelection } from '../../schemas'
import type { WizardGame } from '../../types'
import {
  SECTION_LABELS,
  type SellerCategorySection,
} from '../game-categories-shared'
import { PALETTE } from '../theme'
import StepHeader from './StepHeader'

/**
 * The sections each catalog game supports, keyed by game id. Precomputed
 * server-side by getGameCategories and passed down so the client can, for every
 * selected game, offer only that game's real category sections. Games missing
 * from this map (no active categories) still render — the seller keeps the game
 * without narrowing sections, which the schema allows.
 */
export type SectionsByGameId = Record<string, SellerCategorySection[]>

/** Expected monthly volume options — labels mirror VOLUME_LABELS. */
const VOLUME_OPTIONS: {
  value: Step1FormData['expectedVolume']
  label: string
  desc: string
}[] = [
  { value: 'under_500', label: 'Under $500', desc: 'Just Starting Out' },
  { value: '500_2000', label: '$500 – $2,000', desc: 'Growing Seller' },
  { value: '2000_10000', label: '$2,000 – $10,000', desc: 'Established' },
  { value: 'over_10000', label: 'Over $10,000', desc: 'High Volume' },
]

interface StepAccountGamesProps {
  /** The DB games catalog (fetched server-side, client-safe shape). */
  games: WizardGame[]
  /** Per-game supported category sections, precomputed server-side. */
  sectionsByGameId: SectionsByGameId
  /** Seed values when resuming an in-progress application. */
  initialData?: Partial<Step1FormData>
  /** Called with the validated Step1FormData when the seller advances. */
  onComplete: (data: Step1FormData) => void
}

export default function StepAccountGames({
  games,
  sectionsByGameId,
  initialData,
  onComplete,
}: StepAccountGamesProps) {
  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      is18OrOlder: initialData?.is18OrOlder ?? false,
      sellerType: initialData?.sellerType,
      primaryGames: initialData?.primaryGames ?? [],
      gamesCategories: initialData?.gamesCategories ?? [],
      otherGames: initialData?.otherGames ?? '',
      expectedVolume: initialData?.expectedVolume,
      referralCode: initialData?.referralCode ?? '',
    },
  })

  const is18OrOlder = watch('is18OrOlder')
  const sellerType = watch('sellerType')
  const primaryGames = watch('primaryGames') ?? []
  const gamesCategories = watch('gamesCategories') ?? []
  const otherGames = watch('otherGames') ?? ''
  const expectedVolume = watch('expectedVolume')

  const gamesById = React.useMemo(() => {
    const m = new Map<string, WizardGame>()
    for (const g of games) m.set(g.id, g)
    return m
  }, [games])

  /** Toggle a game in/out of the selection, keeping gamesCategories in lockstep. */
  const toggleGame = (id: string) => {
    const game = gamesById.get(id)
    if (!game) return
    const isSelected = primaryGames.includes(id)
    if (isSelected) {
      setValue('primaryGames', primaryGames.filter((g) => g !== id), {
        shouldValidate: true,
      })
      setValue(
        'gamesCategories',
        gamesCategories.filter((gc) => gc.gameId !== id),
        { shouldValidate: true },
      )
    } else {
      setValue('primaryGames', [...primaryGames, id], { shouldValidate: true })
      // Seed an empty per-game entry so the seller can pick sections for it.
      if (!gamesCategories.some((gc) => gc.gameId === id)) {
        const next: GameCategorySelection = {
          gameId: id,
          gameSlug: game.slug,
          categorySlugs: [],
        }
        setValue('gamesCategories', [...gamesCategories, next], {
          shouldValidate: true,
        })
      }
    }
  }

  /** Toggle a single category section for a given selected game. */
  const toggleSection = (gameId: string, section: SellerCategorySection) => {
    const game = gamesById.get(gameId)
    if (!game) return
    const existing = gamesCategories.find((gc) => gc.gameId === gameId)
    const current = existing?.categorySlugs ?? []
    const nextSlugs = current.includes(section)
      ? current.filter((s) => s !== section)
      : [...current, section]

    const others = gamesCategories.filter((gc) => gc.gameId !== gameId)
    const updated: GameCategorySelection = {
      gameId,
      gameSlug: game.slug,
      categorySlugs: nextSlugs,
    }
    setValue('gamesCategories', [...others, updated], { shouldValidate: true })
  }

  const selectedGameObjs = primaryGames
    .map((id) => gamesById.get(id))
    .filter((g): g is WizardGame => !!g)

  const submit = handleSubmit((data) => onComplete(data))

  return (
    <form onSubmit={submit} noValidate>
      <StepHeader
        heading="Account & Games"
        explainer="Tell us who you are and exactly what you sell — buyers get routed straight to it."
        icon={Gamepad2}
      />

      <div className="space-y-8">
        {/* ── Seller type ─────────────────────────────────────────── */}
        <Field
          label="I'm Selling As"
          required
          error={errors.sellerType?.message}
        >
          <div className="grid grid-cols-2 gap-3">
            <ChoiceCard
              icon={User}
              label="Individual"
              desc="A personal seller account"
              selected={sellerType === 'individual'}
              onClick={() =>
                setValue('sellerType', 'individual', { shouldValidate: true })
              }
            />
            <ChoiceCard
              icon={Building2}
              label="Business"
              desc="A registered company"
              selected={sellerType === 'business'}
              onClick={() =>
                setValue('sellerType', 'business', { shouldValidate: true })
              }
            />
          </div>
        </Field>

        {/* ── Games multi-select ──────────────────────────────────── */}
        <Field
          label="Games You'll Sell"
          required
          error={errors.primaryGames?.message}
          hint="Search the catalog. Not listed? Add it under Other Games below."
        >
          <GamePicker
            games={games}
            selected={primaryGames}
            onToggle={toggleGame}
            invalid={!!errors.primaryGames}
          />
        </Field>

        {/* ── Per-game category sections ──────────────────────────── */}
        {selectedGameObjs.length > 0 && (
          <Field
            label="What You'll Sell Per Game"
            hint="Pick the categories you'll trade in for each game."
          >
            <div className="space-y-3">
              {selectedGameObjs.map((game) => {
                const sections = sectionsByGameId[game.id] ?? []
                const chosen =
                  gamesCategories.find((gc) => gc.gameId === game.id)
                    ?.categorySlugs ?? []
                return (
                  <div
                    key={game.id}
                    className="rounded-xl border p-3.5"
                    style={{
                      borderColor: PALETTE.line,
                      backgroundColor: PALETTE.paper,
                    }}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <GameGlyph game={game} size={22} />
                      <span
                        className="text-sm font-medium"
                        style={{ color: PALETTE.ink }}
                      >
                        {game.name}
                      </span>
                    </div>
                    {sections.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {sections.map((section) => {
                          const active = chosen.includes(section)
                          return (
                            <button
                              key={section}
                              type="button"
                              onClick={() => toggleSection(game.id, section)}
                              aria-pressed={active}
                              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors"
                              style={
                                active
                                  ? {
                                      borderColor: PALETTE.forest,
                                      backgroundColor: PALETTE.forest,
                                      color: PALETTE.paper,
                                    }
                                  : {
                                      borderColor: PALETTE.line,
                                      backgroundColor: PALETTE.paper,
                                      color: PALETTE.ink2,
                                    }
                              }
                            >
                              {active && (
                                <Check
                                  className="h-3 w-3"
                                  strokeWidth={3}
                                  style={{ color: PALETTE.lime }}
                                />
                              )}
                              {SECTION_LABELS[section]}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: PALETTE.ink2 }}>
                        We&apos;ll set your categories for this game during review.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </Field>
        )}

        {/* ── Other games ─────────────────────────────────────────── */}
        <Field
          label="Other Games"
          hint="Optional — games not in our catalog, comma-separated."
          error={errors.otherGames?.message}
        >
          <textarea
            value={otherGames}
            onChange={(e) =>
              setValue('otherGames', e.target.value, { shouldValidate: true })
            }
            rows={2}
            placeholder="e.g. Old School RuneScape, Path Of Exile"
            className="w-full resize-none rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:opacity-60"
            style={fieldStyle}
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
          />
        </Field>

        {/* ── Expected monthly volume ─────────────────────────────── */}
        <Field
          label="Expected Monthly Volume"
          required
          error={errors.expectedVolume?.message}
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {VOLUME_OPTIONS.map((opt) => {
              const active = expectedVolume === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setValue('expectedVolume', opt.value, {
                      shouldValidate: true,
                    })
                  }
                  aria-pressed={active}
                  className="flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors"
                  style={{
                    borderColor: active ? PALETTE.forest : PALETTE.line,
                    backgroundColor: active
                      ? 'rgba(20,67,42,0.04)'
                      : PALETTE.paper,
                  }}
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: active ? PALETTE.forest : PALETTE.ink }}
                  >
                    {opt.label}
                  </span>
                  <span className="text-xs" style={{ color: PALETTE.ink2 }}>
                    {opt.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </Field>

        {/* ── 18+ confirm ─────────────────────────────────────────── */}
        <label
          className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5"
          style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.paper }}
          // The visual checkbox is a 20px span — toggling from the label makes
          // the whole card the touch target (the span isn't a real form
          // control, so label forwarding alone wouldn't fire it).
          onClick={() =>
            setValue('is18OrOlder', !is18OrOlder, { shouldValidate: true })
          }
        >
          <span
            role="checkbox"
            aria-checked={is18OrOlder}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                setValue('is18OrOlder', !is18OrOlder, { shouldValidate: true })
              }
            }}
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors"
            style={{
              borderColor: is18OrOlder ? PALETTE.forest : PALETTE.line,
              backgroundColor: is18OrOlder ? PALETTE.forest : PALETTE.paper,
            }}
          >
            {is18OrOlder && (
              <Check
                className="h-3.5 w-3.5"
                strokeWidth={3}
                style={{ color: PALETTE.lime }}
              />
            )}
          </span>
          <span className="text-sm" style={{ color: PALETTE.ink }}>
            I confirm I&apos;m 18 years or older.
            <span style={{ color: PALETTE.forest2 }}> *</span>
          </span>
        </label>
        {errors.is18OrOlder && (
          <p className="-mt-4 text-xs" style={{ color: '#B42318' }}>
            {errors.is18OrOlder.message}
          </p>
        )}

        {/* ── Advance ─────────────────────────────────────────────── */}
        <div className="flex justify-end pt-2">
          <PrimaryButton>
            Continue
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </div>
      </div>
    </form>
  )
}

/* ── Local light-world primitives ─────────────────────────────────────────── */

const fieldStyle: React.CSSProperties = {
  borderColor: PALETTE.line,
  backgroundColor: PALETTE.paper,
  color: PALETTE.ink,
}

function onFieldFocus(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = PALETTE.forest2
  e.currentTarget.style.boxShadow = `0 0 0 3px rgba(27,94,58,0.12)`
}
function onFieldBlur(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = PALETTE.line
  e.currentTarget.style.boxShadow = 'none'
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="mb-2 block text-sm font-medium"
        style={{ color: PALETTE.ink }}
      >
        {label}
        {required && <span style={{ color: PALETTE.forest2 }}> *</span>}
      </label>
      {hint && (
        <p className="mb-2.5 text-xs" style={{ color: PALETTE.ink2 }}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: '#B42318' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function ChoiceCard({
  icon: Icon,
  label,
  desc,
  selected,
  onClick,
}: {
  icon: typeof User
  label: string
  desc: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="flex flex-col items-start gap-1 rounded-xl border px-4 py-3.5 text-left transition-colors"
      style={{
        borderColor: selected ? PALETTE.forest : PALETTE.line,
        backgroundColor: selected ? 'rgba(20,67,42,0.04)' : PALETTE.paper,
      }}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{
          backgroundColor: selected ? PALETTE.forest : 'rgba(20,67,42,0.06)',
          color: selected ? PALETTE.paper : PALETTE.forest2,
        }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span
        className="mt-1 text-sm font-semibold"
        style={{ color: selected ? PALETTE.forest : PALETTE.ink }}
      >
        {label}
      </span>
      <span className="text-xs" style={{ color: PALETTE.ink2 }}>
        {desc}
      </span>
    </button>
  )
}

function GameGlyph({ game, size }: { game: WizardGame; size: number }) {
  if (game.image_url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={game.image_url}
        alt=""
        className="shrink-0 rounded object-cover"
        style={{ height: size, width: size }}
      />
    )
  }
  if (game.emoji) {
    return (
      <span
        className="shrink-0 text-center leading-none"
        style={{ width: size, fontSize: size * 0.7 }}
      >
        {game.emoji}
      </span>
    )
  }
  return (
    <Gamepad2
      className="shrink-0"
      style={{ height: size, width: size, color: PALETTE.ink2 }}
    />
  )
}

/**
 * GamePicker — a LIGHT Forest-Ledger searchable multi-select over the games
 * catalog. Same radix Popover + cmdk primitives as the site's GameMultiSelect,
 * restyled for the ivory/forest palette (the dark-glass original would break
 * this page's committed light look).
 */
function GamePicker({
  games,
  selected,
  onToggle,
  invalid,
}: {
  games: WizardGame[]
  selected: string[]
  onToggle: (id: string) => void
  invalid?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selectedObjs = games.filter((g) => selected.includes(g.id))

  return (
    <div>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            data-invalid={invalid || undefined}
            className="flex h-11 w-full items-center justify-between rounded-lg border px-3.5 text-sm transition-colors"
            style={{
              borderColor: open ? PALETTE.forest2 : PALETTE.line,
              backgroundColor: PALETTE.paper,
              color: selected.length === 0 ? PALETTE.ink2 : PALETTE.ink,
              boxShadow: open ? '0 0 0 3px rgba(27,94,58,0.12)' : 'none',
            }}
          >
            <span className="truncate">
              {selected.length === 0
                ? 'Search And Select Games…'
                : `${selected.length} ${selected.length === 1 ? 'Game' : 'Games'} Selected`}
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 transition-transform"
              style={{
                color: PALETTE.ink2,
                transform: open ? 'rotate(180deg)' : 'none',
              }}
            />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            style={{
              width: 'var(--radix-popover-trigger-width)',
              backgroundColor: PALETTE.paper,
              borderColor: PALETTE.line,
            }}
            className="z-50 overflow-hidden rounded-xl border shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <Command
              shouldFilter
              filter={(itemValue, search, keywords) => {
                const q = search.trim().toLowerCase()
                if (!q) return 1
                const hay = (
                  itemValue +
                  ' ' +
                  (keywords?.join(' ') ?? '')
                ).toLowerCase()
                return hay.includes(q) ? 1 : 0
              }}
              className="flex w-full flex-col"
            >
              <div
                className="flex items-center gap-2 border-b px-3 py-2.5"
                style={{ borderColor: PALETTE.line }}
              >
                <Search
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: PALETTE.ink2 }}
                />
                <CommandInput
                  placeholder="Search games…"
                  autoFocus
                  className="h-6 flex-1 border-0 bg-transparent text-sm outline-none focus:outline-none focus-visible:outline-none focus-visible:shadow-none"
                  style={{ color: PALETTE.ink }}
                />
              </div>
              <CommandList className="max-h-64 overflow-y-auto p-1.5">
                <CommandEmpty
                  className="px-3 py-2 text-xs"
                  style={{ color: PALETTE.ink2 }}
                >
                  No games found — use Other Games below.
                </CommandEmpty>
                <CommandGroup>
                  {games.map((game) => {
                    const isChecked = selected.includes(game.id)
                    return (
                      <CommandItem
                        key={game.id}
                        value={game.name}
                        keywords={[game.slug]}
                        onSelect={() => onToggle(game.id)}
                        className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[selected=true]:bg-[rgba(20,67,42,0.06)]"
                        style={{ color: PALETTE.ink }}
                      >
                        <span
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
                          style={{
                            borderColor: isChecked ? PALETTE.forest : PALETTE.line,
                            backgroundColor: isChecked
                              ? PALETTE.forest
                              : PALETTE.paper,
                          }}
                        >
                          {isChecked && (
                            <Check
                              className="h-3 w-3"
                              strokeWidth={3}
                              style={{ color: PALETTE.lime }}
                            />
                          )}
                        </span>
                        <GameGlyph game={game} size={20} />
                        <span className="flex-1 truncate">{game.name}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Selected chips */}
      {selectedObjs.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {selectedObjs.map((game) => (
            <span
              key={game.id}
              className="inline-flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-1 text-xs"
              style={{
                borderColor: PALETTE.line,
                backgroundColor: PALETTE.paper,
                color: PALETTE.ink,
              }}
            >
              <GameGlyph game={game} size={16} />
              <span className="max-w-[160px] truncate">{game.name}</span>
              <button
                type="button"
                onClick={() => onToggle(game.id)}
                aria-label={`Remove ${game.name}`}
                className="-m-1 rounded-full p-2 transition-colors hover:bg-[rgba(20,67,42,0.08)]"
                style={{ color: PALETTE.ink2 }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = React.useState(false)
  return (
    <button
      type="submit"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all"
      style={{
        backgroundColor: PALETTE.forest,
        color: PALETTE.paper,
        boxShadow: hover ? `0 0 0 3px ${PALETTE.lime}` : 'none',
        transform: hover ? 'translateY(-1px)' : 'none',
      }}
    >
      {children}
    </button>
  )
}
