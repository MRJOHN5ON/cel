import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconErase,
  IconRestore,
  IconUndo,
  IconRedo,
  IconZoom,
  IconCheck,
  IconClose,
  IconPan,
  IconStartOver,
} from './Icons'
import './MaskEditor.css'

const TOOLS = { erase: 'erase', restore: 'restore', pan: 'pan' }

const MAX_HISTORY = 20
const MIN_ZOOM = 0.1
const MAX_ZOOM = 8
const ZOOM_SLIDER_MIN = Math.round(MIN_ZOOM * 100)
const ZOOM_SLIDER_MAX = Math.round(MAX_ZOOM * 100)

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}
const MAGNIFIER_SIZE = 128
const MAGNIFIER_PIXEL_RATIO = 4
// Cap ring size so it stays readable when zoomed far out (low viewScale).
const MAGNIFIER_MAX_BRUSH_RADIUS = (MAGNIFIER_SIZE / 2) * 0.45
const MAGNIFIER_MAX_BRUSH_SIZE = 5
const MAGNIFIER_SHOW_BELOW_SCALE = 0.88
const MAGNIFIER_HIDE_ABOVE_SCALE = 0.94

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}

function cloneImageData(data) {
  return new ImageData(
    new Uint8ClampedArray(data.data),
    data.width,
    data.height,
  )
}

function brushFalloff(dist, radius, hardness) {
  if (dist >= radius) return 0
  const inner = radius * hardness
  if (dist <= inner) return 1
  return 1 - (dist - inner) / (radius - inner)
}

function paintBrush({ workData, originalData, cx, cy, radius, hardness, tool }) {
  const { width, height, data } = workData
  const orig = originalData.data
  const r = Math.ceil(radius)
  const x0 = Math.max(0, Math.floor(cx - r))
  const y0 = Math.max(0, Math.floor(cy - r))
  const x1 = Math.min(width - 1, Math.ceil(cx + r))
  const y1 = Math.min(height - 1, Math.ceil(cy + r))

  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.hypot(dx, dy)
      const strength = brushFalloff(dist, radius, hardness)
      if (strength <= 0) continue

      const idx = (y * width + x) * 4

      if (tool === TOOLS.erase) {
        const prevAlpha = data[idx + 3]
        const nextAlpha = Math.round(prevAlpha * (1 - strength))
        if (prevAlpha > 0) {
          const scale = nextAlpha / prevAlpha
          data[idx] = Math.round(data[idx] * scale)
          data[idx + 1] = Math.round(data[idx + 1] * scale)
          data[idx + 2] = Math.round(data[idx + 2] * scale)
        }
        data[idx + 3] = nextAlpha
      } else if (tool === TOOLS.restore) {
        const blend = strength
        data[idx] = Math.round(data[idx] * (1 - blend) + orig[idx] * blend)
        data[idx + 1] = Math.round(data[idx + 1] * (1 - blend) + orig[idx + 1] * blend)
        data[idx + 2] = Math.round(data[idx + 2] * (1 - blend) + orig[idx + 2] * blend)
        data[idx + 3] = Math.round(data[idx + 3] + (255 - data[idx + 3]) * blend)
      }
    }
  }
}

function getCheckerColors() {
  const style = getComputedStyle(document.documentElement)
  return {
    light: style.getPropertyValue('--checker-light').trim() || '#e8e8ed',
    dark: style.getPropertyValue('--checker-dark').trim() || '#f5f5f7',
  }
}

