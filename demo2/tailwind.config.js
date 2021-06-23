const windmill = require('@windmill/react-ui/config')
const { colors, fontSize } = require('tailwindcss/defaultTheme')

const emoji = 'Segoe UI Emoji'
const mono = 'IBM Plex Mono'
const sans = 'IBM Plex Sans'
const condensed = 'IBM Plex Sans Condensed'
const serif = 'IBM Plex Serif'

module.exports = windmill({
  mode: 'jit',
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/**/*.html'],
  theme: {
    extend: {
      fontFamily: {
        mono: [mono, emoji, 'monospace'],
        sans: [sans, emoji, 'sans-serif'],
        condensed: [condensed, emoji, 'sans-serif'],
        serif: [serif, emoji, 'serif'],
      },
      zIndex: {},
      colors: {
        primary: colors.blue,
        secondary: colors.teal,
        neutral: colors.gray,
        success: colors.green,
        warning: colors.orange,
        danger: colors.red,
      },
      fontSize: {},
      fontWeight: {
        thin: 200,
        normal: 500,
        bold: 600,
        extrabold: 800,
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
      animation: {
        wiggle: 'wiggle 1s ease-in-out infinite',
        'spin-fast': 'spin 500ms linear infinite',
      },
    },
  },
  variants: {
    opacity: ({ after }) => after(['group-hover', 'group-focus', 'disabled']),
    textColor: ({ after }) => after(['group-hover', 'group-focus']),
    boxShadow: ({ after }) => after(['group-hover', 'group-focus']),
  },
})
