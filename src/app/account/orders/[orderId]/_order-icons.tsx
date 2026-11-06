'use client'

/**
 * The order page's icons, one family (owner, 2026-11-06: small marks in little boxes
 * didn't look good). Phosphor duotone, sized by the caller, never in a tile.
 */

import type { ComponentType } from 'react'
import type { Icon, IconProps } from '@phosphor-icons/react'
import { ArrowUUpLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowUUpLeft'
import { ChatsIcon } from '@phosphor-icons/react/dist/csr/Chats'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise'
import { CreditCardIcon } from '@phosphor-icons/react/dist/csr/CreditCard'
import { HandCoinsIcon } from '@phosphor-icons/react/dist/csr/HandCoins'
import { HourglassIcon } from '@phosphor-icons/react/dist/csr/Hourglass'
import { ListChecksIcon } from '@phosphor-icons/react/dist/csr/ListChecks'
import { PackageIcon } from '@phosphor-icons/react/dist/csr/Package'
import { ProhibitIcon } from '@phosphor-icons/react/dist/csr/Prohibit'
import { ReceiptIcon } from '@phosphor-icons/react/dist/csr/Receipt'
import { SealCheckIcon } from '@phosphor-icons/react/dist/csr/SealCheck'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { ShieldWarningIcon } from '@phosphor-icons/react/dist/csr/ShieldWarning'
import { ThumbsDownIcon } from '@phosphor-icons/react/dist/csr/ThumbsDown'
import { ThumbsUpIcon } from '@phosphor-icons/react/dist/csr/ThumbsUp'
import { TimerIcon } from '@phosphor-icons/react/dist/csr/Timer'
import { TruckIcon } from '@phosphor-icons/react/dist/csr/Truck'
import { WalletIcon } from '@phosphor-icons/react/dist/csr/Wallet'
import { XCircleIcon } from '@phosphor-icons/react/dist/csr/XCircle'

export type OrderIcon = ComponentType<IconProps>

const duotone = (Glyph: Icon): OrderIcon =>
  function OrderPageIcon(props: IconProps) {
    return <Glyph weight="duotone" aria-hidden {...props} />
  }

export const Ban = duotone(ProhibitIcon)
export const BadgeCheck = duotone(SealCheckIcon)
export const CheckCircle2 = duotone(CheckCircleIcon)
export const CreditCard = duotone(CreditCardIcon)
export const Hourglass = duotone(HourglassIcon)
export const ListChecks = duotone(ListChecksIcon)
export const MessagesSquare = duotone(ChatsIcon)
export const OrderDetails = duotone(ReceiptIcon)
export const OrderTimeline = duotone(ClockCounterClockwiseIcon)
export const PackageCheck = duotone(PackageIcon)
export const Payout = duotone(HandCoinsIcon)
export const ShieldAlert = duotone(ShieldWarningIcon)
export const ShieldCheck = duotone(ShieldCheckIcon)
export const ThumbsDown = duotone(ThumbsDownIcon)
export const ThumbsUp = duotone(ThumbsUpIcon)
export const TimerOff = duotone(TimerIcon)
export const Truck = duotone(TruckIcon)
export const Undo2 = duotone(ArrowUUpLeftIcon)
export const Wallet = duotone(WalletIcon)
export const XCircle = duotone(XCircleIcon)
