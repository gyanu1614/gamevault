// DEV ONLY — delete before production
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const colorTokens = [
  // Backgrounds
  { name: '--color-bg-base',         label: 'bg-base' },
  { name: '--color-bg-raised',       label: 'bg-raised' },
  { name: '--color-bg-raised-hover', label: 'bg-raised-hover' },
  { name: '--color-bg-overlay',      label: 'bg-overlay' },
  { name: '--color-bg-overlay-2',    label: 'bg-overlay-2' },
  { name: '--color-bg-inset',        label: 'bg-inset' },
  // Borders
  { name: '--color-border-subtle',   label: 'border-subtle' },
  { name: '--color-border-default',  label: 'border-default' },
  { name: '--color-border-strong',   label: 'border-strong' },
  // Text
  { name: '--color-text-primary',    label: 'text-primary' },
  { name: '--color-text-secondary',  label: 'text-secondary' },
  { name: '--color-text-tertiary',   label: 'text-tertiary' },
  { name: '--color-text-disabled',   label: 'text-disabled' },
  { name: '--color-text-inverse',    label: 'text-inverse' },
  { name: '--color-text-footer',     label: 'text-footer' },
  // Accent
  { name: '--color-accent-default',  label: 'accent-default' },
  { name: '--color-accent-hover',    label: 'accent-hover' },
  { name: '--color-accent-pressed',  label: 'accent-pressed' },
  { name: '--color-accent-tint-bg',  label: 'accent-tint-bg' },
  { name: '--color-accent-text',     label: 'accent-text' },
  // Semantic
  { name: '--color-success',         label: 'success' },
  { name: '--color-success-bg',      label: 'success-bg' },
  { name: '--color-warning',         label: 'warning' },
  { name: '--color-warning-bg',      label: 'warning-bg' },
  { name: '--color-error',           label: 'error' },
  { name: '--color-error-bg',        label: 'error-bg' },
  { name: '--color-info',            label: 'info' },
  { name: '--color-info-bg',         label: 'info-bg' },
  // States
  { name: '--color-state-hover',     label: 'state-hover' },
  { name: '--color-state-pressed',   label: 'state-pressed' },
  { name: '--color-state-selected',  label: 'state-selected' },
  { name: '--color-focus-ring',      label: 'focus-ring' },
]

const typeScale = [
  { cls: 'text-hero',        label: 'hero — 72px / 900',        sample: 'Hero Heading' },
  { cls: 'text-display-lg',  label: 'display-lg — 52px / 900',  sample: 'Display Large' },
  { cls: 'text-display',     label: 'display — 38px / 700',     sample: 'Display' },
  { cls: 'text-heading',     label: 'heading — 28px / 700',     sample: 'Section Heading' },
  { cls: 'text-subheading',  label: 'subheading — 21px / 700',  sample: 'Subheading' },
  { cls: 'text-body-lg',     label: 'body-lg — 18px / 400',     sample: 'Body large text for descriptions and paragraphs.' },
  { cls: 'text-body',        label: 'body — 16px / 400',        sample: 'Body text for standard UI copy.' },
  { cls: 'text-body-sm',     label: 'body-sm — 14px / 400',     sample: 'Small body text for captions and metadata.' },
  { cls: 'text-caption',     label: 'caption — 12px / 500',     sample: 'CAPTION TEXT' },
  { cls: 'text-mono',        label: 'mono — 13px / 400',        sample: 'ORD-20240601-X7K2' },
  { cls: 'text-overline',    label: 'overline — 12px / 600',    sample: 'OVERLINE LABEL' },
]

const shadows = [
  { cls: 'shadow-subtle',    label: 'shadow-subtle' },
  { cls: 'shadow-raised',    label: 'shadow-raised' },
  { cls: 'shadow-elevated',  label: 'shadow-elevated' },
  { cls: 'shadow-glow',      label: 'shadow-glow' },
]

const radii = [
  { cls: 'rounded-sm',   label: 'rounded-sm — 6px' },
  { cls: 'rounded-md',   label: 'rounded-md — 10px (--radius)' },
  { cls: 'rounded-lg',   label: 'rounded-lg — 14px' },
  { cls: 'rounded-xl',   label: 'rounded-xl — 20px' },
  { cls: 'rounded-full', label: 'rounded-full — 999px' },
]

