import { describe, expect, it } from 'vitest'
import {
  MAGNIFIER_MAX_BRUSH_RADIUS,
  MAGNIFIER_PIXEL_RATIO,
  MAGNIFIER_SIZE,
  MAX_ZOOM,
  MIN_ZOOM,
  TOOLS,
  brushFalloff,
  clampZoom,
  magnifierGeometry,
  paintBrush,
} from './brush'

function solid(width, height, [r, g, b, a]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }
  return { width, height, data }
}

function alphaAt(img, x, y) {
  return img.data[(y * img.width + x) * 4 + 3]
}

describe('clampZoom', () => {
  it('keeps zoom within limits', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(100)).toBe(MAX_ZOOM)
    expect(clampZoom(1.5)).toBe(1.5)
  })
})

describe('brushFalloff', () => {
  it('is full strength inside the hard core', () => {
    expect(brushFalloff(0, 10, 0.5)).toBe(1)
    expect(brushFalloff(5, 10, 0.5)).toBe(1)
  })

  it('fades linearly to zero at the edge', () => {
    expect(brushFalloff(7.5, 10, 0.5)).toBeCloseTo(0.5)
    expect(brushFalloff(10, 10, 0.5)).toBe(0)
    expect(brushFalloff(20, 10, 0.5)).toBe(0)
  })
})

describe('magnifierGeometry', () => {
  // The ring drawn in the loupe must cover the same image pixels as the real brush.
  it.each([
    [2, 1],
    [5, 0.5],
    [1, 0.2],
    [5, 0.1],
    [3, 0.88],
  ])('ring matches brush footprint (brushSize=%s, viewScale=%s)', (brushSize, viewScale) => {
    const { brushRadius, srcDim } = magnifierGeometry(brushSize, viewScale)
    const loupePxPerImagePx = MAGNIFIER_SIZE / srcDim

    expect(brushRadius / loupePxPerImagePx).toBeCloseTo(brushSize / viewScale)
  })

  it('uses max zoom for tiny brushes', () => {
    expect(magnifierGeometry(1, 1).zoom).toBe(MAGNIFIER_PIXEL_RATIO)
  })

  it('never zooms out below 1x', () => {
    expect(magnifierGeometry(5, 0.05).zoom).toBe(1)
  })

  it('caps the ring when the brush allows zoom', () => {
    const { brushRadius, zoom } = magnifierGeometry(5, 0.5)

    expect(zoom).toBeGreaterThan(1)
    expect(brushRadius).toBeCloseTo(MAGNIFIER_MAX_BRUSH_RADIUS)
  })

  it('keeps the ring inside the loupe for every brush the loupe is shown with', () => {
    for (let brushSize = 1; brushSize <= 5; brushSize += 1) {
      for (const viewScale of [0.3, 0.5, 0.88]) {
        const { brushRadius } = magnifierGeometry(brushSize, viewScale)
        expect(brushRadius).toBeLessThan(MAGNIFIER_SIZE / 2)
      }
    }
  })
})

describe('paintBrush', () => {
  it('erases fully at the center and leaves pixels outside the radius alone', () => {
    const work = solid(20, 20, [100, 150, 200, 255])
    const original = solid(20, 20, [100, 150, 200, 255])

    paintBrush({ workData: work, originalData: original, cx: 10, cy: 10, radius: 4, hardness: 1, tool: TOOLS.erase })

    expect(alphaAt(work, 10, 10)).toBe(0)
    expect(alphaAt(work, 0, 0)).toBe(255)
    expect(alphaAt(work, 10, 15)).toBe(255)
  })

  it('premultiplies color when partially erasing', () => {
    const work = solid(5, 5, [200, 100, 50, 200])
    const original = solid(5, 5, [200, 100, 50, 200])

    paintBrush({ workData: work, originalData: original, cx: 2, cy: 2, radius: 2, hardness: 0, tool: TOOLS.erase })

    const idx = (2 * 5 + 3) * 4
    const alpha = work.data[idx + 3]
    expect(alpha).toBe(100)
    expect(work.data[idx]).toBe(100)
  })

  it('restores original pixels', () => {
    const work = solid(10, 10, [0, 0, 0, 0])
    const original = solid(10, 10, [10, 20, 30, 255])

    paintBrush({ workData: work, originalData: original, cx: 5, cy: 5, radius: 3, hardness: 1, tool: TOOLS.restore })

    const idx = (5 * 10 + 5) * 4
    expect(Array.from(work.data.slice(idx, idx + 4))).toEqual([10, 20, 30, 255])
    expect(alphaAt(work, 0, 0)).toBe(0)
  })

  it('does not write outside the image at the edges', () => {
    const work = solid(4, 4, [1, 1, 1, 255])
    const original = solid(4, 4, [1, 1, 1, 255])

    paintBrush({ workData: work, originalData: original, cx: 0, cy: 0, radius: 10, hardness: 1, tool: TOOLS.erase })

    expect(work.data.length).toBe(4 * 4 * 4)
    expect(work.data.every((v, i) => i % 4 !== 3 || v === 0)).toBe(true)
  })

  it('does nothing with the pan tool', () => {
    const work = solid(6, 6, [9, 9, 9, 255])
    const before = Array.from(work.data)

    paintBrush({ workData: work, originalData: solid(6, 6, [0, 0, 0, 0]), cx: 3, cy: 3, radius: 3, hardness: 1, tool: TOOLS.pan })

    expect(Array.from(work.data)).toEqual(before)
  })
})
