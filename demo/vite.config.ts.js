// vite.config.ts
import { defineConfig } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";
import tsconfigPaths from "vite-tsconfig-paths";

// postcss.config.js
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";

// tailwind.config.ts
import windmill from "@windmill/react-ui/config.js";
import defaultTheme from "tailwindcss/defaultTheme.js";
var { colors, fontSize } = defaultTheme;
var emoji = "Segoe UI Emoji";
var mono = "IBM Plex Mono";
var sans = "IBM Plex Sans";
var condensed = "IBM Plex Sans Condensed";
var serif = "IBM Plex Serif";
var tailwind_config_default = windmill({
  mode: "jit",
  purge: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],
  theme: {
    extend: {
      fontFamily: {
        mono: [mono, emoji, "monospace"],
        sans: [sans, emoji, "sans-serif"],
        condensed: [condensed, emoji, "sans-serif"],
        serif: [serif, emoji, "serif"]
      },
      zIndex: {},
      colors: {
        primary: colors.blue,
        secondary: colors.teal,
        neutral: colors.gray,
        success: colors.green,
        warning: colors.orange,
        danger: colors.red
      },
      fontWeight: {
        thin: 200,
        normal: 500,
        bold: 600,
        extrabold: 800
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" }
        }
      },
      animation: {
        wiggle: "wiggle 1s ease-in-out infinite",
        "spin-fast": "spin 500ms linear infinite"
      }
    }
  },
  variants: {
    opacity: ({ after }) => after(["group-hover", "group-focus", "disabled"]),
    textColor: ({ after }) => after(["group-hover", "group-focus"]),
    boxShadow: ({ after }) => after(["group-hover", "group-focus"])
  }
});

// postcss.config.js
var postcss_config_default = {
  plugins: [tailwind(tailwind_config_default), autoprefixer]
};

