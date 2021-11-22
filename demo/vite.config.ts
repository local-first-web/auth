import inject from '@rollup/plugin-inject'
import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'

import postcss from './postcss.config'

export default defineConfig({
  plugins: [reactRefresh()],
  build: {
    rollupOptions: {
      external: ['Buffer', 'buffer'],
    },
    target: 'esnext',
  },
  css: { postcss },
})
