import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatDimensions,
  getFileExtension,
  isAcceptedImage,
  swapExt,
} from './format'
import { isLargeForAlphaMatting } from '../hooks/useSettings'

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5.00 MB'],
  ])('%s -> %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})

describe('formatDimensions', () => {
  it('uses a multiplication sign', () => {
    expect(formatDimensions(1920, 1080)).toBe('1920 × 1080')
  })
})

describe('swapExt', () => {
  it.each([
    ['photo.jpg', '.png', 'photo_BGREMOVED.png'],
    ['my.cat.heic', '.png', 'my.cat_BGREMOVED.png'],
    ['noext', '.jpg', 'noext_BGREMOVED.jpg'],
  ])('%s', (name, ext, expected) => {
    expect(swapExt(name, ext)).toBe(expected)
  })
})

describe('getFileExtension', () => {
  it('lowercases and handles missing extensions', () => {
    expect(getFileExtension('IMG_1.HEIC')).toBe('.heic')
    expect(getFileExtension('README')).toBe('')
  })
})

describe('isAcceptedImage', () => {
  it('accepts by MIME type', () => {
    expect(isAcceptedImage({ type: 'image/webp', name: 'x' })).toBe(true)
  })

  it('falls back to extension when the browser gives no type (common for HEIC)', () => {
    expect(isAcceptedImage({ type: '', name: 'IMG_0001.HEIC' })).toBe(true)
  })

  it('rejects other formats', () => {
    expect(isAcceptedImage({ type: 'image/gif', name: 'a.gif' })).toBe(false)
  })
})

describe('isLargeForAlphaMatting', () => {
  it.each([
    [null, false],
    [{ width: 2000, height: 1250 }, false],
    [{ width: 2001, height: 100 }, true],
    [{ width: 1600, height: 1600 }, true],
  ])('%j -> %s', (info, expected) => {
    expect(isLargeForAlphaMatting(info)).toBe(expected)
  })
})
