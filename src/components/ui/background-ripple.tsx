'use client'

import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DivGridProps {
  rows: number
  cols: number
  cellSize: number
  borderColor: string
  fillColor: string
  clickedCell?: { row: number; col: number } | null
  onCellClick?: (row: number, col: number) => void
  interactive?: boolean
  className?: string
}

interface BackgroundRippleEffectProps {
  rows?: number
  cols?: number
  cellSize?: number
}

export const DivGrid: React.FC<DivGridProps> = ({
  rows,
  cols,
  cellSize,
  borderColor,
  fillColor,
  clickedCell,
  onCellClick,
  interactive = false,
  className,
}) => {
  const gridWidth = cols * cellSize
  const gridHeight = rows * cellSize

  const handleCellClick = (row: number, col: number) => {
    if (onCellClick && interactive) {
      onCellClick(row, col)
    }
  }

  const cells = Array.from({ length: rows * cols }).map((_, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const isClicked =
      clickedCell && clickedCell.row === row && clickedCell.col === col

    return (
      <motion.div
        key={`${row}-${col}`}
        className="absolute cursor-pointer"
        style={{
          width: cellSize,
          height: cellSize,
          left: col * cellSize,
          top: row * cellSize,
          border: `1px solid ${borderColor}`,
          backgroundColor: fillColor,
        }}
        onClick={() => handleCellClick(row, col)}
        animate={
          isClicked
            ? {
                opacity: [0.4, 0.8, 0.4],
              }
            : {}
        }
        transition={
          isClicked
            ? {
                duration: 0.2,
                ease: 'easeOut',
              }
            : {}
        }
      />
    )
  })

  return (
    <div
      className={cn('relative', className)}
      style={{
        width: gridWidth,
        height: gridHeight,
      }}
    >
      {cells}
    </div>
  )
}

export const BackgroundRippleEffect: React.FC<
  BackgroundRippleEffectProps
> = ({ rows = 12, cols = 40, cellSize = 50 }) => {
  const [clickedCell, setClickedCell] = useState<{
    row: number
    col: number
  } | null>(null)

  const handleCellClick = useCallback((row: number, col: number) => {
    setClickedCell({ row, col })
    setTimeout(() => setClickedCell(null), 200)
  }, [])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      <DivGrid
        rows={rows}
        cols={cols}
        cellSize={cellSize}
        borderColor="rgba(139, 92, 246, 0.1)"
        fillColor="rgba(139, 92, 246, 0.02)"
        clickedCell={clickedCell}
        onCellClick={handleCellClick}
        interactive={true}
        className="absolute inset-0 flex items-center justify-center"
      />
    </div>
  )
}
