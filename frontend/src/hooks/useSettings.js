import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'cel-settings'
const LEGACY_STORAGE_KEY = 'rembg-studio-settings'

const DEFAULTS = {
  model: 'isnet-general-use',
  alphaMatting: true,
  forceAlphaMatting: false,
}

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
        ?? localStorage.getItem(LEGACY_STORAGE_KEY)
      if (!saved) return DEFAULTS
      const parsed = JSON.parse(saved)
      return {
        model: parsed.model ?? DEFAULTS.model,
        alphaMatting: parsed.alphaMatting ?? DEFAULTS.alphaMatting,
        forceAlphaMatting: parsed.forceAlphaMatting ?? DEFAULTS.forceAlphaMatting,
      }
    } catch {
      return DEFAULTS
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const update = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  return [settings, update]
}

export const ALPHA_MATTING_MAX_PIXELS = 2_500_000
export const ALPHA_MATTING_MAX_SIDE_PX = 2000

export function isLargeForAlphaMatting(info) {
  if (!info?.width || !info?.height) return false
  const pixels = info.width * info.height
  return (
    pixels > ALPHA_MATTING_MAX_PIXELS
    || Math.max(info.width, info.height) > ALPHA_MATTING_MAX_SIDE_PX
  )
}
