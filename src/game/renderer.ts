import type { GameState, Platform, Particle } from './types.ts'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  PLAYER_RADIUS,
} from './types.ts'

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)
const SHADOW = isMobile ? 0.3 : 1

// ── Sky gradient based on altitude ──
function getSkyColors(alt: number): [string, string, string] {
  if (alt < 500) return ['#87CEEB', '#B0E0FF', '#E0F2FE']
  if (alt < 2000) return ['#5BA3D9', '#87CEEB', '#B0E0FF']
  if (alt < 5000) return ['#2D6AA0', '#4A90C4', '#87CEEB']
  if (alt < 10000) return ['#1A1A4E', '#2D3A8C', '#4A6CC4']
  return ['#0A0A2E', '#141450', '#1A1A6E']
}

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState, frame: number) {
  const [top, mid, bot] = getSkyColors(state.altitude)
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
  grad.addColorStop(0, top)
  grad.addColorStop(0.5, mid)
  grad.addColorStop(1, bot)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Stars (visible at high altitude)
  if (state.altitude > 3000) {
    const starAlpha = Math.min(1, (state.altitude - 3000) / 5000)
    for (const s of state.stars) {
      const screenY = s.y - state.cameraY * s.speed * 0.01
      const wrappedY = ((screenY % CANVAS_HEIGHT) + CANVAS_HEIGHT) % CANVAS_HEIGHT
      ctx.save()
      ctx.globalAlpha = s.alpha * starAlpha * (0.5 + Math.sin(frame * 0.03 + s.x) * 0.5)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(s.x, wrappedY, s.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  // Clouds (fade out at very high altitude)
  if (state.altitude < 8000) {
    const cloudAlpha = Math.max(0, 1 - state.altitude / 8000) * 0.3
    ctx.save()
    ctx.globalAlpha = cloudAlpha
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 5; i++) {
      const seed = i * 173.7
      const cx = (seed * 2.3 + frame * 0.15 * (0.5 + i * 0.1)) % (CANVAS_WIDTH + 100) - 50
      const cy = (seed * 3.1 - state.cameraY * 0.05 * (0.3 + i * 0.1)) % CANVAS_HEIGHT
      drawCloud(ctx, cx, ((cy % CANVAS_HEIGHT) + CANVAS_HEIGHT) % CANVAS_HEIGHT, 30 + i * 10)
    }
    ctx.restore()
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath()
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2)
  ctx.arc(x + size * 0.3, y - size * 0.15, size * 0.4, 0, Math.PI * 2)
  ctx.arc(x + size * 0.6, y, size * 0.35, 0, Math.PI * 2)
  ctx.arc(x - size * 0.2, y + size * 0.05, size * 0.3, 0, Math.PI * 2)
  ctx.fill()
}

// ── Platforms ──
function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, cameraY: number) {
  const screenY = p.y - cameraY
  if (screenY < -20 || screenY > CANVAS_HEIGHT + 20) return
  if (p.broken && p.breakTimer <= 0) return

  ctx.save()

  let alpha = 1
  if (p.broken) {
    alpha = Math.max(0, p.breakTimer / 15)
    ctx.globalAlpha = alpha
  }

  const x = p.x - p.w / 2
  const y = screenY - p.h / 2
  const r = 5

  // Platform body
  ctx.beginPath()
  ctx.roundRect(x, y, p.w, p.h, r)

  if (p.type === 'spring') {
    const grad = ctx.createLinearGradient(x, y, x, y + p.h)
    grad.addColorStop(0, '#ff6b6b')
    grad.addColorStop(1, '#ee5a24')
    ctx.fillStyle = grad
    ctx.shadowColor = '#ff6b6b'
    ctx.shadowBlur = 8 * SHADOW
  } else if (p.type === 'moving') {
    const grad = ctx.createLinearGradient(x, y, x, y + p.h)
    grad.addColorStop(0, '#74b9ff')
    grad.addColorStop(1, '#0984e3')
    ctx.fillStyle = grad
    ctx.shadowColor = '#74b9ff'
    ctx.shadowBlur = 6 * SHADOW
  } else if (p.type === 'breakable') {
    ctx.fillStyle = p.broken ? '#a29bfe' : '#dfe6e9'
    ctx.shadowColor = '#b2bec3'
    ctx.shadowBlur = 3 * SHADOW
    // Crack lines
    if (!p.broken) {
      ctx.fill()
      ctx.strokeStyle = 'rgba(99,110,114,0.4)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(x + p.w * 0.3, y)
      ctx.lineTo(x + p.w * 0.4, y + p.h)
      ctx.moveTo(x + p.w * 0.7, y)
      ctx.lineTo(x + p.w * 0.6, y + p.h)
      ctx.stroke()
      ctx.restore()
      return
    }
  } else {
    const grad = ctx.createLinearGradient(x, y, x, y + p.h)
    grad.addColorStop(0, '#55efc4')
    grad.addColorStop(1, '#00b894')
    ctx.fillStyle = grad
    ctx.shadowColor = '#55efc4'
    ctx.shadowBlur = 5 * SHADOW
  }

  ctx.fill()

  // Top highlight
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.beginPath()
  ctx.roundRect(x + 2, y + 1, p.w - 4, p.h * 0.4, [r, r, 0, 0])
  ctx.fill()

  // Spring indicator
  if (p.type === 'spring') {
    ctx.fillStyle = '#ffeaa7'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('^^', p.x, screenY - 2)
  }

  ctx.restore()
}

// ── Player ──
function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState, frame: number) {
  const screenY = state.playerY - state.cameraY
  const px = state.playerX
  const r = PLAYER_RADIUS

  ctx.save()
  ctx.translate(px, screenY)

  // Tilt based on velocity
  const tilt = state.playerVX * 0.04
  ctx.rotate(tilt)

  // Shadow underneath
  ctx.save()
  ctx.globalAlpha = 0.15
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(0, r + 4, r * 0.8, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Body glow
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 12 * SHADOW

  // Body
  const bodyGrad = ctx.createRadialGradient(-3, -4, 0, 0, 0, r * 1.2)
  bodyGrad.addColorStop(0, '#fde68a')
  bodyGrad.addColorStop(0.5, '#fbbf24')
  bodyGrad.addColorStop(1, '#d97706')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowBlur = 0

  // Face
  ctx.fillStyle = '#78350f'
  // Eyes
  const blink = Math.sin(frame * 0.08) > 0.95
  if (blink) {
    ctx.fillRect(-5, -4, 4, 1.5)
    ctx.fillRect(2, -4, 4, 1.5)
  } else {
    ctx.beginPath()
    ctx.arc(-3, -3, 2, 0, Math.PI * 2)
    ctx.arc(4, -3, 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Mouth (smile when going up, O when falling)
  if (state.playerVY < -2) {
    ctx.beginPath()
    ctx.arc(0, 3, 3, 0, Math.PI)
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 1.5
    ctx.stroke()
  } else if (state.playerVY > 4) {
    ctx.beginPath()
    ctx.arc(0, 4, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = '#78350f'
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(0, 3, 3, 0.1, Math.PI - 0.1)
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // Trail particles when going up fast
  if (state.playerVY < -6) {
    ctx.globalAlpha = Math.min(1, Math.abs(state.playerVY) / 15) * 0.4
    for (let i = 0; i < 3; i++) {
      const ty = r + 8 + i * 6 + Math.random() * 4
      const tx = (Math.random() - 0.5) * r
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.arc(tx, ty, 2 + Math.random() * 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}

// ── Particles ──
function drawParticles(ctx: CanvasRenderingContext2D, particles: readonly Particle[], cameraY: number) {
  for (const p of particles) {
    const sy = p.y - cameraY
    if (sy < -20 || sy > CANVAS_HEIGHT + 20) continue
    const alpha = p.life / p.maxLife
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur = 3 * SHADOW
    ctx.beginPath()
    ctx.arc(p.x, sy, p.size * alpha, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// ── HUD ──
function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  // Altitude
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(0, 0, CANVAS_WIDTH, 50)

  ctx.fillStyle = state.altitude > 5000 ? '#fde68a' : '#ffffff'
  ctx.font = 'bold 11px "Segoe UI", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('ALTITUDE', 15, 18)
  ctx.font = 'bold 22px "Segoe UI", sans-serif'
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 4 * SHADOW
  ctx.fillText(`${Math.floor(state.altitude)}m`, 15, 42)
  ctx.shadowBlur = 0

  // Best
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '10px "Segoe UI", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`BEST: ${Math.floor(state.bestScore)}m`, CANVAS_WIDTH - 15, 18)

  // Score
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 18px "Segoe UI", sans-serif'
  ctx.fillText(`${state.score}`, CANVAS_WIDTH - 15, 40)

  ctx.restore()
}

// ── Level text ──
function drawLevelText(ctx: CanvasRenderingContext2D, text: string, life: number) {
  if (life <= 0) return
  const alpha = Math.min(1, life / 25)
  const scale = 0.8 + (1 - life / 60) * 0.2
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(CANVAS_WIDTH / 2, 100)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 10 * SHADOW
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

// ── Title screen ──
function drawTitle(ctx: CanvasRenderingContext2D, frame: number) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const breathe = 1 + Math.sin(frame * 0.03) * 0.02
  ctx.save()
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80)
  ctx.scale(breathe, breathe)
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 30 * SHADOW
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 48px "Segoe UI", sans-serif'
  ctx.fillText('SKY', 0, 0)
  ctx.fillStyle = '#fbbf24'
  ctx.fillText('LEAP', 0, 50)
  ctx.restore()

  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '13px "Segoe UI", sans-serif'
  ctx.fillText('\uD558\uB298 \uB192\uC774 \uC810\uD504\uD558\uC138\uC694!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '11px "Segoe UI", sans-serif'
  ctx.fillText('\uD130\uCE58/\uB9C8\uC6B0\uC2A4\uB85C \uC88C\uC6B0 \uC774\uB3D9', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 45)

  const pulse = 0.5 + Math.sin(frame * 0.06) * 0.5
  ctx.globalAlpha = pulse
  ctx.fillStyle = '#fde68a'
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 10 * SHADOW
  ctx.font = 'bold 18px "Segoe UI", sans-serif'
  ctx.fillText('TAP TO START', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100)

  ctx.restore()
}

// ── Game over ──
function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState, frame: number) {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const breathe = 1 + Math.sin(frame * 0.04) * 0.02
  ctx.save()
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80)
  ctx.scale(breathe, breathe)
  ctx.shadowColor = '#e17055'
  ctx.shadowBlur = 20 * SHADOW
  ctx.fillStyle = '#e17055'
  ctx.font = 'bold 36px "Segoe UI", sans-serif'
  ctx.fillText('CRASHED!', 0, 0)
  ctx.restore()

  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '12px "Segoe UI", sans-serif'
  ctx.fillText('\uCD5C\uC885 \uACE0\uB3C4', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 25)

  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 8 * SHADOW
  ctx.font = 'bold 38px "Segoe UI", sans-serif'
  ctx.fillText(`${Math.floor(state.altitude)}m`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '12px "Segoe UI", sans-serif'
  ctx.fillText(`\uC810\uC218: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50)

  if (state.score >= state.bestScore && state.score > 0) {
    const bp = 0.7 + Math.sin(frame * 0.1) * 0.3
    ctx.globalAlpha = bp
    ctx.fillStyle = '#fde68a'
    ctx.font = 'bold 14px "Segoe UI", sans-serif'
    ctx.fillText('\uD83C\uDFC6 \uC2E0\uAE30\uB85D! \uD83C\uDFC6', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 75)
    ctx.globalAlpha = 1
  }

  const tp = 0.5 + Math.sin(frame * 0.06) * 0.5
  ctx.globalAlpha = tp
  ctx.fillStyle = '#74b9ff'
  ctx.shadowColor = '#74b9ff'
  ctx.shadowBlur = 8 * SHADOW
  ctx.font = 'bold 18px "Segoe UI", sans-serif'
  ctx.fillText('TAP TO RETRY', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 125)

  ctx.restore()
}

// ── Main render ──
export function render(ctx: CanvasRenderingContext2D, state: GameState, frame: number) {
  ctx.save()

  if (state.shake > 0) {
    const i = state.shake * 2
    ctx.translate((Math.random() - 0.5) * i, (Math.random() - 0.5) * i)
  }

  drawBackground(ctx, state, frame)

  if (state.phase === 'title') {
    // Draw some sample platforms for title
    drawTitle(ctx, frame)
    ctx.restore()
    return
  }

  // Platforms
  for (const p of state.platforms) {
    drawPlatform(ctx, p, state.cameraY)
  }

  drawParticles(ctx, state.particles, state.cameraY)
  drawPlayer(ctx, state, frame)
  drawHUD(ctx, state)
  drawLevelText(ctx, state.levelText, state.levelTextLife)

  if (state.phase === 'gameover') {
    drawGameOver(ctx, state, frame)
  }

  ctx.restore()
}
