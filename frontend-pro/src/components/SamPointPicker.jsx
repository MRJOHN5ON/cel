import { useCallback, useEffect, useRef, useState } from 'react'
import { IconClose, IconSparkle, IconWand } from './Icons'
import './SamPointPicker.css'

function buildPrompt(points) {
  return points.map((p) => ({
    type: 'point',
    data: p.data,
    label: p.label,
  }))
}

function clientToImageCoords(clientX, clientY, frameEl, img) {
  const frame = frameEl.getBoundingClientRect()
  const x = ((clientX - frame.left) / frame.width) * img.naturalWidth
  const y = ((clientY - frame.top) / frame.height) * img.naturalHeight
  return [
    Math.round(Math.max(0, Math.min(img.naturalWidth, x))),
    Math.round(Math.max(0, Math.min(img.naturalHeight, y))),
  ]
}

function paintColoredMask(canvas, maskImg) {
  const w = maskImg.naturalWidth
  const h = maskImg.naturalHeight
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  ctx.drawImage(maskImg, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  const pixels = imageData.data

  for (let i = 0; i < pixels.length; i += 4) {
    const lum = pixels[i]
    const t = lum / 255

    if (t >= 0.5) {
      const strength = ((t - 0.5) / 0.5) * 0.72
      pixels[i] = 34
      pixels[i + 1] = 197
      pixels[i + 2] = 94
      pixels[i + 3] = Math.round(strength * 255)
    } else {
      const strength = ((0.5 - t) / 0.5) * 0.58
      pixels[i] = 239
      pixels[i + 1] = 68
      pixels[i + 2] = 68
      pixels[i + 3] = Math.round(strength * 255)
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

export default function SamPointPicker({
  imageUrl,
  file,
  settings,
  disabled,
  onApply,
}) {
  const [expanded, setExpanded] = useState(false)
  const [pointMode, setPointMode] = useState(1)
  const [points, setPoints] = useState([])
  const [maskUrl, setMaskUrl] = useState(null)
  const [applying, setApplying] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState(null)
  const imgRef = useRef(null)
  const frameRef = useRef(null)
  const maskCanvasRef = useRef(null)
  const maskUrlRef = useRef(null)
  const previewAbortRef = useRef(null)
  const previewDebounceRef = useRef(null)

  const revokeMask = useCallback(() => {
    if (maskUrlRef.current) {
      URL.revokeObjectURL(maskUrlRef.current)
      maskUrlRef.current = null
    }
    setMaskUrl(null)
  }, [])

  useEffect(() => () => {
    revokeMask()
    previewAbortRef.current?.abort()
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
  }, [revokeMask])

  const fetchLiveMask = useCallback(async (pts) => {
    if (!file || pts.length === 0) return

    previewAbortRef.current?.abort()
    const controller = new AbortController()
    previewAbortRef.current = controller

    setPreviewing(true)
    setError(null)

    const form = new FormData()
    form.append('file', file)
    form.append('prompt', JSON.stringify(buildPrompt(pts)))

    try {
      const res = await fetch('/api/segment/sam', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not update selection.')

      const bytes = Uint8Array.from(atob(data.mask), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'image/png' })
      revokeMask()
      const url = URL.createObjectURL(blob)
      maskUrlRef.current = url
      setMaskUrl(url)
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message || 'Could not update selection.')
    } finally {
      if (!controller.signal.aborted) {
        setPreviewing(false)
      }
    }
  }, [file, revokeMask])

  useEffect(() => {
    if (!expanded || !file || points.length === 0) {
      revokeMask()
      return undefined
    }

    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
    previewDebounceRef.current = setTimeout(() => {
      fetchLiveMask(points)
    }, 400)

    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
    }
  }, [expanded, file, points, fetchLiveMask, revokeMask])

  useEffect(() => {
    const canvas = maskCanvasRef.current
    if (!maskUrl || !canvas) return undefined

    const maskImg = new Image()
    maskImg.onload = () => paintColoredMask(canvas, maskImg)
    maskImg.src = maskUrl

    return () => {
      maskImg.onload = null
    }
  }, [maskUrl])

  const addPoint = (e) => {
    const img = imgRef.current
    const frame = frameRef.current
    if (!img || !frame || applying || !img.naturalWidth) return

    const data = clientToImageCoords(e.clientX, e.clientY, frame, img)
    setPoints((prev) => [...prev, { data, label: pointMode }])
    setError(null)
  }

  const clearPoints = () => {
    previewAbortRef.current?.abort()
    setPoints([])
    revokeMask()
    setError(null)
    setPreviewing(false)
  }

  const undoPoint = () => {
    setPoints((prev) => prev.slice(0, -1))
    setError(null)
  }

  const applySegment = async () => {
    if (!file || points.length === 0 || applying) return

    previewAbortRef.current?.abort()
    setApplying(true)
    setError(null)

    const params = new URLSearchParams({
      alpha_matting: settings.alphaMatting,
      force_alpha_matting: settings.forceAlphaMatting,
      post_process_mask: settings.postProcessMask,
    })

    const form = new FormData()
    form.append('file', file)
    form.append('prompt', JSON.stringify(buildPrompt(points)))

    try {
      const res = await fetch(`/api/segment/sam/apply?${params}`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not build cutout.')

      const bytes = Uint8Array.from(atob(data.image), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'image/png' })
      onApply(blob, data.metadata)
    } catch (err) {
      setError(err.message || 'Could not build cutout.')
    } finally {
      setApplying(false)
    }
  }

  if (!expanded) {
    return (
      <section className="sam-picker sam-picker--collapsed">
        <button
          type="button"
          className="sam-picker__expand btn btn--ghost"
          onClick={() => setExpanded(true)}
          disabled={disabled}
        >
          <IconSparkle size={15} />
          Smart Select — optional before removing background
        </button>
      </section>
    )
  }

  return (
    <section className="sam-picker">
      <div className="sam-picker__header">
        <div>
          <h3 className="sam-picker__title">Smart Select</h3>
          <p className="sam-picker__hint">
            Click what to keep (green dots) and what to remove (red dots).
            Green tint = kept, red tint = removed. First use downloads a one-time ~375 MB model.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => {
            setExpanded(false)
            clearPoints()
          }}
          aria-label="Close Smart Select"
        >
          <IconClose size={14} />
        </button>
      </div>

      <div className="sam-picker__tools segment-control">
        <button
          type="button"
          className={`view-tab ${pointMode === 1 ? 'view-tab--active' : ''}`}
          onClick={() => setPointMode(1)}
          disabled={applying}
        >
          Keep
        </button>
        <button
          type="button"
          className={`view-tab ${pointMode === 0 ? 'view-tab--active' : ''}`}
          onClick={() => setPointMode(0)}
          disabled={applying}
        >
          Remove
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={undoPoint}
          disabled={applying || points.length === 0}
        >
          Undo point
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={clearPoints}
          disabled={applying || points.length === 0}
        >
          Clear
        </button>
      </div>

      <div className="sam-picker__stage">
        <div className="sam-picker__image-wrap">
          <div
            ref={frameRef}
            className="sam-picker__image-frame"
            onClick={addPoint}
            role="presentation"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Click to mark what to keep or remove"
              draggable={false}
            />
            <canvas
              ref={maskCanvasRef}
              className={`sam-picker__mask${maskUrl ? ' sam-picker__mask--visible' : ''}`}
              aria-hidden="true"
            />
            {previewing && (
              <div className="sam-picker__live-badge" aria-live="polite">
                Updating…
              </div>
            )}
            {points.map((p, i) => {
              const img = imgRef.current
              if (!img?.naturalWidth) return null
              const left = (p.data[0] / img.naturalWidth) * 100
              const top = (p.data[1] / img.naturalHeight) * 100
              return (
                <span
                  key={`${p.data[0]}-${p.data[1]}-${i}`}
                  className={`sam-picker__point sam-picker__point--${p.label === 1 ? 'fg' : 'bg'}`}
                  style={{ left: `${left}%`, top: `${top}%` }}
                />
              )
            })}
          </div>
        </div>
      </div>

      {error && <p className="sam-picker__error">{error}</p>}

      <div className="sam-picker__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={applySegment}
          disabled={disabled || applying || points.length === 0}
        >
          <IconWand size={15} />
          {applying ? 'Building cutout…' : 'Use this selection'}
        </button>
      </div>
    </section>
  )
}
