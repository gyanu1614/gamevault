#!/usr/bin/env node
/**
 * Merge freshly generated Supabase types with the hand-maintained helper
 * aliases at the bottom of src/types/database.ts.
 *
 * `supabase gen types` only emits the Database interface. The app also
 * imports convenience aliases (Profile, ListingWithRelations, …) that the
 * generator knows nothing about — before Phase 1 · Step 1 those lived in a
 * hand-written file that had drifted to 18 of 97 tables and declared several
 * nullable columns as non-null. This keeps both halves in one file so a
 * regeneration can never drop the aliases.
 *
 * Run via `pnpm db:types` (which generates the .generated.ts first).
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'

const GENERATED = 'src/types/database.generated.ts'
const TARGET = 'src/types/database.ts'
const MARKER = '// ─── Helper aliases (hand-maintained, preserved across regeneration) ────────'

const HEADER = `// Database Types
// GENERATED — do not edit the Database interface by hand.
// Regenerate with:  pnpm db:types   (requires the local stack running)
// The helper/convenience aliases below the generated block ARE maintained
// by hand and must be preserved across regenerations.
`

if (!existsSync(GENERATED)) {
  console.error(`✗ ${GENERATED} not found — run \`pnpm db:types\`, not this script directly.`)
  process.exit(1)
}
if (!existsSync(TARGET)) {
  console.error(`✗ ${TARGET} not found; refusing to write without the existing aliases.`)
  process.exit(1)
}

const generated = readFileSync(GENERATED, 'utf8')
const current = readFileSync(TARGET, 'utf8')

const idx = current.indexOf(MARKER)
if (idx === -1) {
  console.error(
    `✗ Could not find the helper-alias marker in ${TARGET}.\n` +
      `  Refusing to overwrite, or the hand-maintained aliases would be lost.`,
  )
  process.exit(1)
}
const aliases = current.slice(idx)

writeFileSync(TARGET, `${HEADER}\n${generated}\n${aliases}`)
unlinkSync(GENERATED)

const tables = (generated.match(/^      [a-z_]+: \{$/gm) ?? []).length
console.log(`✓ ${TARGET} regenerated — ${tables} tables, helper aliases preserved.`)
