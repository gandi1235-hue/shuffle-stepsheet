const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const Back = () => <svg {...base}><path d="M15 5l-7 7 7 7" /></svg>
export const Close = () => <svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const Search = () => <svg {...base}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
export const Plus = () => <svg {...base} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
export const Folder = () => <svg {...base} style={{ color: 'var(--accent)' }}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
export const Shared = () => <svg {...base} style={{ color: 'var(--accent)' }}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="15" cy="13" r="2" /><circle cx="10" cy="13" r="2" /></svg>
export const Play = () => <svg {...base} fill="currentColor" stroke="none"><path d="M7 4l12 8-12 8z" /></svg>
export const Pause = () => <svg {...base} fill="currentColor" stroke="none"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
export const Photo = () => <svg {...base}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></svg>
export const Edit = () => <svg {...base}><path d="M4 20h4l10-10-4-4L4 16v4z" /><path d="M13 7l4 4" /></svg>
export const Share = () => <svg {...base}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" /></svg>
export const Music = () => <svg {...base}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
export const Chevron = ({ open }: { open?: boolean }) => <svg {...base} style={{ transform: open ? 'rotate(90deg)' : undefined }}><path d="M9 6l6 6-6 6" /></svg>
export const Camera = () => <svg {...base}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
export const User = () => <svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
export const People = () => <svg {...base}><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" /><path d="M16 14.5c3 0 6 1.5 6 4.5" /></svg>
