import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Close } from './Icons'

/* ── 토스트 ── */
const ToastCtx = createContext<(msg: string) => void>(() => undefined)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number>(0)
  const show = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={msg ? 'toast show' : 'toast'} role="status" aria-live="polite">
        {msg}
      </div>
    </ToastCtx.Provider>
  )
}

/* ── 아래에서 올라오는 시트(모달) ── */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="iconbtn" aria-label="닫기" onClick={onClose}>
            <Close />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

/* ── 로딩 자리표시 ── */
export function Skeleton({ rows = 3, h = 72 }: { rows?: number; h?: number }) {
  return (
    <div className="list" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skel" key={i} style={{ height: h }} />
      ))}
    </div>
  )
}

/* ── 빈 화면 안내 ── */
export function EmptyState({ icon, title, desc, action }: { icon?: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-ico">{icon}</div>}
      <div className="empty-title">{title}</div>
      {desc && <div className="empty-desc">{desc}</div>}
      {action}
    </div>
  )
}
