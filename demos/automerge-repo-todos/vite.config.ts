import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

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
  ? execFileSync('localhost-dev', ['url', '--service', 'sync'], { encoding: 'utf8' }).trim()
  : undefined

export default defineConfig({
  ...(publicBackend
    ? { define: { 'process.env.SYNC_SERVER_URL': JSON.stringify(new URL(publicBackend).host) } }
    : {}),
  ...(process.env.PORTLESS_URL
    ? { cacheDir: `node_modules/.cache/localhost-dev/${process.env.PORT}` }
    : {}),
  plugins: [wasm(), topLevelAwait(), react()],

  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },

  optimizeDeps: {
    // This is necessary because otherwise `vite dev` includes two separate
    // versions of the JS wrapper. This causes problems because the JS
    // wrapper has a module level variable to track JS side heap
    // allocations, and initializing this twice causes horrible breakage
    exclude: ['@automerge/automerge-wasm/bundler/bindgen_bg.wasm', '@syntect/wasm'],
  },

  server: {
    fs: {
      strict: false,
    },

    ...localhostServer,
  },
})
