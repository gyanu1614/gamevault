/**
 * One sell-form sync for one game: read form + catalogue + live listings →
 * plan the form → plan listing repairs → guard → write form → repair listings
 * → drop unused strays → refresh. Every side effect outside the DB (value
 * re-link, page refresh) is injected, so the internal route wires Next's
 * cache APIs and the CLI dry run needs none.
 */
import { OTHER } from './config'
import { planSellForm } from './plan'
import { planListingRepairs } from './repair'
import { loadCatalogue, loadForm, loadListings, retireFields, writeDeletes, writeForm, writeRepairs } from './store'
import type { ListingRepair, ListingRow, SellFormConfig, SellFormPlan, SyncReport } from './types'
import type { Db } from '../types'

/** Above these one run stops and asks (the first cutover runs with allowLarge). */
export const OPTION_CAP = 300
export const REPAIR_CAP = 50

export interface SyncDeps {
  db: Db
  /** After listing repairs: re-link their value items and refresh their pages. */
  afterRepairs: ((listingIds: string[]) => Promise<void>) | null
  /** After any form change: the sell form's cached template and the game's category pages. */
  afterFormChange: ((ctx: { gameId: string; gameCategoryId: string }) => Promise<void>) | null
}

export interface SyncOptions {
  write: boolean
  allowLarge: boolean
}

export interface SyncResult {
  report: SyncReport
  plan: SellFormPlan | null
  repairs: ListingRepair[]
}

function emptyReport(gameSlug: string, write: boolean): SyncReport {
  return {
    gameSlug, status: 'nothing_to_do', write, fieldsCreated: 0, fieldsUpdated: 0, optionsCreated: [], optionsUpdated: 0,
    optionsDeleted: 0, optionsKept: [], rulesSet: 0, listingsRepaired: 0, fieldsRetired: [], fieldsKeptInUse: [], warnings: [], message: null,
  }
}

/**
 * The config's legacy fields, split by whether a live listing still answers
 * them once the repairs land. Nothing is retired unless every configured type
 * got its chain (a type with no catalogue items keeps its old field).
 */
export function legacyRetirement(
  config: SellFormConfig,
  plan: Pick<SellFormPlan, 'typeValues'>,
  form: { fields: { id: string; slug: string }[] },
  listings: ListingRow[],
  repairs: ListingRepair[],
): { retire: { id: string; slug: string }[]; inUse: string[] } {
  const after = new Map(listings.map((l) => [l.id, l.templateData ?? {}]))
  for (const r of repairs) after.set(r.id, r.templateData)
  const retire: { id: string; slug: string }[] = []
  const inUse: string[] = []
  const chainComplete = config.types.every((t) => plan.typeValues[t.key])
  const retiring = new Set([...config.legacyFields, ...(config.retiredFields ?? [])])
  for (const f of form.fields) {
    if (!retiring.has(f.slug)) continue
    if (!chainComplete) {
      inUse.push(f.slug)
      continue
    }
    if ([...after.values()].some((d) => f.slug in d)) inUse.push(f.slug)
    else retire.push({ id: f.id, slug: f.slug })
  }
  return { retire, inUse }
}

