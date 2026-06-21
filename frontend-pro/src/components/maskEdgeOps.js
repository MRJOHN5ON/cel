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

function blurAlphaChannel(data, width, height, radius) {
  const pixelCount = width * height
  const alphas = new Float32Array(pixelCount)
  const temp = new Float32Array(pixelCount)
  const blurred = new Float32Array(pixelCount)

  for (let i = 0; i < pixelCount; i += 1) {
    alphas[i] = data[i * 4 + 3]
  }

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
  const radius = clamp(Math.round(radiusPx), 1, 24)
  const { width, height, data } = imageData
  const blurredAlpha = blurAlphaChannel(data, width, height, radius)

  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4
    const oldAlpha = data[idx + 3]
    const newAlpha = clamp255(blurredAlpha[i])

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

function unmixFromWhite(r, g, b, alpha) {
  const a = alpha / 255
  if (a <= 0.04) return [r, g, b]

  const inv = 1 - a
  return [
    clamp255(((r / 255 - inv) / a) * 255),
    clamp255(((g / 255 - inv) / a) * 255),
    clamp255(((b / 255 - inv) / a) * 255),
  ]
}

function sampleSolidNeighborColor(data, alpha, width, height, x, y, sampleRadius) {
  let sr = 0
  let sg = 0
  let sb = 0
  let count = 0

  for (let dy = -sampleRadius; dy <= sampleRadius; dy += 1) {
    for (let dx = -sampleRadius; dx <= sampleRadius; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

      const ni = ny * width + nx
      if (alpha[ni] < 240) continue

      const nidx = ni * 4
      sr += data[nidx]
      sg += data[nidx + 1]
      sb += data[nidx + 2]
      count += 1
    }
  }

  if (count === 0) return null
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

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      const a = alpha[i]
      if (a >= 252 || a <= 4) continue

      const idx = i * 4
      const fringe = 1 - Math.abs(a - 128) / 128
      const mix = amount * fringe
      if (mix <= 0.01) continue

      const neighbor = sampleSolidNeighborColor(data, alpha, width, height, x, y, 4)
      let targetR
      let targetG
      let targetB

      if (neighbor) {
        ;[targetR, targetG, targetB] = neighbor
      } else {
        ;[targetR, targetG, targetB] = unmixFromWhite(
          data[idx],
          data[idx + 1],
          data[idx + 2],
          a,
        )
      }

      out[idx] = clamp255(data[idx] * (1 - mix) + targetR * mix)
      out[idx + 1] = clamp255(data[idx + 1] * (1 - mix) + targetG * mix)
      out[idx + 2] = clamp255(data[idx + 2] * (1 - mix) + targetB * mix)
    }
  }

  data.set(out)
  return imageData
}
