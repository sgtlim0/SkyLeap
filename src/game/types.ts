// ── Canvas ──
export const CANVAS_WIDTH = 400
export const CANVAS_HEIGHT = 650

// ── Physics ──
export const GRAVITY = 0.42
export const JUMP_VELOCITY = -11.2
export const SUPER_JUMP = -16.5
export const WEAK_JUMP = -6        // breakable platform bounce
export const MAX_FALL_SPEED = 13
export const PLAYER_RADIUS = 14
export const MOVE_ACCEL = 0.15
export const FRICTION_AIR = 0.91
export const CAMERA_LERP = 0.12

// ── Platforms ──
export const PLATFORM_W = 64
export const PLATFORM_H = 12
export const PLATFORM_GAP_MIN = 55
export const PLATFORM_GAP_MAX = 105
export const INITIAL_PLATFORMS = 12
export const SCROLL_LINE = 250
export const MOVING_PLATFORM_SPEED = 1.2
export const BREAKABLE_CHANCE = 0.10
export const MOVING_CHANCE = 0.15
export const SPRING_CHANCE = 0.07

// ── Combo ──
export const COMBO_DECAY_FRAMES = 120  // frames without landing → combo resets

// ── Types ──
export type Phase = 'title' | 'playing' | 'gameover'
export type PlatformType = 'normal' | 'moving' | 'breakable' | 'spring'

export interface Platform {
  x: number
  y: number
  readonly w: number
  readonly h: number
  readonly type: PlatformType
  vx: number
  broken: boolean
  breakTimer: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  readonly maxLife: number
  readonly color: string
  readonly size: number
}

export interface LandingRing {
  x: number
  y: number
  life: number
  readonly maxLife: number
  readonly color: string
  radius: number
}

export interface Star {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly speed: number
  readonly alpha: number
}

export interface GameState {
  readonly phase: Phase
  playerX: number
  playerY: number
  playerVX: number
  playerVY: number
  readonly platforms: Platform[]
  readonly particles: Particle[]
  readonly landingRings: LandingRing[]
  readonly stars: Star[]
  readonly score: number
  readonly bestScore: number
  readonly altitude: number
  readonly shake: number
  readonly levelText: string
  readonly levelTextLife: number
  readonly cameraY: number
  readonly targetCameraY: number
  readonly combo: number
  readonly comboTimer: number
  readonly jumpStretch: number     // negative=squash, positive=stretch
  readonly speedLineAlpha: number
  readonly milestonesPassed: number[]
}
