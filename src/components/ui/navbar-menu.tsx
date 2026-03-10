'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const NavbarMenu = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b border-border/40 bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {children}
        </div>
      </div>
    </nav>
  )
}

export const MenuItem = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  return (
    <div className={cn('flex items-center gap-6', className)}>
      {children}
    </div>
  )
}

export const MenuItemWithDropdown = ({
  item,
  children,
}: {
  item: string
  children: React.ReactNode
}) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button className="px-4 py-2 text-sm font-medium text-foreground transition-colors hover:text-primary">
        {item}
      </button>
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 top-full pt-2"
          >
            <div className="min-w-[600px] rounded-lg border bg-background p-6 shadow-xl">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const MegaMenu = ({
  title,
  items,
}: {
  title: string
  items: Array<{
    id: string
    name: string
    slug: string
    emoji?: string
    icon?: React.ReactNode
  }>
}) => {
  return (
    <div>
      <h3 className="mb-4 text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/browse?game=${item.slug}`}
            className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
          >
            {item.emoji && <span className="text-2xl">{item.emoji}</span>}
            {item.icon && item.icon}
            <span className="text-sm font-medium">{item.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
