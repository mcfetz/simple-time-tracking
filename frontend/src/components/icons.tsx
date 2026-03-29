import type { ReactNode } from 'react'

export type IconProps = {
  title?: string
  className?: string
}

function SvgIcon({ title, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

export function IconToday(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
      <path d="M10 21v-6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6" />
    </SvgIcon>
  )
}

export function IconHistory(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </SvgIcon>
  )
}

export function IconReports(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 19.5h16" />
      <path d="M7 16v-5" />
      <path d="M12 16v-8" />
      <path d="M17 16v-3" />
    </SvgIcon>
  )
}

export function IconAbsences(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M7 3v3" />
      <path d="M17 3v3" />
      <path d="M4 10h16" />
      <rect x="4" y="6" width="16" height="16" rx="2" />
      <path d="M8 16h8" />
    </SvgIcon>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 6h11" />
      <path d="M4 12h16" />
      <path d="M4 18h13" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="9" cy="18" r="2" />
      <circle cx="14" cy="12" r="2" />
    </SvgIcon>
  )
}

export function IconPencil(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      <path d="m15 5 3 3" />
    </SvgIcon>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </SvgIcon>
  )
}
