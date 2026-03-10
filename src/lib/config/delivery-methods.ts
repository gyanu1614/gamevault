/**
 * Game-Specific Delivery Methods Configuration
 *
 * Maps games to their available delivery methods with icons and descriptions
 */

import {
  Gamepad2,
  Gift,
  Mail,
  ShoppingCart,
  Plane,
  Crown,
  LogIn,
  type LucideIcon,
} from 'lucide-react'

export interface DeliveryMethodOption {
  value: string
  label: string
  description: string
  icon: LucideIcon
}

export const deliveryMethods: Record<string, DeliveryMethodOption[]> = {
  // Roblox
  roblox: [
    {
      value: 'game_pass',
      label: 'Game Pass',
      description: 'Buyer purchases a game pass you create',
      icon: Crown,
    },
    {
      value: 'in_game_trade',
      label: 'In-game Trade',
      description: 'Direct trade within the game',
      icon: Gamepad2,
    },
    {
      value: 'login_method',
      label: 'Login Method',
      description: 'Provide account credentials for login',
      icon: LogIn,
    },
  ],

  // Animal Crossing
  animal_crossing: [
    {
      value: 'island_delivery',
      label: 'Island Delivery',
      description: 'Deliver items to buyer\'s island',
      icon: Plane,
    },
    {
      value: 'mail_trade',
      label: 'Mail Trade',
      description: 'Send items via in-game mail system',
      icon: Mail,
    },
    {
      value: 'in_game_trade',
      label: 'In-game Trade',
      description: 'Direct trade within the game',
      icon: Gamepad2,
    },
  ],

  // Apex Legends
  apex_legends: [
    {
      value: 'in_game_trade',
      label: 'In-game Trade',
      description: 'Direct trade within the game',
      icon: Gamepad2,
    },
    {
      value: 'gifting',
      label: 'Epic Gifting',
      description: 'Send items via Epic Games gifting system',
      icon: Gift,
    },
    {
      value: 'login_method',
      label: 'Login Method',
      description: 'Provide account credentials for login',
      icon: LogIn,
    },
  ],

  // Fortnite
  fortnite: [
    {
      value: 'gifting',
      label: 'Epic Gifting',
      description: 'Send items via Epic Games gifting system',
      icon: Gift,
    },
    {
      value: 'login_method',
      label: 'Login Method',
      description: 'Provide account credentials for login',
      icon: LogIn,
    },
  ],

  // CS:GO / CS2
  csgo: [
    {
      value: 'in_game_trade',
      label: 'In-game Trade',
      description: 'Direct trade within Steam',
      icon: Gamepad2,
    },
    {
      value: 'market_purchase',
      label: 'Steam Market',
      description: 'Buyer purchases from Steam Community Market',
      icon: ShoppingCart,
    },
  ],

  // Genshin Impact
  genshin_impact: [
    {
      value: 'login_method',
      label: 'Login Method',
      description: 'Provide account credentials for login',
      icon: LogIn,
    },
    {
      value: 'in_game_trade',
      label: 'In-game Trade',
      description: 'Direct trade within the game',
      icon: Gamepad2,
    },
  ],

  // Call of Duty
  call_of_duty: [
    {
      value: 'login_method',
      label: 'Login Method',
      description: 'Provide account credentials for login',
      icon: LogIn,
    },
    {
      value: 'gifting',
      label: 'COD Gifting',
      description: 'Send items via Call of Duty gifting system',
      icon: Gift,
    },
  ],

  // Default fallback for games not specifically configured
  default: [
    {
      value: 'in_game_trade',
      label: 'In-game Trade',
      description: 'Direct trade within the game',
      icon: Gamepad2,
    },
    {
      value: 'login_method',
      label: 'Login Method',
      description: 'Provide account credentials for login',
      icon: LogIn,
    },
    {
      value: 'gifting',
      label: 'Gifting',
      description: 'Send items via in-game gifting system',
      icon: Gift,
    },
  ],
}

/**
 * Get delivery methods for a specific game
 * Falls back to default if game not found
 */
export function getDeliveryMethodsForGame(gameSlug: string): DeliveryMethodOption[] {
  return deliveryMethods[gameSlug] || deliveryMethods.default
}

/**
 * Get delivery method label by value
 */
export function getDeliveryMethodLabel(methodValue: string): string {
  for (const methods of Object.values(deliveryMethods)) {
    const method = methods.find((m) => m.value === methodValue)
    if (method) return method.label
  }
  return methodValue // Return value as fallback
}

/**
 * Get delivery method icon by value
 */
export function getDeliveryMethodIcon(methodValue: string): LucideIcon {
  for (const methods of Object.values(deliveryMethods)) {
    const method = methods.find((m) => m.value === methodValue)
    if (method) return method.icon
  }
  return Gamepad2 // Default icon
}
