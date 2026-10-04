/**
 * Submit EXPLICIT URLs to IndexNow: for pages that change only on deploy (static
 * pages, file-based blog posts) and so have no runtime hook. Everything that
 * changes at runtime (listings, value pages, DB blog posts, game hubs) is
 * submitted automatically by lib/seo/indexnow; do not use this for those.
 *
 *   pnpm indexnow:submit /safedrop /blog/how-we-work           # dry run: prints what it would send
 *   pnpm indexnow:submit --send /safedrop /blog/how-we-work    # really submit to IndexNow
 *
 * Paths or absolute dropmarket.gg URLs; anything on another host is ignored.
 * Capped at MAX_URLS so it cannot become a "send everything" job again (Bing
 * flagged the old daily 504-URL batch as abusive "batch mode").
 */
import { normaliseUrls, submitIndexNow } from '../src/lib/seo/indexnow/submit'

const MAX_URLS = 50
const args = process.argv.slice(2)
const send = args.includes('--send')
const inputs = args.filter((a) => !a.startsWith('--'))

if (inputs.length === 0) {
  console.error('usage: pnpm indexnow:submit [--send] <path-or-url> [...]')
  process.exit(1)
}

const { urls, rejected } = normaliseUrls(inputs)
if (rejected.length) console.warn(`ignored (not on this site): ${rejected.join(', ')}`)
if (urls.length === 0) {
  console.error('nothing to submit')
  process.exit(1)
}
if (urls.length > MAX_URLS) {
  console.error(`${urls.length} URLs is more than the ${MAX_URLS} this CLI allows. Submit only pages that really changed.`)
  process.exit(1)
}

if (!send) {
  console.log(`dry run: would submit ${urls.length} URL(s). Add --send to submit.`)
  for (const u of urls) console.log(`  ${u}`)
  process.exit(0)
}

// `--send` is the operator saying "this is the real site": the CLI runs from a
// laptop, where the deployment check would otherwise (rightly) refuse.
submitIndexNow(urls, { reason: 'manual-cli', production: true }).then((r) => {
  console.log(`submitted ${r.submitted} of ${urls.length} URL(s) in ${r.chunks} request(s); ${r.failures} failed`)
  process.exit(r.failures > 0 ? 1 : 0)
})
