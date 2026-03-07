'use client'

import { useState, useEffect } from 'react'

export interface BoardTheme {
  id: string
  name: string
  light: string
  dark: string
  highlightFrom: string
  highlightTo: string
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    light: '#f0d9b5',
    dark: '#b58863',
    highlightFrom: 'rgba(180, 130, 60, 0.6)',
    highlightTo: 'rgba(180, 130, 60, 0.6)',
  },
  {
    id: 'walnut',
    name: 'Walnut',
    light: '#e8d5b5',
    dark: '#8b6914',
    highlightFrom: 'rgba(139, 105, 20, 0.5)',
    highlightTo: 'rgba(139, 105, 20, 0.5)',
  },
  {
    id: 'marble',
    name: 'Marble',
    light: '#f0ece8',
    dark: '#a8a29e',
    highlightFrom: 'rgba(168, 162, 158, 0.5)',
    highlightTo: 'rgba(168, 162, 158, 0.5)',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    light: '#eeeed2',
    dark: '#769656',
    highlightFrom: 'rgba(118, 150, 86, 0.5)',
    highlightTo: 'rgba(118, 150, 86, 0.5)',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    light: '#dee3e6',
    dark: '#4b7399',
    highlightFrom: 'rgba(75, 115, 153, 0.5)',
    highlightTo: 'rgba(75, 115, 153, 0.5)',
  },
]

export function useBoardTheme() {
  const [themeId, setThemeId] = useState('classic')

  useEffect(() => {
    const saved = localStorage.getItem('board_theme')
    if (saved && BOARD_THEMES.find(t => t.id === saved)) {
      setThemeId(saved)
    }
  }, [])

  const setTheme = (id: string) => {
    setThemeId(id)
    localStorage.setItem('board_theme', id)
  }

  const theme = BOARD_THEMES.find(t => t.id === themeId) || BOARD_THEMES[0]

  return { theme, themeId, setTheme, themes: BOARD_THEMES }
}
