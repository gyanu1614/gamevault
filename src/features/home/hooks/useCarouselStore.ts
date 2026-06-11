import { create } from 'zustand'

interface CarouselState {
  activeIndex: number
  isPaused: boolean
  setActiveIndex: (index: number) => void
  setPaused: (paused: boolean) => void
  next: (slideCount: number) => void
}

/**
 * Zustand store for the hero carousel index.
 *
 * Justification for Zustand over local state: the carousel index may need to be
 * read by sibling components (e.g. dot navigation rendered outside the slide
 * track, or a future admin preview panel) without prop-drilling. Zustand gives
 * us a single source of truth that's trivially testable and easy to wire to
 * future admin-editable slide config without re-plumbing props.
 */
export const useCarouselStore = create<CarouselState>((set) => ({
  activeIndex: 0,
  isPaused: false,
  setActiveIndex: (index) => set({ activeIndex: index }),
  setPaused: (paused) => set({ isPaused: paused }),
  next: (slideCount) => set((state) => ({ activeIndex: (state.activeIndex + 1) % slideCount })),
}))
