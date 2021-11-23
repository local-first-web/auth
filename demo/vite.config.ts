import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import tsconfigPaths from 'vite-tsconfig-paths'

import postcss from './postcss.config'

export default defineConfig({
  plugins: [reactRefresh(), tsconfigPaths()],
  build: {
    rollupOptions: {
      external: ['Buffer', 'buffer'],
    },
    target: 'esnext',
  },
  css: { postcss },
})
