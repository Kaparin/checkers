'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface LeaveGameModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function LeaveGameModal({ open, onConfirm, onCancel }: LeaveGameModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-bg-card border border-border rounded-2xl shadow-xl p-6 max-w-sm w-full text-center space-y-4"
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold">Покинуть игру?</h3>
            <p className="text-sm text-text-secondary">
              Вы покинете игру. Ваши средства автоматически вернутся через определённое время.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 bg-accent text-white font-medium rounded-xl hover:bg-accent-hover transition-colors"
              >
                Остаться
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 border border-danger/30 text-danger font-medium rounded-xl hover:bg-danger/5 transition-colors"
              >
                Покинуть
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
