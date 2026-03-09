'use client'

import { useState } from 'react'
import { CheckersBoard } from '@/components/board/checkers-board'
import { GameLobby } from '@/components/layout/game-lobby'
import { WalletSetup } from '@/components/ui/wallet-setup'
import { LobbyChat } from '@/components/ui/lobby-chat'
import { AnnouncementsBanner } from '@/components/ui/announcements-banner'

export default function HomePage() {
  const [activeGame, setActiveGame] = useState<string | null>(null)

  if (activeGame) {
    return (
      <div className="flex flex-col items-center gap-6">
        <button
          onClick={() => setActiveGame(null)}
          className="self-start text-sm text-text-secondary hover:text-text transition-colors"
        >
          &larr; Back to lobby
        </button>
        <CheckersBoard gameId={activeGame} />
      </div>
    )
  }

  return (
    <>
      <AnnouncementsBanner />
      <WalletSetup />
      <GameLobby onJoinGame={setActiveGame} />
      <LobbyChat />
    </>
  )
}
