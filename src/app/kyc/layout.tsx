import type { Metadata } from 'next'

/** The ID check's own tabs: nothing here belongs in search results. */
export const metadata: Metadata = {
  title: 'ID Check',
  robots: { index: false, follow: false },
}

export default function KycLayout({ children }: { children: React.ReactNode }) {
  return children
}
