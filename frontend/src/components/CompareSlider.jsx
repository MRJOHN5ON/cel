import { useRef, useState, useCallback, useEffect } from 'react'

export default function CompareSlider({
  beforeSrc,
  afterSrc,
  sourceWidth,
  sourceHeight,
}) {
  const containerRef = useRef(null)
  const [position, setPosition] = useState(50)
  const dragging = useRef(false)

  const w = sourceWidth || 4
  const h = sourceHeight || 3

  const updatePosition = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(100, Math.max(0, pct)))
  }, [])

  const stopDragging = useCallback(() => {
    dragging.current = false
  }, [])

  const onPointerMove = useCallback(
    (e) => {
      if (dragging.current) updatePosition(e.clientX)
    },
    [updatePosition],
  )

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [onPointerMove, stopDragging])

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    dragging.current = true
    containerRef.current?.setPointerCapture(e.pointerId)
    updatePosition(e.clientX)
  }

  const onPointerUp = (e) => {
    dragging.current = false
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId)
    }
  }

  const beforeClip = `inset(0 ${100 - position}% 0 0)`

  return (
    <div className="compare-slider-wrap">
      <div
        ref={containerRef}
        className="compare-slider"
        style={{
          '--compare-w': w,
          '--compare-h': h,
          '--compare-aspect': `${w} / ${h}`,
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="compare-slider__stage">
          <div className="compare-slider__result checkerboard">
            <img src={afterSrc} alt="Result" draggable={false} />
          </div>

          <div
            className="compare-slider__before"
            style={{ clipPath: beforeClip, WebkitClipPath: beforeClip }}
          >
            <img src={beforeSrc} alt="Original" draggable={false} />
          </div>
        </div>

        <div className="compare-slider__handle" style={{ left: `${position}%` }}>
          <div className="compare-slider__line" />
          <div className="compare-slider__knob">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="7 8 3 12 7 16" />
              <polyline points="17 8 21 12 17 16" />
            </svg>
          </div>
        </div>

        <div
          className="compare-slider__label-clip compare-slider__label-clip--left"
          style={{ width: `${position}%` }}
        >
          <span className="compare-slider__label">Original</span>
        </div>
        <div
          className="compare-slider__label-clip compare-slider__label-clip--right"
          style={{ left: `${position}%` }}
        >
          <span className="compare-slider__label">Result</span>
        </div>
      </div>
    </div>
  )
}
