import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

import postcss from './postcss.config'

export default defineConfig({
  plugins: [viteReact(), tsconfigPaths()],
  build: {
    rollupOptions: {
      external: ['Buffer', 'buffer'],
    },
    target: 'esnext',
  },
  css: { postcss },
})
