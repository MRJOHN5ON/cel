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
            Click what to keep (green) and what to remove (red). The green overlay
            updates as you add points. First use downloads a one-time ~375 MB model.
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
            {maskUrl && (
              <img
                className="sam-picker__mask"
                src={maskUrl}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
            )}
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
