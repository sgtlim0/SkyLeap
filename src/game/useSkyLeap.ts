import { useRef, useCallback } from 'react'
import type { GameState, Platform, Particle, Star, Phase } from './types.ts'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRAVITY, JUMP_VELOCITY, SUPER_JUMP, MAX_FALL_SPEED,
  PLAYER_RADIUS, FRICTION_AIR,
  PLATFORM_W, PLATFORM_H,
  PLATFORM_GAP_MIN, PLATFORM_GAP_MAX,
  INITIAL_PLATFORMS, SCROLL_LINE,
  MOVING_PLATFORM_SPEED,
  BREAKABLE_CHANCE, MOVING_CHANCE, SPRING_CHANCE,
} from './types.ts'
import { render } from './renderer.ts'
import { playJump, playSuperJump, playBreak, playGameOver, playMilestone } from './sound.ts'

// ── Helpers ──
function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function generateStars(): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT * 3,
      size: 0.5 + Math.random() * 1.5,
      speed: 0.3 + Math.random() * 0.7,
      alpha: 0.3 + Math.random() * 0.7,
    })
  }
  return stars
}

function makePlatform(x: number, y: number, difficulty: number): Platform {
  const r = Math.random()
  let type: Platform['type'] = 'normal'

  const springChance = SPRING_CHANCE * Math.min(1.5, 0.5 + difficulty * 0.1)
  const movingChance = MOVING_CHANCE * Math.min(2, 0.5 + difficulty * 0.15)
  const breakableChance = BREAKABLE_CHANCE * Math.min(2.5, 0.5 + difficulty * 0.2)

  if (r < springChance) type = 'spring'
  else if (r < springChance + movingChance) type = 'moving'
  else if (r < springChance + movingChance + breakableChance) type = 'breakable'

  return {
    x,
    y,
    w: PLATFORM_W,
    h: PLATFORM_H,
    type,
    vx: type === 'moving' ? MOVING_PLATFORM_SPEED * (Math.random() > 0.5 ? 1 : -1) : 0,
    broken: false,
    breakTimer: 0,
  }
}

function spawnParticles(
  x: number, y: number, count: number, color: string,
): Particle[] {
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 3
    out.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 20 + Math.random() * 15,
      maxLife: 35,
      color,
      size: 2 + Math.random() * 2,
    })
  }
  return out
}

function getMilestone(alt: number): string | null {
  const milestones = [500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000]
  for (const m of milestones) {
    if (alt >= m && alt - 8 < m) return `${m}m!`
  }
  return null
}

// ── Initial state ──
function createInitialState(): GameState {
  const platforms: Platform[] = []
  // Ground platform
  platforms.push({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 40,
    w: PLATFORM_W * 1.5,
    h: PLATFORM_H,
    type: 'normal',
    vx: 0,
    broken: false,
    breakTimer: 0,
  })

  let lastY = CANVAS_HEIGHT - 40
  for (let i = 1; i < INITIAL_PLATFORMS; i++) {
    const gap = rand(PLATFORM_GAP_MIN, PLATFORM_GAP_MAX)
    lastY -= gap
    const x = rand(PLATFORM_W, CANVAS_WIDTH - PLATFORM_W)
    platforms.push(makePlatform(x, lastY, 0))
  }

  return {
    phase: 'title',
    playerX: CANVAS_WIDTH / 2,
    playerY: CANVAS_HEIGHT - 40 - PLAYER_RADIUS - PLATFORM_H / 2,
    playerVX: 0,
    playerVY: 0,
    platforms,
    particles: [],
    stars: generateStars(),
    score: 0,
    bestScore: Number(localStorage.getItem('skyleap_best') || '0'),
    altitude: 0,
    shake: 0,
    levelText: '',
    levelTextLife: 0,
    cameraY: 0,
    combo: 0,
  }
}

