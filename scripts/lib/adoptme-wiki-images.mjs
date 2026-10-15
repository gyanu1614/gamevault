/**
 * Adopt Me pet images from the Adopt Me Wiki (Fandom, CC BY-SA 3.0) for pets
 * whose source image is broken. adoptmevalues' CDN serves
 * /images/pets/<Name>.png and has no file for many new pets (the geists,
 * Jester Dragon…): the card showed a placeholder. A copy goes into our own
 * public adopt-me-pets bucket at wiki/<slug>.webp — where the 13 pets fixed by
 * hand on 2026-10-05 already live — and pages never hot-link the wiki.
 * Plain JS: loaded by the owner/CI script and by vitest.
 */

export const WIKI_API = 'https://adoptme.fandom.com/api.php'
export const WIKI_UA = 'DropMarket-values-catalogue/1.0 (+https://dropmarket.gg)'
export const BUCKET = 'adopt-me-pets'
/** Path fragment every copied image URL contains (also read by the app's credit line). */
export const WIKI_IMAGE_PREFIX = `/${BUCKET}/wiki/`
const BATCH = 50

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Storage object path for a pet's copy. */
export function wikiImagePath(slug) {
  return `wiki/${slug}.webp`
}

/** True when the image is already our bucket copy (never re-checked or replaced). */
export function isOurCopy(url) {
  return typeof url === 'string' && url.includes(WIKI_IMAGE_PREFIX)
}

/** Fandom's 512 px rendition: page-weight sized (the originals are 1080 px). */
export function scaledWikiUrl(url, width = 512) {
  return /\/revision\/latest(?!\/scale)/.test(url) ? url.replace('/revision/latest', `/revision/latest/scale-to-width-down/${width}`) : url
}

/** One MediaWiki query (action=query, JSON, redirects followed). */
export async function wikiApi(params, { fetchImpl = fetch } = {}) {
  const url = new URL(WIKI_API)
  for (const [k, v] of Object.entries({ action: 'query', format: 'json', redirects: '1', ...params })) url.searchParams.set(k, v)
  const res = await fetchImpl(url, { headers: { 'user-agent': WIKI_UA } })
  if (!res.ok) throw new Error(`wiki API HTTP ${res.status}`)
  return res.json()
}

/** Requested title → the title the response's pages carry (normalised, redirected). */
function finalTitles(query) {
  const map = new Map()
  for (const n of query?.normalized ?? []) map.set(n.from, n.to)
  for (const r of query?.redirects ?? []) map.set(r.from, r.to)
  return (t) => {
    let out = t
    for (let i = 0; i < 3 && map.has(out); i += 1) out = map.get(out)
    return out
  }
}

async function lookup(titles, prop, pick, { api, delayMs }) {
  const out = new Map()
  for (let i = 0; i < titles.length; i += BATCH) {
    const batch = titles.slice(i, i + BATCH)
    const params =
      prop === 'imageinfo'
        ? { prop: 'imageinfo', iiprop: 'url|mime', titles: batch.join('|') }
        : { prop: 'pageimages', piprop: 'original', titles: batch.join('|') }
    const data = await api(params)
    const resolve = finalTitles(data?.query)
    const byTitle = new Map(Object.values(data?.query?.pages ?? {}).map((p) => [p.title, p]))
    for (const t of batch) {
      const url = pick(byTitle.get(resolve(t)))
      if (url) out.set(t, url)
    }
    if (delayMs && i + BATCH < titles.length) await sleep(delayMs)
  }
  return out
}

/**
 * Each pet name → its wiki image URL: the file named after the pet
 * (File:<Name>.png, the wiki's convention) first, then the image of the pet's
 * page (<Name>, then <Name> (Pet)). Names with neither are `missing`.
 * @param {string[]} names
 * @param {{ api?: (params: Record<string, string>) => Promise<any>, delayMs?: number }} [deps]
 */
export async function resolveWikiImages(names, { api = wikiApi, delayMs = 1000 } = {}) {
  const found = new Map()
  const files = await lookup(
    names.map((n) => `File:${n}.png`),
    'imageinfo',
    (p) => (p && !('missing' in p) ? p.imageinfo?.[0]?.url : null),
    { api, delayMs },
  )
  for (const n of names) if (files.has(`File:${n}.png`)) found.set(n, files.get(`File:${n}.png`))

  const rest = names.filter((n) => !found.has(n))
  if (rest.length) {
    const pages = await lookup(
      rest.flatMap((n) => [n, `${n} (Pet)`]),
      'pageimages',
      (p) => p?.original?.source ?? null,
      { api, delayMs },
    )
    for (const n of rest) {
      const url = pages.get(n) ?? pages.get(`${n} (Pet)`)
      if (url) found.set(n, url)
    }
  }
  return { found, missing: names.filter((n) => !found.has(n)) }
}
