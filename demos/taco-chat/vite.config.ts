import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import postcss from './postcss.config'
import topLevelAwait from 'vite-plugin-top-level-await'
import { NodeGlobalsPolyfillPlugin as nodeGlobals } from '@esbuild-plugins/node-globals-polyfill'
export default defineConfig({
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
