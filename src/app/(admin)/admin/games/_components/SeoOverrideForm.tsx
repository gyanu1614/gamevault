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
    return <div className="h-64 animate-pulse rounded-xl bg-bg-raised" />
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-text-secondary">
        Leave a field blank to use the auto-generated value (shown as the placeholder).
        Fill it in to override for <span className="font-semibold text-text-primary">{gameName}</span>.
      </p>

      <Field
        label="Title"
        hint="≤ 60 chars. Appears in search results + browser tab."
        value={form.seo_title ?? ''}
        placeholder={generated.title}
        onChange={(v) => set('seo_title', v)}
        max={60}
      />
      <Field
        label="Meta description"
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
        label="Intro paragraph"
        hint="Visible SSR copy under the H1 — helps the page rank."
        value={form.seo_intro ?? ''}
        placeholder={generated.intro}
        onChange={(v) => set('seo_intro', v)}
        textarea
        rows={4}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-[12px] font-semibold uppercase tracking-wider text-text-secondary">
            Ecosystem
          </label>
          <select
            value={form.ecosystem ?? ''}
            onChange={(e) => set('ecosystem', e.target.value)}
            className="h-10 w-full rounded-lg border border-border-default bg-bg-overlay px-3 text-sm text-text-primary outline-none focus:border-lime"
          >
            {ECOSYSTEMS.map((e) => (
              <option key={e} value={e}>{e === '' ? '— none —' : e}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[12px] font-semibold uppercase tracking-wider text-text-secondary">
            Indexing
          </label>
          <select
            value={indexMode}
            onChange={(e) => setIndexMode(e.target.value as IndexMode)}
            className="h-10 w-full rounded-lg border border-border-default bg-bg-overlay px-3 text-sm text-text-primary outline-none focus:border-lime"
          >
            <option value="auto">Auto (by listings + content)</option>
            <option value="index">Force index</option>
            <option value="noindex">Force noindex</option>
          </select>
        </div>
      </div>

      {indexMode === 'noindex' && (
        <Field
          label="Noindex reason"
          hint="Shown in the admin SEO badge tooltip (e.g. 'prelaunch')."
          value={form.seo_noindex_reason ?? ''}
          placeholder="e.g. prelaunch, awaiting content"
          onChange={(v) => set('seo_noindex_reason', v)}
        />
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center rounded-lg bg-lime px-5 text-sm font-bold text-text-inverse transition-colors hover:bg-lime-hover disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save SEO'}
        </button>
      </div>
    </div>
  )
}

function Field({
  label, hint, value, placeholder, onChange, textarea, rows = 2, max,
}: {
  label: string; hint?: string; value: string; placeholder?: string
  onChange: (v: string) => void; textarea?: boolean; rows?: number; max?: number
}) {
  const over = max != null && value.length > max
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="block text-[12px] font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </label>
        {max != null && value.length > 0 && (
          <span className={`text-[11px] tabular-nums ${over ? 'text-error' : 'text-text-tertiary'}`}>
            {value.length}/{max}
          </span>
        )}
      </div>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full rounded-lg border border-border-default bg-bg-overlay px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-lime"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-border-default bg-bg-overlay px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-lime"
        />
      )}
      {hint && <p className="text-[11.5px] text-text-tertiary">{hint}</p>}
    </div>
  )
}
