'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'next-themes'
import { Suspense, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import RouteProgress from '@/components/global/RouteProgress'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
        {/* V1 — TooltipProvider at the root so any descendant can drop a
            Tooltip without re-mounting the provider. delayDuration of 200
            feels snappy without being twitchy on quick hover-overs. */}
        <TooltipProvider delayDuration={200}>
          {/* V14t — Global top progress bar. Renders a thin lime bar at the
              top of the viewport while route transitions are in flight.
              Wrapped in Suspense because it reads search params. */}
          <Suspense fallback={null}>
            <RouteProgress />
          </Suspense>
          {children}
        </TooltipProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
