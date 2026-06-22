import { useState, useEffect, useRef, useCallback } from 'react'
import DropZone from './components/DropZone'
import CompareSlider from './components/CompareSlider'
import PreviewHint from './components/PreviewHint'
import ProcessingOptions from './components/ProcessingOptions'
import BatchPanel, { buildZip } from './components/BatchPanel'
import MaskEditor from './components/MaskEditor'
import SamPointPicker from './components/SamPointPicker'
import {
  LogoMark,
  IconBatch,
  IconTag,
  IconMac,
  IconPerson,
  IconWand,
  IconSave,
  IconPlusPhoto,
  IconSplit,
  IconSlider,
  IconWarning,
  IconError,
  IconSparkle,
  IconClose,
  IconSun,
  IconMoon,
  IconEdit,
} from './components/Icons'
import { useSettings } from './hooks/useSettings'
import { useTheme } from './hooks/useTheme'
import {
  formatBytes,
  formatDimensions,
  swapExt,
  isAcceptedImage,
  UNSUPPORTED_FORMAT_MSG,
  saveBlob,
} from './utils/format'
import './App.css'

function previewFrameStyle(width, height) {
  const w = width || 4
  const h = height || 3
  return {
    '--preview-w': w,
    '--preview-h': h,
    '--preview-aspect': `${w} / ${h}`,
  }
}

const VIEWS = { side: 'side', slider: 'slider' }

const VIEW_TABS = [
  [VIEWS.side, 'Side by Side', IconSplit],
  [VIEWS.slider, 'Slider', IconSlider],
]

