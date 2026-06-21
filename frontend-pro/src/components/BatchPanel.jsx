import { useState } from 'react'
import JSZip from 'jszip'
import DropZone from './DropZone'
import { formatBytes, swapExt } from '../utils/format'

const STATUS_LABEL = {
  pending: 'Pending',
  processing: 'Processing…',
  done: 'Done',
  error: 'Error',
}

export default function BatchPanel({ open, onClose, onProcessOne, onDownloadZip }) {
  const [queue, setQueue] = useState([])
  const [processing, setProcessing] = useState(false)
  const [progressLabel, setProgressLabel] = useState('')

  if (!open) return null

  const addFiles = (files) => {
    const items = files.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      error: null,
    }))
    setQueue((q) => [...q, ...items])
  }

  const removeItem = (id) => setQueue((q) => q.filter((i) => i.id !== id))

  const clearDone = () => setQueue((q) => q.filter((i) => i.status !== 'done'))

  const runBatch = async () => {
    const pending = queue.filter((i) => i.status === 'pending' || i.status === 'error')
    if (!pending.length) return

    setProcessing(true)
    const completed = []
    const total = pending.length

    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index]
      setProgressLabel(`Processing ${index + 1} of ${total}…`)
      setQueue((q) =>
        q.map((i) =>
          i.id === item.id ? { ...i, status: 'processing', error: null } : i,
        ),
      )

      try {
        const blob = await onProcessOne(item.file)
        completed.push({ name: item.file.name, blob })
        setQueue((q) =>
          q.map((i) => (i.id === item.id ? { ...i, status: 'done', error: null } : i)),
        )
      } catch (err) {
        setQueue((q) =>
          q.map((i) =>
            i.id === item.id
              ? { ...i, status: 'error', error: err.message || 'Failed' }
              : i,
          ),
        )
      }
    }

    if (completed.length) {
      try {
        await onDownloadZip(completed)
      } catch (err) {
        setQueue((q) =>
          q.map((i) =>
            i.status === 'done' && completed.some((c) => c.name === i.file.name)
              ? { ...i, status: 'error', error: err.message || 'Save failed' }
              : i,
          ),
        )
      }
    }

    setProcessing(false)
    setProgressLabel('')
  }

  const pendingCount = queue.filter((i) => i.status === 'pending' || i.status === 'error').length

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="batch-panel" onClick={(e) => e.stopPropagation()}>
        <header className="batch-panel__header">
          <h2>Batch mode</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="batch-panel__body">
          <DropZone
            onFiles={addFiles}
            multiple
            label="Add images to queue"
          />

          {queue.length > 0 && (
            <ul className="batch-queue">
              {queue.map((item) => (
                <li key={item.id} className={`batch-item batch-item--${item.status}`}>
                  <div className="batch-item__info">
                    <span className="batch-item__name">{item.file.name}</span>
                    <span className="batch-item__meta">{formatBytes(item.file.size)}</span>
                  </div>
                  <span className={`batch-item__status batch-item__status--${item.status}`}>
                    {item.error || STATUS_LABEL[item.status]}
                  </span>
                  {!processing && item.status !== 'processing' && (
                    <button type="button" className="icon-btn" onClick={() => removeItem(item.id)}>×</button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="batch-panel__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={processing || pendingCount === 0}
              onClick={runBatch}
            >
              {processing
                ? progressLabel || 'Processing…'
                : `Process ${pendingCount || ''} image${pendingCount !== 1 ? 's' : ''}`}
            </button>
            {queue.some((i) => i.status === 'done') && !processing && (
              <button type="button" className="btn btn--ghost" onClick={clearDone}>
                Clear completed
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export async function buildZip(entries) {
  const zip = new JSZip()
  for (const { name, blob } of entries) {
    zip.file(swapExt(name, '.png'), blob)
  }
  return zip.generateAsync({ type: 'blob' })
}
