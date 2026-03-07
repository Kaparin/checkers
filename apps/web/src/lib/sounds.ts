/**
 * Game sound effects using Web Audio API
 * No external files needed — synthesized tones
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Audio not available
  }
}

export function playMoveSound() {
  playTone(600, 0.1, 'sine', 0.12)
}

export function playCaptureSound() {
  playTone(300, 0.15, 'square', 0.1)
  setTimeout(() => playTone(400, 0.1, 'square', 0.08), 100)
}

export function playKingSound() {
  playTone(523, 0.12, 'sine', 0.15) // C5
  setTimeout(() => playTone(659, 0.12, 'sine', 0.15), 120) // E5
  setTimeout(() => playTone(784, 0.15, 'sine', 0.15), 240) // G5
}

export function playGameOverSound(won: boolean) {
  if (won) {
    playTone(523, 0.15, 'sine', 0.2)
    setTimeout(() => playTone(659, 0.15, 'sine', 0.2), 150)
    setTimeout(() => playTone(784, 0.15, 'sine', 0.2), 300)
    setTimeout(() => playTone(1047, 0.3, 'sine', 0.2), 450)
  } else {
    playTone(400, 0.2, 'sine', 0.15)
    setTimeout(() => playTone(350, 0.2, 'sine', 0.15), 200)
    setTimeout(() => playTone(300, 0.3, 'sine', 0.15), 400)
  }
}

export function playTickSound() {
  playTone(1000, 0.05, 'sine', 0.08)
}
