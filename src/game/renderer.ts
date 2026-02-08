import type { GameState, Platform, Particle, LandingRing } from './types.ts'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  PLAYER_RADIUS,
} from './types.ts'

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)
const SHADOW = isMobile ? 0.3 : 1

// ── Color interpolation ──
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

// ── Smooth sky gradient ──
const SKY_BANDS: { alt: number; top: string; mid: string; bot: string }[] = [
  { alt: 0,     top: '#87CEEB', mid: '#B0E0FF', bot: '#E0F2FE' },
  { alt: 500,   top: '#6BB5DE', mid: '#9AD4F5', bot: '#C8E8FC' },
  { alt: 2000,  top: '#4A90C4', mid: '#6BAED6', bot: '#A0D0F0' },
  { alt: 5000,  top: '#2D4A8C', mid: '#3A6CB0', bot: '#6090D0' },
  { alt: 8000,  top: '#1A1A5E', mid: '#2D3080', bot: '#3A50A0' },
  { alt: 12000, top: '#0C0C30', mid: '#161650', bot: '#1E1E70' },
  { alt: 20000, top: '#060618', mid: '#0A0A2E', bot: '#101045' },
]

function getSkyColors(alt: number): [string, string, string] {
  for (let i = 0; i < SKY_BANDS.length - 1; i++) {
    const lo = SKY_BANDS[i]
    const hi = SKY_BANDS[i + 1]
    if (alt >= lo.alt && alt < hi.alt) {
      const t = (alt - lo.alt) / (hi.alt - lo.alt)
      return [
        lerpColor(lo.top, hi.top, t),
        lerpColor(lo.mid, hi.mid, t),
        lerpColor(lo.bot, hi.bot, t),
      ]
    }
  }
  const last = SKY_BANDS[SKY_BANDS.length - 1]
  return [last.top, last.mid, last.bot]
}

// ── Parallax mountains ──
function drawMountains(ctx: CanvasRenderingContext2D, cameraY: number, alt: number) {
  if (alt > 6000) return
  const fadeAlpha = Math.max(0, 1 - alt / 6000) * 0.25

  // Far mountains
  ctx.save()
  ctx.globalAlpha = fadeAlpha * 0.6
  ctx.fillStyle = '#7090B0'
  const farOffset = cameraY * 0.02
  drawMountainLayer(ctx, farOffset, 0.6, CANVAS_HEIGHT * 0.7)
  ctx.restore()

  // Near mountains
  ctx.save()
  ctx.globalAlpha = fadeAlpha
  ctx.fillStyle = '#506880'
  const nearOffset = cameraY * 0.04
  drawMountainLayer(ctx, nearOffset, 0.8, CANVAS_HEIGHT * 0.8)
  ctx.restore()
}

function drawMountainLayer(ctx: CanvasRenderingContext2D, offset: number, scale: number, baseY: number) {
  ctx.beginPath()
  ctx.moveTo(0, CANVAS_HEIGHT)
  const peaks = 7
  for (let i = 0; i <= peaks; i++) {
    const x = (i / peaks) * (CANVAS_WIDTH + 80) - 40
    const seed = i * 137.5
    const peakH = (60 + Math.sin(seed) * 40 + Math.cos(seed * 0.7) * 20) * scale
    const peakY = baseY - peakH + (offset % 300)
    if (i === 0) {
      ctx.lineTo(x, Math.min(CANVAS_HEIGHT, peakY + 30))
    }
    ctx.lineTo(x, Math.min(CANVAS_HEIGHT, peakY))
    if (i < peaks) {
      const midX = x + (CANVAS_WIDTH + 80) / peaks / 2
      const midY = Math.min(CANVAS_HEIGHT, peakY + peakH * 0.4)
      ctx.lineTo(midX, midY)
    }
  }
  ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT)
  ctx.closePath()
  ctx.fill()
}

