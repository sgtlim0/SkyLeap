// ── Canvas ──
export const CANVAS_WIDTH = 400
export const CANVAS_HEIGHT = 650

// ── Physics ──
export const GRAVITY = 0.45
export const JUMP_VELOCITY = -11.5
export const SUPER_JUMP = -16
export const MAX_FALL_SPEED = 14
export const PLAYER_RADIUS = 14
export const MOVE_SPEED = 6
export const FRICTION_AIR = 0.92

// ── Platforms ──
export const PLATFORM_W = 64
export const PLATFORM_H = 12
export const PLATFORM_GAP_MIN = 60
export const PLATFORM_GAP_MAX = 110
export const INITIAL_PLATFORMS = 10
export const SCROLL_LINE = 250     // player above this triggers scroll
export const MOVING_PLATFORM_SPEED = 1.2
export const BREAKABLE_CHANCE = 0.12
export const MOVING_CHANCE = 0.18
export const SPRING_CHANCE = 0.08

// ── Types ──
export type Phase = 'title' | 'playing' | 'gameover'
export type PlatformType = 'normal' | 'moving' | 'breakable' | 'spring'

export interface Platform {
  x: number
  y: number
  readonly w: number
  readonly h: number
  readonly type: PlatformType
  vx: number           // for moving platforms
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
  readonly stars: Star[]
  readonly score: number
  readonly bestScore: number
  readonly altitude: number
  readonly shake: number
  readonly levelText: string
  readonly levelTextLife: number
  readonly cameraY: number
  readonly combo: number
}