// ── Hook ──
export function useSkyLeap() {
  const stateRef = useRef<GameState>(createInitialState())
  const frameRef = useRef(0)
  const rafRef = useRef(0)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const inputXRef = useRef<number | null>(null)
  const prevAltRef = useRef(0)

  const resetGame = useCallback(() => {
    const best = stateRef.current.bestScore
    const s = createInitialState()
    stateRef.current = {
      ...s,
      phase: 'playing',
      bestScore: best,
      playerVY: JUMP_VELOCITY,
    }
    prevAltRef.current = 0
  }, [])

  const handlePointerDown = useCallback((clientX: number, canvasRect: DOMRect) => {
    const s = stateRef.current
    if (s.phase === 'title') {
      resetGame()
      return
    }
    if (s.phase === 'gameover') {
      resetGame()
      return
    }
    // Track touch position for movement
    const scaleX = CANVAS_WIDTH / canvasRect.width
    inputXRef.current = (clientX - canvasRect.left) * scaleX
  }, [resetGame])

  const handlePointerMove = useCallback((clientX: number, canvasRect: DOMRect) => {
    if (stateRef.current.phase !== 'playing') return
    const scaleX = CANVAS_WIDTH / canvasRect.width
    inputXRef.current = (clientX - canvasRect.left) * scaleX
  }, [])

  const handlePointerUp = useCallback(() => {
    inputXRef.current = null
  }, [])

  const tick = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'playing') return

    let { playerX, playerY, playerVX, playerVY } = s
    const platforms = [...s.platforms]
    let particles = [...s.particles]
    let { score, altitude, shake, levelText, levelTextLife, cameraY, combo } = s

    // ── Input → horizontal movement ──
    if (inputXRef.current !== null) {
      const targetX = inputXRef.current
      const diff = targetX - playerX
      playerVX += diff * 0.12
    }
    playerVX *= FRICTION_AIR
    playerX += playerVX

    // Screen wrapping
    if (playerX < -PLAYER_RADIUS) playerX = CANVAS_WIDTH + PLAYER_RADIUS
    if (playerX > CANVAS_WIDTH + PLAYER_RADIUS) playerX = -PLAYER_RADIUS

    // ── Gravity ──
    playerVY += GRAVITY
    if (playerVY > MAX_FALL_SPEED) playerVY = MAX_FALL_SPEED
    playerY += playerVY

    // ── Platform collision (only when falling) ──
    if (playerVY > 0) {
      for (const p of platforms) {
        if (p.broken && p.breakTimer <= 0) continue

        const dx = Math.abs(playerX - p.x)
        const dy = playerY + PLAYER_RADIUS - p.y + p.h / 2

        if (dx < p.w / 2 + PLAYER_RADIUS * 0.3 && dy >= 0 && dy < playerVY + 4) {
          // Landing!
          playerY = p.y - p.h / 2 - PLAYER_RADIUS

          if (p.type === 'breakable') {
            p.broken = true
            p.breakTimer = 15
            playBreak()
            particles = [
              ...particles,
              ...spawnParticles(p.x, p.y, 6, '#dfe6e9'),
            ]
            shake = Math.max(shake, 0.15)
          } else if (p.type === 'spring') {
            playerVY = SUPER_JUMP
            playSuperJump()
            particles = [
              ...particles,
              ...spawnParticles(p.x, p.y, 8, '#ff6b6b'),
            ]
            combo += 1
            shake = Math.max(shake, 0.2)
          } else {
            playerVY = JUMP_VELOCITY
            playJump()
            particles = [
              ...particles,
              ...spawnParticles(p.x, p.y, 4, '#55efc4'),
            ]
            combo += 1
          }
          break
        }
      }
    }

    // ── Move moving platforms ──
    for (const p of platforms) {
      if (p.type === 'moving') {
        p.x += p.vx
        if (p.x < p.w / 2 || p.x > CANVAS_WIDTH - p.w / 2) {
          p.vx *= -1
        }
      }
      // Break timer
      if (p.broken && p.breakTimer > 0) {
        p.breakTimer -= 1
      }
    }

    // ── Camera scroll ──
    const screenY = playerY - cameraY
    if (screenY < SCROLL_LINE) {
      const diff = SCROLL_LINE - screenY
      cameraY -= diff
    }

    // ── Altitude / Score ──
    altitude = Math.max(altitude, -cameraY * 0.5)
    const newScore = Math.floor(altitude / 10)
    if (newScore > score) {
      score = newScore
    }

    // Milestone check
    const milestone = getMilestone(altitude)
    if (milestone) {
      levelText = milestone
      levelTextLife = 60
      playMilestone()
    }

    // ── Generate new platforms above ──
    const topPlatY = Math.min(...platforms.map(p => p.y))
    const difficulty = altitude / 1000
    while (topPlatY > cameraY - 200) {
      const gap = rand(
        PLATFORM_GAP_MIN + Math.min(20, difficulty * 2),
        PLATFORM_GAP_MAX + Math.min(40, difficulty * 4),
      )
      const newY = Math.min(...platforms.map(p => p.y)) - gap
      const newX = rand(PLATFORM_W, CANVAS_WIDTH - PLATFORM_W)
      platforms.push(makePlatform(newX, newY, difficulty))
      if (newY < cameraY - 300) break
    }

    // ── Remove platforms far below ──
    const removeThreshold = cameraY + CANVAS_HEIGHT + 100
    const filtered = platforms.filter(p => p.y < removeThreshold)

    // ── Update particles ──
    particles = particles
      .map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.05,
        life: p.life - 1,
      }))
      .filter(p => p.life > 0)

    // ── Shake decay ──
    if (shake > 0) shake = Math.max(0, shake - 0.04)

    // ── Level text decay ──
    if (levelTextLife > 0) levelTextLife -= 1

    // ── Game over check ──
    const playerScreenY = playerY - cameraY
    let phase: Phase = 'playing'
    if (playerScreenY > CANVAS_HEIGHT + 50) {
      phase = 'gameover'
      playGameOver()
      shake = 0.6

      const newBest = Math.max(s.bestScore, score)
      if (newBest > s.bestScore) {
        localStorage.setItem('skyleap_best', String(newBest))
      }

      stateRef.current = {
        ...s,
        phase,
        playerX, playerY, playerVX, playerVY,
        platforms: filtered,
        particles,
        score,
        bestScore: Math.max(s.bestScore, score),
        altitude,
        shake,
        levelText,
        levelTextLife,
        cameraY,
        combo,
      }
      return
    }

    stateRef.current = {
      ...s,
      phase,
      playerX, playerY, playerVX, playerVY,
      platforms: filtered,
      particles,
      score,
      altitude,
      shake,
      levelText,
      levelTextLife,
      cameraY,
      combo,
    }
  }, [])

  const gameLoop = useCallback(() => {
    frameRef.current += 1
    tick()

    const ctx = ctxRef.current
    if (ctx) {
      render(ctx, stateRef.current, frameRef.current)
    }

    rafRef.current = requestAnimationFrame(gameLoop)
  }, [tick])

  const start = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctxRef.current = ctx
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop])

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  return {
    start,
    stop,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}