// ── Background ──
function drawBackground(ctx: CanvasRenderingContext2D, state: GameState, frame: number) {
  const [top, mid, bot] = getSkyColors(state.altitude)
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
  grad.addColorStop(0, top)
  grad.addColorStop(0.5, mid)
  grad.addColorStop(1, bot)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Stars (visible at high altitude, smooth fade in)
  if (state.altitude > 2000) {
    const starAlpha = Math.min(1, (state.altitude - 2000) / 4000)
    for (const s of state.stars) {
      const screenY = s.y - state.cameraY * s.speed * 0.01
      const wrappedY = ((screenY % CANVAS_HEIGHT) + CANVAS_HEIGHT) % CANVAS_HEIGHT
      const twinkle = 0.5 + Math.sin(frame * 0.03 + s.x * 0.1 + s.y * 0.05) * 0.5
      ctx.save()
      ctx.globalAlpha = s.alpha * starAlpha * twinkle
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(s.x, wrappedY, s.size, 0, Math.PI * 2)
      ctx.fill()
      // Cross sparkle for large stars
      if (s.size > 1.2 && starAlpha > 0.5) {
        ctx.globalAlpha *= 0.4
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 0.5
        const len = s.size * 2.5 * twinkle
        ctx.beginPath()
        ctx.moveTo(s.x - len, wrappedY)
        ctx.lineTo(s.x + len, wrappedY)
        ctx.moveTo(s.x, wrappedY - len)
        ctx.lineTo(s.x, wrappedY + len)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  // Mountains (parallax)
  drawMountains(ctx, state.cameraY, state.altitude)

  // Clouds (fade out at altitude)
  if (state.altitude < 6000) {
    const cloudAlpha = Math.max(0, 1 - state.altitude / 6000) * 0.25
    ctx.save()
    ctx.globalAlpha = cloudAlpha
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 6; i++) {
      const seed = i * 173.7
      const cx = (seed * 2.3 + frame * 0.12 * (0.5 + i * 0.08)) % (CANVAS_WIDTH + 120) - 60
      const cy = (seed * 3.1 - state.cameraY * 0.04 * (0.3 + i * 0.08)) % CANVAS_HEIGHT
      drawCloud(ctx, cx, ((cy % CANVAS_HEIGHT) + CANVAS_HEIGHT) % CANVAS_HEIGHT, 25 + i * 8)
    }
    ctx.restore()
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath()
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2)
  ctx.arc(x + size * 0.35, y - size * 0.15, size * 0.4, 0, Math.PI * 2)
  ctx.arc(x + size * 0.65, y, size * 0.35, 0, Math.PI * 2)
  ctx.arc(x - size * 0.2, y + size * 0.05, size * 0.3, 0, Math.PI * 2)
  ctx.fill()
}

// ── Speed lines ──
function drawSpeedLines(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.speedLineAlpha <= 0) return
  ctx.save()
  ctx.globalAlpha = state.speedLineAlpha * 0.35
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5

  const goingUp = state.playerVY < 0
  for (let i = 0; i < 8; i++) {
    const seed = i * 97.3
    const x = (seed * 3.7) % CANVAS_WIDTH
    const lineLen = 15 + state.speedLineAlpha * 40
    const startY = (seed * 5.1 + state.cameraY * 0.3) % CANVAS_HEIGHT

    ctx.beginPath()
    if (goingUp) {
      ctx.moveTo(x, startY)
      ctx.lineTo(x + (Math.sin(seed) * 3), startY + lineLen)
    } else {
      ctx.moveTo(x, startY)
      ctx.lineTo(x + (Math.sin(seed) * 3), startY - lineLen)
    }
    ctx.stroke()
  }
  ctx.restore()
}

// ── Platforms ──
function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, cameraY: number, frame: number) {
  const screenY = p.y - cameraY
  if (screenY < -20 || screenY > CANVAS_HEIGHT + 20) return
  if (p.broken && p.breakTimer <= 0) return

  ctx.save()

  if (p.broken) {
    const alpha = Math.max(0, p.breakTimer / 18)
    ctx.globalAlpha = alpha
    // Break apart offset
    const breakOffset = (1 - alpha) * 8
    ctx.translate(0, breakOffset)
  }

  const x = p.x - p.w / 2
  const y = screenY - p.h / 2
  const r = 6

  // Shadow under platform
  ctx.save()
  ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.1
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.roundRect(x + 2, y + 3, p.w, p.h, r)
  ctx.fill()
  ctx.restore()

  // Platform body
  ctx.beginPath()
  ctx.roundRect(x, y, p.w, p.h, r)

  if (p.type === 'spring') {
    const grad = ctx.createLinearGradient(x, y, x, y + p.h)
    grad.addColorStop(0, '#ff7675')
    grad.addColorStop(1, '#d63031')
    ctx.fillStyle = grad
    ctx.shadowColor = '#ff7675'
    ctx.shadowBlur = 10 * SHADOW
  } else if (p.type === 'moving') {
    const grad = ctx.createLinearGradient(x, y, x, y + p.h)
    grad.addColorStop(0, '#74b9ff')
    grad.addColorStop(1, '#0984e3')
    ctx.fillStyle = grad
    ctx.shadowColor = '#74b9ff'
    ctx.shadowBlur = 7 * SHADOW
  } else if (p.type === 'breakable') {
    ctx.fillStyle = p.broken ? '#a29bfe' : '#dfe6e9'
    ctx.shadowColor = '#b2bec3'
    ctx.shadowBlur = 3 * SHADOW
  } else {
    const grad = ctx.createLinearGradient(x, y, x, y + p.h)
    grad.addColorStop(0, '#55efc4')
    grad.addColorStop(1, '#00b894')
    ctx.fillStyle = grad
    ctx.shadowColor = '#55efc4'
    ctx.shadowBlur = 6 * SHADOW
  }

  ctx.fill()
  ctx.shadowBlur = 0

  // Top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.beginPath()
  ctx.roundRect(x + 2, y + 1, p.w - 4, p.h * 0.4, [r, r, 0, 0])
  ctx.fill()

  // Type-specific decorations
  if (p.type === 'spring' && !p.broken) {
    // Animated spring coil
    const bounce = Math.sin(frame * 0.15) * 2
    ctx.strokeStyle = '#ffeaa7'
    ctx.lineWidth = 2
    ctx.beginPath()
    const coilX = p.x
    const coilBaseY = screenY - p.h / 2
    for (let i = 0; i < 3; i++) {
      const cy = coilBaseY - 3 - i * 3 + bounce * (i / 3)
      const spread = 6 - i * 1.5
      ctx.moveTo(coilX - spread, cy)
      ctx.quadraticCurveTo(coilX, cy - 2, coilX + spread, cy)
    }
    ctx.stroke()
  } else if (p.type === 'breakable' && !p.broken) {
    // Crack pattern
    ctx.strokeStyle = 'rgba(99,110,114,0.4)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(x + p.w * 0.3, y)
    ctx.lineTo(x + p.w * 0.35, y + p.h * 0.5)
    ctx.lineTo(x + p.w * 0.4, y + p.h)
    ctx.moveTo(x + p.w * 0.65, y)
    ctx.lineTo(x + p.w * 0.6, y + p.h * 0.6)
    ctx.lineTo(x + p.w * 0.55, y + p.h)
    ctx.stroke()
  } else if (p.type === 'moving') {
    // Direction arrows
    const dir = p.vx > 0 ? 1 : -1
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(dir > 0 ? '>' : '<', p.x, screenY + 1)
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

  // Tilt based on horizontal velocity
  const tilt = state.playerVX * 0.04
  ctx.rotate(tilt)

  // Squash/stretch
  const stretch = state.jumpStretch
  const scaleX = 1 - stretch * 0.3
  const scaleY = 1 + stretch * 0.3
  ctx.scale(scaleX, scaleY)

  // Shadow underneath
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(0, r + 5, r * 0.7, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Body glow
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 14 * SHADOW

  // Body
  const bodyGrad = ctx.createRadialGradient(-3, -4, 0, 0, 0, r * 1.2)
  bodyGrad.addColorStop(0, '#fef3c7')
  bodyGrad.addColorStop(0.4, '#fbbf24')
  bodyGrad.addColorStop(1, '#d97706')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()

  // Rim highlight
  ctx.shadowBlur = 0
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.clip()
  const rimGrad = ctx.createLinearGradient(-r, -r, r, r)
  rimGrad.addColorStop(0, 'rgba(255,255,255,0.25)')
  rimGrad.addColorStop(0.5, 'rgba(255,255,255,0)')
  rimGrad.addColorStop(1, 'rgba(0,0,0,0.1)')
  ctx.fillStyle = rimGrad
  ctx.fillRect(-r, -r, r * 2, r * 2)
  ctx.restore()

  // Face
  ctx.fillStyle = '#78350f'

  // Eyes
  const blink = Math.sin(frame * 0.08) > 0.95
  const eyeY = -2
  if (blink) {
    ctx.fillRect(-6, eyeY - 0.5, 4, 1.5)
    ctx.fillRect(2, eyeY - 0.5, 4, 1.5)
  } else {
    // Eye whites
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(-3.5, eyeY, 2.8, 0, Math.PI * 2)
    ctx.arc(3.5, eyeY, 2.8, 0, Math.PI * 2)
    ctx.fill()
    // Pupils (look toward movement direction)
    const lookX = Math.min(1.2, Math.max(-1.2, state.playerVX * 0.15))
    ctx.fillStyle = '#78350f'
    ctx.beginPath()
    ctx.arc(-3.5 + lookX, eyeY, 1.6, 0, Math.PI * 2)
    ctx.arc(3.5 + lookX, eyeY, 1.6, 0, Math.PI * 2)
    ctx.fill()
    // Eye shine
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(-4.2 + lookX, eyeY - 0.8, 0.6, 0, Math.PI * 2)
    ctx.arc(2.8 + lookX, eyeY - 0.8, 0.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Cheeks (blush)
  ctx.save()
  ctx.globalAlpha = 0.15
  ctx.fillStyle = '#ff6b6b'
  ctx.beginPath()
  ctx.ellipse(-7, 3, 3, 2, 0, 0, Math.PI * 2)
  ctx.ellipse(7, 3, 3, 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Mouth
  if (state.playerVY < -4) {
    // Happy smile going up
    ctx.beginPath()
    ctx.arc(0, 4, 3.5, 0.1, Math.PI - 0.1)
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 1.5
    ctx.stroke()
  } else if (state.playerVY > 6) {
    // Scared O mouth falling fast
    ctx.beginPath()
    ctx.arc(0, 5, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = '#78350f'
    ctx.fill()
    ctx.fillStyle = '#c0392b'
    ctx.beginPath()
    ctx.arc(0, 5, 1.5, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Neutral
    ctx.beginPath()
    ctx.arc(0, 4, 2.5, 0.2, Math.PI - 0.2)
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 1.3
    ctx.stroke()
  }

  // Trail when going up fast
  if (state.playerVY < -7) {
    const intensity = Math.min(1, Math.abs(state.playerVY) / 16)
    ctx.globalAlpha = intensity * 0.35
    for (let i = 0; i < 4; i++) {
      const ty = r + 6 + i * 5 + Math.random() * 3
      const tx = (Math.random() - 0.5) * r * 0.8
      const trailSize = (1.5 + Math.random() * 2) * (1 - i / 5)
      ctx.fillStyle = i < 2 ? '#fbbf24' : '#f97316'
      ctx.beginPath()
      ctx.arc(tx, ty, trailSize, 0, Math.PI * 2)
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
    ctx.globalAlpha = alpha * 0.8
    ctx.fillStyle = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur = 4 * SHADOW
    ctx.beginPath()
    ctx.arc(p.x, sy, p.size * (0.3 + alpha * 0.7), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// ── Landing rings ──
function drawLandingRings(ctx: CanvasRenderingContext2D, rings: readonly LandingRing[], cameraY: number) {
  for (const r of rings) {
    const sy = r.y - cameraY
    if (sy < -50 || sy > CANVAS_HEIGHT + 50) continue
    const alpha = (r.life / r.maxLife) * 0.5
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = r.color
    ctx.lineWidth = 2 * (r.life / r.maxLife)
    ctx.shadowColor = r.color
    ctx.shadowBlur = 6 * SHADOW
    ctx.beginPath()
    ctx.ellipse(r.x, sy, r.radius, r.radius * 0.3, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

// ── HUD ──
function drawHUD(ctx: CanvasRenderingContext2D, state: GameState, frame: number) {
  // Top bar
  const barGrad = ctx.createLinearGradient(0, 0, 0, 55)
  barGrad.addColorStop(0, 'rgba(0,0,0,0.35)')
  barGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = barGrad
  ctx.fillRect(0, 0, CANVAS_WIDTH, 55)

  // Altitude (left)
  ctx.save()
  ctx.fillStyle = state.altitude > 5000 ? '#fde68a' : 'rgba(255,255,255,0.6)'
  ctx.font = 'bold 10px "Segoe UI", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('ALTITUDE', 15, 16)
  ctx.fillStyle = state.altitude > 5000 ? '#fde68a' : '#ffffff'
  ctx.font = 'bold 20px "Segoe UI", sans-serif'
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 4 * SHADOW
  ctx.fillText(`${Math.floor(state.altitude)}m`, 15, 38)
  ctx.shadowBlur = 0

  // Combo (center)
  if (state.combo > 1) {
    const comboColor = state.combo > 5 ? '#ff6b6b' : state.combo > 3 ? '#fbbf24' : '#55efc4'
    const pulse = 1 + Math.sin(frame * 0.12) * 0.05
    ctx.save()
    ctx.translate(CANVAS_WIDTH / 2, 28)
    ctx.scale(pulse, pulse)
    ctx.fillStyle = comboColor
    ctx.shadowColor = comboColor
    ctx.shadowBlur = 8 * SHADOW
    ctx.font = 'bold 18px "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`x${state.combo}`, 0, 0)
    ctx.restore()
  }

  // Score / Best (right)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '10px "Segoe UI", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`BEST: ${Math.floor(state.bestScore)}`, CANVAS_WIDTH - 15, 16)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 18px "Segoe UI", sans-serif'
  ctx.fillText(`${state.score}`, CANVAS_WIDTH - 15, 38)

  ctx.restore()
}

// ── Level text ──
function drawLevelText(ctx: CanvasRenderingContext2D, text: string, life: number) {
  if (life <= 0) return
  const alpha = Math.min(1, life / 25)
  const progress = 1 - life / 60
  const scale = 0.8 + progress * 0.2
  const yOff = -progress * 10

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(CANVAS_WIDTH / 2, 90 + yOff)
  ctx.scale(scale, scale)

  // Text with outline
  ctx.font = 'bold 22px "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 3
  ctx.strokeText(text, 0, 0)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 12 * SHADOW
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

// ── Title screen ──
function drawTitle(ctx: CanvasRenderingContext2D, state: GameState, frame: number) {
  // Floating sample platforms on title
  const platSamples = state.platforms.slice(0, 5)
  for (const p of platSamples) {
    drawPlatform(ctx, p, 0, frame)
  }

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Semi-transparent backdrop
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.roundRect(CANVAS_WIDTH / 2 - 140, CANVAS_HEIGHT / 2 - 130, 280, 280, 20)
  ctx.fill()

  // Title
  const breathe = 1 + Math.sin(frame * 0.03) * 0.02
  ctx.save()
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80)
  ctx.scale(breathe, breathe)
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 25 * SHADOW
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 46px "Segoe UI", sans-serif'
  ctx.fillText('SKY', 0, 0)
  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 46px "Segoe UI", sans-serif'
  ctx.fillText('LEAP', 0, 48)
  ctx.restore()

  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '13px "Segoe UI", sans-serif'
  ctx.fillText('\uD558\uB298 \uB192\uC774 \uC810\uD504\uD558\uC138\uC694!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15)

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '11px "Segoe UI", sans-serif'
  ctx.fillText('\uD130\uCE58/\uB9C8\uC6B0\uC2A4\uB85C \uC88C\uC6B0 \uC774\uB3D9', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 38)

  // Platform type legend
  ctx.font = '10px "Segoe UI", sans-serif'
  const legendY = CANVAS_HEIGHT / 2 + 62
  const items: [string, string][] = [
    ['#55efc4', '\uC77C\uBC18'],
    ['#74b9ff', '\uC774\uB3D9'],
    ['#dfe6e9', '\uD30C\uAD34'],
    ['#ff7675', '\uC2A4\uD504\uB9C1'],
  ]
  const totalW = items.length * 60
  const startX = CANVAS_WIDTH / 2 - totalW / 2 + 30
  items.forEach(([color, label], i) => {
    const ix = startX + i * 60
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(ix - 18, legendY - 4, 14, 6, 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText(label, ix + 4, legendY + 2)
  })

  // Pulsing "tap to start"
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
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Rounded card backdrop
  ctx.fillStyle = 'rgba(20,10,40,0.85)'
  ctx.beginPath()
  ctx.roundRect(CANVAS_WIDTH / 2 - 130, CANVAS_HEIGHT / 2 - 120, 260, 270, 20)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Title
  const breathe = 1 + Math.sin(frame * 0.04) * 0.02
  ctx.save()
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80)
  ctx.scale(breathe, breathe)
  ctx.shadowColor = '#e17055'
  ctx.shadowBlur = 18 * SHADOW
  ctx.fillStyle = '#e17055'
  ctx.font = 'bold 32px "Segoe UI", sans-serif'
  ctx.fillText('CRASHED!', 0, 0)
  ctx.restore()

  ctx.shadowBlur = 0

  // Altitude
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '11px "Segoe UI", sans-serif'
  ctx.fillText('\uCD5C\uC885 \uACE0\uB3C4', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30)

  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#fbbf24'
  ctx.shadowBlur = 8 * SHADOW
  ctx.font = 'bold 36px "Segoe UI", sans-serif'
  ctx.fillText(`${Math.floor(state.altitude)}m`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 2)
  ctx.shadowBlur = 0

  // Score
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '12px "Segoe UI", sans-serif'
  ctx.fillText(`\uC810\uC218: ${state.score}  |  \uCF64\uBCF4: x${state.combo}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)

  // New record
  if (state.score >= state.bestScore && state.score > 0) {
    const bp = 0.7 + Math.sin(frame * 0.1) * 0.3
    ctx.globalAlpha = bp
    ctx.fillStyle = '#fde68a'
    ctx.shadowColor = '#fbbf24'
    ctx.shadowBlur = 10 * SHADOW
    ctx.font = 'bold 14px "Segoe UI", sans-serif'
    ctx.fillText('\uD83C\uDFC6 \uC2E0\uAE30\uB85D! \uD83C\uDFC6', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 65)
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }

  // Best score
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '11px "Segoe UI", sans-serif'
  ctx.fillText(`\uCD5C\uACE0: ${Math.floor(state.bestScore)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 90)

  // Retry button
  const tp = 0.5 + Math.sin(frame * 0.06) * 0.5
  ctx.globalAlpha = tp
  ctx.fillStyle = '#74b9ff'
  ctx.shadowColor = '#74b9ff'
  ctx.shadowBlur = 8 * SHADOW
  ctx.font = 'bold 17px "Segoe UI", sans-serif'
  ctx.fillText('TAP TO RETRY', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 120)

  ctx.restore()
}

// ── Main render ──
export function render(ctx: CanvasRenderingContext2D, state: GameState, frame: number) {
  ctx.save()

  if (state.shake > 0) {
    const intensity = state.shake * 3
    ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity)
  }

  drawBackground(ctx, state, frame)

  if (state.phase === 'title') {
    drawTitle(ctx, state, frame)
    ctx.restore()
    return
  }

  // Speed lines
  drawSpeedLines(ctx, state)

  // Platforms
  for (const p of state.platforms) {
    drawPlatform(ctx, p, state.cameraY, frame)
  }

  // Landing rings
  drawLandingRings(ctx, state.landingRings, state.cameraY)

  drawParticles(ctx, state.particles, state.cameraY)
  drawPlayer(ctx, state, frame)
  drawHUD(ctx, state, frame)
  drawLevelText(ctx, state.levelText, state.levelTextLife)

  if (state.phase === 'gameover') {
    drawGameOver(ctx, state, frame)
  }

  ctx.restore()
}
