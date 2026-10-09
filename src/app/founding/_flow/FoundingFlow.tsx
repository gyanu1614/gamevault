'use client'

/**
 * /founding — Become a Seller (open seller signup, 2026-10-08).
 *
 * One checklist card, one step open at a time: Sign Up → Personal Details →
 * Set Up Store → Seller Agreement. Progress is saved server-side: the page
 * hands this component the state it resolved (getFoundingFlowState); after
 * every save the client re-reads it and opens the next step, so a refresh,
 * a second device or the email-confirmation round trip all land on the
 * right row. A signed-in visitor starts with Sign Up already ticked.
 *
 * Chrome: the real site navbar in its transparent, minimal mode (logo +
 * auth/profile). Space above the header is reserved for a hero background.
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar-floating'
import type { Game } from '@/lib/utils/games'
import type { GameCategoryOptions } from '@/app/account/become-seller/_redesign/game-categories-shared'
import type { LegalDoc } from '@/lib/legal/documents'
import { getFoundingFlowState, type FoundingFlowState } from '@/lib/actions/founding-onboarding'
import { useAuth } from '@/hooks/use-auth'
import type { FoundingStage, FoundingStepId } from '@/lib/founding/onboarding'
import { StepChecklist } from './StepChecklist'
import { WhySellPanel } from './WhySellPanel'
import { StepAccount } from './StepAccount'
import { StepDetails } from './StepDetails'
import { StepStore } from './StepStore'
import { StepAgreement } from './StepAgreement'
import { DoneScreen } from './DoneScreen'
import { GLASS_CARD } from './ui'
import { CongratsDialog } from './CongratsDialog'

export interface FoundingFlowProps {
  initialState: FoundingFlowState
  games: Game[]
  categories: GameCategoryOptions[]
  agreement: Pick<LegalDoc, 'title' | 'sections'>
}

export default function FoundingFlow({ initialState, games, categories, agreement }: FoundingFlowProps) {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  // The open row. Starts at the next step; a done row can be re-opened to
  // review, and Continue there jumps forward to the next step again.
  const [open, setOpen] = useState<FoundingStage>(initialState.stage)
  // The congratulations dialog opens once per device: right after the
  // agreement is signed, or on the first visit after finishing elsewhere.
  // Later visits land on the done card only.
  const [celebrate, setCelebrate] = useState(false)
  const celebratedKey = state.user?.id ? `dm.founding.celebrated:${state.user.id}` : null
  const markCelebrated = useCallback(() => {
    try { if (celebratedKey) localStorage.setItem(celebratedKey, '1') } catch { /* storage blocked */ }
  }, [celebratedKey])
  useEffect(() => {
    if (!state.isSeller || !celebratedKey) return
    try {
      if (!localStorage.getItem(celebratedKey)) { setCelebrate(true); markCelebrated() }
    } catch { /* storage blocked */ }
  }, [state.isSeller, celebratedKey, markCelebrated])

  const reload = useCallback(async () => {
    const fresh = await getFoundingFlowState()
    setState(fresh)
    setOpen(fresh.stage)
    router.refresh()
  }, [router])

  // Back from the email-confirmation link: the session exists now but the
  // page was rendered before it. Re-resolve once on mount if we look stale.
  useEffect(() => {
    if (!initialState.signedIn && typeof window !== 'undefined' && window.location.search.includes('confirmed=1')) {
      reload().catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The page was rendered with the session it had at request time. When the
  // browser session changes underneath it — navbar Log Out, a sign-in in
  // another tab, the OAuth return — re-resolve so step 1 never shows a tick
  // for an account that is gone (or a form for one that is here).
  const { user: authUser, loading: authLoading } = useAuth()
  useEffect(() => {
    if (authLoading) return
    if (Boolean(authUser) !== state.signedIn) reload().catch(() => undefined)
  }, [authLoading, authUser, state.signedIn, reload])

  const stage: FoundingStage = state.isSeller ? 5 : state.stage
  const next = () => setOpen(stage)

  const renderStep = (id: FoundingStepId) => {
    if (id === 1) return <StepAccount signedIn={state.signedIn} email={state.user?.email ?? null} onContinue={next} onSignedIn={reload} />
    if (id === 2) return <StepDetails games={games} categories={categories} initial={state.details} discordHint={state.discordHandle} onBack={() => setOpen(1)} onSaved={reload} />
    if (id === 3) return <StepStore initialName={state.store?.name ?? null} initialLogoUrl={state.user?.avatarUrl ?? null} onBack={() => setOpen(2)} onSaved={reload} />
    return (
      <StepAgreement
        doc={agreement}
        version={state.agreementVersion}
        defaultName={state.user?.name ?? null}
        onBack={() => setOpen(3)}
        onFinished={async () => { await reload(); setCelebrate(true); markCelebrated() }}
      />
    )
  }

  return (
    <div className="relative min-h-screen text-text-primary">
      <Navbar transparent minimal />

      {/* Top padding doubles as the slot for the hero background (later). */}
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pt-32">
        <header className="max-w-3xl">
          {stage >= 5 ? (
            <>
              <h1 className="text-heading text-text-primary sm:text-display lg:whitespace-nowrap">
                Welcome to the <span className="seller-shimmer">DropMarket</span> Community
              </h1>
              <p className="mt-3 text-body text-text-secondary sm:text-body-lg">
                {state.shopName ? <>Your store <span className="font-medium text-text-primary">{state.shopName}</span> is open. Here is what to do next.</> : 'Your store is open. Here is what to do next.'}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-heading text-text-primary sm:text-display">
                Become a <span className="seller-shimmer">Seller</span>
              </h1>
              <p className="mt-3 text-body text-text-secondary sm:text-body-lg">Takes about 2 minutes. Then you start selling.</p>
            </>
          )}
        </header>

        <div className="mt-8 grid grid-cols-1 items-start gap-6 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          {stage >= 5 ? (
            <div className={`${GLASS_CARD} p-5 sm:p-7`}>
              <DoneScreen shopName={state.shopName} shopSlug={state.shopSlug} logoUrl={state.user?.avatarUrl ?? null} isFounding={state.isFounding} isVerified={state.isVerified} tier={state.tier} />
            </div>
          ) : (
            <StepChecklist
              stage={stage}
              open={open}
              onOpen={(id) => setOpen(id)}
              renderStep={renderStep}
              renderDone={() => null}
            />
          )}
          <WhySellPanel progress={state.progress} />
        </div>
      </main>

      <CongratsDialog
        open={celebrate}
        onOpenChange={setCelebrate}
        shopName={state.shopName}
        shopSlug={state.shopSlug}
        logoUrl={state.user?.avatarUrl ?? null}
        isFounding={state.isFounding}
      />
    </div>
  )
}
