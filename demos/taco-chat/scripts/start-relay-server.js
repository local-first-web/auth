import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Bundle the legacy relay's JSON assertion so the demo runs on current Node.
const require = createRequire(import.meta.url)
const directory = resolve('node_modules/.cache/local-relay', process.env.PORT || '8080')
await mkdir(directory, { recursive: true })
const outfile = resolve(directory, 'server.cjs')
await build({
  entryPoints: [require.resolve('@localfirst/relay/Server.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  external: ['bufferutil', 'utf-8-validate', 'msgpackr-extract'],
})
const {
  default: { Server },
} = await import(pathToFileURL(outfile).href)
const server = new Server({ port: Number(process.env.PORT) || 8080 })
await server.listen()
