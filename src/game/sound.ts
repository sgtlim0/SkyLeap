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
  playTone(440, 0.08, 'sine', 0.08)
  playTone(660, 0.08, 'sine', 0.06)
  vibrate(5)
}

export function playSuperJump() {
  playTone(500, 0.06, 'sine', 0.1)
  setTimeout(() => playTone(700, 0.06, 'sine', 0.1), 40)
  setTimeout(() => playTone(900, 0.08, 'sine', 0.12), 80)
  vibrate(10)
}

export function playBreak() {
  playTone(200, 0.12, 'square', 0.06)
  playTone(150, 0.15, 'square', 0.05)
  vibrate([8, 20, 8])
}

export function playGameOver() {
  playTone(400, 0.3, 'sawtooth', 0.08)
  setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.08), 150)
  setTimeout(() => playTone(180, 0.5, 'sawtooth', 0.1), 300)
  vibrate([30, 50, 30, 50, 60])
}

export function playMilestone() {
  const notes = [600, 750, 900]
  notes.forEach((f, i) => setTimeout(() => playTone(f, 0.1, 'sine', 0.1), i * 60))
  vibrate([10, 15, 10])
}
