// vite.config.ts
import { defineConfig } from "file:///Users/herbcaudill/Code/local-first-web/auth/node_modules/.pnpm/vite@5.1.4_@types+node@18.19.21/node_modules/vite/dist/node/index.js";
import react from "file:///Users/herbcaudill/Code/local-first-web/auth/node_modules/.pnpm/@vitejs+plugin-react@4.2.1_vite@5.1.4/node_modules/@vitejs/plugin-react/dist/index.mjs";
import wasm from "file:///Users/herbcaudill/Code/local-first-web/auth/node_modules/.pnpm/vite-plugin-wasm@3.3.0_vite@5.1.4/node_modules/vite-plugin-wasm/exports/import.mjs";
import topLevelAwait from "file:///Users/herbcaudill/Code/local-first-web/auth/node_modules/.pnpm/vite-plugin-top-level-await@1.4.1_vite@5.1.4/node_modules/vite-plugin-top-level-await/exports/import.mjs";
var vite_config_default = defineConfig({
  plugins: [wasm(), topLevelAwait(), react()],
  worker: {
    format: "es",
    plugins: () => [wasm(), topLevelAwait()]
  },
  optimizeDeps: {
    // This is necessary because otherwise `vite dev` includes two separate
    // versions of the JS wrapper. This causes problems because the JS
    // wrapper has a module level variable to track JS side heap
    // allocations, and initializing this twice causes horrible breakage
    exclude: ["@automerge/automerge-wasm/bundler/bindgen_bg.wasm", "@syntect/wasm"]
  },
  server: {
    fs: {
      strict: false
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvaGVyYmNhdWRpbGwvQ29kZS9sb2NhbC1maXJzdC13ZWIvYXV0aC9kZW1vcy9hdXRvbWVyZ2UtcmVwby10b2Rvc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2hlcmJjYXVkaWxsL0NvZGUvbG9jYWwtZmlyc3Qtd2ViL2F1dGgvZGVtb3MvYXV0b21lcmdlLXJlcG8tdG9kb3Mvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2hlcmJjYXVkaWxsL0NvZGUvbG9jYWwtZmlyc3Qtd2ViL2F1dGgvZGVtb3MvYXV0b21lcmdlLXJlcG8tdG9kb3Mvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHdhc20gZnJvbSAndml0ZS1wbHVnaW4td2FzbSdcbmltcG9ydCB0b3BMZXZlbEF3YWl0IGZyb20gJ3ZpdGUtcGx1Z2luLXRvcC1sZXZlbC1hd2FpdCdcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3dhc20oKSwgdG9wTGV2ZWxBd2FpdCgpLCByZWFjdCgpXSxcblxuICB3b3JrZXI6IHtcbiAgICBmb3JtYXQ6ICdlcycsXG4gICAgcGx1Z2luczogKCkgPT4gW3dhc20oKSwgdG9wTGV2ZWxBd2FpdCgpXSxcbiAgfSxcblxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICAvLyBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIG90aGVyd2lzZSBgdml0ZSBkZXZgIGluY2x1ZGVzIHR3byBzZXBhcmF0ZVxuICAgIC8vIHZlcnNpb25zIG9mIHRoZSBKUyB3cmFwcGVyLiBUaGlzIGNhdXNlcyBwcm9ibGVtcyBiZWNhdXNlIHRoZSBKU1xuICAgIC8vIHdyYXBwZXIgaGFzIGEgbW9kdWxlIGxldmVsIHZhcmlhYmxlIHRvIHRyYWNrIEpTIHNpZGUgaGVhcFxuICAgIC8vIGFsbG9jYXRpb25zLCBhbmQgaW5pdGlhbGl6aW5nIHRoaXMgdHdpY2UgY2F1c2VzIGhvcnJpYmxlIGJyZWFrYWdlXG4gICAgZXhjbHVkZTogWydAYXV0b21lcmdlL2F1dG9tZXJnZS13YXNtL2J1bmRsZXIvYmluZGdlbl9iZy53YXNtJywgJ0BzeW50ZWN0L3dhc20nXSxcbiAgfSxcblxuICBzZXJ2ZXI6IHtcbiAgICBmczoge1xuICAgICAgc3RyaWN0OiBmYWxzZSxcbiAgICB9LFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBdVksU0FBUyxvQkFBb0I7QUFDcGEsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixPQUFPLG1CQUFtQjtBQUUxQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsS0FBSyxHQUFHLGNBQWMsR0FBRyxNQUFNLENBQUM7QUFBQSxFQUUxQyxRQUFRO0FBQUEsSUFDTixRQUFRO0FBQUEsSUFDUixTQUFTLE1BQU0sQ0FBQyxLQUFLLEdBQUcsY0FBYyxDQUFDO0FBQUEsRUFDekM7QUFBQSxFQUVBLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS1osU0FBUyxDQUFDLHFEQUFxRCxlQUFlO0FBQUEsRUFDaEY7QUFBQSxFQUVBLFFBQVE7QUFBQSxJQUNOLElBQUk7QUFBQSxNQUNGLFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
