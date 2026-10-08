import { execFileSync } from 'node:child_process'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import postcss from './postcss.config'
import topLevelAwait from 'vite-plugin-top-level-await'
import { NodeGlobalsPolyfillPlugin as nodeGlobals } from '@esbuild-plugins/node-globals-polyfill'
/** Route the assigned loopback port and hot reload through the shared HTTPS proxy. */
const localhostServer = process.env.PORTLESS_URL
  ? {
      port: Number(process.env.PORT),
      host: '127.0.0.1',
      strictPort: true,
      allowedHosts: [new URL(process.env.PORTLESS_URL).hostname],
      hmr: {
        protocol: 'wss' as const,
        host: new URL(process.env.PORTLESS_URL).hostname,
        clientPort: 443,
      },
    }
  : {}

/** Exact backend address for this checkout, without a fixed browser port. */
const publicBackend = process.env.PORTLESS_URL
  ? execFileSync('localhost-dev', ['url', '--service', 'relay'], { encoding: 'utf8' }).trim()
  : undefined

export default defineConfig({
  ...(publicBackend
    ? {
        define: {
          'import.meta.env.VITE_RELAY_URL': JSON.stringify(
            publicBackend.replace(/^https:/, 'wss:')
          ),
        },
      }
    : {}),
  ...(process.env.PORTLESS_URL
    ? { cacheDir: `node_modules/.cache/localhost-dev/${process.env.PORT}` }
    : {}),
  server: { port: 3000, ...localhostServer },
  plugins: [viteReact(), tsconfigPaths(), topLevelAwait()],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { global: 'globalThis' },
      plugins: [nodeGlobals({ buffer: true })],
    },
  },
  css: { postcss },
})
