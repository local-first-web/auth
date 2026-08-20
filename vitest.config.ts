import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { configDefaults, defineConfig } from 'vitest/config'

const packagesDir = fileURLToPath(new URL('packages', import.meta.url))

/**
 * Point a `@localfirst/*` workspace import at the dependency's **source**, for the test run only.
 *
 * Without this, a test that imports `@localfirst/crdx` gets whatever `pnpm build` last wrote to
 * `packages/crdx/dist` — that is what the package's `exports` field names, and nothing else in the
 * repo redirects it. So editing a package's `src` changes nothing that any *other* package's tests
 * can see, and nothing says so. Measured by sabotage: with `packages/crdx/src` broken so that every
 * structural validation fails unconditionally, `packages/crdx` reported 89 failures and the whole
 * `packages/auth` suite passed, 363 for 363. `packages/auth` had been validating a build old enough
 * to predate the symbols under test.
 *
 * CI was never exposed — `test:all` is `run-s build … test:run`, so a build always came first. The
 * hazard was the inner loop, which is where the editing happens.
 *
 * Aliasing here rather than adding `paths` to the root `tsconfig.json` is deliberate. Every
 * package's `tsconfig.json` *and* its `tsconfig.build.json` extend the root one, so a `paths` entry
 * there would also reach the `tsc --emitDeclarationOnly` that produces what we publish, and the
 * emitted `.d.ts` files would point at source paths no tarball contains — which is exactly what
 * `scripts/verify-published-types.js` exists to catch. It would reach the demos too:
 * `demos/taco-chat/vite.config.ts` runs `vite-tsconfig-paths`, and its tsconfig extends the root
 * one. The demos are supposed to build against the published `dist` and its declarations, because
 * that is what makes their `typecheck` worth running. This file is loaded by `vitest` and by
 * nothing else, so the redirect lands where it's wanted and nowhere else.
 */
const toSource = (dir: string) => {
  const { name, exports } = JSON.parse(
    readFileSync(join(packagesDir, dir, 'package.json'), 'utf8')
  ) as { name: string; exports?: unknown }

  // One alias stands in for one entry point. Every package here declares exactly
  // `"exports": "./dist/index.js"`; the day one grows subpath exports or a second entry, a single
  // alias would cover part of it and leave the rest resolving to `dist` — the same split this
  // file exists to remove, and just as quiet. Fail loudly instead.
  if (exports !== './dist/index.js')
    throw new Error(
      `${name} no longer declares a single "./dist/index.js" entry point — map each of its entry points to source explicitly.`
    )

  return {
    // Anchored, so `@localfirst/auth` can't swallow `@localfirst/auth-syncserver`, and so the
    // published `@localfirst/relay` that the taco-chat demo depends on is left alone.
    find: new RegExp(`^${name}$`),
    replacement: join(packagesDir, dir, 'src', 'index.ts'),
  }
}

/**
 * Every workspace package, not a list of the ones that have bitten us. `packages/auth` reading a
 * stale `crdx` was the first half of this; the second was `auth-syncserver` and
 * `auth-provider-automerge-repo` reading a stale `packages/auth`, measured the same way — with
 * `createTeam` sabotaged to throw, `packages/auth` failed 324 of its own tests while those two
 * packages passed all 28 of theirs. A hand-maintained list would go stale the first time someone
 * adds a package and doesn't think of this file.
 */
const sourceAliases = readdirSync(packagesDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(join(packagesDir, entry.name, 'package.json')))
  .map(entry => toSource(entry.name))

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: sourceAliases,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        preserveModules: true,
        inlineDynamicImports: false,
      },
    },
  },
  test: {
    include: ['packages/**/*.test.ts'],
    watchExclude: configDefaults.watchExclude.filter(d => !d.includes('dist')),
  },
})
