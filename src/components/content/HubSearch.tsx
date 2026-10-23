'use client'

/**
 * Hub navbar search (owner, 2026-10-23): ONE game at a time — its items
 * (picture, what it is, market price) first, then its guides. Opens from the
 * bar's search button or Ctrl/⌘ K, in a cmdk dialog like the game switcher.
 *
 * The game's index (/[game]/search.json, a few dozen KB, cached) loads when
 * the dialog opens, never with the page. With no result in this game, the
 * other games' indexes are checked so "bat dragon" on MM2 answers "Found in
 * Adopt Me", next to "Are you sure you're in the right game?". Typos fall
 * back to close spellings (lib/search/game-search.ts).
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { BookOpenTextIcon } from '@phosphor-icons/react/dist/csr/BookOpenText'
import { unpack } from '@/lib/serialize/columnar'
import { searchGame, searchIndexGames, type GameSearchIndex, type SearchGuide, type SearchItem } from '@/lib/search/game-search'
import { formatUsd } from '@/lib/value-listings/format'
import { ValueArt } from '@/components/values/ValueArt'

const indexes = new Map<string, Promise<GameSearchIndex | null>>()

/** One fetch per game per visit; a failed fetch is retried next time the dialog opens. */
function loadIndex(slug: string): Promise<GameSearchIndex | null> {
  let p = indexes.get(slug)
  if (!p) {
    p = fetch(`/${slug}/search.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j ? ({ ...j, items: unpack<SearchItem[]>(j.items) } as GameSearchIndex) : null))
      .catch(() => null)
      .then((ix) => {
        if (!ix) indexes.delete(slug)
        return ix
      })
    indexes.set(slug, p)
  }
  return p
}

const ROW =
  'flex cursor-pointer select-none items-center gap-3 rounded-md px-2.5 py-2 outline-none transition-colors data-[selected=true]:bg-white/[0.06]'
const HEADING = '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-tertiary'

export function HubSearch({ game }: { game: { slug: string; name: string } }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<GameSearchIndex | null>(null)
  const [elsewhere, setElsewhere] = useState<{ name: string; items: SearchItem[] }[]>([])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open && !index) loadIndex(game.slug).then(setIndex)
  }, [open, index, game.slug])

  const q = query.trim()
  const results = useMemo(() => (index && q ? searchGame(index, q) : null), [index, q])
  const nothingHere = !!results && results.items.length === 0 && results.guides.length === 0

  // Nothing in this game: look in the others (their indexes load only now).
  useEffect(() => {
    if (!nothingHere) {
      setElsewhere([])
      return
    }
    let live = true
    const others = searchIndexGames().filter((g) => g !== game.slug)
    Promise.all(others.map(loadIndex)).then((list) => {
      if (!live) return
      setElsewhere(
        list
          .filter((ix): ix is GameSearchIndex => ix != null)
          .map((ix) => {
            const r = searchGame(ix, q, { items: 3, guides: 0 })
            return { name: ix.name, items: r.closeOnly ? [] : r.items }
          })
          .filter((x) => x.items.length > 0),
      )
    })
    return () => {
      live = false
    }
  }, [nothingHere, q, game.slug])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }
  const suggestions = index && !q ? { items: index.items.slice(0, 6), guides: index.guides.slice(0, 3) } : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Search ${game.name}`}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-white/[0.05] px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.09] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:h-11"
      >
        <MagnifyingGlassIcon size={16} weight="bold" aria-hidden />
        <span className="hidden 2xl:inline">Search</span>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setQuery('')
        }}
        label={`Search ${game.name}`}
        shouldFilter={false}
        loop
        overlayClassName="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
        contentClassName="fixed left-1/2 top-[max(12px,8vh)] z-[61] w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-lg bg-[rgba(29,30,35,0.98)] text-[15px] shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
      >
        <div className="p-2 pb-1">
          <div className="flex h-12 items-center gap-2.5 rounded-md bg-white/[0.05] px-3 transition-colors focus-within:bg-white/[0.09]">
            <MagnifyingGlassIcon aria-hidden size={18} weight="bold" className="shrink-0 text-text-tertiary" />
            {/* 16px text: no zoom on focus on iPhone. */}
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={`Search ${game.name} items and guides`}
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-text-primary shadow-none outline-none ring-0 placeholder:text-text-tertiary focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            />
          </div>
        </div>

        <Command.List className={`max-h-[min(64vh,520px)] overflow-y-auto overscroll-contain p-1.5 ${HEADING}`}>
          {!index && <Command.Loading className="px-3 py-6 text-center text-sm text-text-tertiary">Loading {game.name}…</Command.Loading>}

          {suggestions && (
            <>
              {suggestions.items.length > 0 && <ItemGroup heading="Popular" items={suggestions.items} onPick={go} />}
              {suggestions.guides.length > 0 && <GuideGroup heading="Latest Guides" guides={suggestions.guides} onPick={go} />}
            </>
          )}

          {results && !nothingHere && (
            <>
              {results.items.length > 0 && <ItemGroup heading={results.closeOnly ? 'Did You Mean' : `${game.name} Items`} items={results.items} onPick={go} />}
              {results.guides.length > 0 && <GuideGroup heading="Guides" guides={results.guides} onPick={go} />}
            </>
          )}

          {nothingHere && (
            <>
              <div className="px-3 pb-3 pt-4 text-center">
                <p className="text-[14.5px] font-semibold text-text-primary">
                  No {game.name} results for “{q}”
                </p>
                <p className="mt-1 text-[13px] text-text-secondary">Are you sure you&apos;re in the right game? Pick another game from the menu at the top left.</p>
              </div>
              {elsewhere.map((g) => (
                <ItemGroup key={g.name} heading={`Found In ${g.name}`} items={g.items} onPick={go} />
              ))}
            </>
          )}
        </Command.List>
      </Command.Dialog>
    </>
  )
}

function ItemGroup({ heading, items, onPick }: { heading: string; items: SearchItem[]; onPick: (href: string) => void }) {
  return (
    <Command.Group heading={heading}>
      {items.map((item) => (
        <Command.Item key={item.h} value={item.h} onSelect={() => onPick(item.h)} className={ROW}>
          <ValueArt src={item.i} alt="" aria-hidden size={36} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-medium text-text-primary">{item.n}</span>
            {item.k && <span className="block truncate text-[12px] text-text-tertiary">{item.k}</span>}
          </span>
          {item.p != null && <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-text-secondary">{formatUsd(item.p)}</span>}
        </Command.Item>
      ))}
    </Command.Group>
  )
}

function GuideGroup({ heading, guides, onPick }: { heading: string; guides: SearchGuide[]; onPick: (href: string) => void }) {
  return (
    <Command.Group heading={heading}>
      {guides.map((g) => (
        <Command.Item key={g.h} value={g.h} onSelect={() => onPick(g.h)} className={ROW}>
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-text-tertiary">
            <BookOpenTextIcon size={17} weight="duotone" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[14.5px] text-text-primary">{g.t}</span>
        </Command.Item>
      ))}
    </Command.Group>
  )
}
