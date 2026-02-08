import { useEffect, useRef } from 'react'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './types.ts'
import { useSkyLeap } from './useSkyLeap.ts'

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { start, stop, handlePointerDown, handlePointerMove, handlePointerUp } = useSkyLeap()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    start(canvas)
    return stop
  }, [start, stop])

  const getRect = () => canvasRef.current?.getBoundingClientRect()

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        touchAction: 'none',
        userSelect: 'none',
        display: 'block',
      }}
      onTouchStart={(e) => {
        e.preventDefault()
        const t = e.touches[0]
        const rect = getRect()
        if (t && rect) handlePointerDown(t.clientX, rect)
      }}
      onTouchMove={(e) => {
        e.preventDefault()
        const t = e.touches[0]
        const rect = getRect()
        if (t && rect) handlePointerMove(t.clientX, rect)
      }}
      onTouchEnd={(e) => {
        e.preventDefault()
        handlePointerUp()
      }}
      onMouseDown={(e) => {
        const rect = getRect()
        if (rect) handlePointerDown(e.clientX, rect)
      }}
      onMouseMove={(e) => {
        if (e.buttons === 0) return
        const rect = getRect()
        if (rect) handlePointerMove(e.clientX, rect)
      }}
      onMouseUp={() => handlePointerUp()}
      onMouseLeave={() => handlePointerUp()}
    />
  )
}
