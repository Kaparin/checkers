'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Shield, LogOut } from 'lucide-react'

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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4"
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-warning" />
            </div>
            <h3 className="text-lg font-bold text-text">Покинуть игру?</h3>
            <p className="text-sm text-text-secondary">
              Если вы покинете игру, через 30 секунд вам будет засчитано поражение, а соперник получит выигрыш.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 bg-accent text-white font-medium rounded-xl hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Остаться
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 border border-danger/30 text-danger font-medium rounded-xl hover:bg-danger/5 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Покинуть
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
