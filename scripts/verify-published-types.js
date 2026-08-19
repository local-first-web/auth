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

/**
 * Each published package, an import that reaches a good share of its public types, and the ambient
 * libs a consumer of that package can be assumed to have.
 *
 * `lib` is spelled out per package rather than granted across the board, because a blanket `DOM`
 * hands every package the browser globals whether it has any business using them. `auth-syncserver`
 * is a Node process — its declarations reach `Server` from `http`, `WebSocketServer` from `ws` and
 * `Debugger` from `debug`, and nothing else ambient — so it gets no DOM, and what it does need
 * comes from the `@types/node` it declares.
 *
 * Every entry must say what its `lib` is; see the check below for why.
 */
const packages = [
  {
    dir: 'shared',
    lib: ['DOM', 'ESNext'],
    probe: `import { assert, debug, memoize, pause } from '@localfirst/shared'`,
  },
  {
    dir: 'crypto',
    lib: ['DOM', 'ESNext'],
    probe: `import { randomKey, type Base58, type Base58Keypair } from '@localfirst/crypto'`,
  },
  {
    dir: 'crdx',
    lib: ['DOM', 'ESNext'],
    probe: `import { createGraph, serialize, createStore, type Graph, type KeysetWithSecrets } from '@localfirst/crdx'`,
  },
  {
    dir: 'auth',
    lib: ['DOM', 'ESNext'],
    probe: `import { createTeam, type Team, type UserWithSecrets, type Invitation } from '@localfirst/auth'`,
  },
  {
    // `buildServerUrl.d.ts` publishes a `URL`, which comes from `lib.dom`, `lib.webworker` or
    // `@types/node`. This package runs in all three, so DOM is a fair stand-in for its consumers.
    dir: 'auth-provider-automerge-repo',
    lib: ['DOM', 'ESNext'],
    probe: `import { AuthProvider } from '@localfirst/auth-provider-automerge-repo'`,
  },
  {
    dir: 'auth-syncserver',
    lib: ['ESNext'],
    probe: `import { LocalFirstAuthSyncServer } from '@localfirst/auth-syncserver'`,
  },
]

/**
 * An entry that forgets `lib` doesn't get a narrower check — it gets a wider one. `lib: undefined`
 * disappears from the emitted tsconfig (`JSON.stringify` drops undefined), and with no `lib` at all
 * `target: ESNext` falls back to `lib.esnext.full.d.ts`, which is blanket DOM plus WebWorker plus
 * ScriptHost. Measured: a probe of `document.createElement('div')` errors under `lib: ['ESNext']`
 * and passes with `lib` omitted. So the per-package discipline is enforced here rather than merely
 * documented above.
 */
const missingLib = packages.filter(({ lib }) => !Array.isArray(lib) || lib.length === 0)
if (missingLib.length > 0) {
  console.error(`✗ ${missingLib.map(({ dir }) => dir).join(', ')} — no \`lib\` declared; omitting it silently grants DOM.`)
  process.exit(1)
}

/**
 * Broken declarations inside our dependencies hit consumers just as hard, but we can't fix them
 * from this repo, so a known one is reported without failing the run. Anything *not* on this list
 * fails — an unbaselined warning is one nobody reads by the seventh entry. To accept a new one,
 * file it and add it here; that's the paper trail.
 */
const knownThirdPartyProblems = [
  {
    bead: 'auth-ap1',
    match: /@herbcaudill\/eventemitter42\/dist\/eventPromise\.d\.ts.*Cannot find module 'eventemitter3'/,
  },
  {
    bead: 'auth-ap1',
    match: /@automerge\/automerge-repo\/dist\/helpers\/cbor\.d\.ts.*Cannot find name 'Buffer'/,
  },
]

