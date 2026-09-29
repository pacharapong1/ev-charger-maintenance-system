import type { Config } from 'tailwindcss';

/**
 * Dark mode is class based, not media based, so the user can override the
 * system preference from the header toggle. The class is set on <html> by the
 * inline script in app/layout.tsx before React hydrates, which is what
 * prevents a white flash on a dark-mode load.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic surface tokens. Each has a light and dark value so a single
        // class like bg-surface works in both themes.
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f6f7f9',
          sunken: '#eef0f4',
        },
        ink: {
          DEFAULT: '#0f172a',
          muted: '#5b6474',
          subtle: '#8b93a3',
        },
        line: {
          DEFAULT: '#e3e6ec',
          strong: '#cbd1db',
        },
        brand: {
          50: '#eefdf3',
          100: '#d6f8e0',
          200: '#b0efc6',
          300: '#7ce1a3',
          400: '#45cb7c',
          500: '#20b364',
          600: '#129150',
          700: '#0f7343',
          800: '#105b37',
          900: '#0e4b2f',
          950: '#04261a',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        'card-dark': '0 1px 2px 0 rgb(0 0 0 / 0.3), 0 1px 3px 0 rgb(0 0 0 / 0.4)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
