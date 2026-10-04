/** @type {import('tailwindcss').Config} */
// Maps Tailwind onto the CSS custom properties defined in src/styles.scss.
// No literal colour, size or shadow value belongs in this file — the Figma
// tokens are the single source of truth.
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        // --- Theme tokens (use these) -------------------------------------
        surface: {
          DEFAULT: 'var(--color-bg-surface)',
          base: 'var(--color-bg-base)',
          subtle: 'var(--color-bg-subtle)',
          // deprecated aliases, see §6 in styles.scss
          card: 'var(--color-bg-surface)',
          dark: 'var(--brand-900)',
        },
        ink: {
          DEFAULT: 'var(--color-text-default)',
          strong: 'var(--color-text-strong)',
          muted: 'var(--color-text-muted)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
        },
        line: {
          DEFAULT: 'var(--color-border-default)',
          subtle: 'var(--color-border-subtle)',
          strong: 'var(--color-border-strong)',
        },
        action: {
          DEFAULT: 'var(--color-action-primary)',
          hover: 'var(--color-action-primary-hover)',
          active: 'var(--color-action-primary-active)',
          on: 'var(--color-action-on-primary)',
          text: 'var(--color-action-primary-text)',
        },
        focus: 'var(--color-focus)',
        scrim: 'var(--color-scrim)',

        // --- Deprecated: pre-Figma names, kept so the un-migrated screens
        // --- keep rendering. Removed per screen by #52–#60.
        primary: {
          DEFAULT: 'var(--color-action-primary)',
          hover: 'var(--color-action-primary-hover)',
        },
        secondary: 'var(--brand-300)',
        tertiary: 'var(--brand-200)',
        neutral: 'var(--color-bg-base)',
      },
      spacing: {
        page: 'var(--space-page)',
        card: 'var(--space-card)',
        gutter: 'var(--space-gutter)',
      },
      boxShadow: {
        'elevation-sm': 'var(--shadow-sm)',
        'elevation-md': 'var(--shadow-md)',
        'elevation-lg': 'var(--shadow-lg)',
      },
      screens: {
        // Figma breakpoints — additive, Tailwind's own sm/md/lg stay untouched.
        tablet: '834px',
        desktop: '1440px',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
      letterSpacing: {
        brand: '-0.02em',
      },
    },
  },
  plugins: [],
}
