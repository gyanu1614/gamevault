import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Colors ─────────────────────────────────────────────────
      colors: {
        // shadcn/radix compatible — updated to use var() directly (GV tokens are hex, not HSL)
        border: {
          DEFAULT: 'var(--border)',
          subtle:  'var(--color-border-subtle)',
          default: 'var(--color-border-default)',
          strong:  'var(--color-border-strong)',
        },
        input:       'var(--input)',
        ring:        'var(--ring)',
        background:  'var(--background)',
        foreground:  'var(--foreground)',
        primary: {
          DEFAULT:    'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT:    'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT:    'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT:    'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT:    'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT:    'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT:    'var(--card)',
          foreground: 'var(--card-foreground)',
        },

        // GameVault design tokens — use gv-* prefix to avoid conflicts
        'gv-primary': 'var(--gv-primary)',
        'gv-cyan':    'var(--gv-cyan)',

        // Surface palette (layered dark UI)
        surface: {
          0: 'var(--gv-surface-0)',   // page bg
          1: 'var(--gv-surface-1)',   // cards, sidebars
          2: 'var(--gv-surface-2)',   // modals, dropdowns
          3: 'var(--gv-surface-3)',   // tooltips, popovers
        },

        // ── GameVault v2 Design Tokens (lime-accent system) ──
        bg: {
          base:           'var(--color-bg-base)',
          raised:         'var(--color-bg-raised)',
          'raised-hover': 'var(--color-bg-raised-hover)',
          overlay:        'var(--color-bg-overlay)',
          'overlay-2':    'var(--color-bg-overlay-2)',
          inset:          'var(--color-bg-inset)',
        },
        'gv-border': {
          subtle:  'var(--color-border-subtle)',
          DEFAULT: 'var(--color-border-default)',
          strong:  'var(--color-border-strong)',
        },
        'gv-text': {
          primary:   'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary:  'var(--color-text-tertiary)',
          disabled:  'var(--color-text-disabled)',
          inverse:   'var(--color-text-inverse)',
          footer:    'var(--color-text-footer)',
        },
        lime: {
          DEFAULT:      'var(--color-accent-default)',
          hover:        'var(--color-accent-hover)',
          pressed:      'var(--color-accent-pressed)',
          'tint-bg':    'var(--color-accent-tint-bg)',
          'tint-border':'var(--color-accent-tint-border)',
          text:         'var(--color-accent-text)',
        },
        'gv-success': { DEFAULT: 'var(--color-success)', bg: 'var(--color-success-bg)' },
        'gv-warning': { DEFAULT: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
        'gv-error':   { DEFAULT: 'var(--color-error)',   bg: 'var(--color-error-bg)'   },
        'gv-info':    { DEFAULT: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },

        // ── Flat aliases used by homepage components (Phase 2) ──
        // text-{primary,secondary,...} -> color.text.* ; border-{subtle,...} -> color.border.* ; etc.
        text: {
          primary:   'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary:  'var(--color-text-tertiary)',
          disabled:  'var(--color-text-disabled)',
          inverse:   'var(--color-text-inverse)',
          footer:    'var(--color-text-footer)',
        },
        success:    { DEFAULT: 'var(--color-success)', bg: 'var(--color-success-bg)' },
        warning:    { DEFAULT: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
        error:      { DEFAULT: 'var(--color-error)',   bg: 'var(--color-error-bg)'   },
        info:       { DEFAULT: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },
        state: {
          hover:    'var(--color-state-hover)',
          pressed:  'var(--color-state-pressed)',
          selected: 'var(--color-state-selected)',
        },
        'focus-ring':         'var(--color-focus-ring)',

        // Extended violet palette
        violet: {
          50:  '#f3e8ff',
          100: '#e9d5ff',
          200: '#d8b4fe',
          300: '#c084fc',
          400: '#a855f7',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#2e1065',
          950: '#1a0a3d',
        },

        // Cyan/teal palette
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
      },

      // ── Typography ──────────────────────────────────────────────
      fontFamily: {
        // GV v2 — Satoshi display, General Sans body, Geist Mono
        sans:    ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        body:    ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        hero:          ['72px', { lineHeight: '1.02',  letterSpacing: '-0.03em',  fontWeight: '900' }],
        'display-lg':  ['52px', { lineHeight: '1.05',  letterSpacing: '-0.025em', fontWeight: '900' }],
        display:       ['38px', { lineHeight: '1.10',  letterSpacing: '-0.02em',  fontWeight: '700' }],
        heading:       ['28px', { lineHeight: '1.15',  letterSpacing: '-0.015em', fontWeight: '700' }],
        subheading:    ['21px', { lineHeight: '1.25',  letterSpacing: '-0.01em',  fontWeight: '700' }],
        'body-lg':     ['18px', { lineHeight: '1.6',   letterSpacing: '0',        fontWeight: '400' }],
        body:          ['16px', { lineHeight: '1.6',   letterSpacing: '0',        fontWeight: '400' }],
        'body-sm':     ['14px', { lineHeight: '1.5',   letterSpacing: '0',        fontWeight: '400' }],
        caption:       ['12px', { lineHeight: '1.35',  letterSpacing: '0.02em',   fontWeight: '500' }],
        mono:          ['13px', { lineHeight: '1.45',  letterSpacing: '0',        fontWeight: '400' }],
        overline:      ['12px', { lineHeight: '1.35',  letterSpacing: '0.14em',   fontWeight: '600' }],
      },

      // ── Border Radius ───────────────────────────────────────────
      borderRadius: {
        // shadcn compat kept
        lg:   'var(--radius)',
        md:   'calc(var(--radius) - 2px)',
        sm:   'var(--radius-sm)',
        xl:   'var(--radius-xl)',
        '2xl':'1.75rem',
        '3xl':'2rem',
        full: 'var(--radius-full)',
      },

      // ── Box Shadows ─────────────────────────────────────────────
      boxShadow: {
        // GV v2 tokens
        subtle:       'var(--shadow-subtle)',
        raised:       'var(--shadow-raised)',
        elevated:     'var(--shadow-elevated)',
        glow:         'var(--shadow-glow)',
        'focus-ring': '0 0 0 2px var(--color-bg-base), 0 0 0 4px var(--color-focus-ring)',
        // Legacy — kept for existing components
        'glow-violet':'0 0 20px rgba(139, 92, 246, 0.35)',
        'glow-lg':    '0 0 40px rgba(139, 92, 246, 0.25)',
        'glow-cyan':  '0 0 20px rgba(6, 182, 212, 0.30)',
        'card':       '0 4px 24px rgba(0, 0, 0, 0.45)',
        'float':      '0 8px 32px rgba(0, 0, 0, 0.60)',
        'modal':      '0 24px 64px rgba(0, 0, 0, 0.80)',
        'inner-glow': 'inset 0 0 20px rgba(139, 92, 246, 0.08)',
      },

      // ── Keyframes ───────────────────────────────────────────────
      keyframes: {
        // Existing
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        meteor: {
          '0%':   { transform: 'rotate(215deg) translateX(0)', opacity: '1' },
          '70%':  { opacity: '1' },
          '100%': { transform: 'rotate(215deg) translateX(-500px)', opacity: '0' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },

        // New
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(139, 92, 246, 0.2)' },
          '50%':       { boxShadow: '0 0 25px rgba(139, 92, 246, 0.45)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-right': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '200% 50%' },
          '50%':       { backgroundPosition: '-200% 50%' },
        },
        'aurora-drift-a': {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
          '50%':       { transform: 'translate(8%, -6%) scale(1.1)' },
        },
        'aurora-drift-b': {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
          '50%':       { transform: 'translate(-10%, 8%) scale(1.15)' },
        },
      },

      // ── Animations ──────────────────────────────────────────────
      animation: {
        // Existing
        'accordion-down':  'accordion-down 0.2s ease-out',
        'accordion-up':    'accordion-up 0.2s ease-out',
        'meteor-effect':   'meteor 5s linear infinite',
        // V19/P24/P7.bb — Checkout footer trust marquee. Track is
        // rendered twice; the `-50%` slide creates seamless wrap.
        marquee:           'marquee 38s linear infinite',

        // New
        shimmer:           'shimmer 1.6s ease-in-out infinite',
        'glow-pulse':      'glow-pulse 2s ease-in-out infinite',
        float:             'float 3s ease-in-out infinite',
        'fade-up':         'fade-up 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
        'fade-in':         'fade-in 0.3s ease forwards',
        'scale-in':        'scale-in 0.2s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
        'slide-right':     'slide-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'gradient-x':      'gradient-x 36s linear infinite',
        'aurora-drift-a':  'aurora-drift-a 22s ease-in-out infinite',
        'aurora-drift-b':  'aurora-drift-b 28s ease-in-out infinite',
      },

      // ── Backdrop Blur ───────────────────────────────────────────
      backdropBlur: {
        xs:  '4px',
        sm:  '8px',
        md:  '12px',
        lg:  '16px',
        xl:  '24px',
        '2xl': '40px',
      },

      // ── Background Size ─────────────────────────────────────────
      backgroundSize: {
        '200%': '200% 100%',
      },

      // ── Transitions ─────────────────────────────────────────────
      transitionTimingFunction: {
        apple:  'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        gv:     'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        fast:    '120ms',
        default: '200ms',
        slow:    '360ms',
      },

      // ── Layout ──────────────────────────────────────────────────
      maxWidth: {
        container:       '1280px',
        'container-wide':'1440px',
      },
      height: {
        nav: '68px',
      },

      // ── Screens ─────────────────────────────────────────────────
      screens: {
        sm:  '640px',
        md:  '760px',
        lg:  '1024px',
        xl:  '1280px',
        '2xl': '1440px',
      },
    },
  },
  plugins: [],
}

export default config
