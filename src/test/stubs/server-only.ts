/**
 * Test stub for the `server-only` marker package.
 *
 * The real package throws on import outside a React Server Components
 * bundle, which makes any module carrying `import 'server-only'` impossible
 * to unit-test. Vitest aliases the specifier here (see vitest.config.ts); the
 * marker keeps its build-time meaning in the app bundle.
 */
export {}
