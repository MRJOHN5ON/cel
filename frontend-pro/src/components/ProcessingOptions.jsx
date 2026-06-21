import { useState } from 'react'
import { IconInfo } from './Icons'
import { isLargeForAlphaMatting } from '../hooks/useSettings'

const ALPHA_MATTING_TIP =
  'Refines hair and soft edges with a second pass. Best for portraits. '
  + 'Can take several minutes on large images — Cel skips it automatically past 2.5 MP.'

export default function ProcessingOptions({ settings, onChange, models, inspectInfo }) {
  const [tipOpen, setTipOpen] = useState(false)
  const largeImage = isLargeForAlphaMatting(inspectInfo)
  const showForceOption = settings.alphaMatting && largeImage

  return (
    <section className="controls-bar">
      <label className="controls-bar__model">
        <span className="controls-bar__label">Model</span>
        <select
          value={settings.model}
          onChange={(e) => onChange({ model: e.target.value })}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.description}
            </option>
          ))}
        </select>
      </label>

      <div className="controls-bar__toggles">
        <label className="controls-bar__toggle">
          <input
            type="checkbox"
            checked={settings.alphaMatting}
            onChange={(e) => onChange({
              alphaMatting: e.target.checked,
              forceAlphaMatting: e.target.checked ? settings.forceAlphaMatting : false,
            })}
          />
          <span className="controls-bar__track" />
          <span className="controls-bar__toggle-text">
            Alpha matting
            <button
              type="button"
              className={`info-tip ${tipOpen ? 'info-tip--open' : ''}`}
              aria-label="About alpha matting"
              aria-expanded={tipOpen}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setTipOpen((open) => !open)
              }}
            >
              <IconInfo size={13} />
            </button>
          </span>
        </label>

        {showForceOption && (
          <label className="controls-bar__toggle controls-bar__toggle--sub">
            <input
              type="checkbox"
              checked={settings.forceAlphaMatting}
              onChange={(e) => onChange({ forceAlphaMatting: e.target.checked })}
            />
            <span className="controls-bar__track" />
            <span className="controls-bar__toggle-text">
              Force on large images
              <span className="controls-bar__hint">Slow — may take many minutes</span>
            </span>
          </label>
        )}

        <label className="controls-bar__toggle">
          <input
            type="checkbox"
            checked={settings.postProcessMask}
            onChange={(e) => onChange({ postProcessMask: e.target.checked })}
          />
          <span className="controls-bar__track" />
          <span className="controls-bar__toggle-text">
            Edge cleanup
            <span className="controls-bar__hint">Sharper mask edges (post-process)</span>
          </span>
        </label>
      </div>

      {tipOpen && (
        <p className="controls-bar__help" role="tooltip">
          {ALPHA_MATTING_TIP}
        </p>
      )}
    </section>
  )
}
