export const TOOLS = { erase: 'erase', restore: 'restore', pan: 'pan' }

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

export function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export const MAGNIFIER_SIZE = 128
export const MAGNIFIER_PIXEL_RATIO = 4
// Cap ring size so it stays readable when zoomed far out (low viewScale).
export const MAGNIFIER_MAX_BRUSH_RADIUS = (MAGNIFIER_SIZE / 2) * 0.45

export function magnifierGeometry(brushSize, viewScale, size = MAGNIFIER_SIZE) {
  const brushRadiusImg = brushSize / viewScale
  const zoom = Math.max(
    1,
    Math.min(
      MAGNIFIER_PIXEL_RATIO,
      MAGNIFIER_MAX_BRUSH_RADIUS / brushRadiusImg,
    ),
  )
  return {
    zoom,
    brushRadius: brushRadiusImg * zoom,
    srcDim: size / zoom,
  }
}

export function brushFalloff(dist, radius, hardness) {
  if (dist >= radius) return 0
  const inner = radius * hardness
  if (dist <= inner) return 1
  return 1 - (dist - inner) / (radius - inner)
}

export function paintBrush({ workData, originalData, cx, cy, radius, hardness, tool }) {
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
