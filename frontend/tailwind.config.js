/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
          hover: 'rgb(var(--color-brand-hover) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          hover: 'rgb(var(--color-accent-hover) / <alpha-value>)',
        },
        app: 'rgb(var(--color-bg-app) / <alpha-value>)',
        rail: 'rgb(var(--color-bg-rail) / <alpha-value>)',
        sidebar: 'rgb(var(--color-bg-sidebar) / <alpha-value>)',
        surface: 'rgb(var(--color-bg-surface) / <alpha-value>)',
        ink: 'rgb(var(--color-text-primary) / <alpha-value>)',
        muted: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          hover: 'rgb(var(--color-danger-hover) / <alpha-value>)',
        },
      },
      borderColor: {
        DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
      },
      fontSize: {
        caption: ['0.75rem', { lineHeight: '1rem' }],
        body: ['1rem', { lineHeight: '1.5rem' }],
        heading: ['1.125rem', { lineHeight: '1.75rem' }],
        title: ['1.5rem', { lineHeight: '2rem' }],
      },
      fontFamily: {
        sans: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
