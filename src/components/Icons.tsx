const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const Back = () => <svg {...base}><path d="M15 5l-7 7 7 7" /></svg>
export const Close = () => <svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const Search = () => <svg {...base}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
export const Plus = () => <svg {...base} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
export const Folder = () => <svg {...base}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
export const Shared = () => <svg {...base}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="15" cy="13" r="2" /><circle cx="10" cy="13" r="2" /></svg>
export const Play = () => <svg {...base} fill="currentColor" stroke="none"><path d="M7 4l12 8-12 8z" /></svg>
export const Pause = () => <svg {...base} fill="currentColor" stroke="none"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
export const Photo = () => <svg {...base}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></svg>
export const More = () => <svg {...base}><circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" /></svg>
export const Doc = () => <svg {...base}><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5" /><path d="M9 13h7M9 17h7" /></svg>
export const Copy = () => <svg {...base}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></svg>
export const Edit = () => <svg {...base}><path d="M4 20h4l10-10-4-4L4 16v4z" /><path d="M13 7l4 4" /></svg>
export const Share = () => <svg {...base}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" /></svg>
export const Music = () => <svg {...base}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
export const Chevron = ({ open }: { open?: boolean }) => <svg {...base} style={{ transform: open === true ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}><path d="M9 6l6 6-6 6" /></svg>
export const Camera = () => <svg {...base}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
export const User = () => <svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
export const Chat = () => <svg {...base}><path d="M4 5h16v11H9l-5 4z" /></svg>
export const Mic = () => <svg {...base}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
export const People = () => <svg {...base}><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" /><path d="M16 14.5c3 0 6 1.5 6 4.5" /></svg>
export const Print = () => <svg {...base}><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></svg>
export const Gear = () => <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>

export const Dancer = () => (
  <svg viewBox="0 0 64 64" width="24" height="24" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 18 L28.5 33" />
      <path d="M31 21 L40.5 13.5 L50 9.5" />
      <path d="M31 22 L22 27.5 L15.5 22" />
      <path d="M28.5 33 L39.5 41.5 L50.5 36" />
      <path d="M28.5 33 L23.5 45.5 L30 55.5" />
    </g>
    <circle cx="34" cy="11.5" r="5.3" fill="currentColor" />
  </svg>
)

/** 앱 로고 (검정 바탕 + 빨간 춤추는 사람) + 워드마크 */
export const Brand = ({ size = 26 }: { size?: number }) => (
  <span className="brandmark" style={{ ['--bs' as string]: `${size}px` }}>
    <span className="brandmark-ico">
      <Dancer />
    </span>
    <span className="brandmark-word">
      Shuffle<b>Box</b>
    </span>
  </span>
)
export const LayoutTop = () => <svg {...base}><rect x="3" y="4" width="18" height="7" rx="2" /><path d="M3 15h18M3 19h12" /></svg>
export const LayoutSide = () => <svg {...base}><rect x="3" y="5" width="10" height="14" rx="2" /><path d="M16 7h5M16 11h5M16 15h5" /></svg>
