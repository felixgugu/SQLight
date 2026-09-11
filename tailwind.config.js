/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#141418', // Deepest background (e.g. status bar, title bar)
          850: '#18181f', // Outer background
          800: '#1e1e26', // Panel background (sidebar, bottom panel)
          750: '#252530', // Surface background (active tab, header)
          700: '#2d2d3a', // Border color / divider
          600: '#3c3c4e', // Hover border
          500: '#525266', // Muted text / icon
          400: '#8b8b9e', // Secondary text
          300: '#b4b4c4', // Body text
          100: '#f0f0f5', // Brightest text
        },
        brand: {
          500: '#3b82f6', // Primary action / highlight blue
          600: '#2563eb', // Primary button hover
          700: '#1d4ed8',
        }
      },
      fontFamily: {
        mono: ['"Fira Code"', 'Consolas', 'Monaco', 'monospace'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'xxs': '0.6875rem',
      }
    },
  },
  plugins: [],
}
