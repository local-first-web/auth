import { defineConfig } from 'vitest/config'
import rootConfig from './vitest.config.js'

/**
 * Config for a test run started from inside one package — `pnpm test` in the package directory, or
 * `pnpm -F @localfirst/auth test`.
 *
 * Vitest takes its root from the directory it was invoked in, and the root config's
 * `include: ['packages/**\/*.test.ts']` is written relative to the repo root. Resolved against a
 * root of `packages/auth-syncserver` it matched nothing, so every one of those `"test": "vitest"`
 * scripts exited 1 with "No test files found" — loud, but a no-op.
 *
 * Everything else about the root config is wanted here unchanged, in particular the
 * `@localfirst/*`-to-source aliases: they're built from absolute paths, so they still point at the
 * right place from a package root. Only `include` has to be re-anchored.
 */
export default defineConfig({
  ...rootConfig,
  test: {
    ...rootConfig.test,
    include: ['src/**/*.test.ts'],
  },
})