// A stock consumer tsconfig. Deliberately no `skipLibCheck`, no `baseUrl`, no `paths` — leaving any
// of those out is the whole point.
const consumerTsconfig = lib => ({
  compilerOptions: {
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    target: 'ESNext',
    lib,
    strict: true,
    noEmit: true,
  },
  include: ['src'],
})

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
 * Placement is nested rather than flat, because nested is the strictest layout a real consumer
 * plausibly has: under pnpm's default isolated `node_modules` a dependency resolves only from the
 * package that asked for it, so a `.d.ts` using a type its own package doesn't declare fails here
 * exactly as it would there.
 *
 * That is a choice about strictness, not a claim to know what consumers run — we don't. Nothing
 * we publish tells them which package manager to use, and pnpm itself can be told to produce a
 * flat layout (`node-linker=hoisted`, `shamefully-hoist=true`), while npm and yarn hoist by
 * default. So the false-positive class isn't empty: a package that under-declares something its
 * consumer's layout happens to supply anyway fails here and works for them. It's just the cheap
 * direction to be wrong in — a false positive costs a maintainer one failure and one
 * `dependencies` line, and never a shipped bug.
 *
 * What settles it is the measurement. Hoist every dependency flat into the probe root and this
 * same check reports zero errors for all six packages, including every third-party diagnostic it
 * currently catches. A flat probe would have shipped the `lodash-es` fragility this one caught.
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
 * Whether a diagnostic belongs to a dependency rather than to us.
 *
 * Defined positively, and that matters: it has to name a file, that file has to be inside
 * `node_modules`, and the package owning it — the one after the *last* `node_modules/`, since our
 * packages carry their dependencies underneath them — has to not be ours. Everything else is ours.
 *
 * Classifying the other way round, as "not obviously ours", is how an earlier version of this
 * script demoted every diagnostic in the probe's own `src/index.ts` to a warning, along with every
 * config-level diagnostic that carries no file path at all. The run then printed `entry point
 * clean` and exited 0 for a package a consumer couldn't type.
 */
const isThirdParty = line => {
  const path = /^(.+?)\(\d+,\d+\): error TS/.exec(line)?.[1]
  if (!path) return false
  const segments = path.split('node_modules/')
  if (segments.length === 1) return false
  return !segments[segments.length - 1].startsWith('@localfirst/')
}

/**
 * Run `tsc` and split what it said.
 *
 * A run that fails without producing a single parseable diagnostic did not typecheck anything —
 * missing binary, crash, bad config, out of memory — and must not read as success. This gate sits
 * directly upstream of `lerna publish`, so its null state has to be "fail", not "pass".
 */
const runTsc = (projectDir, tsc) => {
  let output = ''
  let status = 0
  try {
    execFileSync(process.execPath, [tsc, '-p', 'tsconfig.json'], { cwd: projectDir, stdio: 'pipe' })
  } catch (error) {
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim()
    status = error.status ?? `signal ${error.signal ?? 'unknown'}`
  }
  const diagnostics = output.split('\n').filter(line => / error TS/.test(line))
  if (status !== 0 && diagnostics.length === 0) {
    return { fatal: `tsc exited with ${status} without reporting any diagnostic — it did not run.\n${output || '(no output)'}` }
  }
  return {
    ours: diagnostics.filter(line => !isThirdParty(line)),
    theirs: diagnostics.filter(line => isThirdParty(line)),
  }
}

const tsc = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc')

