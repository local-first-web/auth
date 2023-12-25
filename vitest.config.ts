import tsconfigPaths from 'vite-tsconfig-paths'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        preserveModules: true,
        inlineDynamicImports: false,
      },
    },
  },
  test: {
    include: ['packages/**/*.test.ts'],
    watchExclude: configDefaults.watchExclude.filter(d => !d.includes('dist')),
  },
})
