function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${variableName}) / ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

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
          950: withOpacity('--color-dark-950'),
          900: withOpacity('--color-dark-900'), // Deepest background (e.g. status bar, title bar)
          850: withOpacity('--color-dark-850'), // Outer background
          800: withOpacity('--color-dark-800'), // Panel background (sidebar, bottom panel)
          750: withOpacity('--color-dark-750'), // Surface background (active tab, header)
          700: withOpacity('--color-dark-700'), // Border color / divider
          600: withOpacity('--color-dark-600'), // Hover border
          500: withOpacity('--color-dark-500'), // Muted text / icon
          400: withOpacity('--color-dark-400'), // Secondary text
          300: withOpacity('--color-dark-300'), // Body text
          200: withOpacity('--color-dark-200'), // Headings / high contrast text
          100: withOpacity('--color-dark-100'), // Brightest text
        },
        brand: {
          500: '#3b82f6', // Primary action / highlight blue
          600: '#2563eb', // Primary button hover
          700: '#1d4ed8',
        },
        primary: {
          DEFAULT: 'var(--p-primary-color)',
          contrast: 'var(--p-primary-contrast-color)',
        }
      },
      fontFamily: {
        mono: ['"Fira Code"', 'Consolas', 'Monaco', 'monospace'],
        sans: ['var(--app-font-sans)'],
      },
      fontSize: {
        'xxs': '0.6875rem',
      }
    },
  },
  plugins: [],
}
