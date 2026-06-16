/**
 * PlatformSelector Component
 *
 * Displays platform selection for categories that require it
 * (GTA accounts, Fortnite V-Bucks, Minecraft accounts, etc.)
 * Reads available platforms from category metadata
 */

'use client'

import { Check, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlatformSelectorProps {
  platforms: string[]
  selectedPlatform: string
  onSelectPlatform: (platform: string) => void
  className?: string
  label?: string
}

const platformIcons: Record<string, string> = {
  PC: '💻',
  PlayStation: '🎮',
  'PlayStation 5': '🎮',
  'PlayStation 4': '🎮',
  Xbox: '🎮',
  'Xbox Series X/S': '🎮',
  'Xbox One': '🎮',
  'Nintendo Switch': '🎮',
  Mobile: '📱',
  'Java Edition': '☕',
  'Bedrock Edition': '🪨',
  Both: '⭐',
}

export default function PlatformSelector({
  platforms,
  selectedPlatform,
  onSelectPlatform,
  className,
  label = 'Platform',
}: PlatformSelectorProps) {
  if (platforms.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-text-secondary">
        <Monitor className="h-4 w-4" />
        {label} <span className="text-error">*</span>
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {platforms.map((platform) => {
          const isSelected = selectedPlatform === platform
          const icon = platformIcons[platform] || '🎮'

          return (
            <button
              key={platform}
              onClick={() => onSelectPlatform(platform)}
              className={cn(
                'relative flex items-center gap-2 rounded-lg border-2 p-3 transition-all',
                isSelected
                  ? 'border-primary bg-primary/20'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              )}
            >
              <span className="text-xl">{icon}</span>
              <span className="text-sm font-medium text-white">{platform}</span>

              {isSelected && (
                <div className="absolute right-2 top-2 rounded-full bg-primary p-1">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
