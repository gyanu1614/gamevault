'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Search, ShoppingCart, User, LogOut, Menu, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { NavbarMenu, MenuItem, MenuItemWithDropdown, MegaMenu } from '@/components/ui/navbar-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { logout } from '@/lib/actions/auth'
import { getGames, getCategories } from '@/lib/api/listings'

export function Navbar() {
  const { user, loading } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Fetch games and categories
  const { data: gamesData } = useQuery({
    queryKey: ['games'],
    queryFn: getGames,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  // Fallback static data in case database isn't populated yet
  const staticCategories = [
    { id: '1', name: 'Currency', slug: 'currency', icon: '💰', description: null, created_at: '' },
    { id: '2', name: 'Accounts', slug: 'accounts', icon: '👤', description: null, created_at: '' },
    { id: '3', name: 'Items', slug: 'items', icon: '🎒', description: null, created_at: '' },
    { id: '4', name: 'Boosting', slug: 'boosting', icon: '🚀', description: null, created_at: '' },
  ]

  const staticGames = [
    { id: '1', name: 'Roblox', slug: 'roblox', emoji: '🎮', image_url: null, description: null, is_active: true, created_at: '' },
    { id: '2', name: 'Fortnite', slug: 'fortnite', emoji: '⚔️', image_url: null, description: null, is_active: true, created_at: '' },
    { id: '3', name: 'Valorant', slug: 'valorant', emoji: '🔫', image_url: null, description: null, is_active: true, created_at: '' },
    { id: '4', name: 'GTA V', slug: 'gta-v', emoji: '🚗', image_url: null, description: null, is_active: true, created_at: '' },
    { id: '5', name: 'Minecraft', slug: 'minecraft', emoji: '⛏️', image_url: null, description: null, is_active: true, created_at: '' },
    { id: '6', name: 'League of Legends', slug: 'lol', emoji: '⚡', image_url: null, description: null, is_active: true, created_at: '' },
  ]

  const games = (gamesData?.data && gamesData.data.length > 0
    ? gamesData.data
    : staticGames) as any[]
  const categories = (categoriesData?.data && categoriesData.data.length > 0
    ? categoriesData.data
    : staticCategories) as any[]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `/browse?search=${encodeURIComponent(searchQuery)}`
    }
  }

  return (
    <>
      <NavbarMenu className="rounded-none border-b shadow-sm">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">G</span>
          </div>
          <span className="hidden font-bold sm:inline-block">GameVault</span>
        </Link>

        {/* Categories */}
        <MenuItem className="hidden md:flex">
          {categories.slice(0, 4).map((category) => (
            <MenuItemWithDropdown key={category.id} item={category.name}>
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    Popular Games
                  </h3>
                  <Link
                    href={`/browse?category=${category.slug}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View all {category.name} →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {games.slice(0, 6).map((game) => (
                    <Link
                      key={game.id}
                      href={`/browse?game=${game.slug}&category=${category.slug}`}
                      className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
                    >
                      {game.emoji && <span className="text-2xl">{game.emoji}</span>}
                      <span className="text-sm font-medium">{game.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </MenuItemWithDropdown>
          ))}

          {/* Browse All Link */}
          <Link
            href="/browse"
            className="px-4 py-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            Browse All
          </Link>
        </MenuItem>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search GameVault"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-10"
              />
            </div>
          </form>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">Menu</span>
          </Button>

          {/* Cart */}
          <Link href="/cart" className="hidden sm:block">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="sr-only">Shopping cart</span>
              {/* Cart count badge */}
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                0
              </span>
            </Button>
          </Link>

          {/* User/Auth */}
          {loading ? (
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="icon">
                  {user.profile?.avatar_url ? (
                    <img
                      src={user.profile.avatar_url}
                      alt={user.profile.username}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
                      {user.profile?.username?.[0]?.toUpperCase() || <User className="h-5 w-5" />}
                    </div>
                  )}
                  <span className="sr-only">Profile</span>
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logout</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign up</Button>
              </Link>
            </div>
          )}
        </div>
      </NavbarMenu>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-16 z-40 border-b bg-background md:hidden">
          <div className="container px-4 py-6">
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search GameVault"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>

            {/* Categories */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Categories
              </h3>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/browse?category=${category.slug}`}
                  className="block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {category.icon} {category.name}
                </Link>
              ))}
              <Link
                href="/browse"
                className="block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                Browse All
              </Link>
            </div>

            {/* Mobile Auth Links */}
            {!loading && !user && (
              <div className="mt-6 space-y-2">
                <Link href="/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Log in
                  </Button>
                </Link>
                <Link href="/signup" className="block" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Sign up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spacer for fixed navbar */}
      <div className="h-16" />
    </>
  )
}
