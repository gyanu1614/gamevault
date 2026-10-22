/**
 * Values catalogue pipeline: the contracts (spec:
 * docs/superpowers/specs/2026-10-21-values-catalogue-pipeline-design.md).
 *
 * One shared run (run.ts) adds newly released items from each game's Fandom
 * wiki; a game is one adapter (games/<game>.ts) behind these types. Relative
 * imports only: the tsx CLI (scripts/catalogue.mjs) and vitest load these
 * files the same way.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type Db = SupabaseClient

/** A wiki page as the run reads it: latest revision only. */
export interface WikiPage {
  pageId: number
  title: string
  revisionId: number | null
  content: string
  /** "Category:Secret Brainrots" … */
  categories: string[]
}

/** One listing; the union of a game's listings is every item page. */
export interface WikiListQuery {
  list: 'categorymembers' | 'embeddedin'
  /** "Category:Pets" / "Template:Brainrot Infobox". */
  title: string
}

export interface ListedPage {
  pageId: number
  title: string
}

export interface RecentPage extends ListedPage {
  /** Created (not just edited) inside the window. */
  isNew: boolean
}

export interface WikiClient {
  listPages(q: WikiListQuery): Promise<ListedPage[]>
  /** Main-namespace pages created or edited since `sinceIso`. */
  recentChanges(sinceIso: string): Promise<RecentPage[]>
  fetchPages(pageIds: number[]): Promise<WikiPage[]>
  wikitext(title: string): Promise<string>
  /** File name → URL of its `width`-px rendition; files the wiki lacks are absent. */
  imageUrls(files: string[], width: number): Promise<Map<string, string>>
  /** API calls made so far (for the run report). */
  requests(): number
}

/** The stored How To Get object (src/lib/values/how-to-get.ts reads it back). */
export interface StoredHowToGet {
  status: 'obtainable' | 'unobtainable' | 'unknown' | 'seasonal'
  method: string
  costs?: string
  odds?: string
  released?: string
  note?: string
  sources: string[]
  confidence: 'high' | 'medium' | 'low'
  checked_at: string
}

export interface ParsedItem {
  pageId: number
  revisionId: number | null
  wikiTitle: string
  pageUrl: string
  slug: string
  name: string
  rarity: string | null
  /** Wiki file name without "File:" ("Slushi Huski.png"). */
  imageFile: string | null
  releasedAt: string | null
  origin: string | null
  howToGet: StoredHowToGet | null
  /** Game-specific columns (SAB: income, cost, obtainability, categories). */
  extra: Record<string, unknown>
}

/** An item we already hold, as the matcher needs it. */
export interface KnownItem {
  slug: string
  name: string
  pageId: number | null
}

export interface CatalogueRef {
  pageId: number
  wikiTitle: string
  itemSlug: string | null
  status: 'item' | 'ignored'
  firstSeenAt: string
  checkedAt: string
}

export interface ImageTarget {
  bucket: string
  path: string
}

export interface ImageStore {
  /** Copies one wiki file to our storage as a 512 px WebP. Never throws. */
  copy(file: string, target: ImageTarget): Promise<boolean>
}

export type ParseContext = { checkedAt: string } & Record<string, unknown>

export interface CatalogueAdapter {
  gameSlug: string
  /** Plural noun for messages: "brainrots", "pets", "items". */
  label: string
  /** "stealabrainrot.fandom.com". */
  wikiHost: string
  listQueries: WikiListQuery[]
  /** New items one run may add before it stops and asks (default 50). */
  insertCap?: number
  /** Once-per-run wiki reads the parser needs (SAB: the Update Log). */
  prepare?(wiki: WikiClient): Promise<Record<string, unknown>>
  /** One page → an item, or null when the page is not one. Pure. */
  parse(page: WikiPage, ctx: ParseContext): ParsedItem | null
  /**
   * Wiki reads only NEW items need (MM2: a gamepass or event page's price),
   * run after the guards pass and before the insert; returns the items to insert.
   */
  enrich?(items: ParsedItem[], wiki: WikiClient, ctx: ParseContext): Promise<ParsedItem[]>
  loadKnown(db: Db): Promise<KnownItem[]>
  /** Insert-only (on conflict do nothing); returns the slugs actually inserted. */
  insert(db: Db, items: ParsedItem[], images: ImageStore): Promise<string[]>
  /**
   * Retries images for rows this pipeline added without one; returns the slugs
   * fixed. Gets the wiki because generic values_items rows store no file name.
   */
  fixMissingImages?(db: Db, images: ImageStore, wiki: WikiClient): Promise<string[]>
}

export interface CatalogueGame {
  /** CLI / workflow key, same as PRICING_GAMES ("sab"). */
  key: string
  /** "Steal a Brainrot". */
  name: string
  adapter: CatalogueAdapter
}

export type RunStatus = 'ok' | 'nothing_new' | 'blocked' | 'failed'

export interface RunReport {
  gameSlug: string
  status: RunStatus
  listed: number
  candidates: number
  adopted: number
  /** Inserted (write) or would be inserted (dry run). */
  added: { slug: string; name: string }[]
  ignored: number
  imagesFixed: number
  parseErrors: string[]
  message: string | null
  wikiRequests: number
}
