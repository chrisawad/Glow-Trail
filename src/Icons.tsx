import type { CSSProperties } from 'react'

export type IconName = 'help' | 'route' | 'book' | 'clock' | 'undo' | 'hint' | 'reset' | 'grid' | 'flag' | 'close' | 'check' | 'share' | 'settings' | 'install'

const lines: Record<IconName, React.ReactNode> = {
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9.4a2.6 2.6 0 1 1 4 2.2c-1.2.7-1.5 1.2-1.5 2.4"/><circle cx="12" cy="16.7" r=".55" fill="currentColor"/></>,
  route: <><circle cx="5" cy="16.5" r="2.2"/><circle cx="19" cy="7.5" r="2.2"/><path d="M5 14.2V8a3.5 3.5 0 0 1 7 0v8a3.5 3.5 0 0 0 7 0V10"/></>,
  book: <><path d="M3 5.5c3.4-.9 6.1-.5 9 1.5 2.9-2 5.6-2.4 9-1.5v13c-3.1-.8-6-.4-9 1.5-3-1.9-5.9-2.3-9-1.5z"/><path d="M12 7v13"/></>,
  clock: <><circle cx="12" cy="13.5" r="7.7"/><path d="M12 10v4l2.6 1.5M9.5 2.5h5M12 2.5v3M18.3 6.8l1.4-1.4"/></>,
  undo: <><path d="M8.5 5 3 10.5 8.5 16M3.5 10.5h9.8a6 6 0 0 1 6 6v2"/></>,
  hint: <><path d="M8.7 16.5c0-2.4-3.1-3.7-3.1-7.3A6.4 6.4 0 0 1 12 3a6.4 6.4 0 0 1 6.4 6.2c0 3.6-3.1 4.9-3.1 7.3zM9.5 19.2h5M10.8 21.7h2.4"/></>,
  reset: <><path d="M4 5v5.6h5.6M4.4 10a7.8 7.8 0 1 1-.2 5"/></>,
  grid: <><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/></>,
  flag: <><path d="M5 21V4c5-3.5 9 3.5 14 0v10c-5 3.5-9-3.5-14 0"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  check: <path d="m4.5 12.3 5 5 10-11"/>,
  share: <><circle cx="18" cy="5" r="2.8"/><circle cx="5.8" cy="12" r="2.8"/><circle cx="18" cy="19" r="2.8"/><path d="m8.2 10.6 7.4-4.2m-7.4 7 7.4 4.2"/></>,
  settings: <><path d="m14 3 .6 2.4 1.7 1 2.3-.7 2 3.5-1.7 1.6v2.3l1.7 1.6-2 3.5-2.3-.7-1.7 1L14 21h-4l-.6-2.5-1.7-1-2.3.7-2-3.5 1.7-1.6v-2.2L3.4 9.2l2-3.5 2.3.7 1.7-1L10 3z"/><circle cx="12" cy="12" r="3"/></>,
  install: <><path d="M12 3v12m-4-4 4 4 4-4M4 15v4a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-4"/></>,
}

export function Icon({name, size = 20, style}: {name: IconName; size?: number; style?: CSSProperties}) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={style}>{lines[name]}</svg>
}

export function Mark() {
  return <svg aria-hidden="true" width="43" height="42" viewBox="0 0 48 46" fill="none">
    <path d="M8 32V17c0-4.5 3-7 7-7s7 2.5 7 7v12c0 4.4 3 7 7 7s7-2.6 7-7V14" stroke="#FFAE79" strokeWidth="6" strokeLinecap="round"/>
    <path d="M22 25v4c0 4.4 3 7 7 7s7-2.6 7-7V14" stroke="#FF729A" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="8" cy="32" r="5.7" fill="#FFD585"/><circle cx="36" cy="12" r="5.6" fill="#FF80A3"/>
    <circle cx="8" cy="32" r="1.7" fill="#302741"/><circle cx="36" cy="12" r="1.7" fill="#302741"/>
  </svg>
}
