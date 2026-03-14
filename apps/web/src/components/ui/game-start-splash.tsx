'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Swords } from 'lucide-react'

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
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200 }}
            className="text-center space-y-4"
          >
            <motion.div
              initial={{ rotate: -20 }}
              animate={{ rotate: 0 }}
              transition={{ type: 'spring', damping: 8 }}
              className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto"
            >
              <Swords className="w-8 h-8 text-accent" />
            </motion.div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              Игра началась!
            </h1>
            <p className="text-base text-white/60">
              Первыми ходят чёрные
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
