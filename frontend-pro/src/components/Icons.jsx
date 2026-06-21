const defaults = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function LogoMark({ size = 20, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <rect x="7" y="9" width="12" height="12" rx="2.75" opacity="0.28" />
      <rect x="4" y="5" width="13" height="13" rx="3" />
      <circle cx="10.5" cy="9.25" r="1.75" fill="currentColor" stroke="none" />
      <path d="M7.25 15.25c.6-2.2 1.85-3.5 3.25-3.5s2.65 1.3 3.25 3.5" />
    </svg>
  )
}

export function IconPhotoUpload({ size = 40, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="m3.5 15.5 4.2-4.2a1.2 1.2 0 0 1 1.7 0l2.4 2.4" />
      <path d="M12.5 14 15.2 11.3a1.2 1.2 0 0 1 1.7 0L20.5 15" />
      <path d="M12 3.5v3" />
      <path d="M9.5 5 12 3.5 14.5 5" />
    </svg>
  )
}

export function IconBatch({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <rect x="4" y="5" width="13" height="13" rx="2.5" />
      <path d="M9 9h7M9 12.5h7M9 16h4" />
      <path d="M18 8v11a1.5 1.5 0 0 1-1.5 1.5H7" opacity="0.45" />
    </svg>
  )
}

export function IconTag({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="M4 12.5V6.8a1.8 1.8 0 0 1 1.8-1.8H11l8.2 8.2a1.2 1.2 0 0 1 0 1.7l-4.3 4.3a1.2 1.2 0 0 1-1.7 0L4 12.5Z" />
      <circle cx="8.25" cy="8.25" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconMac({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <rect x="4" y="6" width="16" height="11" rx="2" />
      <path d="M8 19.5h8" />
    </svg>
  )
}

export function IconPerson({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M6.5 19.5c.8-3 2.6-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
    </svg>
  )
}

export function IconWand({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="m4 20 7-7" />
      <path d="M14.5 6.5 17.5 3.5a2.1 2.1 0 0 1 3 3L17.5 9.5" />
      <path d="m11 10 3 3" />
      <path d="M5.5 4.5 4 3M7 2v2M4 7H2M6.8 6.8 5.5 5.5" />
    </svg>
  )
}

export function IconSave({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="M7 4.5h7l3.5 3.5V19.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
      <path d="M14 4.5V8h3.5" />
      <path d="M12 11v5" />
      <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
    </svg>
  )
}

export function IconDownload({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="M12 4.5v9" />
      <path d="m8.5 11 3.5 3.5L15.5 11" />
      <path d="M5 18.5h14" />
    </svg>
  )
}

export function IconPlusPhoto({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <rect x="4" y="6" width="13" height="13" rx="2.5" />
      <path d="M12 9v6M9 12h6" />
      <path d="M18 8.5V6.8a1.8 1.8 0 0 0-1.8-1.8H16" opacity="0.45" />
    </svg>
  )
}

export function IconImage({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m4 16 4.5-4.5a1.2 1.2 0 0 1 1.7 0L14 15.5" />
      <path d="M13 14.5 15.8 11.8a1.2 1.2 0 0 1 1.7 0L20 14.5" />
    </svg>
  )
}

export function IconSplit({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M12 6v12" />
    </svg>
  )
}

export function IconSlider({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="M8 8h12M4 12h16M10 16h10" />
      <circle cx="6" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="6" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconZoom({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4.5 4.5" />
      <path d="M11 8.5v5M8.5 11h5" />
    </svg>
  )
}

export function IconCheck({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.2 2.2L15.8 9.5" />
    </svg>
  )
}

export function IconWarning({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="M12 5.5 4.5 18.5h15L12 5.5Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconError({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.5v5" />
      <circle cx="12" cy="15.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconInfo({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconSparkle({ size = 32, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.8 10.4 12.2 5 10.6 10.4 9Z" />
      <path d="M18.5 4.5 19 6.3 20.8 6.8 19 7.3 18.5 9.1 18 7.3 16.2 6.8 18 6.3Z" opacity="0.7" />
    </svg>
  )
}

export function IconClose({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="m8 8 8 8" />
      <path d="m16 8-8 8" />
    </svg>
  )
}

export function IconSun({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} strokeWidth={2} {...props}>
      <circle cx="12" cy="12" r="4.25" />
      <path d="M12 2.75v2.75M12 18.5v2.75M5.2 5.2l1.95 1.95M16.85 16.85l1.95 1.95M2.75 12h2.75M18.5 12h2.75M5.2 18.8l1.95-1.95M16.85 7.15l1.95-1.95" />
    </svg>
  )
}

export function IconMoon({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        stroke="none"
        d="M12.4 2.1a9.9 9.9 0 1 0 8.8 16.4 6.9 6.9 0 1 1-8.8-16.4Z"
      />
    </svg>
  )
}

export function IconErase({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="m14.5 6.5 3 3L9 18H6v-3l8.5-8.5Z" />
      <path d="M12.5 8.5 15.5 11.5" />
    </svg>
  )
}

export function IconRestore({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="M4 12a8 8 0 0 1 13.3-6" />
      <path d="M17.3 6H14V2.7" />
      <path d="M20 12a8 8 0 0 1-13.3 6" />
      <path d="M6.7 18H10v3.3" />
    </svg>
  )
}

export function IconUndo({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="M9 5 4 10l5 5" />
      <path d="M20 14a7 7 0 0 0-12-4.5" />
    </svg>
  )
}

export function IconRedo({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="m15 5 5 5-5 5" />
      <path d="M4 14a7 7 0 0 1 12-4.5" />
    </svg>
  )
}

export function IconPan({ size = 14, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="M8 11V7.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M11 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 11V7.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M6 11v-1a1.5 1.5 0 0 1 3 0v4.5" />
      <path d="M7.5 15.5 12 20l4.5-4.5" />
    </svg>
  )
}

export function IconEdit({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="M16.5 4.5 19.5 7.5 9 18H6v-3l10.5-10.5Z" />
      <path d="M14 6.5 17.5 10" />
    </svg>
  )
}

export function IconStartOver({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...defaults} {...props}>
      <path d="M4 7.5V4.5h3" />
      <path d="M4.5 8.5a8 8 0 1 1 2.1 5.6" />
    </svg>
  )
}
