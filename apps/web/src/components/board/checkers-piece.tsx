'use client'

import { motion } from 'framer-motion'
import type { PieceColor, PieceType } from '@checkers/shared'

interface CheckersPieceProps {
  color: PieceColor
  type: PieceType
  isSelected: boolean
  isClickable: boolean
  isDragging?: boolean
  size?: 'normal' | 'small'
}

export function CheckersPiece({ color, type, isSelected, isClickable, isDragging, size = 'normal' }: CheckersPieceProps) {
  const isBlack = color === 'black'
  const isKing = type === 'king'
  const sizeClass = size === 'small' ? 'w-[70%]' : 'w-[80%]'

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: isSelected ? 1.08 : 1,
        opacity: isDragging ? 0.3 : 1,
        y: isSelected && !isDragging ? -3 : 0,
      }}
      exit={{ scale: 0.4, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`
        relative ${sizeClass} aspect-square rounded-full
        flex items-center justify-center
        ${isClickable ? 'cursor-pointer' : 'cursor-default'}
        ${isSelected ? 'z-10' : ''}
      `}
      style={{
        background: isBlack
          ? 'radial-gradient(circle at 38% 32%, #4a4a6e, #222240, #111128)'
          : 'radial-gradient(circle at 38% 32%, #ffffff, #e8e4de, #ccc8c0)',
        boxShadow: isSelected
          ? `0 6px 20px rgba(0,0,0,0.6), 0 0 0 3px var(--color-accent), 0 0 12px rgba(124,58,237,0.4)`
          : isBlack
            ? '0 4px 10px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.08)'
            : '0 4px 10px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.5)',
        border: isBlack ? '2px solid #333358' : '2px solid #b8b4ac',
      }}
    >
      {/* Top highlight ring */}
      <div
        className="absolute inset-[3px] rounded-full"
        style={{
          background: isBlack
            ? 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.08), transparent 60%)'
            : 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.6), transparent 60%)',
        }}
      />

      {/* Inner groove for depth */}
      <div
        className="absolute inset-[15%] rounded-full"
        style={{
          border: isBlack
            ? '1.5px solid rgba(255,255,255,0.06)'
            : '1.5px solid rgba(0,0,0,0.06)',
          background: isBlack
            ? 'radial-gradient(circle at 40% 35%, rgba(80,80,120,0.3), transparent)'
            : 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.3), transparent)',
        }}
      />

      {/* King crown */}
      {isKing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="w-[45%] h-[45%] drop-shadow-sm"
            fill={isBlack ? '#fbbf24' : '#d97706'}
            stroke={isBlack ? '#f59e0b' : '#b45309'}
            strokeWidth={0.5}
          >
            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" />
          </svg>
        </div>
      )}
    </motion.div>
  )
}
