/**
 * Typechecks each published package's `.d.ts` output the way a consumer would.
 *
 * The check that matters is isolation. For each package we build a throwaway project containing
 * only what `npm install <package>` would actually give someone: the package's own `dist` and
 * `package.json`, plus the transitive closure of its *declared* dependencies — nothing else. In
 * particular the monorepo's root `node_modules`, where every devDependency is hoisted, is never
 * reachable. Then we typecheck with a stock tsconfig: no `skipLibCheck`, no `baseUrl`, no `paths`.
 *
 * Two things break under that setup and nowhere else:
 *
 *   1. Declaration files that import via bare internal specifiers (`from 'team/types.js'`), which
 *      only resolve against the `baseUrl` this repo used to set. Inside the repo `skipLibCheck`
 *      hid them; outside, `import { Team } from '@localfirst/auth'` produced 86 TS2307 errors.
 *
 *   2. Types we publish but don't depend on — `Buffer` without `@types/node`, a re-exported
 *      `lodash-es` signature without `@types/lodash-es`. Resolving through a symlink into the
 *      monorepo hides these, because the hoisted root `node_modules` supplies them for free.
 *
 * Each package is checked twice: once through its public entry point, and once over every file in
 * `dist` — the entry point alone reaches only about half of them.
 *
 * Run a build first; this only reads `dist`.
 *
 *     node scripts/verify-published-types.js
 *
 * Exits non-zero if any package fails.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Each published package, and an import that reaches a good share of its public types. */
const packages = [
  {
    dir: 'shared',
    probe: `import { assert, debug, memoize, pause } from '@localfirst/shared'`,
  },
  {
    dir: 'crypto',
    probe: `import { randomKey, type Base58, type Base58Keypair } from '@localfirst/crypto'`,
  },
  {
    dir: 'crdx',
    probe: `import { createGraph, serialize, createStore, type Graph, type KeysetWithSecrets } from '@localfirst/crdx'`,
  },
  {
    dir: 'auth',
    probe: `import { createTeam, type Team, type UserWithSecrets, type Invitation } from '@localfirst/auth'`,
  },
  {
    dir: 'auth-provider-automerge-repo',
    probe: `import { AuthProvider } from '@localfirst/auth-provider-automerge-repo'`,
  },
  {
    dir: 'auth-syncserver',
    probe: `import { LocalFirstAuthSyncServer } from '@localfirst/auth-syncserver'`,
  },
]

// A stock consumer tsconfig. Deliberately no `skipLibCheck`, no `baseUrl`, no `paths` — leaving any
// of those out is the whole point.
const consumerTsconfig = {
  compilerOptions: {
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    target: 'ESNext',
    lib: ['DOM', 'ESNext'],
    strict: true,
    noEmit: true,
  },
  include: ['src'],
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const isDir = path => { try { return statSync(path).isDirectory() } catch { return false } }

/**
 * Where the monorepo actually installed `name` for the package living at `fromDir`. We follow
 * symlinks before walking up, because pnpm keeps a package's own dependencies next to its real
 * location in the virtual store rather than next to the link. This is only how we *find* a
 * package — what keeps the probe honest is that we copy nothing we weren't told to.
 */
const findInstalled = (fromDir, name) => {
  let dir = realpathSync(fromDir)
  while (true) {
    const candidate = join(dir, 'node_modules', name)
    if (isDir(candidate)) return realpathSync(candidate)
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** The workspace package directory for a `@localfirst/*` name, if it is one. */
const workspaceDir = name => {
  const match = /^@localfirst\/(.+)$/.exec(name)
  const dir = match && join(repoRoot, 'packages', match[1])
  return dir && existsSync(join(dir, 'package.json')) ? dir : null
}

/**
 * Copy a package into the probe. For our own packages we copy exactly what `files: ["dist"]`
 * publishes; for third-party ones we copy the manifests and type declarations, which is everything
 * that participates in type resolution. Nested `node_modules` are deliberately left behind — every
 * dependency has to earn its place by being declared.
 */
const copyPackage = (fromDir, toDir, ownPackage) => {
  mkdirSync(toDir, { recursive: true })
  cpSync(join(fromDir, 'package.json'), join(toDir, 'package.json'))
  const wanted = /\.(d\.ts|d\.cts|d\.mts|ts|cts|mts|json)$/
  const copy = (from, to) => {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue
      const source = join(from, entry.name)
      const target = join(to, entry.name)
      if (entry.isDirectory()) {
        mkdirSync(target, { recursive: true })
        copy(source, target)
      } else if (ownPackage || wanted.test(entry.name)) {
        cpSync(source, target)
      }
    }
  }
  if (ownPackage) {
    if (isDir(join(fromDir, 'dist'))) copy(join(fromDir, 'dist'), join(toDir, 'dist'))
  } else {
    copy(fromDir, toDir)
  }
}

/**
 * Materialize a package and the transitive closure of everything it *declares* into the probe.
 *
 * Placement is nested rather than flat, which is the stricter of the two layouts a package manager
 * can produce: a dependency is only resolvable from the package that asked for it. Flat hoisting
 * would let one package's declaration accidentally satisfy another's undeclared need — which is
 * exactly the bug class this script exists to catch, so we don't grant it.
 *
 * `visible` maps the names already resolvable by walking up from `dir`, so a dependency that an
 * ancestor already supplies at the same version isn't copied again. That also terminates cycles.
 */
const install = (dir, name, source, visible) => {
  copyPackage(source, dir, Boolean(workspaceDir(name)))

  const manifest = readJson(join(source, 'package.json'))
  // Optional peers and optional dependencies are what a real install may skip, so we skip them too.
  const optionalPeers = new Set(
    Object.entries(manifest.peerDependenciesMeta ?? {})
      .filter(([, meta]) => meta?.optional)
      .map(([dep]) => dep)
  )
  const declared = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }).filter(
    dep => !optionalPeers.has(dep) && !(manifest.optionalDependencies ?? {})[dep]
  )

  const missing = []
  const toPlace = []
  const childVisible = new Map(visible)
  for (const dep of declared) {
    const depSource = workspaceDir(dep) ?? findInstalled(source, dep)
    if (!depSource) {
      missing.push(`${dep} (declared by ${name}, not installed anywhere in this monorepo)`)
      continue
    }
    if (visible.get(dep) === depSource) continue
    childVisible.set(dep, depSource)
    toPlace.push([dep, depSource])
  }
  for (const [dep, depSource] of toPlace) {
    missing.push(...install(join(dir, 'node_modules', dep), dep, depSource, childVisible))
  }
  return missing
}

