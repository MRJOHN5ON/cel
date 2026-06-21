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

export default function SamPointPicker({
  imageUrl,
  file,
  settings,
  disabled,
  onApply,
  onPreviewMask,
}) {
  const [expanded, setExpanded] = useState(false)
  const [pointMode, setPointMode] = useState(1)
  const [points, setPoints] = useState([])
  const [maskUrl, setMaskUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const imgRef = useRef(null)
  const maskUrlRef = useRef(null)

  const revokeMask = useCallback(() => {
    if (maskUrlRef.current) {
      URL.revokeObjectURL(maskUrlRef.current)
      maskUrlRef.current = null
    }
    setMaskUrl(null)
  }, [])

  useEffect(() => () => revokeMask(), [revokeMask])

  const addPoint = (e) => {
    const img = imgRef.current
    if (!img || busy || !img.naturalWidth) return

    const rect = img.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * img.naturalWidth)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * img.naturalHeight)

    setPoints((prev) => [...prev, { data: [x, y], label: pointMode }])
    revokeMask()
    setError(null)
  }

  const clearPoints = () => {
    setPoints([])
    revokeMask()
    setError(null)
  }

  const undoPoint = () => {
    setPoints((prev) => prev.slice(0, -1))
    revokeMask()
    setError(null)
  }

  const previewMask = async () => {
    if (!file || points.length === 0 || busy) return

    setBusy(true)
    setError(null)

    const form = new FormData()
    form.append('file', file)
    form.append('prompt', JSON.stringify(buildPrompt(points)))

    try {
      const res = await fetch('/api/segment/sam', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'SAM preview failed.')

      const bytes = Uint8Array.from(atob(data.mask), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'image/png' })
      revokeMask()
      const url = URL.createObjectURL(blob)
      maskUrlRef.current = url
      setMaskUrl(url)
      onPreviewMask?.()
    } catch (err) {
      setError(err.message || 'SAM preview failed.')
    } finally {
      setBusy(false)
    }
  }

  const applySegment = async () => {
    if (!file || points.length === 0 || busy) return

    setBusy(true)
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
      if (!res.ok) throw new Error(data.detail || 'SAM segmentation failed.')

      const bytes = Uint8Array.from(atob(data.image), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'image/png' })
      onApply(blob, data.metadata)
    } catch (err) {
      setError(err.message || 'SAM segmentation failed.')
    } finally {
      setBusy(false)
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
          Click to segment (SAM) — optional pre-mask
        </button>
      </section>
    )
  }

  return (
    <section className="sam-picker">
      <div className="sam-picker__header">
        <div>
          <h3 className="sam-picker__title">Click to segment</h3>
          <p className="sam-picker__hint">
            Add foreground (green) and background (red) points. First SAM run downloads ~375 MB.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => {
            setExpanded(false)
            clearPoints()
          }}
          aria-label="Close SAM picker"
        >
          <IconClose size={14} />
        </button>
      </div>

      <div className="sam-picker__tools segment-control">
        <button
          type="button"
          className={`view-tab ${pointMode === 1 ? 'view-tab--active' : ''}`}
          onClick={() => setPointMode(1)}
          disabled={busy}
        >
          Foreground
        </button>
        <button
          type="button"
          className={`view-tab ${pointMode === 0 ? 'view-tab--active' : ''}`}
          onClick={() => setPointMode(0)}
          disabled={busy}
        >
          Background
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={undoPoint}
          disabled={busy || points.length === 0}
        >
          Undo point
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={clearPoints}
          disabled={busy || points.length === 0}
        >
          Clear
        </button>
      </div>

      <div className="sam-picker__stage">
        <div
          className="sam-picker__image-wrap"
          onClick={addPoint}
          role="presentation"
        >
          <img ref={imgRef} src={imageUrl} alt="Click to add SAM points" draggable={false} />
          {maskUrl && (
            <img
              className="sam-picker__mask"
              src={maskUrl}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
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

      {error && <p className="sam-picker__error">{error}</p>}

      <div className="sam-picker__actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={previewMask}
          disabled={disabled || busy || points.length === 0}
        >
          Preview mask
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={applySegment}
          disabled={disabled || busy || points.length === 0}
        >
          <IconWand size={15} />
          {busy ? 'Segmenting…' : 'Use SAM cutout'}
        </button>
      </div>
    </section>
  )
}