// vite.config.ts
var vite_config_default = defineConfig({
  plugins: [reactRefresh(), tsconfigPaths()],
  build: {
    rollupOptions: {
      external: ["Buffer", "buffer"]
    },
    target: "esnext"
  },
  css: { postcss: postcss_config_default }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicG9zdGNzcy5jb25maWcuanMiLCAidGFpbHdpbmQuY29uZmlnLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0UmVmcmVzaCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdC1yZWZyZXNoJ1xuaW1wb3J0IHRzY29uZmlnUGF0aHMgZnJvbSAndml0ZS10c2NvbmZpZy1wYXRocydcblxuaW1wb3J0IHBvc3Rjc3MgZnJvbSAnLi9wb3N0Y3NzLmNvbmZpZydcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0UmVmcmVzaCgpLCB0c2NvbmZpZ1BhdGhzKCldLFxuICBidWlsZDoge1xuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIGV4dGVybmFsOiBbJ0J1ZmZlcicsICdidWZmZXInXSxcbiAgICB9LFxuICAgIHRhcmdldDogJ2VzbmV4dCcsXG4gIH0sXG4gIGNzczogeyBwb3N0Y3NzIH0sXG59KVxuIiwgIlx1RkVGRmltcG9ydCB0YWlsd2luZCBmcm9tICd0YWlsd2luZGNzcydcbmltcG9ydCBhdXRvcHJlZml4ZXIgZnJvbSAnYXV0b3ByZWZpeGVyJ1xuaW1wb3J0IHRhaWx3aW5kQ29uZmlnIGZyb20gJy4vdGFpbHdpbmQuY29uZmlnLmpzJ1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIHBsdWdpbnM6IFt0YWlsd2luZCh0YWlsd2luZENvbmZpZyksIGF1dG9wcmVmaXhlcl0sXG59XG4iLCAiaW1wb3J0IHdpbmRtaWxsIGZyb20gJ0B3aW5kbWlsbC9yZWFjdC11aS9jb25maWcuanMnXG5pbXBvcnQgZGVmYXVsdFRoZW1lIGZyb20gJ3RhaWx3aW5kY3NzL2RlZmF1bHRUaGVtZS5qcydcblxuY29uc3QgeyBjb2xvcnMsIGZvbnRTaXplIH0gPSBkZWZhdWx0VGhlbWVcblxuY29uc3QgZW1vamkgPSAnU2Vnb2UgVUkgRW1vamknXG5jb25zdCBtb25vID0gJ0lCTSBQbGV4IE1vbm8nXG5jb25zdCBzYW5zID0gJ0lCTSBQbGV4IFNhbnMnXG5jb25zdCBjb25kZW5zZWQgPSAnSUJNIFBsZXggU2FucyBDb25kZW5zZWQnXG5jb25zdCBzZXJpZiA9ICdJQk0gUGxleCBTZXJpZidcblxuZXhwb3J0IGRlZmF1bHQgd2luZG1pbGwoe1xuICBtb2RlOiAnaml0JyxcbiAgcHVyZ2U6IFsnLi9zcmMvKiovKi57anMsanN4LHRzLHRzeH0nLCAnLi9pbmRleC5odG1sJ10sXG4gIHRoZW1lOiB7XG4gICAgZXh0ZW5kOiB7XG4gICAgICBmb250RmFtaWx5OiB7XG4gICAgICAgIG1vbm86IFttb25vLCBlbW9qaSwgJ21vbm9zcGFjZSddLFxuICAgICAgICBzYW5zOiBbc2FucywgZW1vamksICdzYW5zLXNlcmlmJ10sXG4gICAgICAgIGNvbmRlbnNlZDogW2NvbmRlbnNlZCwgZW1vamksICdzYW5zLXNlcmlmJ10sXG4gICAgICAgIHNlcmlmOiBbc2VyaWYsIGVtb2ppLCAnc2VyaWYnXSxcbiAgICAgIH0sXG4gICAgICB6SW5kZXg6IHt9LFxuICAgICAgY29sb3JzOiB7XG4gICAgICAgIHByaW1hcnk6IGNvbG9ycy5ibHVlLFxuICAgICAgICBzZWNvbmRhcnk6IGNvbG9ycy50ZWFsLFxuICAgICAgICBuZXV0cmFsOiBjb2xvcnMuZ3JheSxcbiAgICAgICAgc3VjY2VzczogY29sb3JzLmdyZWVuLFxuICAgICAgICB3YXJuaW5nOiBjb2xvcnMub3JhbmdlLFxuICAgICAgICBkYW5nZXI6IGNvbG9ycy5yZWQsXG4gICAgICB9LFxuICAgICAgZm9udFdlaWdodDoge1xuICAgICAgICB0aGluOiAyMDAsXG4gICAgICAgIG5vcm1hbDogNTAwLFxuICAgICAgICBib2xkOiA2MDAsXG4gICAgICAgIGV4dHJhYm9sZDogODAwLFxuICAgICAgfSxcbiAgICAgIGtleWZyYW1lczoge1xuICAgICAgICB3aWdnbGU6IHtcbiAgICAgICAgICAnMCUsIDEwMCUnOiB7IHRyYW5zZm9ybTogJ3JvdGF0ZSgtM2RlZyknIH0sXG4gICAgICAgICAgJzUwJSc6IHsgdHJhbnNmb3JtOiAncm90YXRlKDNkZWcpJyB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGFuaW1hdGlvbjoge1xuICAgICAgICB3aWdnbGU6ICd3aWdnbGUgMXMgZWFzZS1pbi1vdXQgaW5maW5pdGUnLFxuICAgICAgICAnc3Bpbi1mYXN0JzogJ3NwaW4gNTAwbXMgbGluZWFyIGluZmluaXRlJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgdmFyaWFudHM6IHtcbiAgICBvcGFjaXR5OiAoeyBhZnRlciB9KSA9PiBhZnRlcihbJ2dyb3VwLWhvdmVyJywgJ2dyb3VwLWZvY3VzJywgJ2Rpc2FibGVkJ10pLFxuICAgIHRleHRDb2xvcjogKHsgYWZ0ZXIgfSkgPT4gYWZ0ZXIoWydncm91cC1ob3ZlcicsICdncm91cC1mb2N1cyddKSxcbiAgICBib3hTaGFkb3c6ICh7IGFmdGVyIH0pID0+IGFmdGVyKFsnZ3JvdXAtaG92ZXInLCAnZ3JvdXAtZm9jdXMnXSksXG4gIH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBO0FBQ0E7QUFDQTs7O0FDRkM7QUFDRDs7O0FDREE7QUFDQTtBQUVBLElBQU0sRUFBRSxRQUFRLGFBQWE7QUFFN0IsSUFBTSxRQUFRO0FBQ2QsSUFBTSxPQUFPO0FBQ2IsSUFBTSxPQUFPO0FBQ2IsSUFBTSxZQUFZO0FBQ2xCLElBQU0sUUFBUTtBQUVkLElBQU8sMEJBQVEsU0FBUztBQUFBLEVBQ3RCLE1BQU07QUFBQSxFQUNOLE9BQU8sQ0FBQyw4QkFBOEIsY0FBYztBQUFBLEVBQ3BELE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxNQUNOLFlBQVk7QUFBQSxRQUNWLE1BQU0sQ0FBQyxNQUFNLE9BQU8sV0FBVztBQUFBLFFBQy9CLE1BQU0sQ0FBQyxNQUFNLE9BQU8sWUFBWTtBQUFBLFFBQ2hDLFdBQVcsQ0FBQyxXQUFXLE9BQU8sWUFBWTtBQUFBLFFBQzFDLE9BQU8sQ0FBQyxPQUFPLE9BQU8sT0FBTztBQUFBLE1BQy9CO0FBQUEsTUFDQSxRQUFRLENBQUM7QUFBQSxNQUNULFFBQVE7QUFBQSxRQUNOLFNBQVMsT0FBTztBQUFBLFFBQ2hCLFdBQVcsT0FBTztBQUFBLFFBQ2xCLFNBQVMsT0FBTztBQUFBLFFBQ2hCLFNBQVMsT0FBTztBQUFBLFFBQ2hCLFNBQVMsT0FBTztBQUFBLFFBQ2hCLFFBQVEsT0FBTztBQUFBLE1BQ2pCO0FBQUEsTUFDQSxZQUFZO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixRQUFRO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixXQUFXO0FBQUEsTUFDYjtBQUFBLE1BQ0EsV0FBVztBQUFBLFFBQ1QsUUFBUTtBQUFBLFVBQ04sWUFBWSxFQUFFLFdBQVcsZ0JBQWdCO0FBQUEsVUFDekMsT0FBTyxFQUFFLFdBQVcsZUFBZTtBQUFBLFFBQ3JDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsV0FBVztBQUFBLFFBQ1QsUUFBUTtBQUFBLFFBQ1IsYUFBYTtBQUFBLE1BQ2Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsVUFBVTtBQUFBLElBQ1IsU0FBUyxDQUFDLEVBQUUsWUFBWSxNQUFNLENBQUMsZUFBZSxlQUFlLFVBQVUsQ0FBQztBQUFBLElBQ3hFLFdBQVcsQ0FBQyxFQUFFLFlBQVksTUFBTSxDQUFDLGVBQWUsYUFBYSxDQUFDO0FBQUEsSUFDOUQsV0FBVyxDQUFDLEVBQUUsWUFBWSxNQUFNLENBQUMsZUFBZSxhQUFhLENBQUM7QUFBQSxFQUNoRTtBQUNGLENBQUM7OztBRGxERCxJQUFPLHlCQUFRO0FBQUEsRUFDYixTQUFTLENBQUMsU0FBUyx1QkFBYyxHQUFHLFlBQVk7QUFDbEQ7OztBREFBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxhQUFhLEdBQUcsY0FBYyxDQUFDO0FBQUEsRUFDekMsT0FBTztBQUFBLElBQ0wsZUFBZTtBQUFBLE1BQ2IsVUFBVSxDQUFDLFVBQVUsUUFBUTtBQUFBLElBQy9CO0FBQUEsSUFDQSxRQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsS0FBSyxFQUFFLGdDQUFRO0FBQ2pCLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