/**
 * Which package a diagnostic belongs to. The owning package is the one after the *last*
 * `node_modules/` in the path, since our packages carry their dependencies underneath them.
 */
const isOurs = line => {
  const path = /^(\S+?)\(\d+,\d+\): error TS/.exec(line)?.[1]
  if (!path) return false
  const segments = path.split('node_modules/')
  return segments[segments.length - 1].startsWith('@localfirst/')
}

const runTsc = (projectDir, tsc) => {
  let output = ''
  try {
    execFileSync(process.execPath, [tsc, '-p', 'tsconfig.json'], { cwd: projectDir, stdio: 'pipe' })
  } catch (error) {
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim()
  }
  const diagnostics = output.split('\n').filter(line => / error TS/.test(line))
  return {
    ours: diagnostics.filter(line => isOurs(line)),
    theirs: diagnostics.filter(line => !isOurs(line)),
  }
}

const tsc = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc')

let failures = 0
for (const { dir, probe } of packages) {
  const packageDir = join(repoRoot, 'packages', dir)
  const name = readJson(join(packageDir, 'package.json')).name
  const projectDir = mkdtempSync(join(tmpdir(), 'lf-types-'))
  try {
    const probeModules = join(projectDir, 'node_modules')
    mkdirSync(join(projectDir, 'src'), { recursive: true })
    mkdirSync(probeModules, { recursive: true })

    const missing = install(join(probeModules, name), name, packageDir, new Map([[name, packageDir]]))
    if (missing.length > 0) {
      failures++
      console.error(`✗ ${name} — declared dependencies not installed: ${missing.join('; ')}`)
      continue
    }

    writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'probe', private: true, type: 'module', version: '0.0.0' }))
    writeFileSync(join(projectDir, 'tsconfig.json'), JSON.stringify(consumerTsconfig, null, 2))

    // 1. through the public entry point, the way a consumer imports it
    writeFileSync(join(projectDir, 'src', 'index.ts'), `${probe}\n`)
    const entry = runTsc(projectDir, tsc)

    // 2. over every declaration file in `dist` — the entry point reaches only about half of them
    const declarations = []
    const collect = d => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, entry.name)
        if (entry.isDirectory()) collect(p)
        else if (entry.name.endsWith('.d.ts')) declarations.push(p)
      }
    }
    collect(join(probeModules, name, 'dist'))
    writeFileSync(
      join(projectDir, 'tsconfig.json'),
      JSON.stringify({ ...consumerTsconfig, include: undefined, files: declarations.map(p => relative(projectDir, p)) }, null, 2)
    )
    const everyFile = runTsc(projectDir, tsc)

    const ours = [...new Set([...entry.ours, ...everyFile.ours])]
    const theirs = [...new Set([...entry.theirs, ...everyFile.theirs])]

    if (ours.length === 0) {
      console.log(`✓ ${name} — entry point clean, all ${declarations.length} declaration files clean`)
    } else {
      failures++
      console.error(`✗ ${name} — ${ours.length} error(s) in our own declarations (${declarations.length} files checked)`)
      console.error(ours.slice(0, 25).map(line => `    ${line}`).join('\n'))
      if (ours.length > 25) console.error(`    …and ${ours.length - 25} more`)
    }

    // Broken declarations inside our dependencies hit consumers just as hard, but we can't fix them
    // from this repo, so they're reported without failing the run. See auth-ap1.
    if (theirs.length > 0) {
      console.warn(`  ! ${theirs.length} error(s) in third-party declarations reached from ${name}:`)
      console.warn(theirs.slice(0, 10).map(line => `    ${line}`).join('\n'))
      if (theirs.length > 10) console.warn(`    …and ${theirs.length - 10} more`)
    }
  } finally {
    rmSync(projectDir, { recursive: true, force: true })
  }
}

if (failures > 0) {
  console.error(`\n${failures} package(s) publish declarations that don't typecheck from an isolated install.`)
  process.exit(1)
}
console.log(`\nAll ${packages.length} published packages' own declarations typecheck from an isolated install.`)
