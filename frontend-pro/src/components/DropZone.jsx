import { useRef, useState, useCallback } from 'react'
import { IconPhotoUpload } from './Icons'
import { ACCEPTED_EXT } from '../utils/format'

export default function DropZone({ onFiles, multiple = false, label = 'Drop your photo here' }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = useCallback(
    (fileList) => {
      if (!fileList?.length) return
      const files = multiple ? Array.from(fileList) : [fileList[0]]
      onFiles(files)
    },
    [onFiles, multiple],
  )

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      className={`dropzone ${dragOver ? 'dropzone--active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXT}
        multiple={multiple}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="dropzone__icon">
        <IconPhotoUpload size={40} />
      </div>
      <p className="dropzone__label">{label}</p>
      <p className="dropzone__hint">
        JPG, PNG, WEBP, or HEIC
        <span className="dropzone__hint-sub">Drag & drop, or click to browse</span>
      </p>
    </div>
  )
}
