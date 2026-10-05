/**
 * Every Tailwind class a `src/` module hands to a component is in the built CSS.
 *
 * Tailwind generates a utility only when its literal token appears in a file
 * matched by `content` in tailwind.config.ts. `src/lib` was not matched, so a
 * class that lived ONLY in a lib style map was never generated. Found
 * 2026-09-28: the Bronze label had no orange, Silver and Diamond badges had no
 * bg/border, the storefront avatar ring fell back to Tailwind's default blue
 * (`src/lib/seller/tiers.ts`), and the SAB hub cards, item hero and calculator
 * tiles lost their shadows (the since-retired `src/lib/sab/theme.ts`).
 *
 * Both checks compile with the real config through Tailwind's PostCSS plugin
 * (no Next, no globals.css) and read the class names back out of the selectors:
 *  - the known lib style maps: every class they carry is generated (this also
 *    catches a typo'd class, which no `content` glob can fix);
 *  - every other file under src/: a class that only an UNSCANNED file holds
 *    fails here, so a new style map in an unscanned folder is caught on day one.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../../../tailwind.config'
import { TIERS } from '@/lib/seller/tiers'
import * as surfaces from '@/lib/ui/surfaces'
import * as valueStyles from '@/components/values/styles'

// tailwind.config.ts lists plain glob strings (no `{ raw }` entries).
const CONTENT = tailwindConfig.content as string[]
const SOURCE_EXT = '{js,ts,jsx,tsx,mdx}'
const COMPILE_TIMEOUT = 60_000

/** A class selector's name with its escapes: `.ring-zinc-500\/30`, `.shadow-\[0_0_20px\2c …\]`. */
const CLASS_SELECTOR = /\.((?:\\[0-9a-fA-F]{1,6} ?|\\[^0-9a-fA-F]|[\w-])+)/g

function unescapeCss(name: string): string {
  return name.replace(/\\(?:([0-9a-fA-F]{1,6}) ?|(.))/g, (_, hex?: string, ch?: string) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : (ch as string),
  )
}

async function generatedClasses(content: string[]): Promise<Set<string>> {
  const { root } = await postcss([tailwindcss({ ...tailwindConfig, content })]).process(
    '@tailwind components;\n@tailwind utilities;',
    { from: undefined },
  )
  const classes = new Set<string>()
  root.walkRules((rule) => {
    for (const [, escaped] of rule.selector.matchAll(CLASS_SELECTOR)) classes.add(unescapeCss(escaped))
  })
  return classes
}

/**
 * src/test and top-level `*.test.*` files: test code never hands a class to a
 * component, and guard headers quote class names on purpose.
 */
const TEST_CODE = /^test$|\.test\.[jt]sx?$/

/** Globs for the top-level entries of src/ that no `content` glob reaches, test code aside. */
function unscannedSrcGlobs(content: string[]): string[] {
  if (content.some((glob) => glob.startsWith('./src/**'))) return []
  const scanned = new Set(content.map((glob) => /^\.\/src\/([^/*{]+)\//.exec(glob)?.[1]))
  return readdirSync(join(process.cwd(), 'src'), { withFileTypes: true })
    .filter((entry) => !scanned.has(entry.name) && !TEST_CODE.test(entry.name))
    .filter((entry) => entry.isDirectory() || /\.(js|ts|jsx|tsx|mdx)$/.test(entry.name))
    .map((entry) => (entry.isDirectory() ? `./src/${entry.name}/**/*.${SOURCE_EXT}` : `./src/${entry.name}`))
}

/** Every class token the shared surface / values style maps carry (the SAB
 *  hub theme they replaced, src/lib/sab/theme.ts, was retired 2026-10-04). */
const STYLE_MAP_CLASSES = [...Object.values(surfaces), ...Object.values(valueStyles)]
  .filter((value): value is string => typeof value === 'string')
  .flatMap((list) => list.split(/\s+/).filter(Boolean))

describe('tailwind.config.ts content covers every class src/ hands to a component', () => {
  let generated: Set<string>

  beforeAll(async () => {
    generated = await generatedClasses(CONTENT)
  }, COMPILE_TIMEOUT)

  it.each(TIERS.map((tier) => [tier.key, tier.colors] as const))(
    '%s tier badge classes are generated',
    (_key, colors) => {
      const classes = [colors.text, colors.bg, colors.border, colors.ring, colors.glow]
      expect(classes.filter((cls) => !generated.has(cls))).toEqual([])
    },
  )

  it('shared surface + values style classes are generated', () => {
    expect(STYLE_MAP_CLASSES.length).toBeGreaterThan(0)
    expect(STYLE_MAP_CLASSES.filter((cls) => !generated.has(cls))).toEqual([])
  })

  it(
    'no unscanned file under src/ holds a class the build drops',
    async () => {
      const globs = unscannedSrcGlobs(CONTENT)
      const dropped = globs.length
        ? [...(await generatedClasses(globs))].filter((cls) => !generated.has(cls))
        : []
      expect(
        dropped,
        'only files tailwind.config.ts `content` does not scan use these classes, so the build drops them: add the folder to `content`',
      ).toEqual([])
    },
    COMPILE_TIMEOUT,
  )
})
