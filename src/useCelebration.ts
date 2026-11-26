import { useEffect, useRef, useState } from 'react'
import { createWinAudio } from './winAudio'
import { createWinCelebration } from './celebration'

export function useCelebration() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const confetti = useRef<ReturnType<typeof createWinCelebration> | null>(null)
  const audio = useRef<ReturnType<typeof createWinAudio> | null>(null)
  const context = useRef<AudioContext | null>(null)
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('glow-trail.muted') === 'true' } catch { return false }
  })
  function stop() {
    confetti.current?.stop()
    audio.current?.stop()
  }
  useEffect(() => () => {
    stop()
    if (context.current) void context.current.close()
    context.current = null
  }, [])
  function play() {
    if (canvas.current) {
      confetti.current ??= createWinCelebration(canvas.current)
      confetti.current.play()
    }
    if (!muted && typeof AudioContext !== 'undefined') {
      try {
        context.current ??= new AudioContext()
        audio.current ??= createWinAudio()
        void audio.current.play(context.current)
      } catch { /* Visual feedback is available even when audio is disabled. */ }
    }
  }
  function toggleSound() {
    if (!muted) audio.current?.stop()
    setMuted(!muted)
    try { localStorage.setItem('glow-trail.muted', String(!muted)) } catch { /* Storage is optional. */ }
  }
  return { canvas, play, stop, toggleSound, muted }
}
