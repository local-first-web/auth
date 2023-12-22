import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    target: 'esnext',
  },
  test: {
    include: ['packages/**/*.test.ts'],
  },
})
