'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface GameStartSplashProps {
  show: boolean
  onDone: () => void
}

export function GameStartSplash({ show, onDone }: GameStartSplashProps) {
  useEffect(() => {
    if (!show) return
    const timer = setTimeout(onDone, 2500)
    return () => clearTimeout(timer)
  }, [show, onDone])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200 }}
            className="text-center space-y-3"
          >
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
              Игра началась!
            </h1>
            <p className="text-lg text-white/70">
              Первыми ходят чёрные
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
