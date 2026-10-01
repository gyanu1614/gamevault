'use client'

/**
 * SEO tab — edit a game's SEO override fields. Blank = the template layer
 * (lib/seo/templates.ts) auto-generates the field, so admins only fill in
 * what they want to customise. The generated value shows as the placeholder
 * so they can see the default before overriding.
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { fetchGameSeo, updateGameSeo, type GameSeoData } from '@/lib/actions/admin-games'
import { resolveGameSeo } from '@/lib/seo/templates'
import { cn } from '@/lib/utils'
import { accountInputCls } from '@/components/account/AccountSurface'
import { FIELD_LABEL, FormLoading, FormSection, SaveBar } from './form-bits'

const ECOSYSTEMS = ['', 'roblox', 'pc', 'console', 'mobile', 'mmo', 'sports', 'other'] as const

type IndexMode = 'auto' | 'index' | 'noindex'

export function SeoOverrideForm({ gameId, gameName }: { gameId: string; gameName: string }) {
  const [loaded, setLoaded] = useState(false)
  const [saving, startSave] = useTransition()
  const [form, setForm] = useState<GameSeoData>({})
  const [indexMode, setIndexMode] = useState<IndexMode>('auto')

  useEffect(() => {
    let alive = true
    fetchGameSeo(gameId).then((d) => {
      if (!alive || !d) return
      setForm({
        seo_title: d.seo_title ?? '',
        seo_description: d.seo_description ?? '',
        seo_h1: d.seo_h1 ?? '',
        seo_intro: d.seo_intro ?? '',
        ecosystem: d.ecosystem ?? '',
        seo_noindex_reason: d.seo_noindex_reason ?? '',
      })
      setIndexMode(d.seo_indexable === true ? 'index' : d.seo_indexable === false ? 'noindex' : 'auto')
      setLoaded(true)
    })
    return () => { alive = false }
  }, [gameId])

  // Live preview of what the templates generate (the placeholders).
  const generated = useMemo(
    () => resolveGameSeo({ name: gameName, categoryLabels: [], hasAccounts: true }),
    [gameName],
  )

  const set = (k: keyof GameSeoData, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const save = () => {
    startSave(async () => {
      const res = await updateGameSeo(gameId, {
        ...form,
        seo_indexable: indexMode === 'auto' ? null : indexMode === 'index',
      })
      if (res.success) toast.success('SEO saved')
      else toast.error(res.error ?? 'Failed to save SEO')
    })
  }

  if (!loaded) {
    return <FormLoading cards={2} />
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="space-y-4"
    >
      <FormSection
        title="Search Listing"
        subtitle={
          <>
            Leave a field blank to use the auto-generated value (shown as the placeholder). Fill it in to override
            for <span className="font-semibold text-text-primary">{gameName}</span>.
          </>
        }
      >
      <div className="space-y-4">

      <Field
        label="Title"
        hint="≤ 60 chars. Appears in search results + browser tab."
        value={form.seo_title ?? ''}
        placeholder={generated.title}
        onChange={(v) => set('seo_title', v)}
        max={60}
      />
      <Field
        label="Meta Description"
        hint="≤ 160 chars. The snippet under the title in Google."
        value={form.seo_description ?? ''}
        placeholder={generated.description}
        onChange={(v) => set('seo_description', v)}
        textarea
        max={160}
      />
      <Field
        label="H1"
        hint="The main heading on the game hub page."
        value={form.seo_h1 ?? ''}
        placeholder={generated.h1}
        onChange={(v) => set('seo_h1', v)}
      />
      <Field
        label="Intro Paragraph"
        hint="Visible SSR copy under the H1 — helps the page rank."
        value={form.seo_intro ?? ''}
        placeholder={generated.intro}
        onChange={(v) => set('seo_intro', v)}
        textarea
        rows={4}
      />
      </div>
      </FormSection>

      <FormSection title="Classification & Indexing">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="seo-ecosystem" className={FIELD_LABEL}>Ecosystem</label>
          <select
            id="seo-ecosystem"
            value={form.ecosystem ?? ''}
            onChange={(e) => set('ecosystem', e.target.value)}
            className={cn(accountInputCls, 'h-10 cursor-pointer py-0 capitalize')}
          >
            {ECOSYSTEMS.map((e) => (
              <option key={e} value={e}>{e === '' ? '— none —' : e}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="seo-indexing" className={FIELD_LABEL}>Indexing</label>
          <select
            id="seo-indexing"
            value={indexMode}
            onChange={(e) => setIndexMode(e.target.value as IndexMode)}
            className={cn(accountInputCls, 'h-10 cursor-pointer py-0')}
          >
            <option value="auto">Auto (By Listings + Content)</option>
            <option value="index">Force Index</option>
            <option value="noindex">Force Noindex</option>
          </select>
        </div>
      </div>

      {indexMode === 'noindex' && (
        <div className="mt-4">
        <Field
          label="Noindex Reason"
          hint="Shown in the admin SEO badge tooltip (e.g. 'prelaunch')."
          value={form.seo_noindex_reason ?? ''}
          placeholder="e.g. prelaunch, awaiting content"
          onChange={(v) => set('seo_noindex_reason', v)}
        />
        </div>
      )}
      </FormSection>

      <SaveBar label={saving ? 'Saving…' : 'Save SEO'} pending={saving} />
    </form>
  )
}

function Field({
  label, hint, value, placeholder, onChange, textarea, rows = 2, max,
}: {
  label: string; hint?: string; value: string; placeholder?: string
  onChange: (v: string) => void; textarea?: boolean; rows?: number; max?: number
}) {
  const over = max != null && value.length > max
  const id = `seo-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={FIELD_LABEL}>
          {label}
        </label>
        {max != null && value.length > 0 && (
          <span className={`text-[12px] tabular-nums ${over ? 'text-error' : 'text-text-tertiary'}`}>
            {value.length}/{max}
          </span>
        )}
      </div>
      {textarea ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={cn(accountInputCls, 'resize-none')}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={accountInputCls}
        />
      )}
      {hint && <p className="mt-1 text-[12px] text-text-tertiary">{hint}</p>}
    </div>
  )
}
