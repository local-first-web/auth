import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
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
