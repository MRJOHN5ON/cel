export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatDimensions(w, h) {
  return `${w} × ${h}`
}

export function swapExt(filename, ext) {
  const dot = filename.lastIndexOf('.')
  const base = dot >= 0 ? filename.slice(0, dot) : filename
  return `${base}_BGREMOVED${ext}`
}

export const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

export const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']

export const ACCEPTED_EXT = ACCEPTED_EXTENSIONS.join(',')

export function getFileExtension(filename) {
  const dot = filename.lastIndexOf('.')
  if (dot < 0) return ''
  return filename.slice(dot).toLowerCase()
}

export function isAcceptedImage(file) {
  if (file.type && ACCEPTED_TYPES.includes(file.type)) return true
  return ACCEPTED_EXTENSIONS.includes(getFileExtension(file.name))
}

export const UNSUPPORTED_FORMAT_MSG =
  'Unsupported format. Please use JPG, PNG, WEBP, or HEIC.'

const SAVE_TYPES = {
  png: {
    description: 'PNG image',
    accept: { 'image/png': ['.png'] },
  },
  zip: {
    description: 'ZIP archive',
    accept: { 'application/zip': ['.zip'] },
  },
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== 'string' || !dataUrl.includes(',')) {
        reject(new Error('Could not encode file'))
        return
      }
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = () => reject(reader.error || new Error('Could not read file'))
    reader.readAsDataURL(blob)
  })
}

async function waitForNativeSaveApi(timeoutMs = 8000) {
  if (window.pywebview?.api?.save_file) return true
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    if (window.pywebview?.api?.save_file) return true
  }
  return false
}

async function saveViaNativeDialog(blob, suggestedName) {
  const dataBase64 = await blobToBase64(blob)
  const result = await window.pywebview.api.save_file(dataBase64, suggestedName)
  if (result?.cancelled) return
  if (!result?.ok) {
    throw new Error(result?.error || 'Save failed.')
  }
}

export async function saveBlob(blob, suggestedName) {
  if (await waitForNativeSaveApi()) {
    await saveViaNativeDialog(blob, suggestedName)
    return
  }

  const ext = suggestedName.includes('.')
    ? suggestedName.split('.').pop().toLowerCase()
    : 'png'
  const typeConfig = SAVE_TYPES[ext] || SAVE_TYPES.png

  if (typeof window.showSaveFilePicker === 'function') {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [typeConfig],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return
  }

  triggerDownload(blob, suggestedName)
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
