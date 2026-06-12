// DEV ONLY — visual test for the new <Select/> primitive. Delete before prod.

'use client'

import { useState } from 'react'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const PETS = [
  'Bat Dragon', 'Frost Dragon', 'Cow', 'Owl', 'Giraffe', 'Parrot',
  'Shadow Dragon', 'Robo Dog', 'Crocodile', 'Albino Monkey', 'Evil Unicorn',
]

const SHORT = ['Pets', 'Eggs', 'Gifts', 'Pet Wears', 'Toys', 'Other']

export default function DevSelectPage() {
  const [pet, setPet] = useState<string>('')
  const [type, setType] = useState<string>('')
  const [trait, setTrait] = useState<string>('')

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Select primitive — dev visual test</h1>
      <p className="mb-8 text-sm text-text-secondary">
        Confirms the dropdown panel portals correctly, doesn’t overlap inputs below,
        and themes via GV tokens.
      </p>

      <div className="space-y-6 rounded-2xl bg-bg-overlay p-6 border border-border-subtle">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Long list (with scroll) — Pet Name
          </label>
          <Select value={pet} onValueChange={setPet}>
            <SelectTrigger>
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Dragons</SelectLabel>
                <SelectItem value="bat-dragon">Bat Dragon</SelectItem>
                <SelectItem value="frost-dragon">Frost Dragon</SelectItem>
                <SelectItem value="shadow-dragon">Shadow Dragon</SelectItem>
                <SelectItem value="evil-unicorn">Evil Unicorn</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Common pets</SelectLabel>
                {PETS.filter((p) => !p.endsWith('Dragon')).map((p) => (
                  <SelectItem key={p} value={p.toLowerCase().replace(/\s+/g, '-')}>
                    {p}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Short list — Item Type
          </label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="Choose Item Type" />
            </SelectTrigger>
            <SelectContent>
              {SHORT.map((s) => (
                <SelectItem key={s} value={s.toLowerCase()}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Required — Trait
          </label>
          <Select value={trait} onValueChange={setTrait}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="N">N</SelectItem>
              <SelectItem value="F">F</SelectItem>
              <SelectItem value="R">R</SelectItem>
              <SelectItem value="FR">FR</SelectItem>
              <SelectItem value="NFR">NFR</SelectItem>
              <SelectItem value="MFR">MFR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* This input sits BELOW the dropdowns — if the panel overlaps it,
            we'll see it visually (the bug we're fixing in R5). */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            This input must NOT overlap with any open dropdown above
          </label>
          <input
            className="h-10 w-full rounded-xl border border-border-default bg-bg-inset px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
            placeholder="Type here…"
          />
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-bg-inset p-3 text-xs text-text-secondary">
        Current values: pet=<span className="text-text-primary font-mono">{pet || 'none'}</span>,
        {' '}type=<span className="text-text-primary font-mono">{type || 'none'}</span>,
        {' '}trait=<span className="text-text-primary font-mono">{trait || 'none'}</span>
      </div>
    </div>
  )
}
