'use client'

/**
 * Adopt Me Neon-cost calculator — build vs buy.
 *
 * Pick a pet: to make a Neon you need 4 full-grown copies; a Mega Neon needs
 * 4 Neons = 16 base pets. This tool shows the cash cost to BUILD each form (from
 * the Normal price) vs. BUY it outright (from the Neon / Mega price we hold),
 * and which is cheaper. Uncontested: no rival calculator shows the money side.
 *
 * Honesty: if we don't hold the price a calculation needs (e.g. no Normal cash),
 * that path shows "no data" rather than a guess.
 */

import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import type { CalcPet, Variant } from '../calculator/_adoptMeCalcTypes'
import { ItemPickerDialog } from '@/components/values/ItemPickerDialog'
import { ValueArt } from '@/components/values/ValueArt'
import { VALUE_SURFACE, VALUE_SURFACE_LINK, VALUE_TILE } from '@/components/values/styles'
import { rarityMeta } from '@/lib/values/rarity'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function AdoptMeNeonClient({ pets }: { pets: CalcPet[] }) {
  const [slug, setSlug] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  // Fresh picker search every time it opens.
  const [pickerSession, setPickerSession] = useState(0)
  const pet = useMemo(() => pets.find((p) => p.slug === slug) ?? null, [pets, slug])

  const cash = (v: Variant) => pet?.values[v]?.cashUsd ?? null

  const normal = cash('N')
  const neon = cash('NEON')
  const mega = cash('MEGA')

  // Build cost = how many base pets × the Normal price.
  const buildNeon = normal != null ? normal * 4 : null
  const buildMega = normal != null ? normal * 16 : null

  return (
    <div className="space-y-5">
      {/* Pet selector */}
      <button
        type="button"
        onClick={() => { setPickerSession((n) => n + 1); setPicking(true) }}
        className={`${VALUE_SURFACE_LINK} flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
      >
        <span className="flex items-center gap-3">
          {pet ? (
            <ValueArt src={pet.imageUrl} alt={pet.name} aria-hidden size={36} />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/[0.06] text-text-tertiary">
              <MagnifyingGlassIcon size={16} weight="bold" aria-hidden />
            </span>
          )}
          <span className="text-[15px] font-semibold text-text-primary">{pet ? pet.name : 'Choose a pet'}</span>
        </span>
        <span className="text-[13px] text-text-secondary">{pet ? 'change' : 'search'}</span>
      </button>

      {pet && (
        <>
          {/* The Neon math, stated plainly. */}
          <div className={`${VALUE_SURFACE} p-4`}>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              To make a <span className="font-semibold text-text-primary">Neon {pet.name}</span> you merge{' '}
              <span className="font-semibold text-text-primary">4 full-grown</span> copies. A{' '}
              <span className="font-semibold text-text-primary">Mega Neon</span> is 4 Neons —{' '}
              <span className="font-semibold text-text-primary">16 base pets</span> in total.
            </p>
          </div>

          {/* Neon: build vs buy */}
          <CostCard
            title={`Neon ${pet.name}`}
            need="4 base pets"
            buildCost={buildNeon}
            buyCost={neon}
          />

          {/* Mega: build vs buy */}
          <CostCard
            title={`Mega Neon ${pet.name}`}
            need="16 base pets"
            buildCost={buildMega}
            buyCost={mega}
          />

          <p className="text-[12px] leading-relaxed text-text-tertiary">
            Build cost is the Normal cash price times the number of base pets, and
            ignores potions and the time to grow each pet. Buying is often cheaper
            than building once you count that effort — this shows the raw money side.
          </p>
        </>
      )}

      <PetPicker
        key={pickerSession}
        open={picking}
        pets={pets}
        onPick={(s) => { setSlug(s); setPicking(false) }}
        onClose={() => setPicking(false)}
      />
    </div>
  )
}

function CostCard({
  title,
  need,
  buildCost,
  buyCost,
}: {
  title: string
  need: string
  buildCost: number | null
  buyCost: number | null
}) {
  const cheaper =
    buildCost != null && buyCost != null ? (buildCost < buyCost ? 'build' : 'buy') : null
  const saving =
    buildCost != null && buyCost != null ? Math.abs(buildCost - buyCost) : null

  return (
    <div className={VALUE_SURFACE}>
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
        <span className="text-[14px] font-semibold text-text-primary">{title}</span>
        <span className="text-[12px] text-text-secondary">needs {need}</span>
      </div>
      <div className="grid gap-2 p-2 sm:grid-cols-2">
        <Path
          label="Build it"
          hint="4 or 16 base pets × Normal price"
          cost={buildCost}
          highlight={cheaper === 'build'}
        />
        <Path
          label="Buy it"
          hint="the ready-made form"
          cost={buyCost}
          highlight={cheaper === 'buy'}
        />
      </div>
      {cheaper && saving != null && (
        <p className="border-t border-white/[0.07] px-4 py-2.5 text-[13px] text-text-secondary">
          <span className="font-semibold text-[#54DDBE]">{cheaper === 'buy' ? 'Buying' : 'Building'}</span>{' '}
          is cheaper by <span className="font-semibold tabular-nums text-text-primary">{USD.format(saving)}</span>.
        </p>
      )}
    </div>
  )
}

function Path({
  label,
  hint,
  cost,
  highlight,
}: {
  label: string
  hint: string
  cost: number | null
  highlight?: boolean
}) {
  return (
    <div className={`px-3.5 py-3 ${highlight ? 'rounded-md bg-[#54DDBE]/[0.08]' : VALUE_TILE}`}>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-text-primary">{label}</span>
        {highlight && <span className="rounded bg-[#54DDBE]/[0.16] px-1.5 py-0.5 text-[10px] font-semibold text-[#54DDBE]">cheaper</span>}
      </div>
      <p className="text-[12px] text-text-tertiary">{hint}</p>
      <p className="mt-1.5 text-[20px] font-bold tabular-nums text-text-primary">
        {cost != null ? USD.format(cost) : <span className="text-[14px] font-normal text-text-tertiary">no cash data</span>}
      </p>
    </div>
  )
}

function PetPicker({
  open,
  pets,
  onPick,
  onClose,
}: {
  open: boolean
  pets: CalcPet[]
  onPick: (slug: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? pets.filter((p) => p.name.toLowerCase().includes(s)) : pets
  }, [q, pets])

  return (
    <ItemPickerDialog
      open={open}
      onClose={onClose}
      title="Choose A Pet"
      items={filtered.map((p) => {
        const r = rarityMeta('adopt-me', p.rarity)
        return { key: p.slug, name: p.name, imageUrl: p.imageUrl, sub: r.label, subColor: r.color }
      })}
      onPick={onPick}
      query={q}
      onQueryChange={setQ}
      searchPlaceholder="Search a pet…"
      searchLabel="Search pets"
      emptyText="No pets match."
    />
  )
}
