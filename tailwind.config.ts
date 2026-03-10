import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Colors ─────────────────────────────────────────────────
      colors: {
        // shadcn/radix compatible (existing — DO NOT REMOVE)
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
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
        sans:    ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
        // display falls back to Inter — swap when a display font is chosen
        display: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },

      // ── Border Radius ───────────────────────────────────────────
      borderRadius: {
        lg:   'var(--radius)',
        md:   'calc(var(--radius) - 2px)',
        sm:   'calc(var(--radius) - 4px)',
        xl:   '1.25rem',    // 20px
        '2xl':'1.75rem',    // 28px
        '3xl':'2rem',       // 32px
      },

      // ── Box Shadows ─────────────────────────────────────────────
      boxShadow: {
        'glow':       '0 0 20px rgba(139, 92, 246, 0.35)',
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
      },

      // ── Animations ──────────────────────────────────────────────
      animation: {
        // Existing
        'accordion-down':  'accordion-down 0.2s ease-out',
        'accordion-up':    'accordion-up 0.2s ease-out',
        'meteor-effect':   'meteor 5s linear infinite',

        // New
        shimmer:           'shimmer 1.6s ease-in-out infinite',
        'glow-pulse':      'glow-pulse 2s ease-in-out infinite',
        float:             'float 3s ease-in-out infinite',
        'fade-up':         'fade-up 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
        'fade-in':         'fade-in 0.3s ease forwards',
        'scale-in':        'scale-in 0.2s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
        'slide-right':     'slide-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
      },
    },
  },
  plugins: [],
}

export default config
