import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Vitest config for the money-layer build (Phase 0+).
// Scoped to *.test.ts colocated with the code under test. The pure domain
// layer (money/ids/errors/ledger/escrow) is unit-tested here with no Next
// runtime, no DB, no network — that's what makes the per-phase test gate fast.
//
// We resolve the @/* -> ./src/* alias directly (rather than via the ESM-only
// vite-tsconfig-paths plugin) because this package is CommonJS and Vite loads
// the config through require(), which can't import an ESM-only plugin.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    // Loads .env.local for integration tests; they self-skip if env is absent.
    setupFiles: ['src/test/setup-env.ts'],
    // Integration tests hit ONE shared Supabase DB and create throwaway orders
    // from the same seed rows — run test FILES serially so two suites can't
    // race on the same rows. (Within a file, tests already run in order.)
    fileParallelism: false,
  },
})
