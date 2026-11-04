import { useEffect, useState } from 'react'

export type FontSize = 'normal' | 'large' | 'xlarge'
export interface Prefs {
  font: FontSize
  contrast: boolean
}
const KEY = 'prefs'
const DEFAULT: Prefs = { font: 'normal', contrast: false }

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT
  }
}

const ZOOM: Record<FontSize, number> = { normal: 1, large: 1.12, xlarge: 1.25 }
let zoom = 1
let listening = false

/** CSS zoom을 쓰면 vh 단위가 틀어져서, 실제 화면 높이를 변수(--app-h)로 직접 넣어 준다 */
function setViewportVar() {
  document.documentElement.style.setProperty('--app-h', `${Math.round(window.innerHeight / zoom)}px`)
}

export function applyPrefs(p: Prefs) {
  const el = document.documentElement
  el.dataset.font = p.font
  el.dataset.contrast = p.contrast ? 'high' : 'normal'
  zoom = ZOOM[p.font]
  setViewportVar()
  if (!listening) {
    listening = true
    window.addEventListener('resize', setViewportVar)
    window.visualViewport?.addEventListener('resize', setViewportVar)
  }
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  useEffect(() => applyPrefs(prefs), [prefs])
  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch }
    localStorage.setItem(KEY, JSON.stringify(next))
    setPrefs(next)
  }
  return [prefs, update]
}

/** 짧은 진동 피드백 (지원 기기에서만) */
export function haptic(ms: number | number[] = 12) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* 무시 */
  }
}
