import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    alias: {
      "@/": new URL("src/", import.meta.url).pathname,
      "@test": new URL("src/_test", import.meta.url).pathname,
    },
  },
})
