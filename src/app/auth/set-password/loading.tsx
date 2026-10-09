import { HeroBackdrop } from '@/components/hero-backdrop'

export default function Loading() {
  return (
    <HeroBackdrop name="home" className="hero-dim">
      <div className="min-h-[calc(100dvh-4rem)]" aria-hidden />
    </HeroBackdrop>
  )
}
