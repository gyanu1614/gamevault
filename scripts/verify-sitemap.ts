/**
 * Fetch /sitemap.xml from a running build and check every URL in it: 200 (no
 * redirect), not noindex, canonical exactly equal to the listed URL.
 *
 *   NEXT_DIST_DIR=.next-check pnpm build && NEXT_DIST_DIR=.next-check pnpm start -p 3102
 *   pnpm sitemap:verify --base=http://127.0.0.1:3102
 *
 * The sitemap lists production URLs; each is requested from `--base` by path.
 * Exits 1 with the list of offenders. Reads only; never writes.
 */
import { verifySitemapAt } from '../src/lib/seo/sitemap-verify'

const base = process.argv.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://127.0.0.1:3000'

verifySitemapAt(base)
  .then(({ checked, failures }) => {
    console.log(`checked ${checked} sitemap URLs against ${base}`)
    if (failures.length === 0) return console.log(`OK: all ${checked} return 200, are indexable and self-canonical`)
    for (const f of failures) console.log(`FAIL ${f.url}\n     ${f.problems.join('; ')}`)
    console.log(`\n${failures.length} of ${checked} URLs failed`)
    process.exit(1)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
