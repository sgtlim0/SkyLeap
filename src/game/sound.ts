let audioCtx: AudioContext | null = null

function ctx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playTone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.1) {
  try {
    const ac = ctx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(vol, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + dur)
  } catch { /* */ }
}

function vibrate(ms: number | number[]) {
  try { navigator?.vibrate?.(ms) } catch { /* */ }
}

export function playJump() {
  playTone(440, 0.08, 'sine', 0.07)
  playTone(660, 0.06, 'sine', 0.05)
  vibrate(4)
}

export function playWeakJump() {
  playTone(300, 0.06, 'sine', 0.05)
  vibrate(3)
}

export function playSuperJump() {
  playTone(500, 0.06, 'sine', 0.09)
  setTimeout(() => playTone(700, 0.06, 'sine', 0.09), 40)
  setTimeout(() => playTone(900, 0.08, 'sine', 0.11), 80)
  vibrate(10)
}

export function playBreak() {
  playTone(200, 0.12, 'square', 0.05)
  playTone(150, 0.15, 'square', 0.04)
  vibrate([8, 20, 8])
}

export function playGameOver() {
  playTone(400, 0.3, 'sawtooth', 0.07)
  setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.07), 150)
  setTimeout(() => playTone(180, 0.5, 'sawtooth', 0.09), 300)
  vibrate([30, 50, 30, 50, 60])
}

export function playMilestone() {
  const notes = [600, 750, 900]
  notes.forEach((f, i) => setTimeout(() => playTone(f, 0.1, 'sine', 0.09), i * 60))
  vibrate([10, 15, 10])
}

export function playCombo(level: number) {
  const baseFreq = 500 + Math.min(level, 8) * 80
  playTone(baseFreq, 0.06, 'sine', 0.06)
  setTimeout(() => playTone(baseFreq + 200, 0.05, 'sine', 0.05), 30)
  vibrate(6)
}
