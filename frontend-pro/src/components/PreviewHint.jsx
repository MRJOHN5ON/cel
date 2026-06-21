const HINTS = {
  side: 'Previews are scaled to fit your screen. Save Result exports the full-resolution file.',
  slider: 'Previews are scaled to fit your screen. Save Result exports the full-resolution file.',
}

export default function PreviewHint({ view }) {
  const hint = HINTS[view]
  if (!hint) return null
  return <p className="preview-hint">{hint}</p>
}
