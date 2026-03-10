/**
 * GameVault Design Tokens
 * Single source of truth for all visual design decisions.
 * Used by tailwind.config.ts and referenced in components.
 *
 * Philosophy: Dark-first, glass morphism, spring animations.
 * Think "if Apple designed a gaming marketplace and Spotify did the motion design."
 */

export const tokens = {
  colors: {
    // Primary: electric violet — gaming energy, trust
    primary: {
      50:  '#f3e8ff',
      100: '#e9d5ff',
      200: '#d8b4fe',
      300: '#c084fc',
      400: '#a855f7',
      500: '#8b5cf6',  // main brand color
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#2e1065',
    },

    // Accent: neon cyan — tech, links, highlights
    cyan: {
      400: '#22d3ee',
      500: '#06b6d4',
      600: '#0891b2',
    },

    // Surface: rich dark grays with subtle blue/violet undertone
    // Use these for layered dark UI (not Tailwind's default grays)
    surface: {
      0: '#0a0a0f',   // deepest — page background
      1: '#111118',   // base surfaces — cards, sidebars
      2: '#1a1a24',   // elevated — modals, dropdowns
      3: '#24243a',   // highest — tooltips, popovers
    },

    // Semantic
    success: '#10b981',
    warning: '#f59e0b',
    error:   '#ef4444',
    info:    '#3b82f6',
  },

  fonts: {
    display: "'Satoshi', 'Plus Jakarta Sans', sans-serif",  // headings, hero text
    body:    "'Plus Jakarta Sans', sans-serif",              // body copy
    mono:    "'JetBrains Mono', 'Fira Code', monospace",    // prices, codes, data
  },

  spacing: {
    xs:  '4px',
    sm:  '8px',
    md:  '16px',
    lg:  '24px',
    xl:  '32px',
    '2xl': '48px',
    '3xl': '64px',
    '4xl': '96px',
  },

  radius: {
    sm:   '6px',
    md:   '10px',
    lg:   '14px',
    xl:   '20px',
    '2xl': '28px',
    pill: '9999px',
  },

  shadows: {
    // Glow effects for interactive elements
    glowPrimary: '0 0 20px rgba(139, 92, 246, 0.35)',
    glowPrimaryLg: '0 0 40px rgba(139, 92, 246, 0.25)',
    glowCyan:    '0 0 20px rgba(6, 182, 212, 0.3)',

    // Elevation shadows (dark-optimised)
    card:   '0 4px 24px rgba(0, 0, 0, 0.45)',
    float:  '0 8px 32px rgba(0, 0, 0, 0.6)',
    modal:  '0 24px 64px rgba(0, 0, 0, 0.8)',
  },

  glass: {
    // backdrop-filter + background combos — ready to use as CSS
    light:  { bg: 'rgba(255, 255, 255, 0.04)', border: 'rgba(255, 255, 255, 0.08)', blur: '12px' },
    medium: { bg: 'rgba(255, 255, 255, 0.07)', border: 'rgba(255, 255, 255, 0.12)', blur: '16px' },
    heavy:  { bg: 'rgba(255, 255, 255, 0.10)', border: 'rgba(255, 255, 255, 0.16)', blur: '24px' },
  },

  animation: {
    // Spring configs — use with framer-motion
    spring: {
      snappy:  { type: 'spring', damping: 25, stiffness: 300 } as const,
      smooth:  { type: 'spring', damping: 30, stiffness: 200 } as const,
      bouncy:  { type: 'spring', damping: 15, stiffness: 250 } as const,
      slow:    { type: 'spring', damping: 40, stiffness: 150 } as const,
    },
    // Standard easing curves (for CSS transitions)
    ease: {
      out:     'cubic-bezier(0.25, 0.1, 0.25, 1)',
      in:      'cubic-bezier(0.42, 0, 1, 1)',
      inOut:   'cubic-bezier(0.42, 0, 0.58, 1)',
      apple:   'cubic-bezier(0.4, 0, 0.2, 1)',   // Apple's signature easing
    },
    duration: {
      instant: '80ms',
      fast:    '150ms',
      normal:  '250ms',
      slow:    '400ms',
      xslow:   '600ms',
    },
  },
} as const

export type DesignTokens = typeof tokens
