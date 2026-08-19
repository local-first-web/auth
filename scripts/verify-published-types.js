/**
 * Typechecks each published package's `.d.ts` output the way a consumer would: from a throwaway
 * project outside this repo, with a stock tsconfig — no `skipLibCheck`, no `baseUrl`, no `paths`.
 *
 * This is what catches declaration files that only resolve from inside this repo. It used to be
 * possible for `dist/**\/*.d.ts` to import via specifiers like `team/types.js`, which resolve
 * against a `baseUrl` we set here and nowhere else. Inside the repo `skipLibCheck: true` hid the
 * damage; outside it, `import { Team } from '@localfirst/auth'` produced 86 TS2307 errors.
 *
 * Run `pnpm build` (or build the packages individually) first — this only reads `dist`.
 *
 *     node scripts/verify-published-types.js
 *
 * Exits non-zero if any package fails to typecheck.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Each published package, and an import that reaches a good share of its public types. */
const packages = [
  { dir: 'shared', name: '@localfirst/shared', probe: `import { assert, memoize, pause } from '@localfirst/shared'` },
  { dir: 'crypto', name: '@localfirst/crypto', probe: `import { randomKey, type Base58, type Base58Keypair } from '@localfirst/crypto'` },
  { dir: 'crdx', name: '@localfirst/crdx', probe: `import { createGraph, type Graph, type KeysetWithSecrets } from '@localfirst/crdx'` },
  { dir: 'auth', name: '@localfirst/auth', probe: `import { createTeam, type Team, type UserWithSecrets, type Invitation } from '@localfirst/auth'` },
  {
    dir: 'auth-provider-automerge-repo',
    name: '@localfirst/auth-provider-automerge-repo',
    probe: `import { AuthProvider } from '@localfirst/auth-provider-automerge-repo'`,
  },
  { dir: 'auth-syncserver', name: '@localfirst/auth-syncserver', probe: `import { LocalFirstAuthSyncServer } from '@localfirst/auth-syncserver'` },
]

// A stock consumer tsconfig. Deliberately no `skipLibCheck`, no `baseUrl`, no `paths` — leaving any
// of those out is the whole point.
const consumerTsconfig = {
  compilerOptions: {
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    target: 'ESNext',
    strict: true,
    noEmit: true,
  },
  include: ['src'],
}

const tsc = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc')

let failures = 0
for (const { dir, name, probe } of packages) {
  const projectDir = mkdtempSync(join(tmpdir(), 'lf-types-'))
  try {
    mkdirSync(join(projectDir, 'src'))
    mkdirSync(join(projectDir, 'node_modules', '@localfirst'), { recursive: true })

    // The package under test, resolved by name the way a consumer would. Its own dependencies
    // resolve through its real location, so we only need to link the one package.
    symlinkSync(join(repoRoot, 'packages', dir), join(projectDir, 'node_modules', name))
    symlinkSync(join(repoRoot, 'node_modules', 'typescript'), join(projectDir, 'node_modules', 'typescript'))

    writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'probe', private: true, type: 'module', version: '0.0.0' }))
    writeFileSync(join(projectDir, 'tsconfig.json'), JSON.stringify(consumerTsconfig, null, 2))
    writeFileSync(join(projectDir, 'src', 'index.ts'), `${probe}\n`)

    execFileSync(process.execPath, [tsc, '-p', 'tsconfig.json'], { cwd: projectDir, stdio: 'pipe' })
    console.log(`✓ ${name}`)
  } catch (error) {
    failures++
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim()
    const count = (output.match(/error TS/g) ?? []).length
    console.error(`✗ ${name} — ${count} error${count === 1 ? '' : 's'}`)
    console.error(output.split('\n').slice(0, 20).join('\n'))
    if (count > 20) console.error(`  …and ${count - 20} more`)
  } finally {
    rmSync(projectDir, { recursive: true, force: true })
  }
}

if (failures > 0) {
  console.error(`\n${failures} package(s) do not typecheck from outside this repo.`)
  process.exit(1)
}
console.log(`\nAll ${packages.length} published packages typecheck from outside this repo.`)
