function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function clamp255(value) {
  return clamp(Math.round(value), 0, 255)
}

function boxBlurPass(src, dst, width, height, radius, horizontal) {
  const windowSize = radius * 2 + 1

  if (horizontal) {
    for (let y = 0; y < height; y += 1) {
      const row = y * width
      let sum = 0
      for (let x = -radius; x <= radius; x += 1) {
        sum += src[row + clamp(x, 0, width - 1)]
      }
      for (let x = 0; x < width; x += 1) {
        dst[row + x] = sum / windowSize
        const removeX = x - radius
        const addX = x + radius + 1
        sum +=
          src[row + clamp(addX, 0, width - 1)] -
          src[row + clamp(removeX, 0, width - 1)]
      }
    }
    return
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0
    for (let y = -radius; y <= radius; y += 1) {
      sum += src[clamp(y, 0, height - 1) * width + x]
    }
    for (let y = 0; y < height; y += 1) {
      dst[y * width + x] = sum / windowSize
      const removeY = y - radius
      const addY = y + radius + 1
      sum +=
        src[clamp(addY, 0, height - 1) * width + x] -
        src[clamp(removeY, 0, height - 1) * width + x]
    }
  }
}

function blurAlphaChannel(alphas, width, height, radius) {
  const pixelCount = width * height
  const temp = new Float32Array(pixelCount)
  const blurred = new Float32Array(pixelCount)

  const passes = radius <= 2 ? 2 : 3
  let src = alphas
  let dst = temp

  for (let pass = 0; pass < passes; pass += 1) {
    boxBlurPass(src, dst, width, height, radius, true)
    boxBlurPass(dst, blurred, width, height, radius, false)
    src = blurred
    dst = temp
  }

  return src
}

export function featherImageData(imageData, radiusPx = 4) {
  const radius = clamp(Math.round(radiusPx), 1, 16)
  const { width, height, data } = imageData
  const pixelCount = width * height
  const originalAlpha = new Float32Array(pixelCount)

  for (let i = 0; i < pixelCount; i += 1) {
    originalAlpha[i] = data[i * 4 + 3]
  }

  const blurredAlpha = blurAlphaChannel(originalAlpha, width, height, radius)

  for (let i = 0; i < pixelCount; i += 1) {
    const idx = i * 4
    const orig = originalAlpha[i]
    const blurred = blurredAlpha[i]
    let newAlpha

    if (orig >= 248) {
      newAlpha = orig
    } else if (orig <= 5) {
      newAlpha = Math.min(blurred, orig)
    } else if (orig >= 128) {
      // Subject side — soften outward only, never eat into the cutout.
      newAlpha = Math.max(orig, blurred)
    } else {
      // Background side — extend a soft falloff into transparency.
      newAlpha = blurred
    }

    newAlpha = clamp255(newAlpha)
    const oldAlpha = data[idx + 3]

    if (oldAlpha > 0 && newAlpha !== oldAlpha) {
      const scale = newAlpha / oldAlpha
      data[idx] = clamp255(data[idx] * scale)
      data[idx + 1] = clamp255(data[idx + 1] * scale)
      data[idx + 2] = clamp255(data[idx + 2] * scale)
    }

    data[idx + 3] = newAlpha
  }

  return imageData
}

function unmixForeground(r, g, b, alpha, bgR, bgG, bgB) {
  const a = alpha / 255
  if (a <= 0.08) return [r, g, b]

  const inv = 1 - a
  const bgRf = bgR / 255
  const bgGf = bgG / 255
  const bgBf = bgB / 255

  return [
    clamp255(((r / 255 - inv * bgRf) / a) * 255),
    clamp255(((g / 255 - inv * bgGf) / a) * 255),
    clamp255(((b / 255 - inv * bgBf) / a) * 255),
  ]
}

function estimateBackgroundColor(data, alpha, width, height, x, y, sampleRadius) {
  let sr = 0
  let sg = 0
  let sb = 0
  let weight = 0

  for (let dy = -sampleRadius; dy <= sampleRadius; dy += 1) {
    for (let dx = -sampleRadius; dx <= sampleRadius; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

      const ni = ny * width + nx
      const na = alpha[ni]
      if (na > 12) continue

      const dist = Math.hypot(dx, dy)
      if (dist > sampleRadius) continue

      const w = 1 / (1 + dist)
      const nidx = ni * 4
      sr += data[nidx] * w
      sg += data[nidx + 1] * w
      sb += data[nidx + 2] * w
      weight += w
    }
  }

  if (weight <= 0) return null
  return [sr / weight, sg / weight, sb / weight]
}

function estimateGlobalBackground(data, alpha, width, height) {
  const samples = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ]

  let sr = 0
  let sg = 0
  let sb = 0
  let count = 0

  for (const [x, y] of samples) {
    const i = y * width + x
    if (alpha[i] > 20) continue
    const idx = i * 4
    sr += data[idx]
    sg += data[idx + 1]
    sb += data[idx + 2]
    count += 1
  }

  if (count === 0) return [255, 255, 255]
  return [sr / count, sg / count, sb / count]
}

export function defringeImageData(imageData, strength = 0.65) {
  const amount = clamp(strength, 0.05, 1)
  const { width, height, data } = imageData
  const pixelCount = width * height
  const alpha = new Uint8Array(pixelCount)
  const out = new Uint8ClampedArray(data)

  for (let i = 0; i < pixelCount; i += 1) {
    alpha[i] = data[i * 4 + 3]
  }

  const globalBg = estimateGlobalBackground(data, alpha, width, height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      const a = alpha[i]
      if (a >= 252 || a <= 12) continue

      const idx = i * 4
      const localBg = estimateBackgroundColor(data, alpha, width, height, x, y, 10)
      const [bgR, bgG, bgB] = localBg ?? globalBg

      const fringe = Math.min(1, Math.min(a, 255 - a) / 64)
      const mix = amount * fringe
      if (mix <= 0.01) continue

      const [fr, fg, fb] = unmixForeground(
        data[idx],
        data[idx + 1],
        data[idx + 2],
        a,
        bgR,
        bgG,
        bgB,
      )

      out[idx] = clamp255(data[idx] * (1 - mix) + fr * mix)
      out[idx + 1] = clamp255(data[idx + 1] * (1 - mix) + fg * mix)
      out[idx + 2] = clamp255(data[idx + 2] * (1 - mix) + fb * mix)
    }
  }

  data.set(out)
  return imageData
}
