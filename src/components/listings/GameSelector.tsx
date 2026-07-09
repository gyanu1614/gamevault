/**
 * GameSelector Component
 *
 * Scalable game selection component that adapts based on the number of games:
 * - Grid view for 5-10 games (current)
 * - Searchable dropdown for 50+ games (future)
 *
 * Features:
 * - Auto-switches UI mode based on game count
 * - Search/filter for large game lists
 * - Popular games section
 * - Responsive design
 */

'use client'

import { useState, useMemo } from 'react'
import { Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface Game {
  id: string
  name: string
  slug: string
  emoji?: string
  image?: string
  image_url?: string
  is_active: boolean
  is_featured?: boolean
}

interface GameSelectorProps {
  games: Game[]
  selectedGameId: string
  onSelectGame: (gameId: string) => void
  mode?: 'auto' | 'grid' | 'dropdown'
  className?: string
}

const GRID_MODE_THRESHOLD = 12 // Switch to dropdown after 12 games

export default function GameSelector({
  games,
  selectedGameId,
  onSelectGame,
  mode = 'auto',
  className,
}: GameSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Determine display mode
  const displayMode = useMemo(() => {
    if (mode !== 'auto') return mode
    return games.length <= GRID_MODE_THRESHOLD ? 'grid' : 'dropdown'
  }, [games.length, mode])

  // Filter games based on search
  const filteredGames = useMemo(() => {
    if (!searchQuery) return games
    const query = searchQuery.toLowerCase()
    return games.filter((game) => game.name.toLowerCase().includes(query))
  }, [games, searchQuery])

  // Separate featured and regular games
  const { featuredGames, regularGames } = useMemo(() => {
    const featured = filteredGames.filter((g) => g.is_featured)
    const regular = filteredGames.filter((g) => !g.is_featured)
    return { featuredGames: featured, regularGames: regular }
  }, [filteredGames])

  const selectedGame = games.find((g) => g.id === selectedGameId)

  // Grid View (for 5-12 games)
  if (displayMode === 'grid') {
    return (
      <div className={className}>
        <label className="mb-3 block text-sm font-medium text-text-secondary">
          Select Game <span className="text-error">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {games.map((game) => {
            const imageUrl = game.image_url || game.image
            return (
              <button
                key={game.id}
                onClick={() => onSelectGame(game.id)}
                className={cn(
                  'group relative overflow-hidden rounded-lg border-2 p-3 transition-all',
                  selectedGameId === game.id
                    ? 'border-primary bg-primary/20 scale-105'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:scale-102'
                )}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={game.name}
                    className="mx-auto mb-2 h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <div className="mx-auto mb-2 text-2xl">{game.emoji || '🎮'}</div>
                )}
                <div className="text-xs font-medium text-white">{game.name}</div>
                {selectedGameId === game.id && (
                  <div className="absolute right-1 top-1 rounded-full bg-primary p-1">
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

  // Dropdown View (for 50+ games)
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-text-secondary">
        Select Game <span className="text-error">*</span>
      </label>

      {/* Selected Game Display / Dropdown Trigger */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={cn(
          'relative w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left transition-all',
          isDropdownOpen ? 'border-primary ring-2 ring-primary/20' : 'hover:border-white/20'
        )}
      >
        {selectedGame ? (
          <div className="flex items-center gap-3">
            {selectedGame.image_url || selectedGame.image ? (
              <img
                src={selectedGame.image_url || selectedGame.image}
                alt={selectedGame.name}
                className="h-6 w-6 rounded object-cover"
              />
            ) : (
              <span className="text-xl">{selectedGame.emoji || '🎮'}</span>
            )}
            <span className="font-medium text-white">{selectedGame.name}</span>
          </div>
        ) : (
          <span className="text-text-secondary">Select a game...</span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isDropdownOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsDropdownOpen(false)}
            />

            {/* Dropdown Content */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 mt-2 w-full max-w-md rounded-lg border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl"
            >
              {/* Search Bar */}
              <div className="border-b border-white/10 p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search games..."
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Game List */}
              <div className="max-h-96 overflow-y-auto p-2">
                {/* Featured Games Section */}
                {featuredGames.length > 0 && !searchQuery && (
                  <>
                    <div className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                      Popular Games
                    </div>
                    {featuredGames.map((game) => (
                      <GameOption
                        key={game.id}
                        game={game}
                        isSelected={selectedGameId === game.id}
                        onClick={() => {
                          onSelectGame(game.id)
                          setIsDropdownOpen(false)
                          setSearchQuery('')
                        }}
                      />
                    ))}
                  </>
                )}

                {/* All Games Section */}
                {regularGames.length > 0 && (
                  <>
                    {featuredGames.length > 0 && !searchQuery && (
                      <div className="my-2 border-t border-white/10" />
                    )}
                    {!searchQuery && regularGames.length > 0 && (
                      <div className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                        All Games
                      </div>
                    )}
                    {regularGames.map((game) => (
                      <GameOption
                        key={game.id}
                        game={game}
                        isSelected={selectedGameId === game.id}
                        onClick={() => {
                          onSelectGame(game.id)
                          setIsDropdownOpen(false)
                          setSearchQuery('')
                        }}
                      />
                    ))}
                  </>
                )}

                {/* No Results */}
                {filteredGames.length === 0 && (
                  <div className="py-8 text-center text-sm text-text-secondary">
                    No games found for "{searchQuery}"
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// Game Option Component
function GameOption({
  game,
  isSelected,
  onClick,
}: {
  game: Game
  isSelected: boolean
  onClick: () => void
}) {
  const imageUrl = game.image_url || game.image

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all',
        isSelected
          ? 'bg-primary/20 text-white'
          : 'text-text-secondary hover:bg-white/5 hover:text-white'
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={game.name} className="h-8 w-8 rounded object-cover" />
      ) : (
        <span className="text-2xl">{game.emoji || '🎮'}</span>
      )}
      <span className="flex-1 font-medium">{game.name}</span>
      {isSelected && <Check className="h-4 w-4 text-primary" />}
    </button>
  )
}