export default function MaskEditor({
  resultUrl,
  originalUrl,
  onDone,
  onCancel,
}) {
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  const containerRef = useRef(null)
  const displayRef = useRef(null)
  const magnifierRef = useRef(null)
  const workCanvasRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const originalDataRef = useRef(null)
  const initialResultRef = useRef(null)
  const initialAlphaRef = useRef(null)
  const showRemovedRef = useRef(false)
  const magnifierVisibleRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [tool, setTool] = useState(TOOLS.erase)
  const [brushSize, setBrushSize] = useState(32)
  const [brushHardness, setBrushHardness] = useState(0.75)
  const [showRemoved, setShowRemoved] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [cursorImage, setCursorImage] = useState(null)
  const [spacePan, setSpacePan] = useState(false)
  const [magnifierVisible, setMagnifierVisible] = useState(false)

  const historyPast = useRef([])
  const historyFuture = useRef([])
  const painting = useRef(false)
  const panning = useRef(false)
  const spaceHeld = useRef(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const lastPoint = useRef(null)
  const strokeSnapshot = useRef(null)
  const toolRef = useRef(tool)
  const rafRef = useRef(null)
  const cursorImageRef = useRef(null)

  showRemovedRef.current = showRemoved
  toolRef.current = tool

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyPast.current.length > 0)
    setCanRedo(historyFuture.current.length > 0)
  }, [])

  const getViewTransform = useCallback(() => {
    const display = displayRef.current
    const work = workCanvasRef.current
    if (!display || !work) return null

    const viewW = display.clientWidth
    const viewH = display.clientHeight
    const { width, height } = work
    const scale = zoom * Math.min(viewW / width, viewH / height)
    const drawW = width * scale
    const drawH = height * scale
    const offsetX = (viewW - drawW) / 2 + pan.x
    const offsetY = (viewH - drawH) / 2 + pan.y

    return { viewW, viewH, width, height, scale, offsetX, offsetY }
  }, [zoom, pan])

  const rebuildGuideOverlay = useCallback(() => {
    const work = workCanvasRef.current
    const initA = initialAlphaRef.current
    if (!work || !initA) return

    let overlay = overlayCanvasRef.current
    if (!overlay || overlay.width !== work.width || overlay.height !== work.height) {
      overlay = document.createElement('canvas')
      overlay.width = work.width
      overlay.height = work.height
      overlayCanvasRef.current = overlay
    }

    const current = work
      .getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, work.width, work.height)
    const octx = overlay.getContext('2d')
    const overlayData = octx.createImageData(work.width, work.height)

    const alphaAt = (px) => current.data[px * 4 + 3]

    for (let px = 0; px < initA.length; px += 1) {
      const idx = px * 4
      const initAlpha = initA[px]
      const curAlpha = alphaAt(px)
      const wasRemoved = initAlpha < 20
      const nowRemoved = curAlpha < 20
      const userErased = initAlpha >= 20 && curAlpha < initAlpha - 8

      if (wasRemoved && nowRemoved && !userErased) {
        // Blue tint — AI removed background (restore targets)
        overlayData.data[idx] = 10
        overlayData.data[idx + 1] = 132
        overlayData.data[idx + 2] = 255
        overlayData.data[idx + 3] = 40
      } else if (userErased) {
        // Red tint on user erasures — proportional to how much alpha was removed
        const removed = Math.min(1, (initAlpha - curAlpha) / initAlpha)
        overlayData.data[idx] = 255
        overlayData.data[idx + 1] = 59
        overlayData.data[idx + 2] = 48
        overlayData.data[idx + 3] = Math.round(35 + removed * 70)
      }
    }

    octx.putImageData(overlayData, 0, 0)
  }, [])

  const redraw = useCallback(() => {
    const display = displayRef.current
    const work = workCanvasRef.current
    const transform = getViewTransform()
    if (!display || !work || !transform) return

    const ctx = display.getContext('2d')
    const { viewW, viewH, scale, offsetX, offsetY } = transform
    const dpr = window.devicePixelRatio || 1
    const targetW = Math.max(1, Math.floor(viewW * dpr))
    const targetH = Math.max(1, Math.floor(viewH * dpr))

    display.width = targetW
    display.height = targetH
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, viewW, viewH)

    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)
    ctx.drawImage(work, 0, 0)

    if (showRemovedRef.current && overlayCanvasRef.current) {
      ctx.drawImage(overlayCanvasRef.current, 0, 0)
    }

    ctx.restore()
  }, [getViewTransform])

  const refreshGuide = useCallback(() => {
    if (showRemovedRef.current) {
      rebuildGuideOverlay()
    }
    redraw()
  }, [rebuildGuideOverlay, redraw])

  const updateMagnifier = useCallback(
    (imgX, imgY, viewScale) => {
      const magnifier = magnifierRef.current
      const work = workCanvasRef.current
      if (!magnifier || !work || imgX == null || imgY == null) return

      const ctx = magnifier.getContext('2d')
      const dpr = window.devicePixelRatio || 1
      const size = MAGNIFIER_SIZE

      if (magnifier.width !== Math.floor(size * dpr)) {
        magnifier.width = Math.floor(size * dpr)
        magnifier.height = Math.floor(size * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      const srcDim = size / MAGNIFIER_PIXEL_RATIO
      const sx = imgX - srcDim / 2
      const sy = imgY - srcDim / 2

      ctx.clearRect(0, 0, size, size)
      ctx.save()
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2)
      ctx.clip()

      // Checkerboard behind transparent pixels (matches main viewport)
      const { light, dark } = getCheckerColors()
      const tile = 8
      for (let ty = 0; ty < size; ty += tile) {
        for (let tx = 0; tx < size; tx += tile) {
          const parity = (Math.floor(tx / tile) + Math.floor(ty / tile)) % 2
          ctx.fillStyle = parity ? light : dark
          ctx.fillRect(tx, ty, tile, tile)
        }
      }

      ctx.drawImage(work, sx, sy, srcDim, srcDim, 0, 0, size, size)

      if (showRemovedRef.current && overlayCanvasRef.current && !painting.current) {
        ctx.drawImage(overlayCanvasRef.current, sx, sy, srcDim, srcDim, 0, 0, size, size)
      }

      // Loupe shows image at MAGNIFIER_PIXEL_RATIO×; scale brush from image space.
      const brushRadiusImg = brushSize / viewScale
      const brushRadiusMag = brushRadiusImg * MAGNIFIER_PIXEL_RATIO
      const activeTool = toolRef.current

      ctx.beginPath()
      ctx.arc(size / 2, size / 2, brushRadiusMag, 0, Math.PI * 2)
      ctx.strokeStyle =
        activeTool === TOOLS.restore
          ? 'rgba(10, 132, 255, 0.95)'
          : 'rgba(255, 59, 48, 0.95)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(size / 2 - 6, size / 2)
      ctx.lineTo(size / 2 + 6, size / 2)
      ctx.moveTo(size / 2, size / 2 - 6)
      ctx.lineTo(size / 2, size / 2 + 6)
      ctx.stroke()

      ctx.restore()
    },
    [brushSize],
  )

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const [resultImg, originalImg] = await Promise.all([
          loadImage(resultUrl),
          loadImage(originalUrl),
        ])
        if (cancelled) return

        const w = resultImg.naturalWidth
        const h = resultImg.naturalHeight

        const work = document.createElement('canvas')
        work.width = w
        work.height = h
        work.getContext('2d', { willReadFrequently: true }).drawImage(resultImg, 0, 0)

        const original = document.createElement('canvas')
        original.width = w
        original.height = h
        const octx = original.getContext('2d', { willReadFrequently: true })
        octx.drawImage(originalImg, 0, 0, w, h)

        const resultData = work
          .getContext('2d', { willReadFrequently: true })
          .getImageData(0, 0, w, h)
        const alpha = new Uint8ClampedArray(w * h)
        for (let i = 0; i < alpha.length; i += 1) {
          alpha[i] = resultData.data[i * 4 + 3]
        }

        workCanvasRef.current = work
        overlayCanvasRef.current = null
        originalDataRef.current = octx.getImageData(0, 0, w, h)
        initialResultRef.current = cloneImageData(resultData)
        initialAlphaRef.current = alpha
        setImgSize({ w, h })
        historyPast.current = []
        historyFuture.current = []
        setCanUndo(false)
        setCanRedo(false)
        setReady(true)
      } catch {
        if (!cancelled) onCancelRef.current?.()
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [resultUrl, originalUrl])

  useEffect(() => {
    if (!ready) return
    redraw()
  }, [ready, redraw, zoom, pan])

  useEffect(() => {
    if (!ready) return
    if (showRemoved) {
      rebuildGuideOverlay()
    }
    redraw()
  }, [ready, showRemoved, rebuildGuideOverlay, redraw])

  useEffect(() => {
    const onResize = () => redraw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [redraw])

  useEffect(() => {
    const viewport = containerRef.current
    if (!viewport || !ready) return undefined

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => redraw())
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [ready, redraw])

  useEffect(() => {
    const img = cursorImageRef.current
    if (!ready || !magnifierVisible || !img) return
    if (tool !== TOOLS.erase && tool !== TOOLS.restore) return
    updateMagnifier(img.x, img.y, img.scale)
  }, [ready, tool, cursorImage, magnifierVisible, updateMagnifier])

  useEffect(() => {
    if (brushSize > MAGNIFIER_MAX_BRUSH_SIZE) {
      magnifierVisibleRef.current = false
      setMagnifierVisible(false)
    }
  }, [brushSize])

  const screenToImage = useCallback(
    (clientX, clientY) => {
      const display = displayRef.current
      const transform = getViewTransform()
      if (!display || !transform) return null

      const rect = display.getBoundingClientRect()
      const { scale, offsetX, offsetY } = transform
      const x = (clientX - rect.left - offsetX) / scale
      const y = (clientY - rect.top - offsetY) / scale
      return { x, y, scale, screenX: clientX - rect.left, screenY: clientY - rect.top }
    },
    [getViewTransform],
  )

  const syncPointerSample = useCallback(
    (clientX, clientY) => {
      const work = workCanvasRef.current
      const pt = screenToImage(clientX, clientY)
      if (!work || !pt) return null

      const overImage =
        pt.x >= 0 && pt.y >= 0 && pt.x < work.width && pt.y < work.height

      if (!overImage) {
        cursorImageRef.current = null
        setCursorImage(null)
        magnifierVisibleRef.current = false
        setMagnifierVisible(false)
        return null
      }

      const img = { x: pt.x, y: pt.y, scale: pt.scale }
      cursorImageRef.current = img
      setCursorImage(img)

      let visible = magnifierVisibleRef.current
      const magnifierEligible = brushSize <= MAGNIFIER_MAX_BRUSH_SIZE
      if (pt.scale < MAGNIFIER_SHOW_BELOW_SCALE && magnifierEligible) visible = true
      else if (pt.scale > MAGNIFIER_HIDE_ABOVE_SCALE || !magnifierEligible) visible = false

      magnifierVisibleRef.current = visible
      setMagnifierVisible(visible)

      if (visible) {
        updateMagnifier(pt.x, pt.y, pt.scale)
      }

      return pt
    },
    [brushSize, screenToImage, updateMagnifier],
  )

  const applyStroke = useCallback(
    (clientX, clientY) => {
      const work = workCanvasRef.current
      const originalData = originalDataRef.current
      if (!work || !originalData || !strokeSnapshot.current) return

      const pt = screenToImage(clientX, clientY)
      if (!pt) return

      const workData = strokeSnapshot.current
      const radius = brushSize / pt.scale
      const activeTool = toolRef.current

      const paintAt = (cx, cy) => {
        paintBrush({
          workData,
          originalData,
          cx,
          cy,
          radius,
          hardness: brushHardness,
          tool: activeTool,
        })
      }

      if (lastPoint.current) {
        const { x: x0, y: y0 } = lastPoint.current
        const dist = Math.hypot(pt.x - x0, pt.y - y0)
        const steps = Math.max(1, Math.ceil(dist / (radius * 0.3)))
        for (let i = 0; i <= steps; i += 1) {
          const t = i / steps
          paintAt(x0 + (pt.x - x0) * t, y0 + (pt.y - y0) * t)
        }
      } else {
        paintAt(pt.x, pt.y)
      }

      lastPoint.current = { x: pt.x, y: pt.y }
      cursorImageRef.current = { x: pt.x, y: pt.y, scale: pt.scale }

      const ctx = work.getContext('2d', { willReadFrequently: true })
      ctx.putImageData(workData, 0, 0)

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          if (showRemovedRef.current) {
            rebuildGuideOverlay()
          }
          redraw()
          if (magnifierVisibleRef.current) {
            const img = cursorImageRef.current
            if (img) {
              updateMagnifier(img.x, img.y, img.scale)
            }
          }
        })
      }
    },
    [brushHardness, brushSize, rebuildGuideOverlay, redraw, screenToImage, updateMagnifier],
  )

  const beginStroke = useCallback(() => {
    const work = workCanvasRef.current
    if (!work) return false

    const ctx = work.getContext('2d', { willReadFrequently: true })
    const before = ctx.getImageData(0, 0, work.width, work.height)

    historyPast.current = [
      ...historyPast.current.slice(-(MAX_HISTORY - 1)),
      cloneImageData(before),
    ]
    historyFuture.current = []
    syncHistoryFlags()

    strokeSnapshot.current = cloneImageData(before)
    return true
  }, [syncHistoryFlags])

  const endStroke = useCallback(() => {
    const hadStroke = painting.current
    painting.current = false
    panning.current = false
    lastPoint.current = null
    strokeSnapshot.current = null

    if (hadStroke) {
      refreshGuide()
      if (magnifierVisibleRef.current && cursorImageRef.current) {
        const img = cursorImageRef.current
        updateMagnifier(img.x, img.y, img.scale)
      }
    }
  }, [refreshGuide, updateMagnifier])

  const undo = useCallback(() => {
    const work = workCanvasRef.current
    if (!work || historyPast.current.length === 0) return

    const ctx = work.getContext('2d', { willReadFrequently: true })
    const current = ctx.getImageData(0, 0, work.width, work.height)
    historyFuture.current.push(cloneImageData(current))

    const prev = historyPast.current.pop()
    ctx.putImageData(prev, 0, 0)

    syncHistoryFlags()
    refreshGuide()
  }, [refreshGuide, syncHistoryFlags])

  const redo = useCallback(() => {
    const work = workCanvasRef.current
    if (!work || historyFuture.current.length === 0) return

    const ctx = work.getContext('2d', { willReadFrequently: true })
    const current = ctx.getImageData(0, 0, work.width, work.height)
    historyPast.current.push(cloneImageData(current))

    const next = historyFuture.current.pop()
    ctx.putImageData(next, 0, 0)

    syncHistoryFlags()
    refreshGuide()
  }, [refreshGuide, syncHistoryFlags])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!spaceHeld.current) {
          spaceHeld.current = true
          setSpacePan(true)
        }
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if (e.key === 'e' || e.key === 'E') setTool(TOOLS.erase)
      if (e.key === 'r' || e.key === 'R') setTool(TOOLS.restore)
      if (e.key === 'h' || e.key === 'H') setTool(TOOLS.pan)
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceHeld.current = false
        setSpacePan(false)
        if (panning.current) {
          panning.current = false
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [undo, redo])

  const isBrushTool = tool === TOOLS.erase || tool === TOOLS.restore

  const toggleGuide = () => {
    endStroke()
    setShowRemoved((v) => !v)
  }

  const onPointerDown = (e) => {
    if (!ready) return

    if (tool === TOOLS.pan || e.button === 1 || spaceHeld.current) {
      panning.current = true
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }

    if (!isBrushTool) return

    e.preventDefault()
    painting.current = true
    if (!beginStroke()) {
      painting.current = false
      return
    }

    lastPoint.current = null
    syncPointerSample(e.clientX, e.clientY)
    applyStroke(e.clientX, e.clientY)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const pt = screenToImage(e.clientX, e.clientY)

    if (pt && isBrushTool) {
      setCursor({ x: pt.screenX, y: pt.screenY })
      if (!spaceHeld.current) {
        syncPointerSample(e.clientX, e.clientY)
      }
    } else if (!spaceHeld.current) {
      setCursor(null)
      if (!pt) {
        cursorImageRef.current = null
        setCursorImage(null)
        magnifierVisibleRef.current = false
        setMagnifierVisible(false)
      }
    }

    if (panning.current) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setPan({
        x: panStart.current.panX + dx,
        y: panStart.current.panY + dy,
      })
      return
    }
    if (painting.current) applyStroke(e.clientX, e.clientY)
  }

  const onPointerUp = (e) => {
    endStroke()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const onWheel = (e) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    setZoom((z) => clampZoom(z * factor))
  }

  const handleDone = async () => {
    const work = workCanvasRef.current
    if (!work || saving) return
    setSaving(true)
    try {
      const blob = await new Promise((resolve, reject) => {
        work.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png')
      })
      onDone(blob)
    } finally {
      setSaving(false)
    }
  }

  const pushHistorySnapshot = useCallback(() => {
    const work = workCanvasRef.current
    if (!work) return
    const snap = work
      .getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, work.width, work.height)
    historyPast.current = [
      ...historyPast.current.slice(-(MAX_HISTORY - 1)),
      cloneImageData(snap),
    ]
    historyFuture.current = []
    syncHistoryFlags()
  }, [syncHistoryFlags])

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const startOver = useCallback(() => {
    const work = workCanvasRef.current
    const initial = initialResultRef.current
    if (!work || !initial || historyPast.current.length === 0) return

    painting.current = false
    panning.current = false
    lastPoint.current = null
    strokeSnapshot.current = null

    const ctx = work.getContext('2d', { willReadFrequently: true })
    ctx.putImageData(cloneImageData(initial), 0, 0)

    historyPast.current = []
    historyFuture.current = []
    syncHistoryFlags()
    refreshGuide()
  }, [refreshGuide, syncHistoryFlags])

  // brushSize is the brush radius in screen pixels (diameter = 2× brushSize)
  const brushCursorSize = brushSize * 2
  const showMagnifier =
    ready &&
    isBrushTool &&
    brushSize <= MAGNIFIER_MAX_BRUSH_SIZE &&
    magnifierVisible &&
    cursorImage

  return (
    <section className="mask-editor">
      <div className="mask-editor__toolbar">
        <div className="mask-editor__tools segment-control">
          <button
            type="button"
            className={`view-tab ${tool === TOOLS.erase ? 'view-tab--active' : ''}`}
            onClick={() => setTool(TOOLS.erase)}
            title="Erase subject (E)"
          >
            <IconErase size={14} />
            Erase
          </button>
          <button
            type="button"
            className={`view-tab ${tool === TOOLS.restore ? 'view-tab--active' : ''}`}
            onClick={() => setTool(TOOLS.restore)}
            title="Restore from original photo (R)"
          >
            <IconRestore size={14} />
            Restore
          </button>
          <button
            type="button"
            className={`view-tab ${tool === TOOLS.pan ? 'view-tab--active' : ''}`}
            onClick={() => setTool(TOOLS.pan)}
            title="Pan (H) · or hold Space and drag"
          >
            <IconPan size={14} />
            Pan
          </button>
        </div>

        {isBrushTool && (
          <div className="mask-editor__sliders">
            <label className="mask-editor__slider">
              <span>Size</span>
              <input
                type="range"
                min={4}
                max={200}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
              />
              <span className="mask-editor__slider-val">{brushSize}</span>
            </label>
            <label className="mask-editor__slider">
              <span>Hardness</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(brushHardness * 100)}
                onChange={(e) => setBrushHardness(Number(e.target.value) / 100)}
              />
              <span className="mask-editor__slider-val">{Math.round(brushHardness * 100)}%</span>
            </label>
          </div>
        )}

        <div className="mask-editor__actions">
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
          >
            <IconUndo size={16} />
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
          >
            <IconRedo size={16} />
          </button>
          <button
            type="button"
            className={`btn btn--ghost btn--icon ${showRemoved ? 'btn--active' : ''}`}
            onClick={toggleGuide}
            title="Blue = restorable background · red = your erasures"
          >
            Guide
          </button>
          <button type="button" className="btn btn--ghost btn--icon" onClick={resetView} title="Reset zoom">
            <IconZoom size={16} />
          </button>
        </div>
      </div>

      <div className="mask-editor__workspace-row">
      <div className="mask-editor__workspace">
        <div
          ref={containerRef}
          className="mask-editor__viewport checkerboard"
        >
          {!ready && <div className="mask-editor__loading">Loading editor…</div>}
          <canvas
            ref={displayRef}
            className={`mask-editor__canvas ${tool === TOOLS.pan || spacePan ? 'mask-editor__canvas--pan' : ''} ${isBrushTool ? 'mask-editor__canvas--brush' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={(e) => {
              setCursor(null)
              setCursorImage(null)
              magnifierVisibleRef.current = false
              setMagnifierVisible(false)
              cursorImageRef.current = null
              if (!painting.current || e.buttons === 0) onPointerUp(e)
            }}
            onWheel={onWheel}
            style={{ visibility: ready ? 'visible' : 'hidden' }}
          />
          {ready && cursor && isBrushTool && (
            <div
              className={`mask-editor__brush-cursor mask-editor__brush-cursor--${tool}${spacePan ? ' mask-editor__brush-cursor--space-pan' : ''}`}
              style={{
                width: brushCursorSize,
                height: brushCursorSize,
                left: cursor.x,
                top: cursor.y,
              }}
              aria-hidden="true"
            />
          )}
        </div>

        <aside
          className={`mask-editor__magnifier ${showMagnifier ? 'mask-editor__magnifier--visible' : ''}`}
          aria-label="Detail magnifier"
          aria-hidden={!showMagnifier}
        >
          <span className="mask-editor__magnifier-label">Detail</span>
          <div className="mask-editor__magnifier-loupe checkerboard">
            <canvas ref={magnifierRef} className="mask-editor__magnifier-canvas" />
          </div>
          <span className="mask-editor__magnifier-meta">{MAGNIFIER_PIXEL_RATIO}× zoom</span>
        </aside>
      </div>

      {ready && (
        <aside className="mask-editor__zoom-rail" aria-label="Zoom">
          <span className="mask-editor__zoom-label">Zoom</span>
          <input
            type="range"
            className="mask-editor__zoom-slider"
            min={ZOOM_SLIDER_MIN}
            max={ZOOM_SLIDER_MAX}
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(clampZoom(Number(e.target.value) / 100))}
            aria-valuetext={`${Math.round(zoom * 100)} percent`}
          />
          <span className="mask-editor__zoom-value">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="btn btn--ghost btn--compact mask-editor__zoom-reset"
            onClick={resetView}
            title="Reset zoom to 100% and re-center the image"
          >
            Reset
          </button>
        </aside>
      )}
      </div>

      {ready && (
        <div className="mask-editor__status" aria-live="polite">
          {spacePan
            ? 'Space — drag to pan'
            : tool === TOOLS.pan
              ? 'Drag to pan · scroll or use zoom slider · Space+drag also works'
              : tool === TOOLS.restore
                ? 'Restore paints back the original photo · scroll or zoom slider to zoom'
                : 'Erase removes subject · scroll or zoom slider to zoom'}
          {showRemoved && ' · Guide on'}
          {showMagnifier && ' · Detail view active'}
          {' · '}{imgSize.w}×{imgSize.h}
        </div>
      )}

      <div className="mask-editor__footer">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={startOver}
          disabled={!canUndo || saving}
          title="Discard all edits and restore the original cutout"
        >
          <IconStartOver size={14} />
          Start Over
        </button>
        <div className="mask-editor__footer-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          <IconClose size={14} />
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleDone}
          disabled={!ready || saving}
        >
          <IconCheck size={14} />
          {saving ? 'Applying…' : 'Done Editing'}
        </button>
        </div>
      </div>
    </section>
  )
}