export default function TokensPage() {
  return (
    <div style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)', padding: '40px', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
        GameVault Design Token Verification
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '48px', fontSize: '14px' }}>
        DEV ONLY — delete before production. Verify all tokens render correctly below.
      </p>

      {/* ── Font Verification ── */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-accent-default)' }}>
          FONTS
        </h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ padding: '16px', background: 'var(--color-bg-raised)', borderRadius: '10px', border: '1px solid var(--color-border-default)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>--font-display (Satoshi) — should be geometric, not Inter</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 900 }}>GameVault — Buy &amp; Sell Game Items Safely</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--color-bg-raised)', borderRadius: '10px', border: '1px solid var(--color-border-default)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>--font-body (General Sans) — should be clean, humanist</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '16px', fontWeight: 400 }}>The safest peer-to-peer marketplace for gaming items, currency, and accounts.</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--color-bg-raised)', borderRadius: '10px', border: '1px solid var(--color-border-default)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>--font-mono (Geist Mono) — order IDs and timestamps</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 400 }}>ORD-20240601-X7K2P  •  $24.99  •  2024-06-01T14:32:00Z</div>
          </div>
        </div>
      </section>

      {/* ── Color Swatches ── */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-accent-default)' }}>
          COLORS ({colorTokens.length} tokens)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
          {colorTokens.map(({ name, label }) => (
            <div key={name} style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ height: '56px', background: `var(${name})`, border: '1px solid rgba(255,255,255,0.06)' }} />
              <div style={{ padding: '8px', background: 'var(--color-bg-raised)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{name}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Type Scale ── */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-accent-default)' }}>
          TYPE SCALE
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {typeScale.map(({ cls, label, sample }) => (
            <div key={cls} style={{ padding: '16px', background: 'var(--color-bg-raised)', borderRadius: '10px', border: '1px solid var(--color-border-default)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>{label}</div>
              <span className={`${cls} font-display`}>{sample}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Shadows ── */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-accent-default)' }}>
          SHADOWS
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '24px' }}>
          {shadows.map(({ cls, label }) => (
            <div key={cls} className={cls} style={{ padding: '24px', background: 'var(--color-bg-raised)', borderRadius: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Border Radius ── */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-accent-default)' }}>
          BORDER RADIUS
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-end' }}>
          {radii.map(({ cls, label }) => (
            <div key={cls} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div className={cls} style={{ width: '72px', height: '72px', background: 'var(--color-accent-tint-bg)', border: '1px solid var(--color-accent-tint-border)' }} />
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Shadcn Shim Verification ── */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-accent-default)' }}>
          SHADCN SHIM (components should use GV brand colors)
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <Button>Default Button</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div style={{ maxWidth: '400px' }}>
            <Input placeholder="Input field — should use GV border and ring colors" />
          </div>
          <Card style={{ maxWidth: '400px' }}>
            <CardHeader>
              <CardTitle>Card Component</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                This card should use --color-bg-raised as background and --color-border-default as border.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Shadcn Variable Mappings ── */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-accent-default)' }}>
          SHADCN → GV VARIABLE MAPPINGS
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          {[
            ['--background',           '--color-bg-base'],
            ['--foreground',           '--color-text-primary'],
            ['--card',                 '--color-bg-raised'],
            ['--popover',              '--color-bg-overlay'],
            ['--primary',              '--color-accent-default (lime)'],
            ['--primary-foreground',   '--color-text-inverse (dark)'],
            ['--secondary',            '--color-bg-overlay-2'],
            ['--muted',                '--color-bg-inset'],
            ['--muted-foreground',     '--color-text-tertiary'],
            ['--accent',               '--color-accent-tint-bg'],
            ['--accent-foreground',    '--color-accent-text'],
            ['--destructive',          '--color-error'],
            ['--border',               '--color-border-default'],
            ['--input',                '--color-border-default'],
            ['--ring',                 '--color-focus-ring'],
            ['--radius',               '--radius-md (10px)'],
          ].map(([shadcn, gv]) => (
            <div key={shadcn} style={{ padding: '10px 12px', background: 'var(--color-bg-raised)', borderRadius: '6px', border: '1px solid var(--color-border-subtle)', display: 'flex', gap: '8px' }}>
              <span style={{ color: 'var(--color-accent-text)', minWidth: '180px' }}>{shadcn}</span>
              <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{gv}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
