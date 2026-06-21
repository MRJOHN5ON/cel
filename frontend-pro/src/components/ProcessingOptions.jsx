export default function ProcessingOptions({ settings, onChange, models }) {
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
    </section>
  )
}
