/** Size tokens shared by the Combobox trigger, panel and inline list. */
export const SIZES = {
  md: {
    trigger: 'h-10 rounded-md border bg-transparent px-3 text-sm',
    triggerGap: 'gap-2',
    triggerIcon: 'h-5 w-5 rounded',
    search: 'gap-2 px-3 py-2',
    searchIcon: 'h-3.5 w-3.5',
    input: 'h-6 text-sm',
    list: 'max-h-72 p-1',
    row: 'gap-2 rounded-md px-2 py-2 text-sm',
    rowIcon: 'h-5 w-5 rounded',
    check: 'h-3.5 w-3.5',
    panel: 'rounded-lg border shadow-elevated',
  },
  lg: {
    // 44px / 16px on touch (no iOS zoom); 40px / 14px with a mouse, the same
    // height as the form's text inputs (owner, 2026-10-12: boxes too big).
    trigger:
      'h-11 rounded-md border border-white/[0.07] bg-white/[0.035] px-3.5 text-base font-medium hover:border-white/[0.13] sm:h-10 sm:px-3 sm:text-[14px]',
    triggerGap: 'gap-2.5',
    triggerIcon: 'h-7 w-7 rounded-md sm:h-6 sm:w-6',
    search: 'gap-2.5 px-4 py-3.5',
    searchIcon: 'h-4 w-4',
    input: 'h-6 text-base sm:text-[14px]',
    list: 'max-h-[22rem] p-1.5',
    row: 'gap-3 rounded-lg px-2.5 py-1.5 text-[14.5px] font-medium min-h-[48px] sm:min-h-[40px] sm:text-[14px]',
    rowIcon: 'h-9 w-9 rounded-lg sm:h-7 sm:w-7 sm:rounded-md',
    check: 'h-4 w-4',
    panel: 'rounded-xl border border-white/[0.06] bg-[#1F2025] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]',
  },
} as const
