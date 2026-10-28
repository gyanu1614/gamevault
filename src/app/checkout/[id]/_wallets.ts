/**
 * Which wallet row this device gets (owner 2026-10-27): Apple Pay where the
 * browser can pay with it, Google Pay everywhere else. Decided after mount —
 * the server render has neither, so the static HTML never guesses wrong.
 *
 * `ApplePaySession` exists only on Apple browsers over https; iPhones and
 * iPads count as Apple Pay devices even on a plain-http local preview.
 */
import { useEffect, useState } from 'react'

import type { WalletAvailability } from './_method-ui'

export function detectWallets(win: { ApplePaySession?: { canMakePayments?: () => boolean } }, userAgent: string): WalletAvailability {
  let applePay = false
  try {
    applePay = !!win.ApplePaySession?.canMakePayments?.()
  } catch {
    applePay = false
  }
  if (!applePay) applePay = /\b(iPhone|iPad|iPod)\b/.test(userAgent)
  return { applePay, googlePay: !applePay }
}

export function useWalletAvailability(): WalletAvailability | null {
  const [wallets, setWallets] = useState<WalletAvailability | null>(null)
  useEffect(() => {
    setWallets(detectWallets(window as never, navigator.userAgent))
  }, [])
  return wallets
}