export default function App() {
  const [settings, updateSettings] = useSettings()
  const [theme, toggleTheme] = useTheme()
  const [models, setModels] = useState([])
  const [backendOnline, setBackendOnline] = useState(null)
  const [batchOpen, setBatchOpen] = useState(false)

  const [file, setFile] = useState(null)
  const [originalUrl, setOriginalUrl] = useState(null)
  const [resultUrl, setResultUrl] = useState(null)
  const [resultBlob, setResultBlob] = useState(null)
  const [metadata, setMetadata] = useState(null)
  const [inspectInfo, setInspectInfo] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ pct: 0, message: '' })
  const [view, setView] = useState(VIEWS.side)
  const [editMode, setEditMode] = useState(false)
  const abortRef = useRef(null)
  const originalUrlRef = useRef(null)
  const resultUrlRef = useRef(null)

  const phase = !file ? 'idle' : (processing || resultBlob) ? 'results' : 'setup'

  const revokeOriginalUrl = () => {
    if (originalUrlRef.current) {
      URL.revokeObjectURL(originalUrlRef.current)
      originalUrlRef.current = null
    }
  }

  const revokeResultUrl = () => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
  }

  const checkBackend = useCallback(() => {
    fetch('/api/health')
      .then((r) => {
        if (!r.ok) throw new Error('offline')
        return r.json()
      })
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))

    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => setModels(d.models))
      .catch(() => {})
  }, [])

  useEffect(() => {
    checkBackend()
    const interval = setInterval(checkBackend, 10000)
    return () => {
      clearInterval(interval)
      revokeOriginalUrl()
      revokeResultUrl()
    }
  }, [checkBackend])

  useEffect(() => {
    document.documentElement.classList.toggle('app-scroll', phase !== 'idle')
    return () => document.documentElement.classList.remove('app-scroll')
  }, [phase])

  useEffect(() => {
    const lockX = () => {
      if (window.scrollX !== 0) window.scrollTo(0, window.scrollY)
    }

    const blockHorizontalWheel = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      if (Math.abs(e.deltaX) < 4) return
      e.preventDefault()
    }

    lockX()
    document.documentElement.scrollLeft = 0
    document.body.scrollLeft = 0
    window.addEventListener('scroll', lockX, { passive: true })
    window.addEventListener('wheel', blockHorizontalWheel, { passive: false })
    return () => {
      window.removeEventListener('scroll', lockX)
      window.removeEventListener('wheel', blockHorizontalWheel)
    }
  }, [])

  const resetResult = () => {
    revokeResultUrl()
    setResultUrl(null)
    setResultBlob(null)
    setMetadata(null)
  }

  const handleFiles = useCallback(async (files) => {
    const f = files[0]
    if (!f) return

    if (!isAcceptedImage(f)) {
      setError(UNSUPPORTED_FORMAT_MSG)
      return
    }

    revokeOriginalUrl()
    resetResult()
    setError(null)
    setFile(f)
    setView(VIEWS.side)
    const url = URL.createObjectURL(f)
    originalUrlRef.current = url
    setOriginalUrl(url)
    setWarnings([])
    setInspectInfo(null)

    const form = new FormData()
    form.append('file', f)
    try {
      const res = await fetch('/api/inspect', { method: 'POST', body: form })
      if (res.ok) {
        const info = await res.json()
        setInspectInfo(info)
        setWarnings(info.warnings || [])
      }
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    const onPaste = (e) => {
      if (batchOpen) return
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          if (blob) {
            e.preventDefault()
            const ext = blob.type === 'image/png' ? '.png' : '.jpg'
            const named = new File([blob], `pasted-image${ext}`, { type: blob.type })
            handleFiles([named])
          }
          break
        }
      }
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [batchOpen, handleFiles])

  const cancelProcess = () => {
    abortRef.current?.abort()
    setProcessing(false)
    setProgress({ pct: 0, message: '' })
  }

  const process = async () => {
    if (!file || processing) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setProcessing(true)
    setProgress({ pct: 0, message: 'Starting…' })
    setError(null)
    resetResult()

    const params = new URLSearchParams({
      model: settings.model,
      alpha_matting: settings.alphaMatting,
      force_alpha_matting: settings.forceAlphaMatting,
      post_process_mask: settings.postProcessMask,
    })

    const form = new FormData()
    form.append('file', file)

    try {
      const startRes = await fetch(`/api/remove/job?${params}`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}))
        throw new Error(err.detail || 'Background removal failed.')
      }

      const { job_id: jobId } = await startRes.json()
      let data = null

      while (!controller.signal.aborted) {
        await new Promise((r) => setTimeout(r, 400))

        const statusRes = await fetch(`/api/jobs/${jobId}`, {
          signal: controller.signal,
        })

        if (!statusRes.ok) {
          throw new Error('Lost connection to the processing job.')
        }

        const status = await statusRes.json()
        setProgress({
          pct: status.progress ?? 0,
          message: status.message || 'Processing…',
        })

        if (status.status === 'complete') {
          data = status
          break
        }
        if (status.status === 'error') {
          throw new Error(status.error || 'Background removal failed.')
        }
      }

      if (controller.signal.aborted || !data) return

      const bytes = Uint8Array.from(atob(data.image), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'image/png' })
      setResultBlob(blob)
      const url = URL.createObjectURL(blob)
      resultUrlRef.current = url
      setResultUrl(url)
      setMetadata(data.metadata)
      setWarnings(data.metadata.warnings || [])
      setProgress({ pct: 100, message: 'Done' })
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setProcessing(false)
    }
  }

  const saveResult = async () => {
    if (!resultBlob || !file) return
    setError(null)
    try {
      await saveBlob(resultBlob, swapExt(file.name, '.png'))
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Save failed.')
      }
    }
  }

  const processOne = async (imageFile) => {
    const params = new URLSearchParams({
      model: settings.model,
      alpha_matting: settings.alphaMatting,
      force_alpha_matting: settings.forceAlphaMatting,
      post_process_mask: settings.postProcessMask,
    })

    const form = new FormData()
    form.append('file', imageFile)

    const res = await fetch(`/api/remove?${params}`, { method: 'POST', body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Processing failed')
    }

    return res.blob()
  }

  const downloadZip = async (entries) => {
    const zipBlob = await buildZip(entries)
    try {
      await saveBlob(zipBlob, 'removed-backgrounds.zip')
    } catch (err) {
      if (err.name === 'AbortError') return
      throw err
    }
  }

  const clearAll = () => {
    cancelProcess()
    revokeOriginalUrl()
    revokeResultUrl()
    setFile(null)
    setOriginalUrl(null)
    setResultUrl(null)
    setResultBlob(null)
    setMetadata(null)
    setInspectInfo(null)
    setWarnings([])
    setError(null)
    setView(VIEWS.side)
    setEditMode(false)
    setProgress({ pct: 0, message: '' })
  }

  const applySamCutout = useCallback((blob, meta) => {
    revokeResultUrl()
    setResultBlob(blob)
    const url = URL.createObjectURL(blob)
    resultUrlRef.current = url
    setResultUrl(url)
    setMetadata(meta)
    setWarnings(meta.warnings || [])
    setError(null)
  }, [])

  const applyEditedResult = useCallback((blob) => {
    revokeResultUrl()
    setResultBlob(blob)
    const url = URL.createObjectURL(blob)
    resultUrlRef.current = url
    setResultUrl(url)
    setMetadata((prev) =>
      prev
        ? {
            ...prev,
            file_size: blob.size,
            edited: true,
          }
        : prev,
    )
    setEditMode(false)
  }, [])

  const handleEditCancel = useCallback(() => setEditMode(false), [])

  const previewSourceW = metadata?.source_width ?? inspectInfo?.width
  const previewSourceH = metadata?.source_height ?? inspectInfo?.height
  const previewResultW = metadata?.output_width ?? previewSourceW
  const previewResultH = metadata?.output_height ?? previewSourceH
  const currentModelName =
    metadata?.model === 'sam'
      ? 'Smart Select'
      : models.find((m) => m.id === metadata?.model)?.name ?? metadata?.model

  const rerun = () => {
    if (!file || processing) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
    process()
  }

  const renderAlerts = () => (
    <>
      {warnings.length > 0 && (
        <div className="alert alert--warning">
          <IconWarning />
          <div>
            {warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        </div>
      )}
      {error && (
        <div className="alert alert--error">
          <IconError />
          <p>{error}</p>
        </div>
      )}
    </>
  )

  const renderPreview = () => {
    if (editMode && resultUrl) {
      return (
        <MaskEditor
          key={resultUrl}
          resultUrl={resultUrl}
          originalUrl={originalUrl}
          onDone={applyEditedResult}
          onCancel={handleEditCancel}
        />
      )
    }

    return (
    <section className="preview-area">
      {resultUrl && (
        <div className="preview-toolbar">
          <div className="segment-control">
            {VIEW_TABS.map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                className={`view-tab ${view === key ? 'view-tab--active' : ''}`}
                onClick={() => setView(key)}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
          <PreviewHint view={view} />
        </div>
      )}

      {view === VIEWS.slider && resultUrl ? (
        <CompareSlider
          beforeSrc={originalUrl}
          afterSrc={resultUrl}
          sourceWidth={metadata?.source_width ?? inspectInfo?.width}
          sourceHeight={metadata?.source_height ?? inspectInfo?.height}
        />
      ) : (
        <div className="preview-grid">
          <div className="preview-panel">
            <div className="preview-panel__label">Original</div>
            <div
              className="preview-panel__frame"
              style={previewFrameStyle(previewSourceW, previewSourceH)}
            >
              <img src={originalUrl} alt="Original" draggable={false} />
            </div>
          </div>
          <div className="preview-panel">
            <div className="preview-panel__label">Result</div>
            <div
              className="preview-panel__frame checkerboard"
              style={previewFrameStyle(previewResultW, previewResultH)}
            >
              {processing ? (
                <div className="processing">
                  <IconSparkle size={34} className="processing__sparkle" />
                  <p>{progress.message || 'Removing background…'}</p>
                  <div className="progress-bar" aria-hidden="true">
                    <div
                      className="progress-bar__fill"
                      style={{ width: `${Math.min(100, progress.pct || 0)}%` }}
                    />
                  </div>
                  <span className="progress-bar__pct">{Math.round(progress.pct || 0)}%</span>
                  <small>Processing at full resolution — large images can take several minutes</small>
                </div>
              ) : resultUrl ? (
                <img src={resultUrl} alt="Result" draggable={false} />
              ) : (
                <div className="preview-placeholder">
                  <IconSparkle size={28} />
                  <p>Processing…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
    )
  }

  return (
    <div className={`app app--${phase}`}>
      <header className="header">
        <div className="header__inner">
          <div className="header__brand">
            <div className="header__logo" aria-hidden="true">
              <LogoMark size={18} />
            </div>
            <span className="header__wordmark">Cel <span className="header__pro">Pro</span></span>
          </div>
          <nav className="header__nav">
            <button
              type="button"
              className="btn btn--ghost theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setBatchOpen(true)}>
              <IconBatch size={15} />
              Batch
            </button>
          </nav>
        </div>
      </header>

      <div className="app__content">
        {backendOnline === false && (
          <div className="offline-banner" role="alert">
            <IconError size={16} />
            <p>
              Can&apos;t reach the server. Restart Cel Pro or run <code>./start.sh</code> in dev mode.
            </p>
          </div>
        )}

        <main className={`main main--${phase}`}>
          {phase === 'idle' && (
            <>
              <section className="hero hero--landing">
                <div className="hero__pills">
                  <span className="hero__pill hero__pill--pro"><IconEdit size={13} /> Pro Editor</span>
                  <span className="hero__pill"><IconTag size={13} /> Free</span>
                  <span className="hero__pill"><IconMac size={13} /> Local</span>
                  <span className="hero__pill"><IconPerson size={13} /> No account</span>
                </div>
                <h2 className="hero__title">
                  Remove backgrounds.<br />Refine every edge.
                </h2>
                <p className="hero__subtitle">
                  Studio-quality transparent PNGs on your Mac — with pro cutout editing.
                  <br />
                  No credits, no subscription.
                </p>
                <p className="hero__privacy">Your images never leave this device.</p>
              </section>

              <ProcessingOptions
                settings={settings}
                onChange={updateSettings}
                models={models}
                inspectInfo={inspectInfo}
              />

              <section className="empty-state">
                <DropZone onFiles={handleFiles} />
              </section>
            </>
          )}

          {phase === 'setup' && (
            <>
              <section className="hero hero--compact">
                <div className="hero__pills">
                  <span className="hero__pill hero__pill--pro"><IconEdit size={13} /> Pro Editor</span>
                  <span className="hero__pill"><IconTag size={13} /> Free</span>
                  <span className="hero__pill"><IconMac size={13} /> Local</span>
                  <span className="hero__pill"><IconPerson size={13} /> No account</span>
                </div>
                <h2 className="hero__title">
                  Remove backgrounds.<br />Refine every edge.
                </h2>
                <p className="hero__subtitle">
                  Adjust settings, then hit Remove Background when you&apos;re ready.
                </p>
              </section>

              <ProcessingOptions
                settings={settings}
                onChange={updateSettings}
                models={models}
                inspectInfo={inspectInfo}
              />

              {renderAlerts()}

              <section className="upload-chip">
                <div className="upload-chip__thumb">
                  <img src={originalUrl} alt="" draggable={false} />
                </div>
                <div className="upload-chip__info">
                  <strong>{file.name}</strong>
                  {inspectInfo && (
                    <span>
                      {formatDimensions(inspectInfo.width, inspectInfo.height)}
                      {' · '}{formatBytes(inspectInfo.file_size)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="upload-chip__clear"
                  onClick={clearAll}
                  aria-label="Remove photo"
                  title="Remove photo"
                >
                  <IconClose size={14} />
                </button>
              </section>

              <SamPointPicker
                imageUrl={originalUrl}
                file={file}
                settings={settings}
                disabled={backendOnline === false || processing}
                onApply={applySamCutout}
              />

              <section className="actions">
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={process}
                  disabled={backendOnline === false}
                >
                  <IconWand size={16} />
                  Remove Background
                </button>
              </section>
            </>
          )}

          {phase === 'results' && (
            <>
              {renderAlerts()}
              {renderPreview()}

              {metadata && (
                <section className="output-meta">
                  Output: {formatDimensions(metadata.output_width, metadata.output_height)}
                  {' · '}{formatBytes(metadata.file_size)}
                  {currentModelName && (
                    <>
                      {' · '}Model: {currentModelName}
                    </>
                  )}
                </section>
              )}

              {resultBlob && models.length > 0 && (
                <section className="rerun-bar">
                  <label className="rerun-bar__field">
                    <span className="rerun-bar__label">Try another model</span>
                    <select
                      value={settings.model}
                      onChange={(e) => updateSettings({ model: e.target.value })}
                      disabled={processing}
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn btn--secondary btn--lg rerun-bar__btn"
                    onClick={rerun}
                    disabled={processing || backendOnline === false}
                  >
                    <IconWand size={16} />
                    Rerun
                  </button>
                </section>
              )}

              <section className="actions">
                {resultBlob ? (
                  <>
                    {!editMode && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--lg"
                        onClick={() => setEditMode(true)}
                      >
                        <IconEdit size={16} />
                        Edit Cutout
                      </button>
                    )}
                    <button type="button" className="btn btn--primary btn--lg" onClick={clearAll}>
                      <IconPlusPhoto size={16} />
                      New Image
                    </button>
                    <button type="button" className="btn btn--success btn--lg" onClick={saveResult}>
                      <IconSave size={16} />
                      Save Result
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn--primary btn--lg" disabled>
                      <IconSparkle size={16} />
                      {progress.message || 'Processing…'}
                      {progress.pct > 0 && ` (${Math.round(progress.pct)}%)`}
                    </button>
                    <button type="button" className="btn btn--ghost btn--lg" onClick={cancelProcess}>
                      Cancel
                    </button>
                  </>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      <BatchPanel
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onProcessOne={processOne}
        onDownloadZip={downloadZip}
      />
    </div>
  )
}
