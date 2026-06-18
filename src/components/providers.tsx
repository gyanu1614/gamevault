'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'next-themes'
import { Suspense, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import RouteProgress from '@/components/global/RouteProgress'
import AccessDeniedToast from '@/components/global/AccessDeniedToast'
import { AuthDialogProvider } from '@/components/auth/AuthDialog'

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
          {/* V17e — Surfaces a toast when the middleware bounced the
              user with ?access=… so they understand WHY they landed
              on the homepage instead of the seller route they tried. */}
          <Suspense fallback={null}>
            <AccessDeniedToast />
          </Suspense>
          {/* V17 — Global auth modal. Mounted once at the root so any
              "Log in / Sign up" button anywhere in the app can open it
              via useAuthDialog(). */}
          <AuthDialogProvider>
            {children}
          </AuthDialogProvider>
        </TooltipProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