export async function syncSellForm(config: SellFormConfig, deps: SyncDeps, opts: SyncOptions): Promise<SyncResult> {
  const report = emptyReport(config.gameSlug, opts.write)
  const loaded = await loadForm(deps.db, config.gameSlug)
  if (!loaded) {
    report.status = 'no_form'
    report.message = 'the game has no active items form'
    return { report, plan: null, repairs: [] }
  }
  const [items, listings] = await Promise.all([loadCatalogue(deps.db, loaded.gameId), loadListings(deps.db, loaded.gameCategoryId)])
  const plan = planSellForm(config, items, loaded.form)
  const repairs = planListingRepairs(config, items, plan, listings)

  report.fieldsCreated = plan.createFields.length
  report.fieldsUpdated = plan.updateFields.length
  report.optionsCreated = plan.createOptions
    .filter((c) => c.option.value !== OTHER)
    .map((c) => ({ node: c.node, label: c.option.label }))
  report.optionsUpdated = plan.updateOptions.length
  report.rulesSet = plan.setRules.length
  report.listingsRepaired = repairs.length
  report.warnings = plan.warnings
  const { retire, inUse } = legacyRetirement(config, plan, loaded.form, listings, repairs)
  report.fieldsRetired = retire.map((f) => f.slug)
  report.fieldsKeptInUse = inUse
  const formChanges = plan.createFields.length + plan.updateFields.length + plan.createOptions.length + plan.updateOptions.length + plan.setRules.length
  const anything = formChanges + plan.deleteOptions.length + repairs.length + retire.length > 0

  if (!opts.allowLarge && (plan.createOptions.length > OPTION_CAP || repairs.length > REPAIR_CAP)) {
    report.status = 'blocked'
    report.message = `${plan.createOptions.length} new options and ${repairs.length} listing repairs is over the safety cap (${OPTION_CAP} / ${REPAIR_CAP}); check a dry run, then run once with allowLarge`
    return { report, plan, repairs }
  }
  if (!opts.write || !anything) {
    report.status = anything ? 'ok' : 'nothing_to_do'
    return { report, plan, repairs }
  }

  if (formChanges) await writeForm(deps.db, plan)
  if (repairs.length) {
    await writeRepairs(deps.db, repairs)
    if (deps.afterRepairs) await deps.afterRepairs(repairs.map((r) => r.id))
    // A listing placed under Other had no value link; the re-link above may have
    // found its item from the title ("Chroma emberbow"). Place those now, not tomorrow.
    const unplaced = new Set(repairs.filter((r) => !r.itemSlug).map((r) => r.id))
    if (unplaced.size && deps.afterRepairs) {
      const fresh = (await loadListings(deps.db, loaded.gameCategoryId)).filter((l) => unplaced.has(l.id) && l.valueItemSlug)
      const second = planListingRepairs(config, items, plan, fresh)
      if (second.length) {
        await writeRepairs(deps.db, second)
        await deps.afterRepairs(second.map((r) => r.id))
        for (const r of second) repairs[repairs.findIndex((x) => x.id === r.id)] = r
      }
    }
  }
  const { kept, deleted } = await writeDeletes(deps.db, plan, loaded.gameCategoryId)
  report.optionsDeleted = deleted
  report.optionsKept = kept
  await retireFields(deps.db, retire.map((f) => f.id))
  if ((formChanges || deleted || retire.length) && deps.afterFormChange) await deps.afterFormChange({ gameId: loaded.gameId, gameCategoryId: loaded.gameCategoryId })
  report.status = 'ok'
  return { report, plan, repairs }
}

const MAX_NAMES = 10

/** The Discord line: only a run that changed something, or stopped itself, speaks. */
export function syncMessage(gameName: string, report: SyncReport): string | null {
  const title = `**${gameName}** sell form`
  if (report.status === 'blocked') return `⚠️ ${title} sync stopped: ${report.message}. Nothing was written.`
  if (report.status !== 'ok' || !report.write) return null
  const parts: string[] = []
  const added = report.optionsCreated.filter((o) => !o.node.startsWith('rarity-') && o.node !== 'item-type')
  if (added.length) {
    const names = added.slice(0, MAX_NAMES).map((o) => o.label).join(', ') + (added.length > MAX_NAMES ? ` and ${added.length - MAX_NAMES} more` : '')
    parts.push(`${added.length} ${added.length === 1 ? 'item is' : 'items are'} now sellable: ${names}`)
  }
  if (report.listingsRepaired) parts.push(`${report.listingsRepaired} ${report.listingsRepaired === 1 ? 'listing was' : 'listings were'} re-linked to their filters`)
  if (report.fieldsRetired.length) parts.push(`${report.fieldsRetired.length} old ${report.fieldsRetired.length === 1 ? 'field' : 'fields'} removed (${report.fieldsRetired.join(', ')})`)
  if (report.fieldsCreated + report.rulesSet && !added.length) parts.push(`${report.fieldsCreated} fields and ${report.rulesSet} rules restored`)
  if (report.optionsKept.length) parts.push(`${report.optionsKept.length} stray ${report.optionsKept.length === 1 ? 'option was' : 'options were'} kept because a listing uses ${report.optionsKept.length === 1 ? 'it' : 'them'}`)
  if (!parts.length) return null
  return `🧾 ${title}: ${parts.join('; ')}.${report.warnings.length ? `\n${report.warnings.map((w) => `• ${w}`).join('\n')}` : ''}`
}
