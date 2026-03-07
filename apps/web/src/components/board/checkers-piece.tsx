'use client'

import { motion } from 'framer-motion'
import type { PieceColor, PieceType } from '@checkers/shared'

interface CheckersPieceProps {
  color: PieceColor
  type: PieceType
  isSelected: boolean
  isClickable: boolean
}

export function CheckersPiece({ color, type, isSelected, isClickable }: CheckersPieceProps) {
  const isBlack = color === 'black'
  const isKing = type === 'king'

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: isSelected ? 1.1 : 1,
        opacity: 1,
        y: isSelected ? -4 : 0,
      }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`
        relative w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full
        flex items-center justify-center
        ${isClickable ? 'cursor-pointer' : 'cursor-default'}
        ${isSelected ? 'z-10' : ''}
      `}
      style={{
        background: isBlack
          ? 'radial-gradient(circle at 35% 35%, #3a3a5c, #1a1a2e)'
          : 'radial-gradient(circle at 35% 35%, #ffffff, #d4d4d4)',
        boxShadow: isSelected
          ? `0 6px 16px rgba(0,0,0,0.4), 0 0 0 3px var(--color-accent)`
          : '0 3px 8px rgba(0,0,0,0.3)',
        border: isBlack ? '2px solid #2a2a4e' : '2px solid #c0c0c0',
      }}
    >
      {/* Inner ring for depth */}
      <div
        className="absolute inset-[3px] rounded-full"
        style={{
          border: isBlack ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
        }}
      />

      {/* King crown */}
      {isKing && (
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 sm:w-6 sm:h-6 ${isBlack ? 'text-yellow-400' : 'text-yellow-600'}`}
          fill="currentColor"
        >
          <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" />
        </svg>
      )}
    </motion.div>
  )
}