let failures = 0
const baselineHits = new Set()
for (const { dir, probe, lib } of packages) {
  const packageDir = join(repoRoot, 'packages', dir)
  const projectDir = mkdtempSync(join(tmpdir(), 'lf-types-'))
  let name = dir
  try {
    name = readJson(join(packageDir, 'package.json')).name
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
    writeFileSync(join(projectDir, 'tsconfig.json'), JSON.stringify(consumerTsconfig(lib), null, 2))

    // 1. through the public entry point, the way a consumer imports it
    writeFileSync(join(projectDir, 'src', 'index.ts'), `${probe}\n`)
    const entry = runTsc(projectDir, tsc)

    // 2. over every declaration file in `dist` — the entry point reaches only about half of them.
    // `.d.mts` and `.d.cts` count too: `copyPackage` already copies them, so without this they'd be
    // published and present in the probe but never looked at. Nothing emits them today.
    const declarations = []
    const collect = d => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, entry.name)
        if (entry.isDirectory()) collect(p)
        else if (/\.d\.(ts|mts|cts)$/.test(entry.name)) declarations.push(p)
      }
    }
    // A package with no `dist` at all is a package that publishes no declarations. Reaching the
    // check below rather than throwing out of the loop matters: an exception here would take the
    // remaining packages with it, and they'd go unchecked behind a single failure.
    const distDir = join(probeModules, name, 'dist')
    if (isDir(distDir)) collect(distDir)
    if (declarations.length === 0) {
      failures++
      console.error(`✗ ${name} — publishes no declaration files at all`)
      continue
    }
    writeFileSync(
      join(projectDir, 'tsconfig.json'),
      JSON.stringify({ ...consumerTsconfig(lib), include: undefined, files: declarations.map(p => relative(projectDir, p)) }, null, 2)
    )
    const everyFile = runTsc(projectDir, tsc)

    const fatal = entry.fatal ?? everyFile.fatal
    if (fatal) {
      failures++
      console.error(`✗ ${name} — could not be checked: ${fatal}`)
      continue
    }

    const ours = [...new Set([...entry.ours, ...everyFile.ours])]
    const theirs = [...new Set([...entry.theirs, ...everyFile.theirs])]
    const knownTheirs = theirs.filter(line => knownThirdPartyProblems.some(({ match }) => match.test(line)))
    const newTheirs = theirs.filter(line => !knownThirdPartyProblems.some(({ match }) => match.test(line)))

    if (ours.length === 0 && newTheirs.length === 0) {
      console.log(`✓ ${name} — entry point clean, all ${declarations.length} declaration files clean`)
    } else {
      failures++
      if (ours.length > 0) {
        console.error(`✗ ${name} — ${ours.length} error(s) in our own declarations (${declarations.length} files checked)`)
        console.error(ours.slice(0, 25).map(line => `    ${line}`).join('\n'))
        if (ours.length > 25) console.error(`    …and ${ours.length - 25} more`)
      }
      if (newTheirs.length > 0) {
        console.error(`✗ ${name} — ${newTheirs.length} unrecognised error(s) in third-party declarations.`)
        console.error(`    Fix upstream, or file it and add it to knownThirdPartyProblems in this file.`)
        console.error(newTheirs.slice(0, 10).map(line => `    ${line}`).join('\n'))
        if (newTheirs.length > 10) console.error(`    …and ${newTheirs.length - 10} more`)
      }
    }

    // Known-broken dependency declarations hit consumers just as hard, but we can't fix them from
    // this repo, so they're reported against their bead without failing the run. Print what they
    // said, not just how many there were — a count and a bead id mean editing this script to find
    // out what actually fired, and the point of baselining rather than deleting is that someone
    // can still read it.
    if (knownTheirs.length > 0) {
      const fired = knownThirdPartyProblems.filter(({ match }) => knownTheirs.some(line => match.test(line)))
      for (const problem of fired) baselineHits.add(problem)
      const beads = [...new Set(fired.map(({ bead }) => bead))]
      console.warn(`  ! ${knownTheirs.length} known error(s) in third-party declarations reached from ${name} (${beads.join(', ')})`)
      console.warn(knownTheirs.map(line => `      ${line}`).join('\n'))
    }
  } catch (error) {
    // Anything unexpected fails this package and lets the rest be checked. A throw escaping the
    // loop would report one package and silently skip every package after it.
    failures++
    console.error(`✗ ${name} — check threw: ${error?.stack ?? error}`)
  } finally {
    rmSync(projectDir, { recursive: true, force: true })
  }
}

/**
 * A baseline entry that matched nothing is one of two things: the upstream problem got fixed, or
 * whatever reached it stopped being reached. Either way the entry is now claiming a problem that
 * this run couldn't find, so it should be deleted and its bead closed.
 *
 * Reported rather than failed, and only on an otherwise-clean run. A package that failed early
 * never got as far as producing third-party diagnostics, so its entries would look stale for the
 * wrong reason; and an upstream fix landing shouldn't be the thing that blocks a release.
 */
if (failures === 0) {
  const stale = knownThirdPartyProblems.filter(problem => !baselineHits.has(problem))
  if (stale.length > 0) {
    console.warn(`\n  ! ${stale.length} entr(ies) in knownThirdPartyProblems matched nothing — delete them and close the bead:`)
    console.warn(stale.map(({ bead, match }) => `      ${bead}: ${match}`).join('\n'))
  }
}

if (failures > 0) {
  console.error(`\n${failures} package(s) publish declarations that don't typecheck from an isolated install.`)
  process.exit(1)
}
console.log(`\nAll ${packages.length} published packages' own declarations typecheck from an isolated install.`)
