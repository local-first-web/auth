import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import wasm from 'vite-plugin-wasm'
import postcss from './postcss.config'

export default defineConfig({
  plugins: [wasm(), viteReact(), tsconfigPaths()],

  worker: {
    format: 'es',
    plugins: [wasm()],
  },

  optimizeDeps: {
    // This is necessary because otherwise `vite dev` includes two separate
    // versions of the JS wrapper. This causes problems because the JS
    // wrapper has a module level variable to track JS side heap
    // allocations, and initializing this twice causes horrible breakage
    exclude: [
      '@automerge/automerge-wasm',
      '@automerge/automerge-wasm/bundler/bindgen_bg.wasm',
      '@syntect/wasm',
    ],
  },

  build: {
    rollupOptions: {
      external: ['Buffer', 'buffer'],
    },
    target: 'esnext',
  },
  css: { postcss },
})
