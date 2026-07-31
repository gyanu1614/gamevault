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
import { Search, X } from 'lucide-react'
import type { CalcPet, Variant } from '../calculator/_adoptMeCalcTypes'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function AdoptMeNeonClient({ pets }: { pets: CalcPet[] }) {
  const [slug, setSlug] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
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
        onClick={() => setPicking(true)}
        className="flex w-full items-center justify-between gap-3 border border-[#1E2723] bg-[#0F1311] px-4 py-3.5 text-left transition hover:border-[#2A3A31]"
      >
        <span className="flex items-center gap-3">
          {pet?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote pet art
            <img src={pet.imageUrl} alt="" className="h-9 w-9 object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center border border-[#1E2723] bg-black/20 text-[#6D7A72]"><Search className="h-4 w-4" /></span>
          )}
          <span className="text-[15px] font-semibold text-[#E6EAE7]">{pet ? pet.name : 'Choose a pet'}</span>
        </span>
        <span className="text-[13px] text-[#8B978F]">{pet ? 'change' : 'search'}</span>
      </button>

      {pet && (
        <>
          {/* The Neon math, stated plainly. */}
          <div className="border border-[#1E2723] bg-[#0F1311] p-4">
            <p className="text-[13px] leading-relaxed text-[#C6CEC9]">
              To make a <span className="font-semibold text-[#F1F3F1]">Neon {pet.name}</span> you merge{' '}
              <span className="font-semibold text-[#F1F3F1]">4 full-grown</span> copies. A{' '}
              <span className="font-semibold text-[#F1F3F1]">Mega Neon</span> is 4 Neons —{' '}
              <span className="font-semibold text-[#F1F3F1]">16 base pets</span> in total.
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

          <p className="text-[12px] leading-relaxed text-[#6D7A72]">
            Build cost is the Normal cash price times the number of base pets, and
            ignores potions and the time to grow each pet. Buying is often cheaper
            than building once you count that effort — this shows the raw money side.
          </p>
        </>
      )}

      {picking && (
        <PetPicker
          pets={pets}
          onPick={(s) => { setSlug(s); setPicking(false) }}
          onClose={() => setPicking(false)}
        />
      )}
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
    <div className="border border-[#1E2723] bg-[#0F1311]">
      <div className="flex items-center justify-between border-b border-[#1E2723] px-4 py-2.5">
        <span className="text-[14px] font-semibold text-[#F1F3F1]">{title}</span>
        <span className="text-[12px] text-[#8B978F]">needs {need}</span>
      </div>
      <div className="grid sm:grid-cols-2">
        <Path
          label="Build it"
          hint="4 or 16 base pets × Normal price"
          cost={buildCost}
          highlight={cheaper === 'build'}
          bordered
        />
        <Path
          label="Buy it"
          hint="the ready-made form"
          cost={buyCost}
          highlight={cheaper === 'buy'}
        />
      </div>
      {cheaper && saving != null && (
        <p className="border-t border-[#1A211A] px-4 py-2.5 text-[13px] text-[#C6CEC9]">
          <span className="font-semibold text-[#8FBF9C]">{cheaper === 'buy' ? 'Buying' : 'Building'}</span>{' '}
          is cheaper by <span className="font-mono font-semibold text-[#F1F3F1]">{USD.format(saving)}</span>.
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
  bordered,
}: {
  label: string
  hint: string
  cost: number | null
  highlight?: boolean
  bordered?: boolean
}) {
  return (
    <div className={`px-4 py-3.5 ${bordered ? 'border-b border-[#1A211A] sm:border-b-0 sm:border-r' : ''} ${highlight ? 'bg-[#0E1611]' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-[#C6CEC9]">{label}</span>
        {highlight && <span className="bg-[#14432A] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#8FBF9C]">cheaper</span>}
      </div>
      <p className="text-[12px] text-[#6D7A72]">{hint}</p>
      <p className="mt-1.5 font-mono text-[20px] font-bold tabular-nums text-[#E6EAE7]">
        {cost != null ? USD.format(cost) : <span className="text-[14px] font-normal text-[#6D7A72]">no cash data</span>}
      </p>
    </div>
  )
}

function PetPicker({
  pets,
  onPick,
  onClose,
}: {
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[10vh] backdrop-blur-sm" onClick={onClose}>
      <div className="animate-verdict w-full max-w-lg border border-[#1E2723] bg-[#0E1211] shadow-[0_28px_60px_-20px_rgba(0,0,0,0.9)]" onClick={(e) => e.stopPropagation()}>
        <style>{`@keyframes amwfl-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } } .animate-verdict { animation: amwfl-in 240ms cubic-bezier(0.16,1,0.3,1); }`}</style>
        <div className="flex items-center gap-2 border-b border-[#1E2723] px-4 py-3">
          <Search className="h-4 w-4 text-[#6D7A72]" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a pet…" className="w-full bg-transparent text-[16px] text-[#F1F3F1] outline-none placeholder:text-[#6D7A72]" />
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#6D7A72] hover:text-[#F1F3F1]"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {filtered.map((p) => (
            <button key={p.slug} type="button" onClick={() => onPick(p.slug)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.04]">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote pet art
                <img src={p.imageUrl} alt="" className="h-8 w-8 shrink-0 object-contain" />
              ) : (
                <span className="h-8 w-8 shrink-0 border border-[#1E2723] bg-black/20" />
              )}
              <span className="text-[14px] text-[#E6EAE7]">{p.name}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-[#6D7A72]">No pets match.</div>}
        </div>
      </div>
    </div>
  )
}
